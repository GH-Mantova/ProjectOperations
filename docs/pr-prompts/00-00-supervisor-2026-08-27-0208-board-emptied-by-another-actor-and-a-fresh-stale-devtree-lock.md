# Station 00 — Supervisor | 2026-08-27T02:08:16Z–2026-08-27T02:20Z

## GROUND

```
UTC            2026-08-27T02:08:16Z
origin/main    47f9c73d            (fetched with +refs/heads/main:refs/remotes/origin/main)
dev tree       main @ 549537a4      C:\ProjectOperations2   (3 behind origin/main, 0 ahead)
doc version    1
bootstrap      1
```

Versions AGREE (1 == 1). This run had full write authority; it nevertheless mutated nothing —
see WHAT CHANGED for why.

## WHAT I MEASURED

**Reachability** — `start_process` powershell.exe returned `2026-08-27T02:08:16.379Z`. NOT blind.
[MEASURED]

**Board — EMPTY.** `gh pr list --state open --json number,...` → `[]`. Control run against
`--state all --limit 8` returned 8 rows, so the query is not silently broken. [MEASURED]

**The last eight PRs** (assign-then-foreach, never a bare pipe into `Where-Object`): [MEASURED]

```
1346 CLOSED  closed=2026-08-27T00:24:44Z  docs(pipeline): correct 4 measured-false claims ... (v2)
1345 MERGED  merged=2026-08-27T01:05:19Z  docs(pipeline): correct four measured-false claims in DOCTRINE section 9
1344 MERGED  merged=2026-08-27T01:00:38Z  docs(sot-05): move four absorbed documents to their cited paths
1343 MERGED  merged=2026-08-27T00:59:05Z  feat(ew-2b): allocation engine core — AllocationService
```

**Timeline events** via `gh api repos/.../issues/<n>/timeline`: [MEASURED]

```
#1343  merged by=GH-Mantova at=2026-08-27T00:59:05Z          (no auto_merge_enabled event)
#1344  labeled   do-not-merge  at=2026-08-26T22:28:29Z
       unlabeled do-not-merge  at=2026-08-27T00:59:21Z
       merged                  at=2026-08-27T01:00:38Z       (77 s after the label came off)
#1345  merged by=GH-Mantova at=2026-08-27T01:05:19Z          (no auto_merge_enabled event)
```

No `auto_merge_enabled` on any of the three ⇒ all three were **direct merges**, not native
auto-merge. All actors merge as `GH-Mantova`, so the API carries no attribution. [MEASURED]

**Breadcrumb freshness** — `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit 1: [MEASURED]

```
00  last 2026-08-27T00:08Z  2.0h  ok      03  last 2026-08-26T23:01Z  3.1h  ok
04  last 2026-08-26T22:18Z  3.9h  ok      05  last 2026-08-26T14:11Z 12.0h  ok
structure: 49 checked, 7 malformed, 7 skipped as pre-contract
```

No station is SILENT. **No station breadcrumb postdates my 00:08Z run**, so there was nothing new
to collect this cycle beyond my own. All 7 malformed files are 06's (`00-06-pr-master-*`), the
same 7 as at 22:08Z. [MEASURED]

**Queue and machines** [MEASURED]

```
ARMED=1     pr-pipeline-fold-s3-nav-any-permission-ready.md   (mtime 2026-08-26 11:33:10Z)
NODE=1      pid 28328  started 2026-08-27 00:15:08Z   (cmdline match pr-watcher[\\/]index\.mjs)
LAUNCHERS=2 pid 10364  started 2026-08-24 05:35:01Z
            pid 23100  started 2026-08-27 00:15:03Z
```

**The watcher is genuinely BUSY, and I proved it from the live heartbeat, not from the verdict.**
`restart-watcher-if-wedged.ps1` printed `VERDICT: BUSY — queue idle 106 min BUT heartbeat is fresh
(1 min)`. I then read the file it actually stats (`$watchDir` is line 48 =
`C:\po-watcher\ProjectOperations\scripts\pr-watcher`, i.e. the CLONE, not the dev tree): [MEASURED]

```
[2026-08-27T02:08:34.089Z] pr-pipeline-fold-s3-nav-any-permission-ready.md elapsed=720s last:
[2026-08-27T02:10:34.091Z] pr-pipeline-fold-s3-nav-any-permission-ready.md elapsed=840s last:
```

Started ≈01:56:34Z. 14 minutes elapsed — well under the 45-minute hang threshold. The BUSY verdict
is REAL. `DO NOT RESTART` and `arm nothing` both bind.

**`pr-pipeline-fold-s3-nav-any-permission-ready.md` is UNTRACKED.**
`git ls-files --error-unmatch <path>` → `error: pathspec ... did not match any file(s)`. Control:
the same command against a tracked path succeeds. So it was armed by a **filesystem rename, not a
`git mv`** — the index carries no rename for it. [MEASURED]

**Dev tree index (SHARED — checked before contemplating any commit):** [MEASURED]

```
A    docs/pr-prompts/00-04-scanner-2026-08-26-2218-instrument-honesty-four-false-traps.md
A    docs/pr-prompts/pr-doctrine-s9-four-false-traps-LOOPING.md
R100 pr-ew-s2b-alloc-engine-core-HOLD.md          -> ...-ready.md
R100 pr-lessons-folder-s2-unfold-sot05-HOLD.md    -> ...-ready.md
R100 pr-sot-02-reconcile-2026-08-19-HOLD.md       -> ...-ready.md
```

Still exactly 5, unchanged since 00:27Z. 16 dirty tracked paths. 49 `pr-*-HOLD.md` at depth 1.

**Dev tree `.git\index.lock` EXISTS.** [MEASURED]

```
size=0  created=2026-08-27T02:07:36Z  modified=2026-08-27T02:07:36Z
git.exe processes = 0
MERGE_HEAD / REBASE_HEAD / CHERRY_PICK_HEAD / rebase-merge / rebase-apply / sequencer = all False
re-measured 8 minutes later: STILL PRESENT, still 0 bytes, git_procs still 0
```

It was created **40 seconds before this run's first command** (02:07:36Z vs 02:08:16Z), so it is
not mine. Zero bytes, no git process, no in-progress operation, and it did not clear across two
samples: **STALE by every test the doctrine names.**

**Watcher clone** `C:\po-watcher\ProjectOperations` [MEASURED]

```
HEAD 42a397bd on main   origin/main...HEAD = 0 behind / 2 ahead   stashes 41
MERGE_HEAD=False  index.lock=False
ahead:  42a397bd Merge branch 'main' of https://github.com/GH-Mantova/ProjectOperations
        355dfdec docs(pr-reviews): verdict on pr-1339 (d-namespace-s2 EA rename)
```

**`watcher-launch.log` (last write 00:24:05Z) is the WRAPPER's log, not the node's.** Its tail
proves what my 00:27Z run got wrong: [MEASURED]

```
[00:23:04Z] Watcher exited with failure (exit 1). Identical consecutive failures: 1 of 5. Restarting in 60 s.
[00:24:04Z] PRE-FLIGHT: uncommitted TRACKED changes on branch 'main'. Self-healing by stashing them
[00:24:05Z] SINGLE-INSTANCE: watcher already running (PID 28328). Not starting another.
[00:24:05Z] ADOPT: a watcher node is already running and no wrapper was supervising it. Adopting rather than exiting.
```

`ensure-watcher.log` shows the Keepalive clean through 02:05:18Z, `watcher alive, pid(s) 28328`
every 10 minutes since 00:25Z. [MEASURED]

## WHAT CHANGED

**Nothing.** No arm, no disarm, no merge, no label, no commit, no restart, no lock cleared.

Three independent reasons, each sufficient: the board is empty (nothing to merge); the watcher is
mid-run on an armed prompt (RULE 4 — one at a time — forbids arming a second); and the dev tree
carries an index lock, so a `git mv` or `git add` would fail anyway. Clearing that lock is 03's,
on 00's dispatch — not mine.

## FINDINGS

### F1 — Three PRs merged by an actor that is not this station, and a `do-not-merge` label was REMOVED

At 00:27Z I recorded #1343 and #1344 as **NOT MERGED** under RULE 2 (`marco:true` in their
`processed/*.log`), and #1345 as the next merge pending the watcher leaving that lane. Between
00:59:05Z and 01:05:19Z all three merged, as direct merges, with no auto-merge event. #1344's
`do-not-merge` label was **removed at 00:59:21Z and the PR merged 77 seconds later.**

Removing a `do-not-merge` label is reserved to Marco absolutely, in every layer of doctrine. The
merges themselves are consistent with Marco clearing the board by hand at ~11:00 local — and the
same window also armed a prompt by filesystem rename (F2), which is exactly Station 06's signature
and 06 only runs when Marco fires it. That reading is coherent, benign, and **unproven**: all
actors authenticate as `GH-Mantova`, so no measurement can distinguish Marco from an agent.

I am not calling this a defect — an unattributable label/merge event is not evidence of one. I am
asking, because the one thing that must never happen silently is a `do-not-merge` coming off.

**Marco — did you merge #1343/#1344/#1345 and lift #1344's `do-not-merge` around 01:00Z today?**

- **If YES:** nothing is wrong and the only gap is auditability. **RULE 1 option A (complete and
  additive, recommended):** have the watcher write a one-line actor breadcrumb to a tracked path
  whenever it applies or observes a label change, and have `Merge-Pr` stamp the merging station
  into the PR comment thread. Solves it immediately (the next event is attributable) and in future
  (every event thereafter), and touches no existing or future data entry — it only adds records.
- **Option B:** give each station its own GitHub token/identity. Complete on the "future" half and
  fully attributable, but it fails the "without damaging existing data entry" half — re-issuing
  tokens touches auth config, which is a hard stop I cannot verify without you, and every existing
  `GH-Mantova` artifact becomes ambiguous rather than clarified.
- **Option C:** do nothing. Fails both halves; the next unexplained label removal is equally
  unreadable.

**DISPOSITION: ESCALATED**

### F2 — `pr-pipeline-fold-s3-nav-any-permission` was armed out of lane, and is running now

Armed between 00:27Z (measured 0 armed) and 01:56:34Z (first heartbeat line), by a filesystem
rename — the file is untracked and the index carries no rename for it. Only Station 00 may arm.
Same actor and window as F1, so I treat it as one question, asked once, in F1.

Operationally it is fine: the prompt is one of the four I named at 00:27Z as the next arms, its
gate was RELEASED, and it is 14 minutes into a legitimate run. There is nothing to do but let it
finish. It becomes urgent at 45 minutes elapsed (`elapsed=2700s` in the clone's `heartbeat.log`),
which is a HANG per §3d, not slow tests.

**DISPOSITION: DEFERRED**

### F3 — STALE 0-byte `index.lock` in the DEV TREE

`C:\ProjectOperations2\.git\index.lock`, 0 bytes, created 02:07:36Z, unchanged across two samples
eight minutes apart, with **zero `git.exe` processes** and no MERGE/REBASE/CHERRY_PICK/sequencer
state. It predates my first command by 40 seconds, so it is not mine.

This is the documented failure mode: a lock with no Windows process behind it never expires, and
it freezes arming, disarming and every queue commit for every station. It is not blocking the
in-flight prompt (the watcher builds in the clone), so there is no emergency — but the next arm
will fail on it, and `status-sweep.ps1` §7 will escalate the whole board to DO-NOT-ACT on its mere
existence.

Handed to **Station 03 — Machine Minder** (next cadence run ~03:01Z): re-measure size, age and
`git.exe` count first, then clear via `scripts/clear-stale-index-lock.ps1`, and **only while the
watcher is not mid-write**. Do not clear it if a `git.exe` has appeared — re-measure, do not
inherit my sample.

**DISPOSITION: DISPATCHED** — Station 03, dev-tree stale lock, clear via the sanctioned script.

### F4 — Correction: launcher pid 10364 is NOT inert. It adopted the live node.

My 00:27Z run recorded pid 10364 as "stale; its node died and it did NOT relaunch". The wrapper
log refutes that. It waited out its 60-second backoff, ran its preflight (auto-stashing the
clone's tracked changes — this is where stash 41 came from), was refused by the SINGLE-INSTANCE
guard, and **ADOPTED node 28328**.

So both wrappers now supervise the same node. The fault is real but different from the one I
reported: not an abandoned process, but **two supervisors racing to relaunch the next death** —
and the SINGLE-INSTANCE guard means the loser exits, which is survivable but leaves the surviving
supervisor unpredictable. The kill of 10364 stands as the fix; the *reason* changes, and 03 must
not kill it while it is the only thing adopting a node.

Re-dispatched to **Station 03** with the corrected reason: kill 10364 **by command line, not
image name**, and only after confirming 23100 is alive and adopting.

**DISPOSITION: DISPATCHED** — Station 03, duplicate wrapper, corrected rationale.

### F5 — The clone divergence is smaller than I escalated, and no longer needs a destructive fix

At 00:27Z I escalated the clone as `355dfdec`, 12 behind / 1 ahead, and said the cure was
`reset --hard` — irreversible, so Marco's. It is now **0 behind / 2 ahead**: the wrapper's own
fetch closed the gap, and the two local commits are a merge commit and one real artifact,
`355dfdec docs(pr-reviews): verdict on pr-1339`.

Nothing destructive is required. The correct handling is to preserve that verdict (it is a real
review artifact that exists nowhere else) rather than discard it. **Withdrawing the escalation.**
The stash count (41) remains a closed loop — report growth, `stash drop` never `pop`.

**DISPOSITION: DEFERRED** — becomes urgent only if the clone goes behind again before a restart.

### F6 — `watcher-launch.log` silence is explained, not a defect

It is the *wrapper's* log. Node 28328 was started by wrapper 23100 and does not write to it, so
its mtime says nothing about the node. The live instrument is
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log` — the same file
`restart-watcher-if-wedged.ps1` stats at line 48. Any future run reading watcher-launch.log for
liveness will get a confident wrong answer.

**DISPOSITION: ACTIONED** — recorded here and in project memory; the probe list is corrected.

### F7 — 7 malformed breadcrumbs, all Station 06's, and 06 still has no schedule

Unchanged from 22:08Z: same 7 files, all `00-06-pr-master-*`, all missing the `# Station <NN>`
heading and a disposition line. 06 has no scheduled task, so it cannot be dispatched to fix them,
and per the standing note this is not re-raised each run.

**DISPOSITION: DEFERRED** — folded into the open 16:09Z escalation about scheduling 06.

## WHAT I DID NOT DO

- **Did not restart the watcher.** Verdict BUSY, and I confirmed it against the live heartbeat
  (`elapsed=840s` on a named prompt), not against the verdict alone. Killing that is worse than
  the stall it would pretend to fix.
- **Did not arm anything.** RULE 4 is one at a time and one is in flight. The next four remain
  `pr-crm-wincount-s2-close-bypasses`, `pr-dns-s3-sot06-widgets-and-marker`,
  `pr-e2e-container-s2-swap-required-job`, `pr-fv2-maintenance-usage-intervals`
  (migration ⇒ Marco at merge), plus `pr-rates-consumers-s3a-export-only-HOLD.md` which is still
  untracked and therefore unarmable until `git add`.
- **Did not clear the index lock.** 00 dispatches it; 03 clears it.
- **Did not commit this breadcrumb.** The dev-tree index is locked and carries 5 entries from
  other chats. **This file is UNTRACKED — it reaches nobody until a board PR commits it, with a
  pathspec.**
- **Did not fast-forward the dev tree** (3 behind origin/main). A FF while a prompt is mid-run is
  exactly how a `-ready.md` gets carried in and armed behind my back. It waits for an idle window.
- **Did not touch Azure / Entra / SharePoint, production data, or `/sot/`.**

---

## LATE-RUN ADDENDUM — 2026-08-27T02:19:52Z (the board moved while I was writing)

Re-measured immediately before closing, because a verdict expires the moment it prints. [MEASURED]

```
lock=True   git_procs=0                       (F3 unchanged — still stale, still dispatched to 03)
heartbeat:  [2026-08-27T02:19:40.685Z] rev-1347-ready.md elapsed=300s last:
open_prs=1
PR 1347  BLOCKED  draft=False  labels=[]  branch=feat/nav-pipeline-any-permission
         feat(nav): gate folded Pipeline item on tenders.view OR crm.view (any-of)
```

**F2 resolved itself the right way.** `pr-pipeline-fold-s3-nav-any-permission` completed and opened
**#1347**. The watcher has already moved on to `rev-1347-ready.md` (the review job), 5 minutes in.

🔴 **#1347 IS WATCHER-ROUTED TO MARCO — RULE 2. DO NOT MERGE IT.** [MEASURED] from
`processed/pr-pipeline-fold-s3-nav-any-permission-ready.md.log`:

```
[watcher] merge result for PR #1347: {"ok":false,"marco":true,
  "reason":"outside tests/ or docs/: apps/web/src/components/ShellLayout.tsx"}
```

Note `labels=[]`. **A label-only check would have read this PR as free to merge.** It is not. This
is the third PR in twelve hours routed to Marco carrying no label at all — always run the
`processed/*.log` probe, never infer from labels.

Two further reasons not to act on it this run, either of which is sufficient on its own: the
watcher is mid-lane on `rev-1347-ready.md`, which is the LL-38 single-actor stop; and it is
`BLOCKED`, so there is nothing to merge yet regardless.

**Next 00:** #1347 is Marco's. Do not merge it, do not remove a label from it, and do not arm the
next HOLD until `rev-1347-ready.md` has been consumed and the watcher is idle.

**DISPOSITION (F2, revised): ACTIONED** — the prompt ran to completion and produced #1347; verified
by the PR existing on the live board and by its `processed/*.log`.
**DISPOSITION (#1347): ESCALATED** — watcher-routed to Marco, left untouched under RULE 2.
