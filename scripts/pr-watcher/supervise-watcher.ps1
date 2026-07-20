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
# TWO THINGS THIS SCRIPT LEARNED THE HARD WAY (2026-07-14):
#
#  1. VISIBILITY. It used to log a bare "Watcher exited with failure (exit 1)"
#     and nothing else. The actual reason (e.g. "PRE-FLIGHT FAIL: on branch X
#     with uncommitted TRACKED changes") only ever reached the CLONE's daily log,
#     which nobody reads. Diagnosis took hours. It now captures the child's
#     output and echoes the failure REASON straight into supervisor.log.
#
#  2. THE LOOP ITSELF. exit 1 -> sleep 60 -> restart -> exit 1 ... forever. The
#     queue was dead for ~2.5 hours and the supervisor reported nothing unusual.
#     It now gives up after N identical consecutive failures and writes an
#     escalation file into docs/pr-prompts/needs-marco/ instead of looping.
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
#   PR_WATCHER_MAX_SAME_FAIL  identical consecutive exit-1 failures tolerated before
#                             the supervisor escalates and stops (default 5)
#   PR_WATCHER_ADOPT_POLL_SEC seconds between liveness polls while supervising an
#                             ADOPTED (already-running, previously orphaned) watcher
#                             (default 60)

$ErrorActionPreference = "Continue"

# Env-carry. This supervisor copy lives in the MAIN tree, so without these two
# vars start-watcher.ps1 refuses (repo root = the interactive tree, exit 1) and
# index.mjs watches the CLONE's docs/pr-prompts instead of the real queue.
# 2026-07-14: a restart crash-looped on exit 1 for exactly this reason.
#   GIT work  -> the isolated clone      (PR_WATCHER_REPO_ROOT)
#   QUEUE     -> the main tree           (PR_WATCHER_PROMPT_DIR)
if (-not $env:PR_WATCHER_REPO_ROOT)  { $env:PR_WATCHER_REPO_ROOT  = "C:\po-watcher\ProjectOperations" }
if (-not $env:PR_WATCHER_PROMPT_DIR) { $env:PR_WATCHER_PROMPT_DIR = "C:\ProjectOperations2\docs\pr-prompts" }

$here        = $PSScriptRoot
$startScript = Join-Path $here "start-watcher.ps1"

$softWaitMin = 20
if ($env:PR_WATCHER_SOFTWAIT_MIN) { $softWaitMin = [int]$env:PR_WATCHER_SOFTWAIT_MIN }
$crashWaitSec = 60
if ($env:PR_WATCHER_CRASH_WAIT_SEC) { $crashWaitSec = [int]$env:PR_WATCHER_CRASH_WAIT_SEC }
$maxSameFail = 5
if ($env:PR_WATCHER_MAX_SAME_FAIL) { $maxSameFail = [int]$env:PR_WATCHER_MAX_SAME_FAIL }
$adoptPollSec = 60
if ($env:PR_WATCHER_ADOPT_POLL_SEC) { $adoptPollSec = [int]$env:PR_WATCHER_ADOPT_POLL_SEC }

$supLog = Join-Path $here "logs\supervisor.log"
New-Item -ItemType Directory -Path (Split-Path $supLog) -Force | Out-Null

$escalationDir = Join-Path $env:PR_WATCHER_PROMPT_DIR "needs-marco"

function Sup-Log([string]$msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format o), $msg
    Add-Content -Path $supLog -Value $line -Encoding UTF8
    Write-Host $line
}

# Work out WHY the child died, from what it printed. Falls back to the clone's
# daily log if the child printed nothing at all.
#
# LL (doctrine 7.6): this function's return value is captured, so it must not
# Write-Output / Write-Host anything -- every stray line would be appended to the
# return value. It returns exactly one string.
function Get-ChildFailureReason {
    param(
        [string[]] $OutputLines,
        [string]   $CloneRoot
    )

    $lines = @()
    if ($OutputLines) {
        $lines = @($OutputLines | Where-Object { $_ -ne $null -and "$_".Trim() -ne "" })
    }

    # 1. An explicit, self-declared failure line from start-watcher.ps1.
    $signals = @($lines | Where-Object { $_ -match 'PRE-FLIGHT FAIL|REFUSE:|SINGLE-INSTANCE' })
    if ($signals.Count -gt 0) { return ("$($signals[-1])").Trim() }

    # 2. Otherwise the last thing it managed to say.
    if ($lines.Count -gt 0) { return ("$($lines[-1])").Trim() }

    # 3. The child said nothing on stdout -- tail the CLONE's daily log, which is
    #    where start-watcher.ps1 mirrors everything.
    if ($CloneRoot) {
        $cloneLog = Join-Path $CloneRoot ("scripts\pr-watcher\logs\{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))
        if (Test-Path $cloneLog) {
            $tail = @(Get-Content -Path $cloneLog -Tail 5 -ErrorAction SilentlyContinue |
                      Where-Object { "$_".Trim() -ne "" })
            if ($tail.Count -gt 0) { return ("clone log tail: " + ($tail -join " | ")) }
        }
    }

    return "(child produced no output and the clone log had nothing to say)"
}

# Strip the leading ISO timestamp so the SAME failure at different times compares
# equal -- otherwise the crash-loop guard never trips.
function Get-ReasonKey([string]$Reason) {
    return ($Reason -replace '^\[[^\]]+\]\s*', '').Trim()
}

function Write-Escalation {
    param(
        [string] $Reason,
        [int]    $Count,
        [string] $Dir
    )

    New-Item -ItemType Directory -Path $Dir -Force | Out-Null
    $stamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
    $path  = Join-Path $Dir ("WATCHER-CRASH-LOOP-{0}.md" -f $stamp)

    $body = @"
# ESCALATION: the PR watcher is in a crash loop and the supervisor has STOPPED

Written by scripts/pr-watcher/supervise-watcher.ps1 at $(Get-Date -Format o).

The watcher child (start-watcher.ps1) exited non-zero **$Count times in a row with
the identical reason**. Rather than keep restarting it every $crashWaitSec seconds
forever -- which once left the queue dead for 2.5 hours undiagnosed -- the
supervisor has stopped and is telling you instead.

## The reason the child gave

``````
$Reason
``````

## The queue is SAFE

Nothing was lost. Every armed prompt is still sitting in ``docs/pr-prompts/`` and
will be picked up on the next successful start.

## What to check

1. The watcher clone: ``C:\po-watcher\ProjectOperations`` -- is it on ``main`` with a clean tree?
   ``````
   git -C C:\po-watcher\ProjectOperations status
   git -C C:\po-watcher\ProjectOperations stash list
   ``````
   start-watcher.ps1 now auto-stashes a dirty tree rather than failing, so if you
   are here it is something the self-heal could not fix.
2. Today's clone log: ``C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\$(Get-Date -Format "yyyy-MM-dd").log``
3. The supervisor log: ``scripts/pr-watcher/logs/supervisor.log``

## Restart, once fixed

``````
powershell -NoProfile -ExecutionPolicy Bypass -File C:\ProjectOperations2\scripts\pr-watcher\supervise-watcher.ps1
``````
"@

    Set-Content -Path $path -Value $body -Encoding UTF8
    return $path
}

Sup-Log "Supervisor started. soft-wait=$softWaitMin min, crash-wait=$crashWaitSec s, max-identical-failures=$maxSameFail."

$lastReasonKey = ""
$sameCount     = 0

while ($true) {
    # Run one watcher session as a child process so we can read its exit code
    # without exiting the supervisor. Use Windows PowerShell 5.1 to match the
    # watcher script's target host; swap to 'pwsh' if you prefer PS 7.
    #
    # Capture the child's output as well as echoing it, so that when it dies we
    # can say WHY in supervisor.log instead of a useless bare exit code.
    $childOut = New-Object 'System.Collections.Generic.List[string]'
    & powershell -NoProfile -ExecutionPolicy Bypass -File $startScript 2>&1 | ForEach-Object {
        $line = "$_"
        Write-Host $line
        $childOut.Add($line)
    }
    $code = $LASTEXITCODE

    if ($code -eq 2) {
        $sameCount     = 0
        $lastReasonKey = ""
        Sup-Log "Watcher soft-halted (usage/rate limit, exit 2). Waiting $softWaitMin min for the quota window, then restarting."
        Start-Sleep -Seconds ($softWaitMin * 60)
        continue
    }
    elseif ($code -eq 1) {
        $reason = Get-ChildFailureReason -OutputLines $childOut.ToArray() -CloneRoot $env:PR_WATCHER_REPO_ROOT
        $key    = Get-ReasonKey $reason

        if ($key -eq $lastReasonKey) { $sameCount++ }
        else { $sameCount = 1; $lastReasonKey = $key }

        Sup-Log "Watcher exited with failure (exit 1). REASON: $reason"
        Sup-Log "Identical consecutive failures: $sameCount of $maxSameFail."

        if ($sameCount -ge $maxSameFail) {
            $escalationPath = Write-Escalation -Reason $reason -Count $sameCount -Dir $escalationDir
            Sup-Log "CRASH-LOOP GUARD TRIPPED: $sameCount identical failures in a row. NOT restarting again."
            Sup-Log "Escalation written to: $escalationPath"
            Sup-Log "Supervisor exiting (exit 1). Fix the cause, then start the supervisor again."
            exit 1
        }

        Sup-Log "Restarting in $crashWaitSec s."
        Start-Sleep -Seconds $crashWaitSec
        continue
    }
    else {
        # Exit 0 has TWO very different causes and conflating them is a bug:
        #
        #   a) start-watcher.ps1's SINGLE-INSTANCE guard found a watcher node
        #      ALREADY running, so it declined to start a second one and exit 0'd.
        #   b) a deliberate stop -- Ctrl+C.
        #
        # (a) is the ORPHANED-NODE case: a node is alive but NO wrapper is
        # supervising it, because a previous wrapper was killed and left it
        # behind. That state was self-perpetuating (found 2026-07-20): relaunching
        # the wrapper made start-watcher exit 0 immediately, this branch treated it
        # as a deliberate stop, and the wrapper died within seconds -- while
        # logging what looked like a successful restart. The node stayed
        # unsupervised, so nothing would restart it when it eventually died.
        #
        # ADOPT it instead: do not start a second node (the guard is right), just
        # sit and watch the existing one. When it goes away, loop round and start
        # a fresh one -- which is exactly what supervising means.
        $reason = Get-ChildFailureReason -OutputLines $childOut.ToArray() -CloneRoot $env:PR_WATCHER_REPO_ROOT
        if ($reason -match 'SINGLE-INSTANCE') {
            Sup-Log "ADOPT: a watcher node is already running and no wrapper was supervising it. Adopting rather than exiting. ($reason)"
            $sameCount     = 0
            $lastReasonKey = ""
            while ($true) {
                Start-Sleep -Seconds $adoptPollSec
                $alive = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
                           Where-Object { $_.CommandLine -match "pr-watcher[\\/]index\.mjs" })
                if ($alive.Count -eq 0) {
                    Sup-Log "ADOPT: the adopted watcher has exited. Starting a fresh one."
                    break
                }
            }
            continue
        }

        # Genuine Ctrl+C. Respect it so a manual stop actually stops things.
        # (The watcher is an fs.watch daemon, so it does NOT exit 0 on an empty queue.)
        Sup-Log "Watcher exited cleanly (exit 0). Treating as a deliberate stop. Supervisor exiting."
        break
    }
}
