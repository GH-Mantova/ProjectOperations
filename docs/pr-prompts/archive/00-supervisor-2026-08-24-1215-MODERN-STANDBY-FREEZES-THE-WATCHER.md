# 00-SUPERVISOR 2026-08-24 12:15Z — THE BOX SLEEPS. THE WATCHER IS FROZEN ~50 MIN IN EVERY 60.

**Run was NOT blind** — Desktop Commander present, all git via `start_process` on Windows.
Sweep verdict: **SAFE TO ACT** (12:09:45Z). Nothing armed, nothing merged, nothing killed.

## The finding — root cause of every "gap" we have been mis-attributing

`powercfg` / Kernel-Power 506/507 on the System log show the host enters **Modern Standby
(S0 Low Power Idle)** and only wakes for a few minutes about once an hour:

```
06:08:13Z exit standby -> re-enter    07:08:15Z exit -> re-enter
08:08:14Z exit standby -> re-enter    10:05:21Z exit -> re-enter
10:08:21Z exit standby -> re-enter    12:08:14Z exit -> re-enter
```

**The watcher's own log proves the process is FROZEN, not merely unobserved.** The
`[review] verdict-archive sweep` line is a **5-minute** timer, sub-second aligned:

```
10:15:25.505 / 10:20:25.581 / ... / 11:00:25.592 / 11:05:25.711   <- every 5 min, exactly
11:05:25.711  ->  12:08:24.193                                     <- 62.98 min, TWELVE TICKS MISSED
```

It resumes **10 seconds after** the 12:08:14Z standby exit. Same shape at 05:35:31 -> 08:13:26
(2h38m), matching the 05:39Z->08:08Z standby block exactly.

`node pid 29024` is alive, correct cmdline, wrapper `pid 10364` alive, ancestry
`powershell:3552 <- powershell:10364 <- WmiPrvSE(gone)`, uptime 395 min. **Every liveness probe
we own says GREEN while the process does nothing for an hour at a time.**

## What this REFUTES

1. **The keepalive task is NOT defective. Station 03: do not "fix" it.**
   Measured: `MSFT_TaskDailyTrigger`, `Interval=PT10M`, `Duration=P1D`, `StopAtDurationEnd=True`,
   `Enabled=True`, `DisallowStartIfOnBatteries=False`, `RunOnlyIfIdle=False`, `State=Ready`,
   `LastTaskResult=0`, last run 12:08:14Z, next 12:15:00Z. The config is correct. The "hourly
   bursts / 67-min gaps" in `ensure-watcher.log` are the **machine asleep**, not a bad trigger.
   The AMBER dispatched to Station 03 on the 10:11Z run is **withdrawn**.

2. **The "merge-wait holds the lane the review job needs" deadlock is NOT the root cause.**
   `08:23:09 [merge] ... waiting…` -> `10:05:27 [merge] PR #1305 stays for Marco (timeout)`.
   The box was in standby 08:08Z -> 10:05:21Z. **The timeout fired 6 seconds after the wake.**
   No lane was burned for 102 minutes; the process was frozen and the wall-clock deadline had
   silently expired underneath it. The review job then ran at 10:05:32 and returned
   `VERDICT: MERGE` at 10:14:10Z — 9 minutes, not starved.

3. **Therefore the real defect is more general and more serious:** every `Date.now()`-based
   deadline inside the watcher (merge-wait, watchdog `wdHungMin=15`, review poll) measures WALL
   CLOCK across a freeze it cannot see. Any PR whose merge-wait straddles a standby window will
   be spuriously timed out and mis-routed to Marco. The `wdHungMin=15` watchdog is the dangerous
   one: on wake it sees a >15-min-stale heartbeat and **kills a perfectly healthy watcher**.
   That is almost certainly what killed the watcher on 08-21 and 08-22 — not a crash.

## Dispositions

- `project_supervisor_..._merge_review_lane_deadlock.md` (lane deadlock) — **SUPERSEDED.** Timeline
  facts stand; the causal claim is refuted. Station 06 prompt must be rewritten around
  freeze-aware deadlines, not lane accounting.
- `project_scanner_..._mergewait_burns_lane_dc_absent.md` — same, its do-not-arm table still good.
- Restarter AMBER -> Station 03 — **WITHDRAWN**, replaced by the escalation below.
- `#1305` — **LEFT ALONE.** Open, MERGEABLE, no labels, 7 SUCCESS/4 SKIPPED, verdict MERGE. The
  watcher routed it to Marco. **RULE 2 is absolute: I do not merge it.** Escalated.
- 5 dead escalations in `needs-marco/` (refs #1134 #1135 #212 #213 #727 #1158 all MERGED) —
  **DEFERRED**, clearing them is a queue-mutating docs PR; low value, do it in the next docs slice.
- 3 orphan worktrees, `qa-findings.md` stale 08-21 — **DEFERRED**, unchanged, no new content.

## ESCALATED TO MARCO — one question, not a status update

**The automation runs about one hour in two because your laptop (chassis=Notebook, on AC, 79%)
goes into Modern Standby.** `Sleep after (AC) = Never` is already set, so an idle timer is not
doing this — a closed lid on a Modern Standby machine is the likely cause. Options, RULE 1 order:

- **(A) COMPLETE + ADDITIVE — keep the box awake AND make the watcher freeze-aware.** Set the lid
  action / add a wake-lock so the host stays up, *and* fix the deadlines to use monotonic time or
  `max(heartbeat mtime, job start)` so a future freeze can never spuriously time out or trigger
  the watchdog kill. Passes both tests: fixes it now, and no data entry is touched.
- (B) Keep the box awake only. Fails the *future* half — the next sleep, RDP disconnect or reboot
  reintroduces it, and the watchdog kill returns with it.
- (C) Fix the deadlines only. Fails the *immediate* half — merges would stop being mis-routed, but
  throughput stays at ~50%.

Nothing here is reversible-unsafe, but it is **his machine's power config** — a hard stop for an
agent. I did not touch it.

## Deliberately left alone
Armed 0 -> stayed 0. I did **not** arm `pr-nopr-s1`/`pr-nopr-s2` or any HOLD: the heartbeat is
117 min stale and `wdHungMin=15` would kill the node on the first job tick (known playbook), and
with the freeze unexplained-until-now any arming would have run into the next standby window.
