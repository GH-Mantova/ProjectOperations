# SUPERVISOR HANDOVER -> STATION 06 (PR MASTER)
## Freeze-blind deadlines: every `Date.now()` timeout in the watcher is wrong on this host

Written 2026-08-24 14:10Z by 00-supervisor. NOT a prompt. PR Master designs and stages; the
supervisor does not create PRs (LL-38).

### The premise, re-measured this run (do not take it on trust, it is cheap to re-run)

The host is a laptop that enters Modern Standby for long stretches. The watcher process does not
die - it FREEZES. Every probe we have (exact cmdline match, `.queue-state.json` mtime,
arm-to-pickup) passes on a frozen watcher. The ONLY probe that catches it is the GAP between
ticks of a FIXED-INTERVAL log line.

Instrument: the watcher's own 5-minute `verdict-archive sweep` line in
`C:\po-watcher\watcher-launch.log`.

MEASURED 2026-08-24 14:10Z:

```
11:05:25.711Z  sweep      <-- then a 63 min GAP (12 ticks missed)
12:08:24.193Z  sweep      <-- resumes 10 s after Kernel-Power 507 at 12:08:14Z
12:13 ... 13:03 sweep     <-- 12 consecutive ticks, 5 min apart, host AWAKE for a full hour
13:08:26.277Z  sweep      <-- then a 60 min GAP (11 ticks missed)
14:08:25.952Z  sweep      <-- resumes 11 s after Kernel-Power 507 at 14:08:14Z
```

Kernel-Power 507 (exit Modern Standby), last 6: 14:08:14Z, 13:08:15Z, 12:08:14Z, 10:08:21Z,
10:05:25Z, 10:05:21Z. Note 11:08 is ABSENT - the host did not wake that hour.

### CORRECTION to the 2026-08-24 12:15Z breadcrumb

That note said "frozen ~50 min in every 60". That is now measured wrong. The real shape is
**alternating hour-long blocks**: awake ~10:12-11:05, frozen 11:05-12:08, awake 12:08-13:05,
frozen 13:05-14:08. Overall duty cycle is still roughly 50%, but the freeze arrives in
**~60-minute unbroken blocks**, not as short gaps inside every hour. This matters for arming:
a job can get a clean 55-minute window, or it can be frozen 1 minute after it starts.

### The defect to design against

Every deadline in the watcher is computed from `Date.now()` deltas. Wall-clock keeps running
through Modern Standby; the process does not. So on every wake, each deadline is instantly
overdue by the length of the freeze. Two consequences already observed:

1. **`wdHungMin=15` kills a healthy node.** `supervise-watcher.ps1` L584-585 measures staleness
   from the last heartbeat WRITE. After a 60-minute freeze the heartbeat is 60 minutes stale the
   instant the box wakes, so the watchdog terminates a node that is perfectly fine. This is the
   most likely cause of all four "watcher deaths" (08-21 x2, 08-22 x2).
2. **Merge-wait mis-routes green PRs.** `waitForPolicyMerge()`'s timeout fires against frozen
   time; #1305's timeout fired 6 s after a wake. The earlier "merge-review lane deadlock"
   diagnosis is DEAD - standby explains the timeline, lanes did not.

### What the fix has to satisfy (RULE 1 - complete AND non-damaging)

- Complete: it must survive a 60-minute freeze at ANY point in a job, not just at start.
- Additive: it must not change behaviour on a machine that never sleeps, and must not weaken a
  genuine hang detection - a truly wedged node must still be caught.

Suggested shape for the panel to attack, not a decision:
- Replace `Date.now()` deltas with a **monotonic** source that does not advance during standby
  (Node `process.hrtime.bigint()` / `performance.now()` do not tick while suspended), OR
- Keep wall-clock but take `max(heartbeat mtime, job start, last observed tick)` and additionally
  require **N consecutive missed fixed-interval ticks** before declaring a hang - a freeze
  produces one big gap then resumes cleanly; a real hang never resumes.
- Whichever is chosen, add the GAP detector as a first-class watcher self-check, because it is
  the only thing that can currently tell frozen from healthy.

### Scope note

This is watcher code (`scripts/pr-watcher/`, `scripts/pipeline/supervise-watcher.ps1`). It does
NOT touch `sot/`. Keep it out of any doc-reconcile PR - CP-24 hard-fails code + `sot/` in one PR.

### Blocking dependency Marco owns

The power configuration of Marco's laptop is a hard stop for an agent - it is his machine and his
call. The code fix above is worth doing REGARDLESS, because it makes the pipeline correct on any
host that sleeps. But until either the fix lands or the power config changes, **arming is
deferred** - see the supervisor report for 2026-08-24 14:10Z.
