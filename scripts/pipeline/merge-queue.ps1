# SERIALIZED MERGE QUEUE - rebase-then-verify. Never abort on BEHIND.
#
# THE RULE: "BEHIND is not a failure. It is a rebase."
#
# 40 of 194 historical failures were this: main moves while a PR sits in the queue, the job
# ABORTS on BEHIND, and nothing ever merges. PR #503 aborted FOUR times with all seven checks
# green every single time.
#
# Every merge invalidates the mergeability of every other open PR. Hence SERIALIZED: one PR at
# a time, re-reading the board after each merge.
#
# ---------------------------------------------------------------------------------------------
# BUG THAT NEARLY MERGED PRODUCTION DATA (2026-07-14) - read before touching this file:
#
#   In PowerShell 5.1, `ConvertFrom-Json` on a JSON ARRAY emits ONE object (the whole array),
#   NOT a stream of objects. So:
#       gh pr list --json ... | ConvertFrom-Json | Where-Object { $NEVER -notcontains $_.number }
#   passes a SINGLE item whose .number is an ARRAY of every number. `-notcontains <array>` is
#   trivially true, so THE FILTER SILENTLY DOES NOTHING and every PR passes through.
#
#   This selected #552 (writes production data) for merge. It survived only because #552 was
#   BEHIND, so the script rebased first and was killed before the merge call.
#
#   FIX 1: force enumeration with @( ... ) and filter the VARIABLE, never the pipeline.
#   FIX 2: guard at the POINT OF ACTION, not only at selection. A selection filter is one line
#          away from being wrong; the merge call itself must refuse.
# ---------------------------------------------------------------------------------------------
#
# Pure ASCII.

param(
    [switch]$Execute,
    [int]$MaxWaitMin = 20
)

$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

# NEVER auto-merge these.
#   552 = writes production data (INSERTs rate rows) -> Marco reviews the SQL
#   538 = needs a real Microsoft account on a real shared PC -> no agent can smoke it
$NEVER = @(552, 538)

function Assert-Mergeable([int]$n) {
    # THE LAST LINE OF DEFENCE. Runs immediately before every merge.
    if ($NEVER -contains $n) {
        throw ("REFUSING TO MERGE #" + $n + " - it is on the NEVER list (production data / human smoke required). " +
               "If the selection filter let it through, the selection filter is broken.")
    }
}

function Get-Board {
    # ASSIGN, then foreach. Do NOT pipe ConvertFrom-Json straight into Where-Object, and do NOT
    # wrap it in @( ) either:
    #   - piping    -> Where-Object sees ONE item (the whole array); the filter is a silent no-op
    #   - @( )      -> wraps that single array object in a 1-element array; $p.number is Object[]
    # Plain assignment + foreach enumerates correctly in PS 5.1. Verified.
    $raw = gh pr list --state open --limit 40 --json number,title,mergeStateStatus | ConvertFrom-Json
    $out = @()
    foreach ($p in $raw) {
        if ($NEVER -contains [int]$p.number) { continue }
        $out += $p
    }
    return ($out | Sort-Object { [int]$_.number })
}

function Wait-ForChecks([int]$n, [int]$maxMin) {
    $deadline = (Get-Date).AddMinutes($maxMin)
    while ((Get-Date) -lt $deadline) {
        $checks = @(gh pr checks $n --json name,state 2>$null | ConvertFrom-Json)
        if ($checks.Count -eq 0) { Start-Sleep -Seconds 20; continue }

        $pending = @($checks | Where-Object { $_.state -in @("PENDING","QUEUED","IN_PROGRESS","EXPECTED") })
        $failed  = @($checks | Where-Object { $_.state -in @("FAILURE","ERROR","CANCELLED","TIMED_OUT") })

        if ($failed.Count -gt 0) {
            Write-Output ("      CHECKS FAILED: " + (($failed | ForEach-Object { $_.name }) -join ", "))
            Write-Output "      Read the job log before diagnosing. Never guess from the diff."
            return $false
        }
        if ($pending.Count -eq 0) { return $true }
        Write-Output ("      waiting on " + $pending.Count + " check(s)...")
        Start-Sleep -Seconds 30
    }
    Write-Output "      TIMEOUT waiting for checks."
    return $false
}

Write-Output "=== SERIALIZED MERGE QUEUE"
Write-Output ("    NEVER-merge list: " + (($NEVER | ForEach-Object { "#" + $_ }) -join " "))
if (-not $Execute) { Write-Output "    (DRY RUN - re-run with -Execute)" }
Write-Output ""

$merged = @()
$stuck  = @()

for ($cycle = 1; $cycle -le 12; $cycle++) {
    $board = @(Get-Board)
    # BLOCKED usually means "required checks have not reported on the current head" - i.e. main
    # moved under it. That is the SAME rebase case as BEHIND. Wait-ForChecks still gates the
    # merge, so if BLOCKED really means "a check is failing", we stop there rather than merge.
    $candidates = @($board | Where-Object {
        $_.mergeStateStatus -in @("CLEAN","BEHIND","UNSTABLE","BLOCKED") -and $stuck -notcontains [int]$_.number
    })
    if ($candidates.Count -eq 0) { break }

    $p = $candidates[0]
    $n = [int]$p.number
    Assert-Mergeable $n          # <-- refuses even if selection is wrong

    Write-Output ("--- cycle " + $cycle + ": #" + $n + " [" + $p.mergeStateStatus + "] " + $p.title)

    if ($p.mergeStateStatus -in @("BEHIND","BLOCKED")) {
        Write-Output "      main moved under it -> rebasing (NOT aborting). BEHIND is not a failure."
        if (-not $Execute) { Write-Output "      DRY RUN"; $stuck += $n; continue }
        gh pr update-branch $n 2>&1 | ForEach-Object { Write-Output ("      " + $_) }
        Start-Sleep -Seconds 15
    }

    if (-not (Wait-ForChecks $n $MaxWaitMin)) { $stuck += $n; continue }

    if (-not $Execute) { Write-Output "      DRY RUN - would merge"; $stuck += $n; continue }

    Assert-Mergeable $n          # <-- and again, immediately before the irreversible call
    $out = gh pr merge $n --squash --delete-branch 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Output ("      MERGED #" + $n)
        $merged += $n
        Start-Sleep -Seconds 8   # let main settle; every merge re-dirties the rest
    } else {
        Write-Output "      merge refused:"
        $out | ForEach-Object { Write-Output ("        " + $_) }
        $stuck += $n
    }
    Write-Output ""
}

Write-Output "=== RESULT"
Write-Output ("  merged: " + $(if ($merged.Count) { ($merged | ForEach-Object { "#" + $_ }) -join " " } else { "none" }))
Write-Output ("  stuck : " + $(if ($stuck.Count)  { ($stuck  | ForEach-Object { "#" + $_ }) -join " " } else { "none" }))
Write-Output ""
Write-Output "  DIRTY PRs need conflict resolution in a worktree - not this script."
