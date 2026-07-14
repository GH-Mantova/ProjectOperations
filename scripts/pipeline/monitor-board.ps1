# ONE MONITOR PASS over the board + the watcher.
#
# - rebases anything that fell BEHIND (BEHIND is not a failure, it is a rebase)
# - re-arms auto-merge on anything that lost it
# - surfaces every FAILING check with the exact command to read its log
# - NEVER merges the NEVER list
#
# Pure ASCII. Safe to run repeatedly.

$ErrorActionPreference = "Continue"
Set-Location "C:\po-watcher\ProjectOperations"

$NEVER = @(552, 538)

function Assert-Mergeable([int]$n) {
    if ($NEVER -contains $n) { throw ("REFUSING #" + $n + " - NEVER list.") }
}

Write-Output ("===== " + (Get-Date -Format "HH:mm:ss") + "  MONITOR PASS")

# --- watcher health (must stay alive; do not kill a BUSY one) --------------
$hb = "C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log"
$hbAge = 99999
if (Test-Path $hb) { $hbAge = [math]::Round(((Get-Date) - (Get-Item $hb).LastWriteTime).TotalMinutes, 0) }
$proc = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -EA SilentlyContinue |
        Where-Object { $_.CommandLine -like "*pr-watcher*" }
$armed = @(Get-ChildItem "C:\ProjectOperations2\docs\pr-prompts" -Filter "*-ready.md" -EA SilentlyContinue)
Write-Output ("WATCHER: " + $(if ($proc) { "alive (pid " + $proc.ProcessId + ")" } else { "not running" }) +
              " | heartbeat " + $hbAge + "m | armed prompts " + $armed.Count)

# --- board ------------------------------------------------------------------
$raw = gh pr list --state open --limit 40 --json number,title,mergeStateStatus,autoMergeRequest | ConvertFrom-Json
if (-not $raw) { Write-Output "BOARD: no open PRs. ALL MERGED."; exit 0 }

$open = @()
foreach ($p in $raw) { $open += $p }
Write-Output ("BOARD: " + $open.Count + " open")
Write-Output ""

$actionable = 0

foreach ($p in ($open | Sort-Object { [int]$_.number })) {
    $n = [int]$p.number
    $state = $p.mergeStateStatus
    $auto = ($null -ne $p.autoMergeRequest)
    $isHeld = ($NEVER -contains $n)

    $tag = if ($isHeld) { "HELD" } else { "    " }
    Write-Output ("#" + $n + " [" + $state.PadRight(8) + "] auto=" + $auto + " " + $tag)

    if ($isHeld) { continue }

    # failing checks?
    $checks = gh pr checks $n --json name,state,link 2>$null | ConvertFrom-Json
    $failed = @()
    foreach ($c in $checks) { if ($c.state -in @("FAILURE","ERROR","CANCELLED","TIMED_OUT")) { $failed += $c } }
    $running = @()
    foreach ($c in $checks) { if ($c.state -in @("PENDING","QUEUED","IN_PROGRESS","EXPECTED")) { $running += $c } }

    # A FAILURE is only real if its run has COMPLETED.
    #
    # While a new run is in flight, `gh pr checks` still reports the PREVIOUS run's conclusion for
    # that check name. Acting on it means chasing a failure that has already been fixed - the same
    # "trusted a stale state over live state" error that has cost this project hours.
    # Verify against the run's actual status before calling anything broken.
    $realFailed = @()
    foreach ($f in $failed) {
        if ($f.link -match "runs/(\d+)/") {
            $status = gh run view $Matches[1] --json status -q .status 2>$null
            if ($status -ne "completed") {
                Write-Output ("      (stale FAILURE on " + $f.name + " - a new run is still in progress. Ignoring.)")
                $running += $f
                continue
            }
        }
        $realFailed += $f
    }
    $failed = $realFailed

    if ($failed.Count -gt 0) {
        $actionable++
        foreach ($f in $failed) {
            Write-Output ("      FAILING (confirmed, run completed): " + $f.name)
            Write-Output ("        log: " + $f.link)
        }
    } elseif ($running.Count -gt 0) {
        Write-Output ("      " + $running.Count + " check(s) still running: " + (($running | ForEach-Object { $_.name }) -join ", "))
    }

    if ($state -eq "DIRTY") {
        $actionable++
        Write-Output "      DIRTY - needs conflict resolution in a worktree."
        continue
    }

    # ONLY rebase when there is nothing running.
    #
    # BUG I CAUSED (2026-07-14): rebasing on every pass while checks were IN_PROGRESS pushed a new
    # commit, retriggered CI, left the PR BLOCKED, and the next pass rebased AGAIN. A self-inflicted
    # loop - the exact churn this whole pipeline exists to stop. BLOCKED + checks running = WAIT.
    if ($running.Count -gt 0) {
        Write-Output "      checks in flight -> WAIT. (Rebasing now would just retrigger them.)"
    }
    elseif ($state -eq "BEHIND" -and $failed.Count -eq 0) {
        Write-Output "      BEHIND with no checks running -> rebasing."
        gh pr update-branch $n 2>&1 | Out-Null
        $actionable++
    }

    if (-not $auto -and $failed.Count -eq 0 -and $state -ne "DIRTY") {
        Assert-Mergeable $n
        gh pr merge $n --squash --auto --delete-branch 2>&1 | Out-Null
        Write-Output "      auto-merge re-armed."
        $actionable++
    }
}

Write-Output ""
$remaining = @($open | Where-Object { $NEVER -notcontains [int]$_.number })
if ($remaining.Count -eq 0) {
    Write-Output "=== ALL MERGEABLE PRs ARE MERGED. Only the HELD ones remain (Marco's call)."
} else {
    Write-Output ("=== " + $remaining.Count + " PR(s) still in flight. Actions taken this pass: " + $actionable)
}
