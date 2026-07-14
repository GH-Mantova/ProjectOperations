# Rescue the watcher's git repo from an abandoned mid-merge.
#
# The supervisor agent started `git merge origin/main` on #538's branch, hit a conflict in
# AdminSettingsPage.tsx, and walked away - leaving MERGE_HEAD in place. Every watcher prompt
# does `git checkout`, so the whole overnight queue would fail on a dirty index.
#
# `git merge --abort` restores the exact pre-merge state. Nothing is lost: the branch is
# untouched on the remote, and the conflict is simply not resolved (which is where we started).
#
# Pure ASCII.

$ErrorActionPreference = "Stop"
Set-Location "C:\po-watcher\ProjectOperations"

Write-Output "=== BEFORE"
Write-Output ("  branch:    " + (git rev-parse --abbrev-ref HEAD))
Write-Output ("  mid-merge: " + (Test-Path ".git\MERGE_HEAD"))

if (Test-Path ".git\MERGE_HEAD") {
    Write-Output ""
    Write-Output "=== ABORTING THE MERGE (restores pre-merge state; nothing is lost)"
    git merge --abort
    Start-Sleep -Seconds 1
}

# Clear any stale index lock (a killed git can leave one; it has frozen this repo before - see sot/05).
if (Test-Path ".git\index.lock") {
    $gitRunning = Get-Process -Name git -ErrorAction SilentlyContinue
    if (-not $gitRunning) {
        Write-Output "  removing stale .git\index.lock (no git process running)"
        Remove-Item ".git\index.lock" -Force
    } else {
        Write-Output "  *** .git\index.lock present AND git is running - leaving it alone."
    }
}

Write-Output ""
Write-Output "=== RETURNING TO main (the watcher expects to start from main)"
git checkout main
git pull --ff-only

Write-Output ""
Write-Output "=== AFTER"
Write-Output ("  branch:    " + (git rev-parse --abbrev-ref HEAD))
Write-Output ("  head:      " + (git log --oneline -1))
Write-Output ("  mid-merge: " + (Test-Path ".git\MERGE_HEAD")) 
Write-Output "  status:"
$st = git status --short
if ($st) { $st | ForEach-Object { Write-Output ("    " + $_) } } else { Write-Output "    clean" }

Write-Output ""
if ((Test-Path ".git\MERGE_HEAD")) {
    Write-Output "*** RESCUE FAILED - still mid-merge. ESCALATE."
    exit 1
} else {
    Write-Output "OK - watcher repo is clean and on main. The overnight queue can run."
    exit 0
}
