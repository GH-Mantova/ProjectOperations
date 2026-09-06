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
#   PR_WATCHER_LANE           0-based lane index this supervisor owns (default unset =
#                             single-lane mode, byte-for-byte legacy behaviour)
#   PR_WATCHER_LANES          total number of lanes (default 2, must match index.mjs)

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
# Max age of .queue-state.json before the watchdog falls back to the raw on-disk
# armed count. 10 min = 2 rescan intervals (healthy node always looks fresh) and
# below the 15-min hung threshold (stopped node is still caught).
$wdStateMaxAgeMin = 10
if ($env:PR_WATCHER_WD_STATE_MAX_MIN) { $wdStateMaxAgeMin = [int]$env:PR_WATCHER_WD_STATE_MAX_MIN }
$wdHeartbeat = Join-Path $env:PR_WATCHER_REPO_ROOT "scripts\pr-watcher\heartbeat.log"

# 2026-08-20: lane-aware watchdog. When PR_WATCHER_LANE is set, the watchdog
# only counts prompts owned by this lane as "runnable" in its fallback path.
# Unset => legacy single-lane behaviour (count everything, no filtering).
# Defaults mirror index.mjs lines 84-92: LANE null, LANES 2.
$watcherLane  = $null
$watcherLanes = 2
if ($env:PR_WATCHER_LANE -ne $null -and $env:PR_WATCHER_LANE -ne '') {
    $parsedLane = 0
    if ([int]::TryParse($env:PR_WATCHER_LANE, [ref]$parsedLane)) { $watcherLane = $parsedLane }
}
if ($env:PR_WATCHER_LANES -ne $null -and $env:PR_WATCHER_LANES -ne '') {
    $parsedLanes = 2
    if ([int]::TryParse($env:PR_WATCHER_LANES, [ref]$parsedLanes) -and $parsedLanes -ge 1) {
        $watcherLanes = $parsedLanes
    }
}
$laneClassifyScript = Join-Path $here "lane-classify.mjs"

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

# Pure function: decide whether a series of watchdog kills constitutes churn
# that warrants halting the supervisor. Extracted for testability -- the caller
# passes Now explicitly so the test suite can control it; this function calls
# Get-Date nowhere and performs no I/O.
#
# Returns [pscustomobject] @{
#   InWindow = <int>          -- kill count inside the window (after pruning)
#   Halt     = <bool>         -- true when InWindow -ge Threshold
#   Kept     = [datetime[]]   -- the subset of KillTimes within the window
# }
#
# LL (doctrine 7.6): no Write-Output / Write-Host; the caller owns all logging.
function Resolve-WatchdogChurn {
    param(
        [datetime[]] $KillTimes,
        [datetime]   $Now,
        [int]        $WindowMinutes = 20,
        [int]        $Threshold     = 4
    )

    if (-not $KillTimes -or $KillTimes.Count -eq 0) {
        return [pscustomobject]@{ InWindow = 0; Halt = $false; Kept = @() }
    }

    $cutoff = $Now.AddMinutes(-$WindowMinutes)
    # Keep times AFTER the cutoff (i.e. within the window). Future timestamps
    # are also kept -- a clock skew must not hide churn.
    $kept = @($KillTimes | Where-Object { $_ -gt $cutoff })

    $inWindow = $kept.Count
    return [pscustomobject]@{
        InWindow = $inWindow
        Halt     = ($inWindow -ge $Threshold)
        Kept     = $kept
    }
}

# Pure function: WATCHDOG_RESTART_GRACE_V1 (2026-09-06).
#
# THE DEFECT IT FIXES. The heartbeat only ticks MID-RUN (DOCTRINE 9.5). A node
# that has just been launched has, by construction, not ticked it yet -- so the
# age of heartbeat.log describes THE QUEUE'S LAST REAL RUN, not the process
# being judged. With a prompt armed and nothing in progress, every freshly
# launched node therefore satisfied "heartbeat stale AND armed AND runnable>0"
# the instant it appeared. Station 00 watched a node launched at 2026-09-06
# 09.28.41Z get killed at 09.29.07Z with ageMin=26 in the kill flag: 26 MINUTES
# of staleness attributed to a 26-SECOND-old process. The supervisor relaunched,
# the next node died the same way, the churn guard tripped at four kills, and the
# loop re-armed one prompt on every restart -- four duplicate PRs of one slice.
#
# THE RULE. The staleness clock starts at the LATER of (heartbeat last write,
# node process start). A new node gets a full $HungMin from ITS OWN start to
# produce its first tick; after that it is judged on its own heartbeat exactly
# as before. This does NOT weaken the watchdog -- the 2026-08-11 hang it exists
# for has a node start HOURS old, so the heartbeat is the later clock and stays
# the judge:
#
#   situation                        node start   heartbeat   judged   outcome
#   the 2026-08-11 hang              hours ago    40 min ago  40 min   killed
#   a node relaunched after a kill   26 s ago     26 min ago  26 s     spared
#   a node that started then froze   hours ago    20 min ago  20 min   killed
#
# CONTRACT. Both timestamps are UTC DateTimes or $null; this function does NOT
# convert time zones -- the caller owns that (Get-Item .LastWriteTimeUtc is
# already UTC; Win32_Process CreationDate is LOCAL and must be converted).
#   $HeartbeatUtc = $null  -- no heartbeat file yet ("never ticked").
#   $NodeStartUtc = $null  -- the node's start time could not be read. NO GRACE
#                             is granted in that case: judgement falls back to
#                             the heartbeat alone, i.e. the pre-fix behaviour.
#                             Deliberate -- an unreadable clock must not be able
#                             to make a genuinely hung node immortal. The caller
#                             logs it.
#   both $null             -- returns $HungMin + 1, the pre-fix "force a kill"
#                             value, unchanged.
# A negative age (clock skew, a timestamp in the future) clamps to 0 = "not
# stale", which is what the pre-fix arithmetic did too (a negative TotalMinutes
# is never -gt $HungMin).
#
# LL (doctrine 7.6): reads no files, no processes, no environment, and writes no
# output but its return value. The caller owns all logging and all I/O.
function Resolve-WatchdogJudgedAgeMinutes {
    param(
        [object]                               $HeartbeatUtc,
        [object]                               $NodeStartUtc,
        [Parameter(Mandatory=$true)][datetime] $NowUtc,
        [Parameter(Mandatory=$true)][int]      $HungMin
    )

    $hb = $null
    if ($HeartbeatUtc -is [datetime]) { $hb = [datetime]$HeartbeatUtc }
    $ns = $null
    if ($NodeStartUtc -is [datetime]) { $ns = [datetime]$NodeStartUtc }

    # Neither clock is readable: preserve the pre-fix "treat as stale" value.
    if ($null -eq $hb -and $null -eq $ns) { return [double]($HungMin + 1) }

    # The staleness clock is the LATER of the two known times.
    $clock = $hb
    if ($null -eq $clock) {
        $clock = $ns
    }
    elseif ($null -ne $ns -and $ns -gt $clock) {
        $clock = $ns
    }

    $age = ($NowUtc - $clock).TotalMinutes
    if ($age -lt 0) { return [double]0 }
    return [double]$age
}

# TEST HOOK: allow the test harness to dot-source this file for its functions
# without spinning up the watchdog job, the main while-loop, or Start-Sleep waits.
# Nothing else is expected to set this variable in production.
if ($env:PR_WATCHER_SUPERVISOR_DOTSOURCE_ONLY -eq '1') { return }

$laneDesc = if ($null -eq $watcherLane) { 'unset (single-lane mode)' } else { "lane=$watcherLane of $watcherLanes" }
Sup-Log "Supervisor started. soft-wait=$softWaitMin min, crash-wait=$crashWaitSec s, max-identical-failures=$maxSameFail. PR_WATCHER_LANE=$laneDesc"
Sup-Log "Heartbeat watchdog armed: restart the node if the JUDGED age (WATCHDOG_RESTART_GRACE_V1: the later of heartbeat last write and node process start, or heartbeat-only when the node CreationDate is unreadable) is stale > $wdHungMin min while runnable>0 (poll ${wdPollSec}s). That is the whole test: nothing checks whether a build is in flight, deliberately -- a hung node is one that believes it is building. Node publishes .queue-state.json; watchdog reads it (max age ${wdStateMaxAgeMin} min); falls back to lane-filtered on-disk count if file is missing or stale."

# WATCHDOG_RESTART_GRACE_V1 -- carry the pure function INTO the watchdog job.
#
# Start-Job runs its scriptblock in a FRESH runspace that does NOT inherit this
# scope's function definitions. A pure helper defined only out here and never
# reachable from the job would be a decorative guard -- this file carried one of
# those until 2026-09-06 (the in-progress\*.md check read a directory no producer
# writes; deleted, see the note at the poll site), and one was enough.
# -InitializationScript runs in the JOB's session state before the scriptblock
# does, so the function it defines is in scope for the poll loop.
#
# The init script's text is READ BACK OFF THE LIVE FUNCTION (FunctionInfo's
# ScriptBlock is the function body; ToString() is that body's source text) rather
# than being a second, hand-copied definition. So there is exactly ONE definition
# of the rule in this file: edit the function above and the job's copy changes
# with it. A duplicate would be free to drift -- the same defect in a new costume.
# -ErrorAction Stop on the lookup means a rename that misses one of the two names
# fails the supervisor at start-up rather than shipping a watchdog with no grace.
$wdGraceFnInfo = Get-Command Resolve-WatchdogJudgedAgeMinutes -CommandType Function -ErrorAction Stop
$wdGraceInit   = [scriptblock]::Create(
    "function Resolve-WatchdogJudgedAgeMinutes {`n" + $wdGraceFnInfo.ScriptBlock.ToString() + "`n}"
)

# HEARTBEAT WATCHDOG (2026-08-12) -- additive; the restart-on-exit loop below is
# UNCHANGED. Runs concurrently for the life of the supervisor. When the node is
# alive but HUNG (heartbeat frozen while buildable prompts wait) it kills the
# node so the main loop's exit handling relaunches it fresh (which resets the
# clone). ASCII only.
$null = Start-Job -Name pr-watcher-heartbeat-watchdog -InitializationScript $wdGraceInit -ScriptBlock {
    param($PromptDir, $Heartbeat, $HungMin, $PollSec, $SupLog, $KillFlag, $StateMaxAgeMin,
          $WatcherLane, $WatcherLanes, $LaneClassifyScript, $EscalationDir)
    function WD-Log([string]$m) {
        try { Add-Content -Path $SupLog -Value ("[{0}] WATCHDOG {1}" -f (Get-Date -Format o), $m) -Encoding UTF8 } catch {}
    }
    $laneDesc = if ($null -eq $WatcherLane) { 'unset (single-lane)' } else { "lane=$WatcherLane of $WatcherLanes" }
    WD-Log "started (hungMin=$HungMin pollSec=$PollSec heartbeat=$Heartbeat killFlag=$KillFlag stateMaxAgeMin=$StateMaxAgeMin PR_WATCHER_LANE=$laneDesc)"

    # WATCHDOG_RESTART_GRACE_V1 -- prove the carry before the first poll.
    # Every kill decision below goes through Resolve-WatchdogJudgedAgeMinutes,
    # which reaches this runspace only via -InitializationScript. If that ever
    # breaks, the call inside the poll loop would throw CommandNotFoundException
    # into the loop's own catch and log "poll error" once per poll forever -- a
    # watchdog that looks armed in the log and is not. Check it once, name it,
    # and stop: a watchdog that cannot compute its grace must not kill, because
    # the pre-fix arithmetic is exactly the kill loop this change exists to end.
    if (-not (Get-Command Resolve-WatchdogJudgedAgeMinutes -CommandType Function -ErrorAction SilentlyContinue)) {
        WD-Log "FATAL: WATCHDOG_RESTART_GRACE_V1 -- Resolve-WatchdogJudgedAgeMinutes is NOT defined in this job runspace (the -InitializationScript carry failed). Refusing to poll; the watchdog is INERT until this is fixed. No kills will be issued."
        return
    }
    WD-Log "WATCHDOG_RESTART_GRACE_V1 active: judged age = now - max(heartbeat last write, node process start). A node relaunched less than $HungMin min ago is judged on its own start, not on the previous node's heartbeat."

    # --- Lane-aware fallback armed-count helper (2026-08-20) -----------------
    # When PR_WATCHER_LANE is set and .queue-state.json is missing/stale, shell
    # out to lane-classify.mjs (which imports laneFor from index.mjs) to count
    # only prompts this lane owns. index.mjs stays the single source of truth.
    # When PR_WATCHER_LANE is unset, returns the raw count -- byte-for-byte
    # identical to the pre-2026-08-20 behaviour (single-lane default).
    #
    # Returns [hashtable] @{ MyCount=<int>; OrphanNames=<string[]> }
    #   MyCount     -- prompts this lane can own (0 when no filtering active)
    #   OrphanNames -- names armed for a different lane (empty when no filtering)
    function Get-LaneAwareCount {
        param([string[]]$ArmedNames)
        if ($null -eq $WatcherLane) {
            # Single-lane mode: no filtering.
            return @{ MyCount = $ArmedNames.Count; OrphanNames = @() }
        }
        if ($ArmedNames.Count -eq 0) {
            return @{ MyCount = 0; OrphanNames = @() }
        }
        # Shell out to node. Each name is a separate argument; node prints one
        # JSON object per line. A failure exits 0 (see lane-classify.mjs header)
        # and prints lane=0 conservatively.
        $myCount    = 0
        $orphanList = New-Object 'System.Collections.Generic.List[string]'
        try {
            # Pass names as individual arguments to avoid shell quoting issues.
            $classifyArgs = @($LaneClassifyScript, $PromptDir, "$WatcherLanes") + $ArmedNames
            $lines = & node @classifyArgs 2>$null
            foreach ($rawLine in $lines) {
                $trimmed = "$rawLine".Trim()
                if ($trimmed -eq '') { continue }
                try {
                    $obj = $trimmed | ConvertFrom-Json
                    if ($obj.lane -eq $WatcherLane) {
                        $myCount++
                    } else {
                        $orphanList.Add($obj.name)
                    }
                } catch {
                    # Malformed JSON line: count it conservatively as ours.
                    WD-Log ("lane-classify: malformed JSON line, counting conservatively: $trimmed")
                    $myCount++
                }
            }
        } catch {
            # node not available or script error: fall back to counting everything.
            WD-Log ("lane-classify: node invocation failed (" + $_.Exception.Message + "); falling back to total armed count.")
            return @{ MyCount = $ArmedNames.Count; OrphanNames = @() }
        }
        return @{ MyCount = $myCount; OrphanNames = $orphanList.ToArray() }
    }

    # --- Orphan escalation tracker (2026-08-20) -------------------------------
    # Write exactly ONE escalation file per distinct orphan set. A "distinct set"
    # is identified by the sorted, pipe-joined list of orphan names -- if the set
    # changes (a new prompt armed), a new file is written; the same set never
    # produces more than one file regardless of how many polls fire.
    # Key = sorted pipe-joined orphan name string; value = path already written.
    $orphanEscalationsWritten = @{}
    # Count of consecutive polls where the same orphan set was seen with no other
    # lane's watcher running. After this many polls we write the escalation file.
    $orphanSustainedPolls = 3
    # Track consecutive-poll counters per orphan-set key.
    $orphanPollCounts = @{}

    function Test-OtherLaneRunning {
        # Detect whether any node.exe is running index.mjs from a DIFFERENT
        # PR_WATCHER_REPO_ROOT by checking process command-lines. We cannot know
        # the other lane's repo root without extra config, so we look for ANY
        # node.exe running index.mjs that is NOT the one we already know about.
        # This mirrors how the main supervisor detects an already-running watcher.
        $scriptName = 'index.mjs'
        $allNodes = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
                      Where-Object { $_.CommandLine -match $scriptName })
        return ($allNodes.Count -gt 1)  # >1 = at least one other lane is running
    }

    function Write-OrphanEscalation {
        param([string]$Key, [string[]]$OrphanNames, [int]$PollCount)
        try {
            New-Item -ItemType Directory -Path $EscalationDir -Force | Out-Null
            # Deterministic filename: hash of the sorted key so a re-armed
            # identical set maps to the same basename and is never re-written.
            $keyBytes  = [System.Text.Encoding]::UTF8.GetBytes($Key)
            $hashBytes = [System.Security.Cryptography.SHA1]::Create().ComputeHash($keyBytes)
            $keyHash   = ($hashBytes | ForEach-Object { "{0:x2}" -f $_ }) -join ''
            $filename  = "ORPHANED-LANE-PROMPTS-{0}.md" -f $keyHash.Substring(0, 12)
            $path      = Join-Path $EscalationDir $filename
            if (Test-Path $path) {
                # Already written for this exact set; do not duplicate.
                return $path
            }
            $stamp   = Get-Date -Format o
            $nameList = ($OrphanNames | ForEach-Object { "- $_" }) -join "`n"
            $body = @"
# ESCALATION: armed prompts orphaned in wrong lane

Written by scripts/pr-watcher/supervise-watcher.ps1 at $stamp.
Lane: PR_WATCHER_LANE=$WatcherLane of $WatcherLanes

The following prompt(s) are armed (*-ready.md) but hash to a DIFFERENT lane
whose watcher has not been running for at least $PollCount consecutive watchdog
polls (~$([int]($PollCount * $PollSec / 60)) min). They will NEVER be dequeued
by this watcher (lane $WatcherLane) and are not making progress.

## Orphaned prompts

$nameList

## What to do

1. Start the other lane's watcher (or set PR_WATCHER_LANE / PR_WATCHER_LANES
   correctly so a supervisor picks them up).
2. Or move the files to the correct lane's prompt dir.

## Diagnosing the lane

Run the classifier to confirm:
  node scripts\pr-watcher\lane-classify.mjs <promptDir> $WatcherLanes <name...>

## The queue is safe

No prompts were deleted. They sit in docs/pr-prompts/ as *-ready.md files.
"@
            Set-Content -Path $path -Value $body -Encoding UTF8 -ErrorAction Stop
            return $path
        } catch {
            WD-Log ("ORPHAN-ESCALATION write failed: " + $_.Exception.Message)
            return ''
        }
    }

    while ($true) {
        Start-Sleep -Seconds $PollSec
        try {
            $node = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
                      Where-Object { $_.CommandLine -match ([regex]::Escape((Join-Path (Split-Path $Heartbeat) 'index.mjs'))) })
            if ($node.Count -eq 0) { continue }                       # no node: the main loop is (re)starting it
            $armed = @(Get-ChildItem (Join-Path $PromptDir '*-ready.md') -File -ErrorAction SilentlyContinue)
            if ($armed.Count -eq 0) { continue }   # empty queue: a stale heartbeat is legitimate idle

            # --- Lane-aware classification (2026-08-20) ----------------------
            # Count only prompts this lane owns for the stale-heartbeat test.
            # Orphan detection runs every cycle but writes at most once per set.
            $armedNames  = @($armed | ForEach-Object { $_.Name })
            $laneResult  = Get-LaneAwareCount -ArmedNames $armedNames

            # Orphan reporting: log every cycle; write escalation file once per
            # distinct set after $orphanSustainedPolls consecutive cycles.
            if ($laneResult.OrphanNames.Count -gt 0) {
                $sortedOrphans = @($laneResult.OrphanNames | Sort-Object)
                $orphanKey     = $sortedOrphans -join '|'
                $otherRunning  = Test-OtherLaneRunning
                WD-Log ("orphaned prompts for other lane (other-lane-running=$otherRunning): " + ($sortedOrphans -join ', '))
                if (-not $otherRunning) {
                    $prevCount = if ($orphanPollCounts.ContainsKey($orphanKey)) { $orphanPollCounts[$orphanKey] } else { 0 }
                    $newCount  = $prevCount + 1
                    $orphanPollCounts[$orphanKey] = $newCount
                    if ($newCount -ge $orphanSustainedPolls -and -not $orphanEscalationsWritten.ContainsKey($orphanKey)) {
                        $esc = Write-OrphanEscalation -Key $orphanKey -OrphanNames $sortedOrphans -PollCount $newCount
                        if ($esc -ne '') {
                            $orphanEscalationsWritten[$orphanKey] = $esc
                            WD-Log ("ORPHAN-ESCALATION written: $esc (set: $orphanKey)")
                        }
                    }
                } else {
                    # Other lane is running: reset counter (it will pick them up).
                    $orphanPollCounts[$orphanKey] = 0
                }
            }

            # The NODE is the only authority on what it can dequeue (lane routing +
            # dependency gates both live in index.mjs). It publishes that number; we
            # read it. If the file is missing or stale the node has stopped rescanning,
            # so fall back to the lane-classified on-disk count (2026-08-20: was raw
            # total -- the bug that caused the kill loop when all armed prompts belonged
            # to another lane).
            $stateFile = Join-Path (Split-Path $Heartbeat) '.queue-state.json'
            $runnable  = $laneResult.MyCount
            $howKnown  = ("lane-classified on-disk count (lane=$WatcherLane, my={0} of {1} armed)" -f $laneResult.MyCount, $armed.Count)
            try {
                if (Test-Path $stateFile) {
                    $stateAgeMin = ((Get-Date).ToUniversalTime() - (Get-Item $stateFile).LastWriteTimeUtc).TotalMinutes
                    if ($stateAgeMin -le $StateMaxAgeMin) {
                        $state = Get-Content $stateFile -Raw | ConvertFrom-Json
                        if ($null -ne $state.runnable) {
                            $runnable = [int]$state.runnable
                            $howKnown = ("node-published (state age {0} min)" -f [int]$stateAgeMin)
                        }
                    }
                }
            } catch { WD-Log ("queue-state read failed (" + $_.Exception.Message + "); using the lane-classified on-disk count.") }

            if ($runnable -le 0) {
                WD-Log ("armed={0} runnable=0 -- nothing this node can dequeue; a stale heartbeat is legitimate idle. Source: {1}." -f $armed.Count, $howKnown)
                continue
            }

            # --- NO BUILD-IN-FLIGHT GUARD HERE, DELIBERATELY (2026-09-06) ---
            # Until this date two lines here counted docs/pr-prompts/in-progress\*.md
            # and skipped the cycle when the count was non-zero ("a build is
            # running: not hung"). NOTHING has ever written that directory --
            # index.mjs retires prompts to processed/, failed/, no-pr-opened/,
            # blocked/ and paused/ and to nothing else, the directory is absent
            # from origin/main, and queue-sync.ps1 only Test-Paths it. The count
            # was therefore permanently 0, the guard never once fired, and the
            # two log lines that advertised it were describing a check that was
            # not happening.
            #
            # DO NOT REINSTATE IT -- not against in-progress\*.md, not against
            # heartbeat.log, .queue-state.json, or any other signal. A guard that
            # actually said "a build is running, so do not kill" would DISABLE
            # this watchdog for the exact failure it exists for: on 2026-08-11
            # (header note above) the node hung MID-RUN with its heartbeat frozen
            # ~40 min while 16 prompts sat armed and nothing restarted it. A hung
            # node is, by definition, a node that believes it is building.
            #
            # The staleness test below is the whole test, and it is enough.
            # --- WATCHDOG_RESTART_GRACE_V1 (2026-09-06) ----------------------
            # The heartbeat only ticks MID-RUN, so its age describes the queue's
            # last real run, NOT the process we are about to judge. Judge by the
            # LATER of (heartbeat last write, node process start) so a node that
            # has just been relaunched gets a full $HungMin from its own start to
            # produce its first tick. A node that started hours ago is still
            # judged on its frozen heartbeat and still gets killed -- the
            # 2026-08-11 hang this watchdog exists for is unaffected.
            #
            # No new signal is introduced: CreationDate already comes back on the
            # Win32_Process instances fetched above. When more than one node
            # matches, take the LATEST start -- the kill below stops ALL of them,
            # so if any matched process is freshly launched the set is not hung.
            $hbUtc = $null
            if (Test-Path $Heartbeat) { $hbUtc = (Get-Item $Heartbeat).LastWriteTimeUtc }
            $nodeStartUtc = $null
            foreach ($p in $node) {
                if ($null -ne $p.CreationDate) {
                    try {
                        $cUtc = ([datetime]$p.CreationDate).ToUniversalTime()
                        if ($null -eq $nodeStartUtc -or $cUtc -gt $nodeStartUtc) { $nodeStartUtc = $cUtc }
                    } catch {}
                }
            }
            if ($null -eq $nodeStartUtc) {
                # Do not substitute a different signal (a marker file, a launch
                # line in the log): every other candidate adds a producer that can
                # go missing, which is precisely how the in-progress guard died.
                # Fall back to the heartbeat alone and say so.
                WD-Log ("WATCHDOG_RESTART_GRACE_V1: CreationDate unreadable on the matched node process(es); judging on the heartbeat alone this cycle (no restart grace).")
            }
            $nowUtc = (Get-Date).ToUniversalTime()
            $ageMin = Resolve-WatchdogJudgedAgeMinutes -HeartbeatUtc $hbUtc -NodeStartUtc $nodeStartUtc -NowUtc $nowUtc -HungMin $HungMin
            $hbAgeMin   = if ($null -ne $hbUtc)        { ($nowUtc - $hbUtc).TotalMinutes }        else { -1 }
            $nodeAgeMin = if ($null -ne $nodeStartUtc) { ($nowUtc - $nodeStartUtc).TotalMinutes } else { -1 }
            if ($ageMin -le $HungMin -and $hbAgeMin -gt $HungMin) {
                # The spared case. Log it: this line is the live proof that the
                # grace is in the job path and which clock decided.
                WD-Log ("WATCHDOG_RESTART_GRACE_V1: SPARED pid {0} -- heartbeat is {1} min stale but the node is only {2} min old; judged age {3} min <= hungMin {4}. This is the restart the pre-fix watchdog killed." -f $node[0].ProcessId, [int]$hbAgeMin, [int]$nodeAgeMin, [int]$ageMin, $HungMin)
            }
            if ($ageMin -gt $HungMin) {
                # SENTINEL FIRST, THEN KILL. Order is doctrine, not an opinion. If we
                # kill first and the write fails, the exit handler reads exit 0 and
                # treats OUR kill as a deliberate stop -- the exact 2026-08-18 outage.
                # Write is best-effort; if it throws we log and DO NOT kill, so we
                # never manufacture the ambiguous exit.
                $flagWritten = $false
                try {
                    Set-Content -Path $KillFlag -Value ("[{0}] pid={1} armed={2} runnable={3} ageMin={4} hbAgeMin={5} nodeAgeMin={6} grace=WATCHDOG_RESTART_GRACE_V1" -f (Get-Date -Format o), $node[0].ProcessId, $armed.Count, $runnable, [int]$ageMin, [int]$hbAgeMin, [int]$nodeAgeMin) -Encoding UTF8 -ErrorAction Stop
                    $flagWritten = $true
                } catch {
                    WD-Log ("FLAG WRITE FAILED (" + $_.Exception.Message + "). Skipping kill this cycle to avoid the ambiguous-exit deadlock.")
                }
                if ($flagWritten) {
                    WD-Log ("judged age {0} min (heartbeat {1} min, node {2} min old; WATCHDOG_RESTART_GRACE_V1 judges by the later) with armed={3} runnable={4} -> node HUNG (staleness is the whole test; no build-in-flight check is performed, by design). Sentinel written; killing pid {5}. Supervisor exit handler will relaunch via the watchdog-kill branch." -f [int]$ageMin, [int]$hbAgeMin, [int]$nodeAgeMin, $armed.Count, $runnable, $node[0].ProcessId)
                    foreach ($p in $node) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
                    Start-Sleep -Seconds 150                          # let the supervisor relaunch; avoid a double-kill
                }
            }
        } catch { WD-Log ("poll error: " + $_.Exception.Message) }
    }
} -ArgumentList $env:PR_WATCHER_PROMPT_DIR, $wdHeartbeat, $wdHungMin, $wdPollSec, $supLog, $wdKillFlag, $wdStateMaxAgeMin,
    $watcherLane, $watcherLanes, $laneClassifyScript, $escalationDir

$lastReasonKey     = ""
$sameCount         = 0
$watchdogKillTimes = New-Object 'System.Collections.Generic.List[datetime]'
$wdChurnWindowMin  = 20
$wdChurnThreshold  = 4
if ($env:PR_WATCHER_WD_CHURN_WINDOW_MIN) { $wdChurnWindowMin = [int]$env:PR_WATCHER_WD_CHURN_WINDOW_MIN }
if ($env:PR_WATCHER_WD_CHURN_THRESHOLD)  { $wdChurnThreshold = [int]$env:PR_WATCHER_WD_CHURN_THRESHOLD }

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
    # this loop is a driver that acts on the returned decision.
    #
    # NOTE on the churn guards: scripts/restart-watcher-if-wedged.ps1 contains
    # Get-RestartChurn / Invoke-ChurnHalt and uses the same 20 min / 4 kill
    # parameters, but that script is invoked ONLY on demand (by hand or by a
    # station agent). It does NOT run on a schedule and is NOT called from here.
    # Resolve-WatchdogChurn (below, in the 'relaunch-watchdog' branch) is the
    # automatic in-loop guard that covers the watchdog-kill path.
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
            # Record this kill in the in-loop churn counter. Resolve-WatchdogChurn
            # is the automatic guard for repeated watchdog kills; it mirrors the 20
            # min / 4 kill parameters of restart-watcher-if-wedged.ps1 so both
            # guards agree. restart-watcher-if-wedged.ps1 is on-demand only and is
            # NOT called from here.
            $watchdogKillTimes.Add((Get-Date))
            $churn = Resolve-WatchdogChurn -KillTimes $watchdogKillTimes.ToArray() `
                         -Now (Get-Date) `
                         -WindowMinutes $wdChurnWindowMin `
                         -Threshold $wdChurnThreshold
            $watchdogKillTimes = [System.Collections.Generic.List[datetime]]::new([datetime[]]$churn.Kept)
            Sup-Log ("Watchdog kill {0} of {1} inside a {2} min window." -f $churn.InWindow, $wdChurnThreshold, $wdChurnWindowMin)

            if ($churn.Halt) {
                $escalationPath = Write-Escalation -Reason "watchdog-kill churn: $($churn.InWindow) kills in $wdChurnWindowMin min" -Count $churn.InWindow -Dir $escalationDir
                Sup-Log "WATCHDOG-KILL CHURN GUARD TRIPPED: $($churn.InWindow) kills in $wdChurnWindowMin min. NOT restarting again."
                Sup-Log "Escalation written to: $escalationPath"
                Sup-Log "Supervisor exiting (exit 1). Fix the cause, then start the supervisor again."
                exit 1
            }

            # Short breather so the killed node is fully reaped before start-watcher's
            # single-instance guard runs.
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
