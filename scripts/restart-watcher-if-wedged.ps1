# Detect a WEDGED watcher and restart it.
#
# supervise-watcher.ps1 already handles the cases where the watcher EXITS:
#   exit 1 (crash)      -> auto-restart after 60s
#   exit 2 (rate limit) -> auto-restart after 20 min
#
# It CANNOT handle a watcher that is alive but doing nothing - no exit code ever
# fires, so the supervisor waits forever while the queue sits armed and untouched.
# That is the gap this script closes.
#
# SAFE BY DEFAULT: reports only. Pass -Fix to actually restart.
# Pure ASCII (PS 5.1 reads UTF-8-without-BOM as Windows-1252).

param(
    [switch]$Fix,
    [int]$StallMinutes = 90
)

$ErrorActionPreference = "Continue"

# The prompt QUEUE lives in the main tree (PR_WATCHER_PROMPT_DIR).
$Q = "C:\ProjectOperations2\docs\pr-prompts"

# But the watcher RUNS from the isolated clone (PR_WATCHER_REPO_ROOT), so its live
# heartbeat and lock are THERE, not in the main tree. Reading the main-tree copy
# gives a permanently-stale heartbeat (it is a checked-in artifact, not the live
# one) - which would disable the "busy, do not kill" guard and let this script
# murder a healthy long-running agent. Get this path right.
$watchDir  = "C:\po-watcher\ProjectOperations\scripts\pr-watcher"
$heartbeat = Join-Path $watchDir "heartbeat.log"
$supervise = Join-Path $watchDir "supervise-watcher.ps1"

if (-not (Test-Path $supervise)) {
    # Fall back to the main tree's copy of the script (the script itself is
    # identical; only the runtime state differs).
    $supervise = "C:\ProjectOperations2\scripts\pr-watcher\supervise-watcher.ps1"
}

Write-Output ("=== " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  wedged-watcher check  (Fix=" + $Fix + ")")
Write-Output ""

# --- Signal 1: is there work waiting?
$armed = @(Get-ChildItem -Path $Q -Filter "*-ready.md" -File -ErrorAction SilentlyContinue)
Write-Output ("armed prompts waiting: " + $armed.Count)

if ($armed.Count -eq 0) {
    Write-Output "VERDICT: OK - nothing armed. An idle watcher is correct, not wedged."
    exit 0
}

# --- Signal 2: when did the queue last move?
$lastProcessed = Get-ChildItem -Path (Join-Path $Q "processed") -Filter "*.md" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
$queueIdleMin = 99999
if ($lastProcessed) {
    $queueIdleMin = [math]::Round(((Get-Date) - $lastProcessed.LastWriteTime).TotalMinutes, 0)
    Write-Output ("queue last moved:      " + $queueIdleMin + " min ago  (" + $lastProcessed.Name + ")")
}

# --- Signal 3: heartbeat freshness (the watcher writes this while healthy)
$hbIdleMin = 99999
if (Test-Path $heartbeat) {
    $hbIdleMin = [math]::Round(((Get-Date) - (Get-Item $heartbeat).LastWriteTime).TotalMinutes, 0)
    Write-Output ("heartbeat last write:  " + $hbIdleMin + " min ago")
} else {
    Write-Output "heartbeat.log:         MISSING"
}

# --- Signal 4: is a watcher process actually alive?
$proc = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*pr-watcher*" }
if ($proc) {
    foreach ($p in $proc) { Write-Output ("watcher process:       ALIVE (pid " + $p.ProcessId + ")") }
} else {
    Write-Output "watcher process:       *** NOT RUNNING ***"
}

Write-Output ""

# --- Verdict.
# WEDGED = work is armed AND the queue has not moved AND the heartbeat is stale,
# while the process is still alive. A single prompt legitimately takes 10-40 min,
# so the threshold is deliberately generous - we would rather miss a wedge than
# kill a healthy long-running agent mid-merge.
$queueStalled = ($queueIdleMin -gt $StallMinutes)
$hbStale      = ($hbIdleMin -gt $StallMinutes)
$alive        = ($null -ne $proc)

if ($alive -and $queueStalled -and $hbStale) {
    Write-Output ("VERDICT: WEDGED - process alive, but queue idle " + $queueIdleMin + " min and heartbeat stale " + $hbIdleMin + " min with " + $armed.Count + " prompts armed.")
    $action = "restart"
}
elseif (-not $alive) {
    Write-Output ("VERDICT: DOWN - no watcher process, but " + $armed.Count + " prompts are armed.")
    $action = "restart"
}
elseif ($alive -and $queueStalled -and -not $hbStale) {
    Write-Output ("VERDICT: BUSY - queue idle " + $queueIdleMin + " min BUT heartbeat is fresh (" + $hbIdleMin + " min). It is mid-run on a long prompt. DO NOT restart.")
    exit 0
}
else {
    Write-Output "VERDICT: HEALTHY - no action."
    exit 0
}

if (-not $Fix) {
    Write-Output ""
    Write-Output "REPORT-ONLY MODE. To actually restart, re-run with -Fix:"
    Write-Output "  powershell -NoProfile -ExecutionPolicy Bypass -File C:\ProjectOperations2\scripts\restart-watcher-if-wedged.ps1 -Fix"
    exit 1
}

# --- Fix.
Write-Output ""
Write-Output "=== RESTARTING"

if ($proc) {
    foreach ($p in $proc) {
        Write-Output ("  stopping wedged watcher pid " + $p.ProcessId)
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 3
}

# The single-instance guard in start-watcher.ps1 makes a stale lock fatal; clear it.
$lock = Join-Path $watchDir ".watcher.lock"
if (Test-Path $lock) {
    Write-Output "  removing stale .watcher.lock"
    Remove-Item $lock -Force -ErrorAction SilentlyContinue
}

Write-Output "  launching supervise-watcher.ps1 (it re-launches the watcher and keeps it alive)"
Start-Process -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$supervise) `
    -WindowStyle Minimized

Start-Sleep -Seconds 20

$after = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
         Where-Object { $_.CommandLine -like "*pr-watcher*" }
if ($after) {
    foreach ($p in $after) { Write-Output ("  OK - watcher back up (pid " + $p.ProcessId + ")") }
    exit 0
} else {
    Write-Output "  *** RESTART FAILED - no watcher process after 20s. ESCALATE TO MARCO."
    exit 1
}
