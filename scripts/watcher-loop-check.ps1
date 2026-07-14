# Read-only loop / stall check across the watcher and the PR-prompt queue.
# Pure ASCII. Touches nothing.

$ErrorActionPreference = "Continue"
$Q = "C:\ProjectOperations2\docs\pr-prompts"

Write-Output ("=== NOW: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  (local)")
Write-Output ""

Write-Output "=== NODE / CLAUDE PROCESSES (is the watcher alive? are agents piling up?)"
$procs = Get-Process -Name node,claude,pwsh,powershell -ErrorAction SilentlyContinue |
    Sort-Object StartTime |
    Select-Object Name, Id, @{N="StartedAt";E={$_.StartTime}}, @{N="CPU_s";E={[math]::Round($_.CPU,0)}}, @{N="RAM_MB";E={[math]::Round($_.WorkingSet64/1MB,0)}}
if ($procs) { $procs | Format-Table -AutoSize | Out-String -Width 160 | Write-Output }
else { Write-Output "  (none)" }

Write-Output ""
Write-Output "=== LONG-RUNNING (> 45 min) - a stuck agent looks like this"
$cut = (Get-Date).AddMinutes(-45)
$old = Get-Process -Name node,claude -ErrorAction SilentlyContinue | Where-Object { $_.StartTime -lt $cut }
if ($old) {
    $old | Select-Object Name, Id, @{N="StartedAt";E={$_.StartTime}}, @{N="RunningMins";E={[math]::Round(((Get-Date) - $_.StartTime).TotalMinutes,0)}}, @{N="CPU_s";E={[math]::Round($_.CPU,0)}} |
        Format-Table -AutoSize | Out-String -Width 160 | Write-Output
    Write-Output "  ^^ INVESTIGATE. A 75-min run means a hang, not slow tests (see sot/05)."
} else {
    Write-Output "  none - nothing has been running longer than 45 minutes"
}

Write-Output ""
Write-Output "=== QUEUE STATE"
$ready = @(Get-ChildItem -Path $Q -Filter "*-ready.md" -File -ErrorAction SilentlyContinue)
Write-Output ("  armed (waiting):  " + $ready.Count)
foreach ($f in $ready) { Write-Output ("      " + $f.Name) }

Write-Output ""
Write-Output "=== LAST 6 PROCESSED (is the queue MOVING? same file twice = loop)"
Get-ChildItem -Path (Join-Path $Q "processed") -Filter "*.md" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 6 |
    Select-Object @{N="At";E={$_.LastWriteTime.ToString("HH:mm")}}, Name |
    Format-Table -AutoSize | Out-String -Width 160 | Write-Output

Write-Output "=== LOOP SIGNAL: any prompt processed MORE THAN ONCE?"
$dupes = Get-ChildItem -Path (Join-Path $Q "processed") -Filter "*.md" -File -ErrorAction SilentlyContinue |
    Group-Object BaseName | Where-Object { $_.Count -gt 1 }
if ($dupes) { $dupes | Select-Object Count, Name | Format-Table -AutoSize | Out-String -Width 160 | Write-Output }
else { Write-Output "  none - no prompt has been processed twice" }

Write-Output ""
Write-Output "=== SILENT NO-OPS (agent exited 0 but opened no PR)"
$nop = @(Get-ChildItem -Path (Join-Path $Q "no-pr-opened") -Filter "*.md" -File -ErrorAction SilentlyContinue)
if ($nop.Count -gt 0) { foreach ($f in $nop) { Write-Output ("  " + $f.LastWriteTime.ToString("MM-dd HH:mm") + "  " + $f.Name) } }
else { Write-Output "  none" }

Write-Output ""
Write-Output "=== NEEDS-MARCO (escalations waiting)"
$nm = @(Get-ChildItem -Path (Join-Path $Q "needs-marco") -Filter "*.md" -File -ErrorAction SilentlyContinue)
if ($nm.Count -gt 0) { foreach ($f in $nm) { Write-Output ("  " + $f.Name) } }
else { Write-Output "  none" }

Write-Output ""
Write-Output "=== ORPHANED WORKTREES (rule-6b apitest scratch left behind by an aborted run)"
if (Test-Path "C:\po-worktrees") {
    $wt = @(Get-ChildItem -Path "C:\po-worktrees" -Directory -ErrorAction SilentlyContinue)
    if ($wt.Count -gt 0) { foreach ($d in $wt) { Write-Output ("  " + $d.LastWriteTime.ToString("MM-dd HH:mm") + "  " + $d.Name) } }
    else { Write-Output "  none" }
} else { Write-Output "  C:\po-worktrees does not exist" }

Write-Output ""
Write-Output "=== WATCHER REPO INTEGRITY (an agent left this mid-merge on 2026-07-13 and killed the queue)"
Set-Location "C:\po-watcher\ProjectOperations"
$repoBranch  = (git rev-parse --abbrev-ref HEAD)
$midMerge    = Test-Path ".git\MERGE_HEAD"
$midRebase   = (Test-Path ".git\rebase-merge") -or (Test-Path ".git\rebase-apply")
$indexLock   = Test-Path ".git\index.lock"
$unmerged    = @(git diff --name-only --diff-filter=U)
Write-Output ("  branch:     " + $repoBranch)
Write-Output ("  mid-merge:  " + $midMerge)
Write-Output ("  mid-rebase: " + $midRebase)
Write-Output ("  index.lock: " + $indexLock)

# BROKEN means CORRUPT - a merge or rebase left half-finished, or unmerged paths.
# Being on a FEATURE BRANCH is NOT broken: the watcher checks one out on every single
# run, by design. An earlier version of this script flagged "not on main" as broken -
# a false positive that would have had the supervisor run rescue-watcher-repo.ps1 and
# `git checkout main` OUT FROM UNDER A RUNNING AGENT, destroying its work. Exactly the
# "kill a healthy process on a weak signal" failure this whole file exists to prevent.
$repoBroken = $midMerge -or $midRebase -or ($unmerged.Count -gt 0)

# Off-main is only WORTH MENTIONING when nothing is running - i.e. an agent finished or
# died and left the repo parked. Even then it is a nuisance, not an emergency: the next
# prompt's own `git checkout` will move off it.
$agentRunning = $null -ne (Get-Process -Name claude -ErrorAction SilentlyContinue |
                           Where-Object { ((Get-Date) - $_.StartTime).TotalMinutes -lt 45 })
$parked = ($repoBranch -ne "main") -and (-not $agentRunning) -and (-not $repoBroken)

if ($repoBroken) {
    Write-Output ""
    Write-Output "*** ============================================================"
    Write-Output "*** THE WATCHER'S GIT REPO IS CORRUPT. THE QUEUE IS DEAD."
    if ($midMerge)  { Write-Output "*** A merge was left half-finished (MERGE_HEAD present)." }
    if ($midRebase) { Write-Output "*** A rebase was left half-finished." }
    if ($unmerged.Count -gt 0) {
        Write-Output "*** Unmerged files (conflict markers on disk):"
        foreach ($u in $unmerged) { Write-Output ("***    " + $u) }
    }
    Write-Output "***"
    Write-Output "*** Every watcher prompt begins with git checkout. A half-merged index"
    Write-Output "*** makes EVERY armed prompt FAIL. Nothing will run until this clears."
    Write-Output "***"
    Write-Output "*** FIX (safe, reversible - aborts the merge, returns to clean main):"
    Write-Output "***   powershell -NoProfile -ExecutionPolicy Bypass -File C:\ProjectOperations2\scripts\rescue-watcher-repo.ps1"
    Write-Output "***"
    Write-Output "*** Then find out WHICH agent did this. Only the watcher and the"
    Write-Output "*** shepherd may run git in that repo."
    Write-Output "*** ============================================================"
}
elseif ($repoBranch -ne "main" -and $agentRunning) {
    Write-Output ""
    Write-Output ("  NOTE: repo is on '" + $repoBranch + "' because an agent is ACTIVELY WORKING on it.")
    Write-Output "        This is NORMAL. The watcher checks out a feature branch on every run."
    Write-Output "        *** DO NOT run rescue-watcher-repo.ps1 - it would checkout main and"
    Write-Output "        *** destroy the in-flight work. Leave it alone."
}
elseif ($parked) {
    Write-Output ""
    Write-Output ("  NOTE: repo is parked on '" + $repoBranch + "' with no agent running.")
    Write-Output "        Not corrupt - the next prompt's own checkout will move off it."
    Write-Output "        Only worth clearing if the queue is also stalled."
}

Write-Output ""
Write-Output "=== OPEN PRs"
$prs = gh pr list --state open --json number,title,mergeStateStatus | ConvertFrom-Json
$dirty = @()
if ($prs) {
    $prs | Select-Object number, mergeStateStatus, @{N="title";E={$_.title.Substring(0, [Math]::Min(60, $_.title.Length))}} |
        Format-Table -AutoSize | Out-String -Width 160 | Write-Output
    $dirty = @($prs | Where-Object { $_.mergeStateStatus -eq "DIRTY" })
} else {
    Write-Output "  none open"
}

# Say this LOUDLY. The 2026-07-13 17:46 supervisor run looked at a board with five
# conflicted PRs and reported "no surprises" - because nothing forced it to reason
# about what DIRTY means. Do not leave that inference to the reader.
if ($dirty.Count -gt 0) {
    Write-Output ""
    Write-Output "*** ============================================================"
    Write-Output ("*** " + $dirty.Count + " PR(s) ARE DIRTY (merge conflict with main):")
    foreach ($d in $dirty) { Write-Output ("***    #" + $d.number + "  " + $d.title) }
    Write-Output "***"
    Write-Output "*** A DIRTY BRANCH CANNOT RUN pull_request CI AT ALL."
    Write-Output "*** GitHub cannot build the merge commit, so CI and the PR gates"
    Write-Output "*** SILENTLY SKIP - only CodeQL runs. Their checks are FROZEN at a"
    Write-Output "*** stale result and will NEVER go green until the conflict is"
    Write-Output "*** resolved. Pushing an empty commit to retrigger does NOTHING."
    Write-Output "***"
    Write-Output "*** RESOLVING THE CONFLICT IS THE UNBLOCK. This is almost certainly"
    Write-Output "*** the single biggest blocker on the board. Do NOT report the board"
    Write-Output "*** as healthy while this is non-zero."
    Write-Output "***"
    Write-Output "*** A conflict is NOT something to escalate to Marco. It is fixable"
    Write-Output "*** work. Check whether pr-zzz-resolve-all-dirty-prs-ready.md is armed."
    Write-Output "*** ============================================================"
}

Write-Output ""
Write-Output "=== VERDICT"
$loop  = $null -ne $dupes
$stall = $false
$lastProcessed = Get-ChildItem -Path (Join-Path $Q "processed") -Filter "*.md" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($lastProcessed -and $ready.Count -gt 0) {
    $idleMins = [math]::Round(((Get-Date) - $lastProcessed.LastWriteTime).TotalMinutes, 0)
    Write-Output ("  armed: " + $ready.Count + " | last processed: " + $idleMins + " min ago")

    # An idle queue ALONE proves nothing. The heartbeat is the tiebreaker:
    #   idle + FRESH heartbeat  = BUSY  (mid-run on a long prompt) -> DO NOT RESTART
    #   idle + STALE heartbeat  = WEDGED                            -> restart
    # An earlier version of this script screamed "STALL - restart it" on queue-idle alone,
    # which directly CONTRADICTED restart-watcher-if-wedged.ps1's (correct) BUSY verdict.
    # An agent following this one would have killed a healthy watcher mid-run.
    # Read the LIVE heartbeat in the watcher's own clone - the copy in the main tree is a
    # checked-in artifact and is ALWAYS stale.
    $hb = "C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log"
    $hbIdle = 99999
    if (Test-Path $hb) { $hbIdle = [math]::Round(((Get-Date) - (Get-Item $hb).LastWriteTime).TotalMinutes, 0) }
    Write-Output ("  heartbeat: " + $hbIdle + " min ago")

    if ($idleMins -gt 90 -and $hbIdle -gt 90) {
        $stall = $true
        Write-Output "  *** WEDGED: queue idle >90 min AND heartbeat stale >90 min, with work armed."
        Write-Output "      Confirm with restart-watcher-if-wedged.ps1, then run it with -Fix."
    }
    elseif ($idleMins -gt 90) {
        Write-Output "  BUSY: queue idle, but the heartbeat is FRESH - it is mid-run on a long prompt."
        Write-Output "        *** DO NOT RESTART. Killing a working agent is worse than waiting."
    }
}
if ($loop)  { Write-Output "  *** LOOP: a prompt has been processed more than once." }
if (-not $loop -and -not $stall) { Write-Output "  Watcher: OK - no loop, no stall." }

if ($repoBroken) {
    Write-Output "  Repo:    *** CORRUPT - mid-merge/rebase or unmerged paths."
    Write-Output "           EVERY armed prompt will fail. Run rescue-watcher-repo.ps1 NOW."
    Write-Output "           This outranks everything else. Fix it first."
} elseif ($repoBranch -ne "main" -and $agentRunning) {
    Write-Output ("  Repo:    OK - on '" + $repoBranch + "', an agent is working on it. NORMAL. Do not touch.")
} elseif ($parked) {
    Write-Output ("  Repo:    OK - parked on '" + $repoBranch + "' (not corrupt). Harmless.")
} else {
    Write-Output "  Repo:    OK - clean, on main."
}

# The watcher being healthy does NOT mean the BOARD is healthy. Two different things.
# Never let "watcher OK" be read as "nothing to do."
if ($dirty.Count -gt 0) {
    Write-Output ("  Board:   *** BLOCKED - " + $dirty.Count + " PR(s) dirty => their CI is frozen. THIS IS THE BLOCKER.")
    Write-Output "           The watcher can be perfectly healthy while the board is stuck."
    Write-Output "           Do not report 'all healthy'."
} else {
    Write-Output "  Board:   OK - no conflicted PRs."
}
