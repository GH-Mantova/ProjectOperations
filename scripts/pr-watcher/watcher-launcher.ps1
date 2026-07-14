# Detached launcher for the PR watcher.
# Must be started with Win32_Process.Create so it is NOT a child of the Claude Desktop
# session - a child dies when Claude Desktop restarts, which is what happened on 2026-07-14.
$env:PR_WATCHER_REPO_ROOT  = "C:\po-watcher\ProjectOperations"
$env:PR_WATCHER_PROMPT_DIR = "C:\ProjectOperations2\docs\pr-prompts"
Start-Transcript -Path "C:\po-watcher\watcher-launch.log" -Append -Force | Out-Null
& "C:\po-watcher\ProjectOperations\scripts\pr-watcher\supervise-watcher.ps1"
Stop-Transcript | Out-Null
