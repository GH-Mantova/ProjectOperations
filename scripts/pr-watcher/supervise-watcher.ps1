# Supervisor for the PR-prompt watcher.
#
# Keeps the watcher alive and AUTO-RESTARTS it after a usage/rate-limit
# soft-halt, so it resumes on its own once the Claude quota resets. Wraps
# start-watcher.ps1 (which keeps all the preflight + single-instance guard).
#
# Exit codes from start-watcher.ps1 / index.mjs:
#   0 = clean stop (Ctrl+C / SIGINT)  -> treated as a deliberate stop; loop ends
#   1 = real failure / crash          -> restart after a short delay
#   2 = usage / rate-limit soft-halt  -> wait for the quota window, then retry
#
# The queue is never lost across any of these -- the halted prompt stays in
# docs/pr-prompts/ and is picked up on the next start.
#
# Pure ASCII only -- PowerShell 5.1 reads UTF-8-without-BOM as Windows-1252,
# so em-dashes / curly quotes / emoji become parser errors at load. Keep ASCII.
#
# Usage (run this INSTEAD of start-watcher.ps1):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\pr-watcher\supervise-watcher.ps1
#
# Tunables (env, optional):
#   PR_WATCHER_SOFTWAIT_MIN   minutes to wait after a usage-limit halt (default 20)
#   PR_WATCHER_CRASH_WAIT_SEC seconds to wait after a crash exit=1 (default 60)

$ErrorActionPreference = "Continue"

# Env-carry. This supervisor copy lives in the MAIN tree, so without these two
# vars start-watcher.ps1 refuses (repo root = the interactive tree, exit 1) and
# index.mjs watches the CLONE's docs/pr-prompts instead of the real queue.
# 2026-07-14: a restart crash-looped on exit 1 for exactly this reason.
#   GIT work  -> the isolated clone      (PR_WATCHER_REPO_ROOT)
#   QUEUE     -> the main tree           (PR_WATCHER_PROMPT_DIR)
if (-not $env:PR_WATCHER_REPO_ROOT)  { $env:PR_WATCHER_REPO_ROOT  = "C:\po-watcher\ProjectOperations" }
if (-not $env:PR_WATCHER_PROMPT_DIR) { $env:PR_WATCHER_PROMPT_DIR = "C:\ProjectOperations2\docs\pr-prompts" }

$here      = $PSScriptRoot
$startScript = Join-Path $here "start-watcher.ps1"

$softWaitMin = 20
if ($env:PR_WATCHER_SOFTWAIT_MIN) { $softWaitMin = [int]$env:PR_WATCHER_SOFTWAIT_MIN }
$crashWaitSec = 60
if ($env:PR_WATCHER_CRASH_WAIT_SEC) { $crashWaitSec = [int]$env:PR_WATCHER_CRASH_WAIT_SEC }

$supLog = Join-Path $here "logs\supervisor.log"
New-Item -ItemType Directory -Path (Split-Path $supLog) -Force | Out-Null

function Sup-Log([string]$msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format o), $msg
    Add-Content -Path $supLog -Value $line -Encoding UTF8
    Write-Host $line
}

Sup-Log "Supervisor started. soft-wait=$softWaitMin min, crash-wait=$crashWaitSec s."

while ($true) {
    # Run one watcher session as a child process so we can read its exit code
    # without exiting the supervisor. Use Windows PowerShell 5.1 to match the
    # watcher script's target host; swap to 'pwsh' if you prefer PS 7.
    & powershell -NoProfile -ExecutionPolicy Bypass -File $startScript
    $code = $LASTEXITCODE

    if ($code -eq 2) {
        Sup-Log "Watcher soft-halted (usage/rate limit, exit 2). Waiting $softWaitMin min for the quota window, then restarting."
        Start-Sleep -Seconds ($softWaitMin * 60)
        continue
    }
    elseif ($code -eq 1) {
        Sup-Log "Watcher exited with failure (exit 1). Restarting in $crashWaitSec s."
        Start-Sleep -Seconds $crashWaitSec
        continue
    }
    else {
        # Exit 0 = deliberate stop (Ctrl+C) or the single-instance guard found
        # an already-running watcher. Respect it and stop supervising so a
        # manual Ctrl+C actually stops things. (The watcher is an fs.watch
        # daemon, so it does NOT exit 0 on an empty queue.)
        Sup-Log "Watcher exited cleanly (exit 0). Treating as a deliberate stop. Supervisor exiting."
        break
    }
}
