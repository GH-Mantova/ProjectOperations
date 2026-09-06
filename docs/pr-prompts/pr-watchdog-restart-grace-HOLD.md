---
premise: '! grep -q "WATCHDOG_RESTART_GRACE_V1" scripts/pr-watcher/supervise-watcher.ps1'
premise_means: The heartbeat watchdog judges a freshly launched node by a heartbeat the PREVIOUS node wrote, so a healthy new node is killed seconds after it starts and can never reach its first run.
scope:
  - scripts/pr-watcher/supervise-watcher.ps1
  - scripts/pr-watcher/__tests__/supervise-watcher.tests.ps1
done_when: node --test "scripts/pr-watcher/__tests__/*.test.mjs" && grep -q "WATCHDOG_RESTART_GRACE_V1" scripts/pr-watcher/supervise-watcher.ps1
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# The watchdog judges a new node by the old node's heartbeat, and kills it

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## This is live. It is happening right now.

Station 00 measured it at 2026-09-06T09.28Z and again at 10.08Z, and the board carries both
breadcrumbs:

- `docs/pr-prompts/00-00-supervisor-2026-09-06-0930-the-watchdog-kills-every-restart-in-thirty-seconds-because-it-judges-a-new-node-by-the-old-heartbeat.md`
- `docs/pr-prompts/00-00-supervisor-2026-09-06-1008-the-watchdog-kill-loop-built-one-prompt-three-times-and-put-three-duplicate-prs-on-the-board.md`

**Read the first one before you write any code.** It contains the measurement, the positive
control, and the kill-flag file that names the pid it killed. Do not re-derive what is already
measured there; build the fix it points at.

The consequence is not theoretical: the loop re-armed one prompt on every restart and put
**four duplicate PRs of a single slice on the board** (#1703, #1704, #1707, #1708).

## The defect, exactly

`scripts/pr-watcher/supervise-watcher.ps1`, inside the heartbeat-watchdog `Start-Job`:

```powershell
$ageMin = if (Test-Path $Heartbeat) { ((Get-Date).ToUniversalTime() - (Get-Item $Heartbeat).LastWriteTimeUtc).TotalMinutes } else { $HungMin + 1 }
if ($ageMin -gt $HungMin) { ...write sentinel, Stop-Process the node... }
```

`$ageMin` is the age of `scripts/pr-watcher/heartbeat.log`. DOCTRINE §9.5 records that **the
heartbeat only ticks MID-RUN**. A node that has just started has, by construction, not ticked it
yet — so `$ageMin` describes **the queue's last real run**, not the process being judged.

With a prompt armed and nothing in progress, every freshly launched node satisfies
`heartbeat stale AND armed AND runnable>0` **the instant it appears**. Station 00 watched a node
launched at 09.28.41Z get killed at 09.29.07Z, aged 26 seconds, with `ageMin=26` in the kill flag —
26 *minutes* of staleness attributed to a 26-*second*-old process. The supervisor relaunches, the
next node dies the same way, and the churn guard trips at four kills and stops restarting
altogether, writing its escalation to `docs/pr-prompts/needs-marco/`, **which is gitignored**.

**The condition that is supposed to detect a hung watcher instead guarantees a healthy one can
never reach its first run.**

## The fix

**The staleness clock starts at the LATER of (heartbeat last write, node process start).**

That single rule is the whole change, and it is exactly right in both directions:

| situation | node start | heartbeat | judged age | outcome |
|---|---|---|---|---|
| the 2026-08-11 hang the watchdog exists for | hours ago | 40 min ago | 40 min | **killed** — correct, unchanged |
| a node relaunched after a kill | 26 s ago | 26 min ago | 26 s | **spared** — the defect, fixed |
| a node that started fine then froze | hours ago | 20 min ago | 20 min | **killed** — correct |

A new node therefore gets a full `$HungMin` from its own start to produce its first tick, and after
that it is judged on its own heartbeat exactly as before. **No new signal is needed**:
`$node` already comes from `Get-CimInstance Win32_Process`, which carries `CreationDate`.

Mark the rule `WATCHDOG_RESTART_GRACE_V1` in a comment so it is greppable and so the premise above
inverts.

## How to build it so the fix is not itself decorative

This file already carries a guard that has never once fired — the `in-progress\*.md` check three
lines above the one you are fixing reads a directory no producer writes (its own prompt is
`pr-watchdog-dead-inprog-guard-HOLD.md`). **Do not add a second one.** Concretely:

1. **Put the arithmetic in a pure, top-level function** — the shape this file already uses for
   `Resolve-WatcherExitAction` and `Resolve-WatchdogChurn`. It takes the three times and returns
   the minutes to judge by; it reads no files, no processes and no environment.
2. **The watchdog job must actually call it.** The kill decision lives inside a `Start-Job`
   scriptblock, which does NOT inherit the outer scope's functions — that is the trap here. Pick a
   mechanism that genuinely carries the function into the job (`-InitializationScript`, passing
   `${function:...}` through `-ArgumentList` and re-binding, or defining it in one place that both
   reach) and **prove the job path, not just the function**. A pure function the job never calls is
   the same defect in a new costume.
3. **Test it through the existing harness.** `__tests__/supervise-watcher.tests.ps1` dot-sources
   this script with `PR_WATCHER_SUPERVISOR_DOTSOURCE_ONLY=1` so that only its function definitions
   are exposed. Pester on the build host is **version 3.4** — `Should Be`, no dash, and no
   `BeforeAll`/`BeforeEach` block scoping. Cover all three rows of the table above plus the
   missing-heartbeat case.

## Two things to know before you start

- 🔴 **Do NOT weaken the watchdog.** Its reason for existing is the 2026-08-11 incident recorded in
  this file's own header: the node hung mid-run with a frozen heartbeat while 16 prompts sat armed
  and nothing restarted it. A change that makes a genuinely hung node survive is worse than the bug
  you are fixing. The table above is the acceptance criterion — row 1 must still kill.
- ⚠️ **Pester is not run by CI anywhere.** `grep -rn "Invoke-Pester" .github/` returns nothing, and
  `watchdog-lane.test.mjs:20` cites this Pester suite as its coverage. So your Pester cases are real
  and worth writing, but **they will not run in CI** — which is why `done_when` runs the `.mjs`
  suites instead, to prove you broke nothing that CI does execute. Say plainly in the PR body that
  the new cases are not CI-executed. Making CI run Pester is a separate slice; do not do it here.

## Stop and report — do not choose

- **If `CreationDate` is not reachable on `$node[0]`** on the PowerShell version this file targets,
  say so and stop rather than substituting a different signal. Every other candidate (a marker file,
  a launch timestamp in the log) introduces a new producer that can go missing — which is precisely
  how the `in-progress` guard died.

## What this is NOT

- Not the `in-progress` guard removal — that is `pr-watchdog-dead-inprog-guard-HOLD.md` and it is a
  separate change to the same file. Do not fold it in; two independent behaviour changes in one
  watchdog PR is how a regression becomes unbisectable.
- Not a change to the churn guard, its threshold, or where it writes its escalation.
- Not a change to `index.mjs`, to lane routing, or to the queue.
