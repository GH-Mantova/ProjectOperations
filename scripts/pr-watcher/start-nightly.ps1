# Nightly wrapper for the PR-prompt watcher.
#
# Designed to be run by Windows Task Scheduler at a fixed evening time
# (e.g., 18:00). It will process the queue overnight and refuse to start a
# new prompt past 06:00, then exit cleanly. Anything still queued stays in
# docs/pr-prompts/ for the next run.
#
# Usage from Task Scheduler:
#   Program:    powershell.exe
#   Arguments:  -NoProfile -ExecutionPolicy Bypass -File "C:\ProjectOperations2\scripts\pr-watcher\start-nightly.ps1"
#   Start in:   C:\ProjectOperations2
#
# Or manually:
#   .\scripts\pr-watcher\start-nightly.ps1

$ErrorActionPreference = "Stop"

# --- Configuration ---
# Override these via env vars in the Task Scheduler action if you want a
# different cutoff or behaviour.
$RepoRoot   = "C:\ProjectOperations2"
$StopAt     = if ($env:PR_WATCHER_STOP_AT) { $env:PR_WATCHER_STOP_AT } else { "06:00" }
$AutoMerge  = if ($env:PR_WATCHER_AUTO_MERGE) { $env:PR_WATCHER_AUTO_MERGE } else { "false" }
$MaxTurns   = if ($env:PR_WATCHER_MAX_TURNS) { $env:PR_WATCHER_MAX_TURNS } else { "120" }

# Daily log file under scripts/pr-watcher/logs/YYYY-MM-DD.log
$LogDir = Join-Path $RepoRoot "scripts\pr-watcher\logs"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$LogFile = Join-Path $LogDir ("{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

# --- Pre-flight ---
Set-Location $RepoRoot

# Make sure we're on main with a clean tree before starting. If not,
# bail — the watcher branch-switches per PR and a dirty tree would
# poison everything.
$branch = (git branch --show-current).Trim()
$dirty  = (git status --short)

if ($branch -ne "main" -or $dirty) {
    $msg = "[$(Get-Date -Format o)] PRE-FLIGHT FAIL: branch=$branch, dirty=$([bool]$dirty). Watcher will NOT start."
    Add-Content -Path $LogFile -Value $msg
    Write-Error $msg
    exit 1
}

# Single-instance guard — refuse to start if another watcher node process is already running.
$existing = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match "pr-watcher[\\/]index\.mjs" }
if ($existing) {
    $msg = "[$(Get-Date -Format o)] Watcher already running (PID $($existing.ProcessId)) — not starting another."
    Add-Content -Path $LogFile -Value $msg
    Write-Host $msg
    exit 0
}

# --- Run ---
$env:PR_WATCHER_STOP_AT    = $StopAt
$env:PR_WATCHER_AUTO_MERGE = $AutoMerge
$env:PR_WATCHER_MAX_TURNS  = $MaxTurns

$banner = @"
============================================================
PR watcher nightly run
Started: $(Get-Date -Format o)
Stop at: $StopAt
Auto-merge: $AutoMerge
Max turns: $MaxTurns
Log file: $LogFile
============================================================
"@
Add-Content -Path $LogFile -Value $banner
Write-Host $banner

# Stream output to BOTH console and log file
node "$RepoRoot\scripts\pr-watcher\index.mjs" 2>&1 | Tee-Object -FilePath $LogFile -Append

$exit = $LASTEXITCODE
$footer = "[$(Get-Date -Format o)] Watcher exited with code $exit"
Add-Content -Path $LogFile -Value $footer
Write-Host $footer

# Exit codes:
#   0 = clean (queue empty or STOP_AT reached)
#   1 = real failure
#   2 = soft halt (usage / rate limit hit — will retry next run)
exit $exit
