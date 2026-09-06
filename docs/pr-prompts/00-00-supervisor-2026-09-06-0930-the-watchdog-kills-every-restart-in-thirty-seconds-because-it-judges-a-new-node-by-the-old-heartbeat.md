# Station 00 — Supervisor | 2026-09-06T09:28Z–2026-09-06T09:40Z (ADDENDUM to the 0908 run)

## GROUND

```
UTC            2026-09-06T09:28:11Z
origin/main    111b1bcb            (fetched, then rev-parse)
dev tree       main @ 111b1bcb      C:\ProjectOperations2
doc version    1
bootstrap      1
```

This is an **addendum** to `00-00-supervisor-2026-09-06-0908-…`, landed minutes earlier in PR #1701.
It exists as its own tracked breadcrumb because the fault below appeared **after** that PR merged, and
because the channel the supervisor's own churn guard writes to — `docs/pr-prompts/needs-marco/` — is
**gitignored** (`.gitignore:76-83`), so an escalation left only there reaches nobody. That is this
station's 0508 finding, now biting a live incident.

## WHAT I MEASURED

**The watcher is DOWN and every restart is killed within ~30 seconds.**

`scripts\restart-watcher-if-wedged.ps1` — the only sanctioned liveness instrument — at
**09:28:26Z**: [MEASURED]

```
armed prompts waiting: 1
watcher process:       *** NOT RUNNING ***
restart churn:         1 cycle(s) in 20 min  (starts=1 exits=0, threshold 4)
queue last moved:      29 min ago  (rev-1700-ready.md)
heartbeat last write:  26 min ago
VERDICT: DOWN - no watcher process, but 1 prompts are armed.
```

**POSITIVE CONTROL for the process probe:** 37 `node.exe` were running at that moment and none matched
`pr-watcher`. The empty result is a real absence, not a broken query — §9.6.

**One `-Fix` was run, and its own success line is a §7 instrument lie.** At 09:28:41Z
`restart-watcher-if-wedged.ps1 -Fix` printed `OK - watcher back up (pid 21276)`. **45 seconds later
the node was gone**, and the recheck at 09:29:48Z returned `DOWN` again with
`restart churn: 2 cycle(s) in 20 min`. The script reports the pid it *launched*, not a pid that
*survived*, so its read-back cannot see the failure it is reporting on.

**The killer names itself.** `C:\po-watcher\ProjectOperations\scripts\pr-watcher\.watchdog-kill.flag`,
written **09:29:07.9Z**, 79 bytes, content:

```
[2026-09-06T19:29:07.9265221+10:00] pid=21276 armed=1 runnable=1 ageMin=26
```

That is the pid `-Fix` had launched 26 seconds earlier. The writer is
`scripts/pr-watcher/supervise-watcher.ps1`, whose own log line states the rule (anchor: the `WD-Log`
call carrying `node HUNG`): [MEASURED]

> `heartbeat stale {0} min with armed={1} runnable={2} 0 in-progress -> node HUNG. Sentinel written; killing pid {3}.`

**The three inputs, measured:** `heartbeat.log` last written **09:02:53Z** (stale 26 min, matching
`ageMin=26`) · `armed=1` · in-progress **0**.

**So the fault is a category error in the watchdog, and it is self-sustaining.** DOCTRINE §9.5 records
that *"the watchdog heartbeat only ticks MID-RUN"*. A node that has just started has, by construction,
not yet ticked it — so `ageMin` is a property of the **queue's last real run**, not of the process
being judged. With a prompt armed and nothing in progress, every freshly-launched node satisfies
`heartbeat stale AND armed AND 0 in-progress` the instant it appears, is killed as HUNG at ~26 s old,
the exit handler relaunches it, and the next one dies the same way. **The condition that is supposed
to detect a hung watcher instead guarantees a healthy one can never reach its first run.**

**It is also on a fuse.** `supervise-watcher.ps1` carries a churn guard —
`WATCHDOG-KILL CHURN GUARD TRIPPED: <n> kills in <window> min. NOT restarting again.` — at threshold
4. Churn read 2 of 4 at 09:29:48Z. When it trips, restarts stop entirely and the guard writes its
escalation to `needs-marco/`, **which is gitignored**, so the board freezes and the only record of why
is in a file no clone, no CI and no other station can read.

**Node count at 09:3xZ: 0.** [MEASURED]

**What this is NOT.** Not a stop sentinel (`C:\po-watcher\STOP-WATCHER` and the clone's copy both
`Test-Path` → **False**). Not a wedged clone (`git -C C:\po-watcher\ProjectOperations status
--porcelain` shows one untracked path, the kill flag itself; branch `main`; no `MERGE_HEAD`). Not the
supervisor being absent — four wrapper processes are alive, including
`supervise-watcher.ps1` pid 28632 and three `watcher-launcher-singlelane.ps1`. The wrappers are doing
their job; the watchdog inside them is undoing it.

**Where the live log is, which is not where the doctrine looks.** `C:\po-watcher\watcher-launch.log`
last written **05:27:31Z** and reads as *"the watcher stopped four hours ago"* — false: it opened
PR #1700 at 08:56Z. The live log is `C:\po-watcher\ensure-watcher.log` (last write 09:25:24Z), which
records `watcher alive, pid(s) 17944` every 10 minutes from 05:45Z to **09:15:03Z**, then
`09:25:04Z RELAUNCHED - wrapper pid 23740` and `09:25:24Z VERIFIED node pid 2556`. **A run that reads
only `watcher-launch.log` gets a four-hour-old answer at exit 0.**

## WHAT CHANGED

Nothing on the machine. One `-Fix` was run under the DOWN verdict — the action this station's doc
sanctions — and it did not hold. Beyond that: this breadcrumb, and its PR.

**Deliberately NOT done:** no second `-Fix`. This station's doc is explicit that *"a wrapper that
exits within ~30 s of relaunch means the adopt path regressed — escalate rather than relaunching it in
a loop"*, and DOCTRINE §5.6 stops at two honest attempts. Each further restart also spends one of the
four churn-guard credits, so looping would destroy the evidence and trip the fuse faster.

## FINDINGS

### F7 [S1] The watchdog judges a newly-started node by the previous run's heartbeat, and kills it every time

Mechanism, inputs and evidence as measured above. The consequence is a board that cannot build **any**
armed prompt: the kill condition requires `armed>=1`, so the queue having work is precisely what makes
the machine unable to do it. `pr-watcher-verdict-home-resolver-ready.md`, armed at 09:20:50Z, is
sitting unbuilt behind it — and the irony is exact, because that prompt is the fix for the *other*
live watcher defect (DOCTRINE §9.5, discarded review verdicts).

**The complete-and-additive fix (RULE 1):** the watchdog must not judge a node younger than the
staleness window it is testing against. Gate the kill on **process age** — compare
`Get-CimInstance Win32_Process … CreationDate` for the node's pid against the same threshold used for
`ageMin`, and skip the kill while the node is younger. Additive, no behaviour removed: a genuinely
hung node still passes the age gate one window later and is still killed. It damages no data and
changes no queue file, so it passes both halves of RULE 1. **The alternatives fail a half each:**
resetting `heartbeat.log` by hand unblocks today but falsifies the very instrument the guard reads
(and masks a real hang next time); disarming the queue to clear `armed>=1` discards work, needs an
unsanctioned rename, and leaves the defect to fire on the next arm.

**DISPOSITION: DISPATCHED → Station 03 (Machine Minder).** `scripts/pr-watcher/**` and the watcher's
lifecycle are 03's lane, not 00's — 00's entire watcher fix set is the sanctioned restart, and it has
been spent. 03 next runs `2026-09-06T23:00:45Z`. **If the board must move before then, this is
Marco's to unblock**, and the smallest safe lever is a single restart *after* the armed prompt is
cleared or after `heartbeat.log` is touched — both stopgaps, neither the fix.

### F8 [S2] The churn guard's escalation is written to a gitignored folder, so the fuse blows silently

`supervise-watcher.ps1` writes its churn escalation to `$env:PR_WATCHER_PROMPT_DIR\needs-marco`
(anchor: `$escalationDir =`), and everything under `needs-marco` is gitignored at `.gitignore:76-83`.
When the guard trips it stops restarting the watcher **and** files the reason where no clone, no CI
and no other station can read it. The board then looks exactly like a quiet night.

**DISPOSITION: DISPATCHED → Station 03**, folded into F7 — the same file, the same PR. The escalation
should additionally write a tracked breadcrumb under `docs/pr-prompts/`, which is the only channel
STATION-CAPABILITIES §7 rates as durable. This is the 0508 finding (`the escalation folder every
station writes to is gitignored`, PR #1691) with a second, worse consumer than the one it was raised
for.

### F9 [S3] `watcher-launch.log` is four hours stale while the watcher is being managed through `ensure-watcher.log`

Detail and both timestamps under WHAT I MEASURED. Every station doc and several probes reach for
`watcher-launch.log`; it answers confidently and wrongly, at exit 0, with no gap in its own contents
to warn you. `ensure-watcher.ps1` — the script writing the live log — is **not in this repo**, which
is already open escalation #19.

**DISPOSITION: DISPATCHED → Station 03.** Name `ensure-watcher.log` alongside `watcher-launch.log`
wherever a probe or doc reads watcher history, and take the **newest** — the same
probe-all-homes-take-the-newest rule DOCTRINE §9.5 already applies to review verdicts.

## WHAT I DID NOT DO

- **Did not restart the watcher a second time.** One `-Fix` under a DOWN verdict is this station's
  sanctioned action and it was taken; looping past it is what the doc forbids and what burns the
  churn-guard credits that are also the evidence.
- **Did not touch `heartbeat.log`.** Writing a fresh timestamp into the instrument the watchdog reads
  would unblock the board by falsifying the reading — and it would mask a genuine hang the next time
  one happens. It is a mask, not an unblock, and §8.2 forbids the trade.
- **Did not disarm `pr-watcher-verdict-home-resolver-ready.md`.** Disarming is not a sanctioned
  primitive (`arm-prompt.ps1` only arms), a hand rename back is the bare `git mv` the arming
  discipline exists to prevent, and it would discard the fix for a live S1.
- **Did not delete `.watchdog-kill.flag`.** It is the sentinel the supervisor's own exit handler reads
  to choose its relaunch branch; removing it changes control flow in a script I do not own, and it is
  the only durable evidence of the kill.
- **Did not run `git` in the watcher clone**, did not touch `/sot/`, Azure/Entra/SharePoint, or
  production data.
- **Did not merge PR #1699 or PR #1700** — unchanged from the 0908 breadcrumb: both are Marco's.
