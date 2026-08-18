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

# 2026-08-12: heartbeat watchdog for the ALIVE-BUT-HUNG case. The watcher is an
# fs.watch daemon that never exits on its own, so the main loop below (which only
# reacts to the child EXITING) blocked forever on 2026-08-11 when the node hung
# with its heartbeat frozen ~40 min while 16 prompts sat armed -- the whole
# in-chain queue stopped draining and nothing restarted it. Threshold is well
# above the legit inter-tick gap (heartbeat ticks every 60s during a build; the
# gap between prompts is a couple of minutes), so this only fires on a real hang.
$wdHungMin = 15
if ($env:PR_WATCHER_HUNG_MIN) { $wdHungMin = [int]$env:PR_WATCHER_HUNG_MIN }
$wdPollSec = 120
if ($env:PR_WATCHER_WD_POLL_SEC) { $wdPollSec = [int]$env:PR_WATCHER_WD_POLL_SEC }
$wdHeartbeat = Join-Path $env:PR_WATCHER_REPO_ROOT "scripts\pr-watcher\heartbeat.log"

# 2026-08-18: sentinel file for the watchdog/supervisor handshake.
#
# The watchdog kills a hung node via Stop-Process. Out of `powershell -File`, that
# kill manifests as exit code 0 -- INDISTINGUISHABLE from a real Ctrl+C at the code
# alone. Before this file existed, the exit-0 branch below assumed "deliberate stop"
# and made the supervisor EXIT, which left the watcher down for 65 min on 2026-08-18
# (7 prompts armed, 0 in-progress) and produced 5 kill/exit cycles in 90s the night
# before. The lie in the WATCHDOG log line -- "the supervisor will relaunch it" --
# was false for that entire window.
#
# The sentinel decouples intent from exit code: the watchdog writes it BEFORE
# Stop-Process; the main-loop exit handler checks for it FIRST; then it is deleted.
# A stuck flag would turn a real Ctrl+C into an unkillable relaunch loop (the
# opposite failure, and worse), so we ALSO clear it at supervisor start.
$wdKillFlag = Join-Path (Split-Path $wdHeartbeat) '.watchdog-kill.flag'
Remove-Item -Path $wdKillFlag -Force -ErrorAction SilentlyContinue

$supLog = Join-Path $here "logs\supervisor.log"
New-Item -ItemType Directory -Path (Split-Path $supLog) -Force | Out-Null

$escalationDir = Join-Path $env:PR_WATCHER_PROMPT_DIR "needs-marco"

function Sup-Log([string]$msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format o), $msg
    # 2026-08-18 (LL-39): logging must NEVER be able to take the supervisor down.
    # When the host's transcript stream broke, every Add-Content here threw
    # "Stream was not readable" and the resulting error spray was mistaken for the
    # child's own output, corrupting the failure REASON the crash-loop guard keys on.
    # Both writes are best-effort: an unwritable log is a nuisance, not an outage.
    try { Add-Content -Path $supLog -Value $line -Encoding UTF8 -ErrorAction Stop } catch { }
    try { Write-Host $line } catch { }
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

# Pure function: decide what to do after the watcher exits. Extracted so the
# BRANCH LOGIC (rather than the whole while-loop-plus-Start-Job) can be tested
# without booting a live supervisor. Prior to 2026-08-18 the decision was
# inlined and one of its branches (watchdog kill -> exit 0 -> "deliberate stop")
# was structurally untestable, which is exactly why the deadlock survived four
# incidents before being caught. Doctrine 7 -- your instrument lies.
#
# LL (doctrine 7.6): every return is a single [pscustomobject]. No Write-Host,
# no Write-Output, no logging inside this function -- the caller owns log I/O
# using the LogMessage field. Any stray output would pollute nothing here
# (structured return) but would corrupt Sup-Log's REASON parsing upstream.
function Resolve-WatcherExitAction {
    param(
        [Parameter(Mandatory=$true)][int]      $ExitCode,
        [Parameter(Mandatory=$true)][string]   $WatchdogFlagPath,
        [AllowNull()][string[]]                $ChildOutput,
        [AllowEmptyString()][string]           $CloneRoot,
        [AllowEmptyString()][string]           $LastReasonKey,
        [int]                                  $SameCount,
        [int]                                  $MaxSameFail
    )

    # WATCHDOG KILL takes precedence over the exit code.
    # This branch MUST run first. The kill's exit code is 0 out of `powershell -File`
    # -- identical to a real Ctrl+C. Only the sentinel distinguishes them. Deleting
    # the flag here (rather than in the caller) makes the check-and-consume atomic
    # w.r.t. this function's return, so a caller that ignores our decision does not
    # leave a stuck flag armed. Reset the crash-loop counters: a hang is a different
    # failure class from a repeated identical crash, and mixing them would cause a
    # single hang after 4 unrelated crashes to fire the crash-loop escalation.
    if ($WatchdogFlagPath -and (Test-Path $WatchdogFlagPath)) {
        $flagBody = try { (Get-Content -Path $WatchdogFlagPath -Raw -ErrorAction Stop).Trim() } catch { '(flag body unreadable)' }
        Remove-Item -Path $WatchdogFlagPath -Force -ErrorAction SilentlyContinue
        return [pscustomobject]@{
            Action       = 'relaunch-watchdog'
            LogMessage   = "Watcher exited via watchdog kill (exit $ExitCode). Heartbeat was stale; relaunching. Flag: $flagBody"
            NewReasonKey = ''
            NewSameCount = 0
            Reason       = $flagBody
        }
    }

    if ($ExitCode -eq 2) {
        return [pscustomobject]@{
            Action       = 'soft-halt'
            LogMessage   = "Watcher soft-halted (usage/rate limit, exit 2)."
            NewReasonKey = ''
            NewSameCount = 0
            Reason       = ''
        }
    }

    if ($ExitCode -ne 0) {
        $reason  = Get-ChildFailureReason -OutputLines $ChildOutput -CloneRoot $CloneRoot
        $key     = Get-ReasonKey $reason
        $newSame = if ($key -eq $LastReasonKey) { $SameCount + 1 } else { 1 }
        $action  = if ($newSame -ge $MaxSameFail) { 'escalate-crash-loop' } else { 'relaunch-crash' }
        return [pscustomobject]@{
            Action       = $action
            LogMessage   = "Watcher exited with failure (exit $ExitCode). REASON: $reason"
            NewReasonKey = $key
            NewSameCount = $newSame
            Reason       = $reason
        }
    }

    # Exit 0: either the single-instance guard (adopt) or a genuine Ctrl+C.
    $reason = Get-ChildFailureReason -OutputLines $ChildOutput -CloneRoot $CloneRoot
    if ($reason -match 'SINGLE-INSTANCE') {
        return [pscustomobject]@{
            Action       = 'adopt'
            LogMessage   = "ADOPT: a watcher node is already running and no wrapper was supervising it. Adopting rather than exiting. ($reason)"
            NewReasonKey = ''
            NewSameCount = 0
            Reason       = $reason
        }
    }

    return [pscustomobject]@{
        Action       = 'exit-deliberate'
        LogMessage   = "Watcher exited cleanly (exit 0). Treating as a deliberate stop. Supervisor exiting."
        NewReasonKey = $LastReasonKey
        NewSameCount = $SameCount
        Reason       = $reason
    }
}

# TEST HOOK: allow the test harness to dot-source this file for its functions
# without spinning up the watchdog job, the main while-loop, or Start-Sleep waits.
# Nothing else is expected to set this variable in production.
if ($env:PR_WATCHER_SUPERVISOR_DOTSOURCE_ONLY -eq '1') { return }

Sup-Log "Supervisor started. soft-wait=$softWaitMin min, crash-wait=$crashWaitSec s, max-identical-failures=$maxSameFail."
Sup-Log "Heartbeat watchdog armed: restart the node if heartbeat is stale > $wdHungMin min while armed>0 and 0 in-progress (poll ${wdPollSec}s)."

# HEARTBEAT WATCHDOG (2026-08-12) -- additive; the restart-on-exit loop below is
# UNCHANGED. Runs concurrently for the life of the supervisor. When the node is
# alive but HUNG (heartbeat frozen while buildable prompts wait) it kills the
# node so the main loop's exit handling relaunches it fresh (which resets the
# clone). ASCII only.
$null = Start-Job -Name pr-watcher-heartbeat-watchdog -ScriptBlock {
    param($PromptDir, $Heartbeat, $HungMin, $PollSec, $SupLog, $KillFlag)
    function WD-Log([string]$m) {
        try { Add-Content -Path $SupLog -Value ("[{0}] WATCHDOG {1}" -f (Get-Date -Format o), $m) -Encoding UTF8 } catch {}
    }
    WD-Log "started (hungMin=$HungMin pollSec=$PollSec heartbeat=$Heartbeat killFlag=$KillFlag)"
    while ($true) {
        Start-Sleep -Seconds $PollSec
        try {
            $node = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
                      Where-Object { $_.CommandLine -match ([regex]::Escape((Join-Path (Split-Path $Heartbeat) 'index.mjs'))) })
            if ($node.Count -eq 0) { continue }                       # no node: the main loop is (re)starting it
            $armed = @(Get-ChildItem (Join-Path $PromptDir '*-ready.md') -File -ErrorAction SilentlyContinue)
            if ($armed.Count -eq 0) { continue }                      # empty queue: a stale heartbeat is legitimate idle
            $inProg = @(Get-ChildItem (Join-Path $PromptDir 'in-progress\*.md') -File -ErrorAction SilentlyContinue)
            if ($inProg.Count -gt 0) { continue }                     # a build is running: not hung
            $ageMin = if (Test-Path $Heartbeat) { ((Get-Date).ToUniversalTime() - (Get-Item $Heartbeat).LastWriteTimeUtc).TotalMinutes } else { $HungMin + 1 }
            if ($ageMin -gt $HungMin) {
                # SENTINEL FIRST, THEN KILL. Order is doctrine, not an opinion. If we
                # kill first and the write fails, the exit handler reads exit 0 and
                # treats OUR kill as a deliberate stop -- the exact 2026-08-18 outage.
                # Write is best-effort; if it throws we log and DO NOT kill, so we
                # never manufacture the ambiguous exit.
                $flagWritten = $false
                try {
                    Set-Content -Path $KillFlag -Value ("[{0}] pid={1} armed={2} ageMin={3}" -f (Get-Date -Format o), $node[0].ProcessId, $armed.Count, [int]$ageMin) -Encoding UTF8 -ErrorAction Stop
                    $flagWritten = $true
                } catch {
                    WD-Log ("FLAG WRITE FAILED (" + $_.Exception.Message + "). Skipping kill this cycle to avoid the ambiguous-exit deadlock.")
                }
                if ($flagWritten) {
                    WD-Log ("heartbeat stale {0} min with {1} armed and 0 in-progress -> node HUNG. Sentinel written; killing pid {2}. Supervisor exit handler will relaunch via the watchdog-kill branch." -f [int]$ageMin, $armed.Count, $node[0].ProcessId)
                    foreach ($p in $node) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
                    Start-Sleep -Seconds 150                          # let the supervisor relaunch; avoid a double-kill
                }
            }
        } catch { WD-Log ("poll error: " + $_.Exception.Message) }
    }
} -ArgumentList $env:PR_WATCHER_PROMPT_DIR, $wdHeartbeat, $wdHungMin, $wdPollSec, $supLog, $wdKillFlag

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

    # SINGLE decision-point. The old inlined if/elseif ladder was where the four
    # different exit-code interpretations lived, and the watchdog-kill branch had
    # no way in -- the ambiguity between OUR kill and Ctrl+C was inescapable. All
    # branch reasoning is now in Resolve-WatcherExitAction (testable in isolation);
    # this loop is a driver that acts on the returned decision. See #1163's churn
    # detector: the "Watcher exited via watchdog kill" LogMessage below still
    # matches its 'Watcher exited' regex, so a repeated hang still trips the
    # churn halt at 4 kills in 20 min -- the two guards coexist.
    $decision = Resolve-WatcherExitAction `
        -ExitCode         $code `
        -WatchdogFlagPath $wdKillFlag `
        -ChildOutput      $childOut.ToArray() `
        -CloneRoot        $env:PR_WATCHER_REPO_ROOT `
        -LastReasonKey    $lastReasonKey `
        -SameCount        $sameCount `
        -MaxSameFail      $maxSameFail

    $lastReasonKey = $decision.NewReasonKey
    $sameCount     = $decision.NewSameCount
    Sup-Log $decision.LogMessage

    switch ($decision.Action) {
        'soft-halt' {
            Sup-Log "Waiting $softWaitMin min for the quota window, then restarting."
            Start-Sleep -Seconds ($softWaitMin * 60)
        }
        'relaunch-watchdog' {
            # Short breather so the killed node is fully reaped before start-watcher's
            # single-instance guard runs, and so a stubbornly-hanging child does not
            # get relaunched in a hot loop (the churn detector already caps this at 4
            # in 20 min, but a 5s pause is cheap insurance either way).
            Start-Sleep -Seconds 5
        }
        'relaunch-crash' {
            Sup-Log "Identical consecutive failures: $sameCount of $maxSameFail."
            Sup-Log "Restarting in $crashWaitSec s."
            Start-Sleep -Seconds $crashWaitSec
        }
        'escalate-crash-loop' {
            Sup-Log "Identical consecutive failures: $sameCount of $maxSameFail."
            $escalationPath = Write-Escalation -Reason $decision.Reason -Count $sameCount -Dir $escalationDir
            Sup-Log "CRASH-LOOP GUARD TRIPPED: $sameCount identical failures in a row. NOT restarting again."
            Sup-Log "Escalation written to: $escalationPath"
            Sup-Log "Supervisor exiting (exit 1). Fix the cause, then start the supervisor again."
            exit 1
        }
        'adopt' {
            # A node is already running with no wrapper supervising it (orphaned by a
            # previous killed wrapper). Sit and watch it rather than starting a second
            # one; when it goes away, loop round and start a fresh one. Discovered
            # 2026-07-20 -- prior to this the wrapper died within seconds and left the
            # node unsupervised. See supervise-watcher git history for the incident.
            while ($true) {
                Start-Sleep -Seconds $adoptPollSec
                $alive = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
                           Where-Object { $_.CommandLine -match ([regex]::Escape((Join-Path $env:PR_WATCHER_REPO_ROOT "scripts\pr-watcher\index.mjs"))) })
                if ($alive.Count -eq 0) {
                    Sup-Log "ADOPT: the adopted watcher has exited. Starting a fresh one."
                    break
                }
            }
        }
        'exit-deliberate' {
            # Genuine Ctrl+C. Respect it so a manual stop actually stops things.
            # (The watcher is an fs.watch daemon, so it does NOT exit 0 on an empty queue.)
            break
        }
    }

    if ($decision.Action -eq 'exit-deliberate') { break }
}
