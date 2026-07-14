# Clear a STALE .git/index.lock - but ONLY if no git process is running.
# sot/05: a 3-day-old index.lock once froze this repo and made it silently serve stale source,
# which led to a false accusation that a merged PR had never landed. Always check for a live
# git process first; never delete a lock out from under a running command.
# Pure ASCII.

$ErrorActionPreference = "Continue"
$lock = "C:\ProjectOperations2\.git\index.lock"

$g = Get-Process git -ErrorAction SilentlyContinue
if ($g) {
    Write-Output ("git IS running (pid " + ($g.Id -join ",") + ") - NOT touching the lock.")
    exit 1
}
Write-Output "no git process running."

if (-not (Test-Path $lock)) { Write-Output "no lock file present."; exit 0 }

$age = [math]::Round(((Get-Date) - (Get-Item $lock).LastWriteTime).TotalMinutes, 1)
Write-Output ("lock age: " + $age + " min")
Remove-Item $lock -Force
Write-Output "stale lock removed."
