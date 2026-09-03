param([string]$Repo = "C:\ProjectOperations2")
# Clear a STALE .git/index.lock - but ONLY if no git process is running.
# sot/05: a 3-day-old index.lock once froze this repo and made it silently serve stale source,
# which led to a false accusation that a merged PR had never landed. Always check for a live
# git process first; never delete a lock out from under a running command.
# Pure ASCII.

$ErrorActionPreference = "Continue"

if (-not (Test-Path $Repo -PathType Container)) {
    Write-Output ("Repo not found: " + $Repo)
    exit 2
}
if (-not (Test-Path (Join-Path $Repo ".git") -PathType Container)) {
    Write-Output ("Not a git repo (no .git directory): " + $Repo)
    exit 2
}

$lock = Join-Path $Repo ".git\index.lock"

$g = Get-Process git -ErrorAction SilentlyContinue
if ($g) {
    Write-Output ("git IS running (pid " + ($g.Id -join ",") + ") - NOT touching the lock.")
    exit 1
}
Write-Output "no git process running."

if (-not (Test-Path $lock)) { Write-Output ("no lock file present in " + $Repo); exit 0 }

$age = [math]::Round(((Get-Date) - (Get-Item $lock).LastWriteTime).TotalMinutes, 1)
Write-Output ("lock age: " + $age + " min  [" + $Repo + "]")
Remove-Item $lock -Force
Write-Output ("stale lock removed from " + $Repo)
