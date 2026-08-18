---
premise: grep -q "Treating as a deliberate stop" scripts/pr-watcher/supervise-watcher.ps1
premise_means: The supervisor still treats ANY exit-0 from the watcher node as a deliberate stop and exits itself. When its own WATCHDOG kills a hung node, that kill produces exit 0, so the supervisor reads its own intervention as "Marco pressed Ctrl+C", exits, and the watcher stays down with prompts armed.
scope:
  - scripts/pr-watcher/supervise-watcher.ps1
  - scripts/pr-watcher/__tests__/supervise-watcher.tests.ps1
done_when: grep -q "watchdogKill" scripts/pr-watcher/supervise-watcher.ps1 && ! grep -q "the supervisor will relaunch it" scripts/pr-watcher/supervise-watcher.ps1 || grep -q "watchdogKill" scripts/pr-watcher/supervise-watcher.ps1
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# FIX the watchdog/supervisor deadlock - a watchdog kill reads as a deliberate stop

## The incident (measured, 2026-08-18)

`scripts/pr-watcher/logs/supervisor.log` in the watcher clone:

    [2026-08-18T10:06:08.1893161+10:00] WATCHDOG heartbeat stale 15 min with 7 armed and 0
                                        in-progress -> node HUNG. Killing pid 20644;
                                        the supervisor will relaunch it.
    [2026-08-18T10:06:08.4406424+10:00] Watcher exited cleanly (exit 0).
                                        Treating as a deliberate stop. Supervisor exiting.
    [2026-08-18T10:06:08.2265864+10:00] Watcher exited with code -1

**The watchdog's log line is a lie.** It says "the supervisor will relaunch it". The supervisor
does not. It sees exit 0 and exits. The watcher stayed down for 65 minutes with 7 prompts armed
and nothing consuming them; it only came back because a human restarted it by hand.

The same pattern fired five times in 90 seconds earlier the same night (01:32:11 -> 01:33:06):
kill -> exit 0 -> "Supervisor exiting" -> relaunch -> kill again. Five supervisors, five kills,
zero progress.

## The defect

A deliberate stop (Ctrl+C) and a watchdog-initiated kill are **indistinguishable** at the exit
code. Both surface as exit 0. The supervisor's rule - "exit 0 means Marco stopped it deliberately,
so exit" - is correct for the first and catastrophic for the second.

Note also that the same event is logged as BOTH `exit 0` and `code -1` on two different lines,
0.2 s apart. Whatever is reading the exit status is not reading it consistently. Fix that too, or
say plainly in your output which one is authoritative and why.

## What to build

1. **Make the watchdog's intent explicit.** Before the watchdog kills the node, set a flag the
   exit handler can read - a script-scoped `$script:watchdogKill = $true`, or a sentinel file next
   to the heartbeat. A flag beats inferring intent from an exit code, because the exit code cannot
   carry intent.

2. **Branch on it.** On watcher exit:
   - watchdog flag SET -> this was OUR kill. Log it as a watchdog restart, clear the flag,
     relaunch. Do NOT exit.
   - watchdog flag CLEAR and exit 0 -> genuine deliberate stop. Exit, as today.
   - non-zero exit -> failure path, unchanged (#1162).

3. **Do not let the flag leak.** Clear it as soon as the relaunch happens. A stuck flag would turn
   a real Ctrl+C into an unkillable relaunch loop - the opposite failure, and worse.

4. **Fix the double-report.** One exit, one log line, one authoritative code.

5. **Make the log honest.** If the code cannot guarantee a relaunch, the message must not promise
   one. This is DOCTRINE 7.1: a log line is a claim, and this one was false for 65 minutes.

## Interaction with the churn detector - do not break it

`scripts/restart-watcher-if-wedged.ps1` (PR #1163) halts on 4+ restarts in a 20-minute window and
writes `needs-marco/WATCHER-CHURN-<stamp>.md`. Relaunching after a watchdog kill **must still
count as a restart** for that detector. The point of this fix is that a hung node gets relaunched,
NOT that the watcher gets an unlimited retry budget. If a node hangs repeatedly, churn detection
must still stop it and escalate. Verify both behaviours coexist.

## Tests

In `__tests__/supervise-watcher.tests.ps1` (create it if absent - Pester, matching the repo's
existing PowerShell test style if one exists; if none exists, say so and write the smallest
harness that actually executes the branch):

- watchdog kill -> exit 0 -> supervisor RELAUNCHES and does not exit.
- no watchdog flag -> exit 0 -> supervisor exits (deliberate stop preserved).
- non-zero exit -> failure path unchanged.
- the flag is cleared after the relaunch, so a subsequent real Ctrl+C still stops the supervisor.
- four watchdog kills inside the churn window still trip the churn halt.

Do not weaken an existing assertion to go green.

## Verification

Do not report this as fixed on the strength of the diff. Drive the actual branch:

1. Start the supervisor chain.
2. Let the heartbeat go stale (or stub the staleness check) so the watchdog fires.
3. Confirm from `supervisor.log` that a NEW node pid appears after the kill and the supervisor
   is still alive.

Quote the log lines in your output. A passing unit test is necessary and not sufficient here -
the last two watcher outages both passed their unit tests.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
