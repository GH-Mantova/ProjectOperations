# Detect a DOWN or WEDGED watcher and restart it.
#
# supervise-watcher.ps1 already handles the cases where the watcher EXITS with a code:
#   exit 1 (crash)      -> auto-restart after 60s
#   exit 2 (rate limit) -> auto-restart after 20 min
#
# It CANNOT handle two cases, which this script closes:
#   1. WEDGED: the watcher is alive but doing nothing - no exit code ever fires, so the
#      supervisor waits forever while the queue sits armed and untouched.
#   2. DOWN:   the watcher process is gone entirely (e.g. a clean Ctrl+C, which
#      supervise-watcher.ps1 treats as a deliberate stop and does NOT restart). This must
#      be restarted EVEN WHEN THE QUEUE IS EMPTY - a stopped watcher never picks up the next
#      armed prompt and stops keeping PR branches current. Before 2026-07-15 an empty queue
#      short-circuited to "OK" here WITHOUT ever checking whether the process was alive, so
#      a cleanly-stopped watcher stayed down until a human noticed.
#
# SAFE BY DEFAULT: reports only. Pass -Fix to actually restart.
# Pure ASCII (PS 5.1 reads UTF-8-without-BOM as Windows-1252).

#   3. CHURNING: the watcher is crash-looping - dying and being relaunched every few seconds.
#      Added 2026-08-18 after this script reported HEALTHY for the whole of a two-hour outage
#      (see docs/pr-prompts/00-supervisor-2026-08-18-0030-crashloop-fixed.md). EVERY signal
#      below is a SINGLE-INSTANT SAMPLE, and in a ~17-second restart cycle a process is almost
#      always present at the sampled moment and the heartbeat was just rewritten by the newest
#      child. So "alive + fresh heartbeat" reads as BUSY and the script exits 0. It is
#      structurally blind to churn. The only way to see a loop is to look at HISTORY, which is
#      what Get-RestartChurn does. DOCTRINE 7: your instrument lies.
#
#      A crash loop must NOT be answered with another restart - restarting is exactly what is
#      already failing. On -Fix this HALTS the loop and escalates to needs-marco/.

param(
    [switch]$Fix,
    [int]$StallMinutes = 90,
    [int]$ChurnWindowMinutes = 20,
    [int]$ChurnThreshold = 4
)

$ErrorActionPreference = "Continue"

# The prompt QUEUE lives in the main tree (PR_WATCHER_PROMPT_DIR).
$Q = "C:\ProjectOperations2\docs\pr-prompts"

# But the watcher RUNS from the isolated clone (PR_WATCHER_REPO_ROOT), so its live heartbeat
# and lock are THERE, not in the main tree. Reading the main-tree copy gives a permanently-
# stale heartbeat (a checked-in artifact, not the live one) - which would disable the "busy,
# do not kill" guard and let this script murder a healthy long-running agent. Get this right.
$watchDir  = "C:\po-watcher\ProjectOperations\scripts\pr-watcher"
$heartbeat = Join-Path $watchDir "heartbeat.log"
$supervise = Join-Path $watchDir "supervise-watcher.ps1"
if (-not (Test-Path $supervise)) {
    # Fall back to the main tree's copy (the script itself is identical; only state differs).
    $supervise = "C:\ProjectOperations2\scripts\pr-watcher\supervise-watcher.ps1"
}

function Get-WatcherProcess {
    return Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
           Where-Object { $_.CommandLine -like "*pr-watcher*" }
}

# --- CHURN DETECTION (history, not an instant) --------------------------------------------
# Counts supervisor restart events inside a rolling window. supervisor.log is the right
# source: supervise-watcher.ps1 writes one "Supervisor started." per start and one
# "Watcher exited ..." per child death, and (since #1162) wraps those writes in try/catch so
# logging can never take the supervisor down. The launcher transcript is deliberately NOT
# used - it is the artefact that broke and caused the 2026-08-17 loop in the first place.
#
# In steady state this is 0-1. In the 2026-08-17 loop it was ~4/min for two hours.
function Get-RestartChurn {
    param([string] $LogPath, [int] $WindowMinutes)

    $result = [pscustomobject]@{ Starts = 0; Exits = 0; Total = 0; Readable = $false; Newest = $null }
    if (-not (Test-Path $LogPath)) { return $result }

    try { $lines = Get-Content -Path $LogPath -Tail 4000 -ErrorAction Stop }
    catch { return $result }   # unreadable = fail open; the other signals still run

    $result.Readable = $true
    $cutoff = (Get-Date).AddMinutes(-$WindowMinutes)

    foreach ($line in $lines) {
        # Lines look like: [2026-08-18T07:31:30.6116300+10:00] Supervisor started. ...
        if ($line -notmatch '^\[([^\]]+)\]') { continue }
        # $ts MUST be pre-typed: in PS 5.1 a [ref] to a $null variable cannot bind the
        # [datetime]::TryParse(string,[ref]datetime) overload and every line throws.
        [datetime] $ts = [datetime]::MinValue
        if (-not [datetime]::TryParse($matches[1], [ref] $ts)) { continue }
        if ($ts -lt $cutoff) { continue }
        if ($null -eq $result.Newest -or $ts -gt $result.Newest) { $result.Newest = $ts }
        if ($line -match 'Supervisor started\.')  { $result.Starts++ }
        elseif ($line -match 'Watcher exited')    { $result.Exits++ }
    }
    # One start + one exit is a single restart, not a loop. Take the larger of the two so a
    # loop is counted once per cycle rather than twice.
    $result.Total = [math]::Max($result.Starts, $result.Exits)
    return $result
}

# A crash loop is NOT fixed by restarting. Stop the churn and hand it to Marco.
# Wrappers die FIRST - killing the node alone just makes the supervisor relaunch it.
function Invoke-ChurnHalt {
    param($proc, $churn, [string] $Dir)

    Write-Output ""
    Write-Output "=== HALTING THE CRASH LOOP (not restarting - restarting is what is already failing)"

    $wrappers = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
                  Where-Object { $_.CommandLine -like "*supervise-watcher*" -or $_.CommandLine -like "*watcher-launcher*" })
    foreach ($w in $wrappers) {
        Write-Output ("  stopping wrapper pid " + $w.ProcessId)
        Stop-Process -Id $w.ProcessId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 3
    foreach ($p in @($proc)) {
        if ($p) {
            Write-Output ("  stopping watcher pid " + $p.ProcessId)
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
    Start-Sleep -Seconds 3

    $stillW = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
                Where-Object { $_.CommandLine -like "*supervise-watcher*" -or $_.CommandLine -like "*watcher-launcher*" })
    $stillN = @(Get-WatcherProcess)
    Write-Output ("  after halt: wrappers=" + $stillW.Count + " nodes=" + $stillN.Count)

    New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    $stamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
    $path  = Join-Path $Dir ("WATCHER-CHURN-{0}.md" -f $stamp)
    $body  = @(
        "# ESCALATION: the PR watcher was CHURNING and has been halted",
        "",
        "Written by scripts/restart-watcher-if-wedged.ps1 at $(Get-Date -Format o).",
        "",
        "## What was seen",
        "",
        "In the last $ChurnWindowMinutes minutes of ``scripts/pr-watcher/logs/supervisor.log``:",
        "",
        "- ``Supervisor started.`` lines: $($churn.Starts)",
        "- ``Watcher exited`` lines:    $($churn.Exits)",
        "- restart cycles counted:    $($churn.Total)  (threshold $ChurnThreshold)",
        "",
        "That is a crash loop, not a slow prompt. The loop has been STOPPED rather than",
        "restarted - wrappers killed first, then the node, so nothing relaunches it.",
        "",
        "## Why this check exists",
        "",
        "On 2026-08-17 this script reported HEALTHY for a two-hour outage because every other",
        "signal it has is a single-instant sample: a process is nearly always alive at the",
        "sampled moment of a ~17s restart cycle, and the heartbeat had just been rewritten by",
        "the newest child. Only history shows a loop.",
        "",
        "## What to do",
        "",
        "1. Read the tail of ``scripts/pr-watcher/logs/supervisor.log`` for the REASON line.",
        "2. Fix the cause. Do not simply relaunch - it will loop again.",
        "3. Start the supervisor again once the cause is fixed.",
        "",
        "Nothing in the queue was moved, and no git write was performed."
    ) -join "`r`n"
    Set-Content -Path $path -Value $body -Encoding UTF8
    Write-Output ("  escalation written: " + $path)
}

# Stop any wedged instance, clear the stale single-instance lock, relaunch via the wrapper,
# and confirm a process came back. Sets $script:RestartExit (0 = up, 1 = failed) rather than
# returning it, so the log lines written here do not pollute the caller's exit expression.
function Invoke-WatcherRestart {
    param($proc)
    Write-Output ""
    Write-Output "=== RESTARTING"
    if ($proc) {
        foreach ($p in $proc) {
            Write-Output ("  stopping watcher pid " + $p.ProcessId)
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
    $after = Get-WatcherProcess
    if ($after) {
        foreach ($p in $after) { Write-Output ("  OK - watcher back up (pid " + $p.ProcessId + ")") }
        $script:RestartExit = 0
    } else {
        Write-Output "  *** RESTART FAILED - no watcher process after 20s. ESCALATE TO MARCO."
        $script:RestartExit = 1
    }
}

function Show-ReportOnlyHint {
    Write-Output ""
    Write-Output "REPORT-ONLY MODE. To actually restart, re-run with -Fix:"
    Write-Output "  powershell -NoProfile -ExecutionPolicy Bypass -File C:\ProjectOperations2\scripts\restart-watcher-if-wedged.ps1 -Fix"
}

Write-Output ("=== " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + "  watcher health check  (Fix=" + $Fix + ")")
Write-Output ""

# --- Signal 1: is there work waiting?
$armed = @(Get-ChildItem -Path $Q -Filter "*-ready.md" -File -ErrorAction SilentlyContinue)
Write-Output ("armed prompts waiting: " + $armed.Count)

# --- Signal 2: is a watcher process actually alive? (checked UP FRONT so an empty queue can
#     no longer hide a dead watcher.)
$proc  = Get-WatcherProcess
$alive = ($null -ne $proc)
if ($alive) {
    foreach ($p in $proc) { Write-Output ("watcher process:       ALIVE (pid " + $p.ProcessId + ")") }
} else {
    Write-Output "watcher process:       *** NOT RUNNING ***"
}

# --- Signal 2b: restart CHURN. Checked BEFORE everything else, because during a crash loop
#     every other signal looks fine: the process is alive (a new one every ~17s) and the
#     heartbeat is fresh (the newest child just wrote it). Order matters here.
$supervisorLog = Join-Path $watchDir "logs\supervisor.log"
$churn = Get-RestartChurn -LogPath $supervisorLog -WindowMinutes $ChurnWindowMinutes
if ($churn.Readable) {
    Write-Output ("restart churn:         " + $churn.Total + " cycle(s) in " + $ChurnWindowMinutes + " min  (starts=" + $churn.Starts + " exits=" + $churn.Exits + ", threshold " + $ChurnThreshold + ")")
} else {
    Write-Output ("restart churn:         supervisor.log unreadable or absent - churn UNKNOWN (" + $supervisorLog + ")")
}

if ($churn.Total -ge $ChurnThreshold) {
    Write-Output ""
    Write-Output ("VERDICT: CHURNING - " + $churn.Total + " watcher restarts in the last " + $ChurnWindowMinutes + " min. This is a crash loop, not a slow prompt.")
    Write-Output "         Restarting is NOT the remedy - it is what is already failing on a loop."
    if (-not $Fix) {
        Write-Output ""
        Write-Output "REPORT-ONLY MODE. To halt the loop and escalate, re-run with -Fix:"
        Write-Output "  powershell -NoProfile -ExecutionPolicy Bypass -File C:\ProjectOperations2\scripts\restart-watcher-if-wedged.ps1 -Fix"
        exit 3
    }
    Invoke-ChurnHalt -proc $proc -churn $churn -Dir (Join-Path $Q "needs-marco")
    exit 3
}

# --- Empty queue: an idle watcher is correct ONLY if it is actually running. If it is DOWN,
#     it must be restarted so it is ready for the next armed prompt.
if ($armed.Count -eq 0) {
    if ($alive) {
        Write-Output ""
        Write-Output "VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged."
        exit 0
    }
    Write-Output ""
    Write-Output "VERDICT: DOWN - no watcher process (queue empty, but the watcher must be up to catch newly-armed prompts and keep PR branches current)."
    if (-not $Fix) { Show-ReportOnlyHint; exit 1 }
    Invoke-WatcherRestart -proc $proc
    exit $script:RestartExit
}

# --- Signal 3: when did the queue last move?
$lastProcessed = Get-ChildItem -Path (Join-Path $Q "processed") -Filter "*.md" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
$queueIdleMin = 99999
if ($lastProcessed) {
    $queueIdleMin = [math]::Round(((Get-Date) - $lastProcessed.LastWriteTime).TotalMinutes, 0)
    Write-Output ("queue last moved:      " + $queueIdleMin + " min ago  (" + $lastProcessed.Name + ")")
}

# --- Signal 4: heartbeat freshness (the watcher writes this while healthy)
$hbIdleMin = 99999
if (Test-Path $heartbeat) {
    $hbIdleMin = [math]::Round(((Get-Date) - (Get-Item $heartbeat).LastWriteTime).TotalMinutes, 0)
    Write-Output ("heartbeat last write:  " + $hbIdleMin + " min ago")
} else {
    Write-Output "heartbeat.log:         MISSING"
}

Write-Output ""

# --- Verdict (armed work present).
# WEDGED = work is armed AND the queue has not moved AND the heartbeat is stale, while the
# process is still alive. A single prompt legitimately takes 10-40 min, so the threshold is
# deliberately generous - we would rather miss a wedge than kill a healthy long-running agent.
$queueStalled = ($queueIdleMin -gt $StallMinutes)
$hbStale      = ($hbIdleMin -gt $StallMinutes)

if ($alive -and $queueStalled -and $hbStale) {
    Write-Output ("VERDICT: WEDGED - process alive, but queue idle " + $queueIdleMin + " min and heartbeat stale " + $hbIdleMin + " min with " + $armed.Count + " prompts armed.")
}
elseif (-not $alive) {
    Write-Output ("VERDICT: DOWN - no watcher process, but " + $armed.Count + " prompts are armed.")
}
elseif ($alive -and $queueStalled -and -not $hbStale) {
    Write-Output ("VERDICT: BUSY - queue idle " + $queueIdleMin + " min BUT heartbeat is fresh (" + $hbIdleMin + " min). It is mid-run on a long prompt. DO NOT restart.")
    exit 0
}
else {
    Write-Output "VERDICT: HEALTHY - no action."
    exit 0
}

if (-not $Fix) { Show-ReportOnlyHint; exit 1 }

Invoke-WatcherRestart -proc $proc
exit $script:RestartExit
