# PREFLIGHT â€” run this BEFORE touching ANY staged prompt, branch, or PR.
#
# MARCO'S STANDING INSTRUCTION (2026-07-14):
#   "ALWAYS check both the watcher, the supervisor, and GitHub BEFORE trying to make changes to any
#    staged PR. The supervisor is doing its job â€” don't merge anything yourself."
#
# WHY THIS EXISTS â€” I broke the concurrency rule TWICE in one afternoon, having written it myself:
#   1. I staged pr-b1/pr-b2 while the SUPERVISOR was concurrently staging pr-a1b/pr-a2b for the SAME
#      work. Two prompts, one job, two PRs, guaranteed conflict.
#   2. I edited PR #570 while it was MERGING under me. Auto-merge fired, deleted the branch, and my
#      push silently recreated it as an ORPHAN with no PR. The commit looked clean. The work was
#      nowhere.
#
# "Claim before you act" was already the rule. Writing it down did not make me do it. So it is now
# a COMMAND you run, not an intention you hold.
#
#   .\preflight.ps1              # is anything else working right now?
#   .\preflight.ps1 -PR 569      # ...and specifically, is it safe to touch PR #569?
param([int]$PR = 0)

$ErrorActionPreference = "Continue"
$busy = @()

Write-Host "=============== PREFLIGHT ===============" -ForegroundColor Cyan

# ---------------------------------------------------------------------------------------------
# 1. THE WATCHER â€” is it mid-run on a prompt?
# ---------------------------------------------------------------------------------------------
Write-Host ""
Write-Host "1. WATCHER"
$watcherAlive = $false
foreach ($proc in (Get-CimInstance Win32_Process -Filter "Name='node.exe'")) {
    if (("" + $proc.CommandLine) -match "pr-watcher.index.mjs") {
        $watcherAlive = $true
        Write-Host ("   ALIVE  pid " + $proc.ProcessId)
    }
}
if (-not $watcherAlive) { Write-Host "   NOT RUNNING" }

$hb = "C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log"
if (Test-Path $hb) {
    $ageMin = [int]((Get-Date) - (Get-Item $hb).LastWriteTime).TotalMinutes
    $last = (Get-Content $hb -Tail 1)
    Write-Host ("   heartbeat: " + $ageMin + " min ago")
    if ($ageMin -le 3) {
        Write-Host ("   >>> MID-RUN: " + $last) -ForegroundColor Yellow
        $busy += "the WATCHER is mid-run on a prompt"
    }
}

# The watcher's repo being on a FEATURE BRANCH is NORMAL. Mid-merge/rebase is NOT.
Set-Location "C:\po-watcher\ProjectOperations"
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$midMerge = (Test-Path ".git\MERGE_HEAD") -or (Test-Path ".git\rebase-merge") -or (Test-Path ".git\rebase-apply")
Write-Host ("   repo on: " + $branch + $(if ($midMerge) { "   *** MID-MERGE/REBASE - CORRUPT" } else { "   (a feature branch here is NORMAL)" }))
if ($midMerge) { $busy += "the watcher's repo is MID-MERGE (corrupt)" }

# ---------------------------------------------------------------------------------------------
# 2. THE SUPERVISOR â€” is a scheduled station running right now?
# ---------------------------------------------------------------------------------------------
Write-Host ""
Write-Host "2. SCHEDULED STATIONS"
$stationBusy = $false
foreach ($proc in (Get-CimInstance Win32_Process -Filter "Name='claude.exe'")) {
    $started = $proc.CreationDate
    if ($started) {
        $ageMin = [int]((Get-Date) - $started).TotalMinutes
        if ($ageMin -lt 30) {
            Write-Host ("   claude.exe pid " + $proc.ProcessId + "  started " + $ageMin + " min ago")
            $stationBusy = $true
        }
    }
}
if ($stationBusy) {
    Write-Host "   >>> A station (supervisor / scanner / sot-keeper) may be MID-RUN." -ForegroundColor Yellow
    Write-Host "   >>> It may be staging prompts or driving PRs RIGHT NOW."
    $busy += "a scheduled station appears to be mid-run"
} else {
    Write-Host "   no recently-started station process"
}

# ---------------------------------------------------------------------------------------------
# 3. GITHUB â€” what is the board actually doing?
# ---------------------------------------------------------------------------------------------
Write-Host ""
Write-Host "3. GITHUB"
Set-Location "C:\po-fix"
git fetch origin --quiet
$board = (gh pr list --state open --json "number,title,mergeStateStatus,autoMergeRequest" | Out-String) | ConvertFrom-Json
# NOTE: this loop variable is $openPr, NOT $pr. PowerShell variables are CASE-INSENSITIVE, so a
# loop over `$pr` would silently OVERWRITE the `-PR` parameter. That is DOCTRINE section 7 lie #5
# ($c clobbering $C), and I committed it here first time - inside the very script written to stop it.
foreach ($openPr in @($board)) {
    $auto = if ($openPr.autoMergeRequest) { "AUTO-MERGE ARMED" } else { "" }
    Write-Host ("   #" + $openPr.number + "  " + $openPr.mergeStateStatus.PadRight(9) + $auto)
}
Write-Host ("   open: " + @($board).Count)

# ---------------------------------------------------------------------------------------------
# 4. THE SPECIFIC PR
# ---------------------------------------------------------------------------------------------
if ($PR -gt 0) {
    Write-Host ""
    Write-Host ("4. PR #" + $PR)
    $target = ((gh pr view $PR --json state,mergeStateStatus,autoMergeRequest,headRefOid | Out-String) | ConvertFrom-Json)
    Write-Host ("   state = " + $target.state)
    if ($target.state -ne "OPEN") {
        Write-Host ("   >>> #" + $PR + " is " + $target.state + " - DO NOT PUSH TO IT.") -ForegroundColor Red
        Write-Host "   >>> Its branch is probably DELETED. A push would recreate it as an ORPHAN"
        Write-Host "   >>> with no PR - the commit looks clean and the work goes NOWHERE. (Happened on #570.)"
        $busy += ("#" + $PR + " is already " + $target.state)
    } else {
        if ($target.autoMergeRequest) {
            Write-Host "   >>> AUTO-MERGE IS ARMED. It can merge and delete the branch AT ANY MOMENT." -ForegroundColor Yellow
            Write-Host "   >>> If you push, re-verify the PR head afterwards. Do not assume."
            $busy += ("#" + $PR + " has auto-merge armed and may vanish mid-edit")
        }
        $checks = (gh pr checks $PR --json "state" | Out-String) | ConvertFrom-Json
        $running = @($checks | Where-Object { $_.state -eq "PENDING" -or $_.state -eq "IN_PROGRESS" }).Count
        if ($running -gt 0) {
            Write-Host ("   >>> " + $running + " check(s) IN FLIGHT. Do NOT rebase - it restarts CI and loops.") -ForegroundColor Yellow
            $busy += ("#" + $PR + " has checks in flight")
        }
    }
}

# ---------------------------------------------------------------------------------------------
Write-Host ""
Write-Host "=============== VERDICT ===============" -ForegroundColor Cyan
if ($busy.Count -eq 0) {
    Write-Host "SAFE TO ACT - nothing else appears to be working." -ForegroundColor Green
    Write-Host "Still: claim before you act. Re-grep the queue for the artifact before staging."
    exit 0
}
Write-Host "DO NOT ACT. Something else is working:" -ForegroundColor Red
foreach ($reason in $busy) { Write-Host ("  - " + $reason) -ForegroundColor Red }
Write-Host ""
Write-Host "Wait for it to finish, then re-run. Marco's standing instruction: the supervisor drives"
Write-Host "the board. Do not merge PRs yourself, and do not edit a PR something else is holding."
exit 1
