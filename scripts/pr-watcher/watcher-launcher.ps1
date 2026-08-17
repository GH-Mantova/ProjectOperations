# Detached launcher for the PR watcher.
# Must be started with Win32_Process.Create so it is NOT a child of the Claude Desktop
# session - a child dies when Claude Desktop restarts, which is what happened on 2026-07-14.
$env:PR_WATCHER_REPO_ROOT  = "C:\po-watcher\ProjectOperations"
$env:PR_WATCHER_PROMPT_DIR = "C:\ProjectOperations2\docs\pr-prompts"
# 2026-08-18 (LL-39): this transcript was `-Append` with NO rotation, so it grew
# without bound (42 MB by the time it broke). A transcript whose stream goes bad
# poisons EVERY output stream in the host: `Add-Content` and `Write-Host` then throw
# "Stream was not readable", and the node child -- which inherits that stdout --
# dies with exit -1 on its very first log write. That was the trigger for the
# 2026-08-17 crash loop. Cap and rotate before starting the transcript.
$launchLog = "C:\po-watcher\watcher-launch.log"
$maxLogBytes = 20MB
if ((Test-Path $launchLog) -and ((Get-Item $launchLog).Length -gt $maxLogBytes)) {
    $rotated = "{0}.rotated-{1}" -f $launchLog, (Get-Date -Format "yyyyMMdd-HHmmss")
    Move-Item -Path $launchLog -Destination $rotated -Force -ErrorAction SilentlyContinue
    # Keep only the 5 most recent rotations; the old ones are pure disk burn.
    Get-ChildItem "$launchLog.rotated-*" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 |
        Remove-Item -Force -ErrorAction SilentlyContinue
}
Start-Transcript -Path $launchLog -Append -Force | Out-Null
& "C:\po-watcher\ProjectOperations\scripts\pr-watcher\supervise-watcher.ps1"
Stop-Transcript | Out-Null
