# Pester tests for supervise-watcher.ps1's exit-branch decision.
#
# Why this file exists:
#   The 2026-08-18 incident was a WATCHDOG kill (Stop-Process on a hung node)
#   that manifested as exit 0 out of `powershell -File`, indistinguishable at
#   the code from a real Ctrl+C. The supervisor's "exit 0 == deliberate stop"
#   branch fired, the supervisor exited, and the watcher stayed down for 65
#   min with 7 prompts armed. The prior five kill/exit cycles in 90s the same
#   night had already fired the same trap without anyone catching it.
#
#   The fix (this PR) makes the watchdog write a SENTINEL FILE before killing;
#   the exit handler checks the sentinel FIRST and relaunches. These tests
#   cover every branch of that decision so a future regression cannot repeat
#   any of those four incidents unnoticed.
#
# Pester version:
#   The build hosts Pester 3.4 (no Pester 5). Uses `Should Be` (no dash) and
#   avoids BeforeAll/BeforeEach block scoping that Pester 3 doesn't understand.
#
# Isolation strategy:
#   supervise-watcher.ps1 has a top-level `while ($true)` loop plus a Start-Job
#   watchdog. Dot-sourcing it verbatim would hang the test host. This file sets
#   PR_WATCHER_SUPERVISOR_DOTSOURCE_ONLY=1 so the script returns before the
#   watchdog spins up and the loop starts, exposing only its function defs
#   (Resolve-WatcherExitAction, Get-ChildFailureReason, Get-ReasonKey).
#   restart-watcher-if-wedged.ps1 gets the same treatment for
#   Get-RestartChurn.
#
# Pure ASCII. Follows the repo convention: no em-dashes, no smart quotes.

$here      = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptDir = Split-Path -Parent $here
$repoRoot  = Split-Path -Parent (Split-Path -Parent $scriptDir)

$superviseScript = Join-Path $scriptDir 'supervise-watcher.ps1'
$wedgedScript    = Join-Path $repoRoot  'scripts\restart-watcher-if-wedged.ps1'

# Provide the env vars the supervisor script reads at top-level, pointing at
# temp locations so the real watcher clone is never touched.
$tmpRoot = Join-Path $env:TEMP ("supervise-tests-{0}-{1}" -f $PID, ([guid]::NewGuid().ToString('N').Substring(0,8)))
New-Item -ItemType Directory -Path $tmpRoot -Force | Out-Null
$tmpRepo   = Join-Path $tmpRoot 'clone'
$tmpPrompt = Join-Path $tmpRoot 'prompts'
New-Item -ItemType Directory -Path (Join-Path $tmpRepo 'scripts\pr-watcher\logs') -Force | Out-Null
New-Item -ItemType Directory -Path $tmpPrompt -Force | Out-Null

$env:PR_WATCHER_REPO_ROOT              = $tmpRepo
$env:PR_WATCHER_PROMPT_DIR             = $tmpPrompt
$env:PR_WATCHER_SUPERVISOR_DOTSOURCE_ONLY = '1'
$env:PR_WATCHER_WEDGED_DOTSOURCE_ONLY     = '1'

. $superviseScript
. $wedgedScript

# Path the supervisor's function will look at. It is $wdKillFlag from
# supervise-watcher.ps1 -- computed the same way here so tests can arm and
# clear it.
$flagPath = Join-Path $tmpRepo 'scripts\pr-watcher\.watchdog-kill.flag'

function New-KillFlag {
    param([string]$Body = '[test] pid=1234 armed=3 ageMin=42')
    Set-Content -Path $flagPath -Value $Body -Encoding UTF8
}

function Clear-KillFlag { Remove-Item -Path $flagPath -Force -ErrorAction SilentlyContinue }

Describe 'Resolve-WatcherExitAction -- the 2026-08-18 deadlock branch' {

    Context 'watchdog kill with the exit code that fooled us' {

        It 'relaunches on the watchdog kill; does NOT treat exit 0 as a deliberate stop' {
            New-KillFlag
            $d = Resolve-WatcherExitAction -ExitCode 0 -WatchdogFlagPath $flagPath `
                    -ChildOutput @() -CloneRoot $tmpRepo `
                    -LastReasonKey '' -SameCount 0 -MaxSameFail 5
            $d.Action | Should Be 'relaunch-watchdog'
            # The supervisor's exit-0 branch would set this to 'exit-deliberate'.
            # If it ever does again, the 65-min outage recurs. Guard it.
            $d.Action | Should Not Be 'exit-deliberate'
        }

        It 'consumes the flag so a subsequent real Ctrl+C still stops the supervisor' {
            New-KillFlag
            $null = Resolve-WatcherExitAction -ExitCode 0 -WatchdogFlagPath $flagPath `
                    -ChildOutput @() -CloneRoot $tmpRepo `
                    -LastReasonKey '' -SameCount 0 -MaxSameFail 5
            (Test-Path $flagPath) | Should Be $false

            # Now a real Ctrl+C (exit 0, no flag) must be honoured, not treated
            # as another watchdog restart. This is the "stuck flag = unkillable
            # relaunch loop" failure mode the fix guards against.
            $d = Resolve-WatcherExitAction -ExitCode 0 -WatchdogFlagPath $flagPath `
                    -ChildOutput @() -CloneRoot $tmpRepo `
                    -LastReasonKey '' -SameCount 0 -MaxSameFail 5
            $d.Action | Should Be 'exit-deliberate'
        }

        It 'still routes a watchdog kill via the watchdog branch when the child normalized exit to 1' {
            # start-watcher.ps1 normalizes non-{0,2} node exits (e.g. -1 from
            # Stop-Process) to 1. That would look identical to a crash without
            # the sentinel. The sentinel must still win.
            New-KillFlag
            $d = Resolve-WatcherExitAction -ExitCode 1 -WatchdogFlagPath $flagPath `
                    -ChildOutput @() -CloneRoot $tmpRepo `
                    -LastReasonKey '' -SameCount 0 -MaxSameFail 5
            $d.Action | Should Be 'relaunch-watchdog'
        }

        It 'resets the crash-loop counters so an unrelated prior-crash streak does not escalate' {
            # A hang is a different failure class from a repeat identical crash.
            # If we did not reset, 4 unrelated crashes followed by 1 hang would
            # cross MaxSameFail and escalate the WRONG thing.
            New-KillFlag
            $d = Resolve-WatcherExitAction -ExitCode 0 -WatchdogFlagPath $flagPath `
                    -ChildOutput @() -CloneRoot $tmpRepo `
                    -LastReasonKey 'PRE-FLIGHT FAIL' -SameCount 4 -MaxSameFail 5
            $d.NewSameCount | Should Be 0
            $d.NewReasonKey | Should Be ''
        }
    }

    Context 'deliberate stop -- must NOT be broken by the fix' {

        It 'exit 0 with no watchdog flag = deliberate stop = supervisor exits' {
            Clear-KillFlag
            $d = Resolve-WatcherExitAction -ExitCode 0 -WatchdogFlagPath $flagPath `
                    -ChildOutput @() -CloneRoot $tmpRepo `
                    -LastReasonKey '' -SameCount 0 -MaxSameFail 5
            $d.Action | Should Be 'exit-deliberate'
        }

        It 'exit 0 with SINGLE-INSTANCE in child output = adopt, not exit' {
            Clear-KillFlag
            $d = Resolve-WatcherExitAction -ExitCode 0 -WatchdogFlagPath $flagPath `
                    -ChildOutput @('SINGLE-INSTANCE: another watcher is running (pid 999)') `
                    -CloneRoot $tmpRepo `
                    -LastReasonKey '' -SameCount 0 -MaxSameFail 5
            $d.Action | Should Be 'adopt'
        }
    }

    Context 'non-zero exit -- crash-loop path stays intact' {

        It 'exit 1 (crash) routes to relaunch-crash and increments SameCount' {
            Clear-KillFlag
            $d = Resolve-WatcherExitAction -ExitCode 1 -WatchdogFlagPath $flagPath `
                    -ChildOutput @('PRE-FLIGHT FAIL: on branch X with uncommitted TRACKED changes') `
                    -CloneRoot $tmpRepo `
                    -LastReasonKey '' -SameCount 0 -MaxSameFail 5
            $d.Action       | Should Be 'relaunch-crash'
            $d.NewSameCount | Should Be 1
        }

        It 'identical failure at the threshold trips the crash-loop escalation' {
            Clear-KillFlag
            $d = Resolve-WatcherExitAction -ExitCode 1 -WatchdogFlagPath $flagPath `
                    -ChildOutput @('PRE-FLIGHT FAIL: on branch X with uncommitted TRACKED changes') `
                    -CloneRoot $tmpRepo `
                    -LastReasonKey 'PRE-FLIGHT FAIL: on branch X with uncommitted TRACKED changes' `
                    -SameCount 4 -MaxSameFail 5
            $d.Action       | Should Be 'escalate-crash-loop'
            $d.NewSameCount | Should Be 5
        }

        It 'exit 2 (soft halt) routes to soft-halt and resets counters' {
            Clear-KillFlag
            $d = Resolve-WatcherExitAction -ExitCode 2 -WatchdogFlagPath $flagPath `
                    -ChildOutput @() -CloneRoot $tmpRepo `
                    -LastReasonKey 'something' -SameCount 3 -MaxSameFail 5
            $d.Action       | Should Be 'soft-halt'
            $d.NewSameCount | Should Be 0
            $d.NewReasonKey | Should Be ''
        }
    }

    Context 'the log line is honest AND coexists with the churn detector (#1163)' {

        It 'the watchdog-kill LogMessage matches the churn detector regex' {
            # If our new log line does not contain "Watcher exited", the churn
            # counter (Get-RestartChurn, restart-watcher-if-wedged.ps1) will
            # silently stop counting hang-loops, and a repeatedly-hanging
            # watcher gets an unlimited retry budget -- the exact opposite of
            # what #1163 was built for. This test locks that regex in.
            New-KillFlag
            $d = Resolve-WatcherExitAction -ExitCode 0 -WatchdogFlagPath $flagPath `
                    -ChildOutput @() -CloneRoot $tmpRepo `
                    -LastReasonKey '' -SameCount 0 -MaxSameFail 5
            ($d.LogMessage -match 'Watcher exited') | Should Be $true
        }

        It 'four watchdog kills inside the churn window still trip the churn halt' {
            # Write a synthetic supervisor.log with 4 watchdog-kill lines timed
            # in the last 20 min, then run the REAL Get-RestartChurn against it.
            # This is what restart-watcher-if-wedged.ps1 does in production.
            $logDir = Join-Path $tmpRoot 'churn-logs'
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
            $logPath = Join-Path $logDir 'supervisor.log'

            $lines = @()
            $now = Get-Date
            for ($i = 0; $i -lt 4; $i++) {
                $ts = ($now.AddMinutes(-($i * 3))).ToString('o')
                # Match exactly the LogMessage template that Resolve-WatcherExitAction
                # emits, so this test breaks if that template ever loses "Watcher exited".
                $lines += "[$ts] Watcher exited via watchdog kill (exit 0). Heartbeat was stale; relaunching. Flag: [x] pid=1 armed=2 ageMin=20"
            }
            Set-Content -Path $logPath -Value ($lines -join "`r`n") -Encoding UTF8

            $churn = Get-RestartChurn -LogPath $logPath -WindowMinutes 20
            $churn.Readable | Should Be $true
            $churn.Exits    | Should Be 4
            # The churn halt fires when Total >= threshold (default 4).
            ($churn.Total -ge 4) | Should Be $true
        }
    }
}

Describe 'Resolve-WatchdogChurn -- in-loop watchdog-kill churn guard' {

    # All tests use a fixed $now so results are deterministic.
    $now = [datetime]'2026-08-20T10:00:00'

    Context 'empty / null input -- must not throw' {

        It 'returns InWindow=0 Halt=false for empty array' {
            $result = Resolve-WatchdogChurn -KillTimes @() -Now $now
            $result.InWindow | Should Be 0
            $result.Halt     | Should Be $false
        }

        It 'returns InWindow=0 Halt=false for null input' {
            $result = Resolve-WatchdogChurn -KillTimes $null -Now $now
            $result.InWindow | Should Be 0
            $result.Halt     | Should Be $false
        }
    }

    Context 'pruning -- kills outside the window are dropped' {

        It 'prunes a kill that is exactly at the window boundary (>= WindowMinutes old)' {
            # Exactly 20 minutes ago is AT the cutoff; cutoff is Now - 20 min.
            # -gt $cutoff means 20-min-old is NOT kept (it equals the cutoff).
            $old = $now.AddMinutes(-20)
            $result = Resolve-WatchdogChurn -KillTimes @($old) -Now $now -WindowMinutes 20 -Threshold 4
            $result.InWindow | Should Be 0
            $result.Halt     | Should Be $false
        }

        It 'keeps a kill that is one second inside the window' {
            $recent = $now.AddMinutes(-19).AddSeconds(-59)
            $result = Resolve-WatchdogChurn -KillTimes @($recent) -Now $now -WindowMinutes 20 -Threshold 4
            $result.InWindow | Should Be 1
        }

        It 'prunes old kills and keeps recent ones -- Kept matches InWindow' {
            $old    = $now.AddMinutes(-25)
            $recent = $now.AddMinutes(-5)
            $result = Resolve-WatchdogChurn -KillTimes @($old, $recent) -Now $now -WindowMinutes 20 -Threshold 4
            $result.InWindow    | Should Be 1
            $result.Kept.Count  | Should Be 1
        }
    }

    Context 'threshold boundary -- halt fires at exactly Threshold' {

        It 'does NOT halt at Threshold - 1 kills in window' {
            $times = @(
                $now.AddMinutes(-1),
                $now.AddMinutes(-2),
                $now.AddMinutes(-3)
            )
            $result = Resolve-WatchdogChurn -KillTimes $times -Now $now -WindowMinutes 20 -Threshold 4
            $result.InWindow | Should Be 3
            $result.Halt     | Should Be $false
        }

        It 'halts at exactly Threshold kills in window' {
            $times = @(
                $now.AddMinutes(-1),
                $now.AddMinutes(-2),
                $now.AddMinutes(-3),
                $now.AddMinutes(-4)
            )
            $result = Resolve-WatchdogChurn -KillTimes $times -Now $now -WindowMinutes 20 -Threshold 4
            $result.InWindow | Should Be 4
            $result.Halt     | Should Be $true
        }

        It 'halts above Threshold' {
            $times = @(
                $now.AddMinutes(-1),
                $now.AddMinutes(-2),
                $now.AddMinutes(-3),
                $now.AddMinutes(-4),
                $now.AddMinutes(-5)
            )
            $result = Resolve-WatchdogChurn -KillTimes $times -Now $now -WindowMinutes 20 -Threshold 4
            $result.InWindow | Should Be 5
            $result.Halt     | Should Be $true
        }
    }

    Context 'future timestamps -- clock skew must not hide churn' {

        It 'keeps a kill time in the future (skew must not discard it)' {
            $future = $now.AddMinutes(5)
            $result = Resolve-WatchdogChurn -KillTimes @($future) -Now $now -WindowMinutes 20 -Threshold 4
            $result.InWindow | Should Be 1
            $result.Halt     | Should Be $false
        }
    }

    Context 'Kept matches InWindow' {

        It 'InWindow equals Kept.Count in all cases' {
            $times = @(
                $now.AddMinutes(-5),
                $now.AddMinutes(-10),
                $now.AddMinutes(-30)   # outside window
            )
            $result = Resolve-WatchdogChurn -KillTimes $times -Now $now -WindowMinutes 20 -Threshold 4
            $result.InWindow   | Should Be $result.Kept.Count
        }
    }
}

Describe 'Resolve-WatchdogJudgedAgeMinutes -- WATCHDOG_RESTART_GRACE_V1' {

    # 2026-09-06. The heartbeat only ticks MID-RUN (DOCTRINE 9.5), so a node that
    # has just been launched has not ticked it yet and the file describes the
    # PREVIOUS node's run. The pre-fix watchdog judged the new process by that
    # file: a node launched at 09.28.41Z was killed at 09.29.07Z with ageMin=26 --
    # 26 minutes of staleness attributed to a 26-second-old process. Every restart
    # died the same way, the churn guard tripped at four kills, and the re-armed
    # prompt reached the board four times (#1703, #1704, #1707, #1708).
    #
    # The rule under test: the staleness clock starts at the LATER of (heartbeat
    # last write, node process start). All tests use a fixed $wdNow so results are
    # deterministic, and $wdHung = 15 to match the shipped default.

    $wdNow  = [datetime]'2026-09-06T09:29:07'
    $wdHung = 15

    Context 'the acceptance table -- row 1 must still kill' {

        It 'row 1: the 2026-08-11 hang (node hours old, heartbeat 40 min frozen) is KILLED' {
            # The reason this watchdog exists. The node hung mid-run with a frozen
            # heartbeat while 16 prompts sat armed and nothing restarted it. The
            # node start is the OLDER clock here, so the heartbeat stays the judge.
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc ($wdNow.AddMinutes(-40)) `
                        -NodeStartUtc ($wdNow.AddHours(-6)) `
                        -NowUtc $wdNow -HungMin $wdHung
            [int]$judged        | Should Be 40
            ($judged -gt $wdHung) | Should Be $true
        }

        It 'row 2: a node relaunched 26 s ago with a 26 min old heartbeat is SPARED' {
            # The defect, exactly as measured at 09.29.07Z.
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc ($wdNow.AddMinutes(-26)) `
                        -NodeStartUtc ($wdNow.AddSeconds(-26)) `
                        -NowUtc $wdNow -HungMin $wdHung
            ($judged -lt 1)       | Should Be $true
            ($judged -gt $wdHung) | Should Be $false
        }

        It 'row 3: a node that started fine hours ago then froze 20 min ago is KILLED' {
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc ($wdNow.AddMinutes(-20)) `
                        -NodeStartUtc ($wdNow.AddHours(-3)) `
                        -NowUtc $wdNow -HungMin $wdHung
            [int]$judged          | Should Be 20
            ($judged -gt $wdHung) | Should Be $true
        }
    }

    Context 'the grace is exactly HungMin and then it expires' {

        It 'a node relaunched 16 min ago that never ticked is KILLED (grace is not open-ended)' {
            # The node start is now the LATER clock, so it is the judge -- and it
            # is already past the threshold. A node that cannot produce one tick in
            # $HungMin minutes is hung by this watchdog's own definition.
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc ($wdNow.AddMinutes(-40)) `
                        -NodeStartUtc ($wdNow.AddMinutes(-16)) `
                        -NowUtc $wdNow -HungMin $wdHung
            [int]$judged          | Should Be 16
            ($judged -gt $wdHung) | Should Be $true
        }

        It 'exactly HungMin old is SPARED (the kill test is -gt, not -ge)' {
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc ($wdNow.AddMinutes(-40)) `
                        -NodeStartUtc ($wdNow.AddMinutes(-$wdHung)) `
                        -NowUtc $wdNow -HungMin $wdHung
            [int]$judged          | Should Be $wdHung
            ($judged -gt $wdHung) | Should Be $false
        }
    }

    Context 'missing heartbeat -- the file has never been written' {

        It 'a brand new node with no heartbeat file at all is SPARED' {
            # Pre-fix this returned $HungMin + 1 unconditionally, i.e. an instant
            # kill for a node that had existed for four seconds.
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc $null `
                        -NodeStartUtc ($wdNow.AddSeconds(-4)) `
                        -NowUtc $wdNow -HungMin $wdHung
            ($judged -lt 1)       | Should Be $true
            ($judged -gt $wdHung) | Should Be $false
        }

        It 'an hours-old node that has never written a heartbeat is KILLED' {
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc $null `
                        -NodeStartUtc ($wdNow.AddHours(-2)) `
                        -NowUtc $wdNow -HungMin $wdHung
            [int]$judged          | Should Be 120
            ($judged -gt $wdHung) | Should Be $true
        }

        It 'neither clock readable falls back to the pre-fix HungMin + 1' {
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc $null -NodeStartUtc $null `
                        -NowUtc $wdNow -HungMin $wdHung
            [int]$judged          | Should Be ($wdHung + 1)
            ($judged -gt $wdHung) | Should Be $true
        }
    }

    Context 'unreadable node start grants NO grace -- the watchdog keeps its teeth' {

        It 'a null node start with a 40 min stale heartbeat still KILLS' {
            # Deliberate: an unreadable clock must never be able to make a
            # genuinely hung node immortal. This is the pre-fix judgement.
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc ($wdNow.AddMinutes(-40)) -NodeStartUtc $null `
                        -NowUtc $wdNow -HungMin $wdHung
            [int]$judged          | Should Be 40
            ($judged -gt $wdHung) | Should Be $true
        }

        It 'a non-datetime node start is treated as unreadable, not as an error' {
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc ($wdNow.AddMinutes(-40)) -NodeStartUtc 'not-a-date' `
                        -NowUtc $wdNow -HungMin $wdHung
            [int]$judged          | Should Be 40
        }
    }

    Context 'clock skew must not manufacture a kill' {

        It 'a heartbeat timestamped in the future clamps to 0 (spared)' {
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc ($wdNow.AddMinutes(5)) `
                        -NodeStartUtc ($wdNow.AddHours(-6)) `
                        -NowUtc $wdNow -HungMin $wdHung
            $judged | Should Be 0
        }

        It 'a node start timestamped in the future clamps to 0 (spared)' {
            $judged = Resolve-WatchdogJudgedAgeMinutes `
                        -HeartbeatUtc ($wdNow.AddMinutes(-40)) `
                        -NodeStartUtc ($wdNow.AddMinutes(5)) `
                        -NowUtc $wdNow -HungMin $wdHung
            $judged | Should Be 0
        }
    }

    Context 'purity -- no I/O, no ambient clock, single return value' {

        It 'is deterministic: the same inputs give the same answer twice' {
            $a = Resolve-WatchdogJudgedAgeMinutes -HeartbeatUtc ($wdNow.AddMinutes(-40)) `
                    -NodeStartUtc ($wdNow.AddHours(-6)) -NowUtc $wdNow -HungMin $wdHung
            $b = Resolve-WatchdogJudgedAgeMinutes -HeartbeatUtc ($wdNow.AddMinutes(-40)) `
                    -NodeStartUtc ($wdNow.AddHours(-6)) -NowUtc $wdNow -HungMin $wdHung
            $a | Should Be $b
        }

        It 'emits exactly one value (no stray Write-Output to corrupt the caller)' {
            $out = @(Resolve-WatchdogJudgedAgeMinutes -HeartbeatUtc ($wdNow.AddMinutes(-40)) `
                        -NodeStartUtc ($wdNow.AddHours(-6)) -NowUtc $wdNow -HungMin $wdHung)
            $out.Count | Should Be 1
        }
    }
}

# Clean up temp dirs and env vars so a follow-up test run starts fresh.
Remove-Item -Path $tmpRoot -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item Env:PR_WATCHER_SUPERVISOR_DOTSOURCE_ONLY -ErrorAction SilentlyContinue
Remove-Item Env:PR_WATCHER_WEDGED_DOTSOURCE_ONLY     -ErrorAction SilentlyContinue
Remove-Item Env:PR_WATCHER_REPO_ROOT                 -ErrorAction SilentlyContinue
Remove-Item Env:PR_WATCHER_PROMPT_DIR                -ErrorAction SilentlyContinue
