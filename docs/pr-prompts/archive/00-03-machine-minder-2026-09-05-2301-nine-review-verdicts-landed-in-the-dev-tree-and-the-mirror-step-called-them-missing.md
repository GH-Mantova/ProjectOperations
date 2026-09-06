# Station 03 - Machine Minder | 2026-09-05T23:01Z-2026-09-05T23:12Z

## GROUND

```
UTC            2026-09-05T23:01:37Z
origin/main    02cd539f              (git fetch origin +refs/heads/main:... then rev-parse, in the DEV TREE)
dev tree       main @ 7695b3a5       C:\ProjectOperations2   (2 behind origin/main)
doc version    1                     (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE. Run proceeded normally (report-only, as always for 03).

Binding documents were read from the DEV TREE after proving the dev tree copy is byte-identical
to `origin/main` - the sound comparison form, no pipe (DOCTRINE 9.1 / 9.3):

```
git rev-parse origin/main:docs/pipeline/DOCTRINE.md              d143d4be...
git hash-object            docs/pipeline/DOCTRINE.md              d143d4be...   IDENTICAL
git rev-parse origin/main:docs/pipeline/STATION-CAPABILITIES.md   5645734f...
git hash-object            docs/pipeline/STATION-CAPABILITIES.md   5645734f...   IDENTICAL
git rev-parse origin/main:docs/pipeline/stations/03-machine-minder.md  1863c3ea...
git hash-object            docs/pipeline/stations/03-machine-minder.md  1863c3ea...  IDENTICAL
```

The two commits the dev tree lacks (`110b1721`, `02cd539f`) touch only
`apps/web/src/pages/tendering/scope-cards/**` - no `docs/pipeline/**`, no `scripts/**`.

## WHAT I MEASURED

**Preflight, step 1 - reachability.** `[MEASURED]` `start_process` shell `powershell.exe` returned
`REACHED ... 2026-09-06T09:01:14.5517850+10:00`. **This run was SIGHTED.** Desktop Commander present
throughout; every line below is a probe on the box, not a GitHub-side substitute.

**status-sweep.ps1** `[MEASURED]` 2026-09-05T23:02:27Z, run with `-File`. Section 0 positive controls
both PASS (`gh CAN reach GitHub (saw merged PR #1681)`, `node runs`). Section 7 verdict: `SAFE TO ACT`.
No `[BROKEN]` anywhere, so the report is usable.

**Watcher process** `[MEASURED]` resolved by COMMAND LINE, never by image name (DOCTRINE 9.5):

```
Get-CimInstance Win32_Process -Filter "Name='node.exe'"   ->  17 node.exe running
  the ONE that is the watcher:
  ProcessId    : 20000
  CreationDate : 2026-09-04 19:37:14 (Brisbane) = 2026-09-04T09:37:14Z   uptime ~37.5 h
  CommandLine  : "C:\Program Files\nodejs\node.exe" --no-deprecation
                 C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
```

Re-measured at 23:05:58Z (DOCTRINE 7, `[LIVE]` expires): still pid 20000, same creation time.

**Keepalive** `[MEASURED]` `C:\po-watcher\ensure-watcher.log` ticks every 10 minutes; the last 25
samples (19:05:03Z -> 23:05:03Z) all read `watcher alive, pid(s) 20000`. No restart in that window.

**Heartbeat** `[MEASURED]` status-sweep reports `heartbeat age: 26 min`. Per DOCTRINE 9.5 the watchdog
heartbeat only ticks MID-RUN, so 26 min against an empty armed queue is IDLE, not wedged - and the
launch log below shows the review lane working through 23:02:21Z, i.e. minutes before this report.

**Locks and concurrency** `[MEASURED]` (status-sweep section 3): `git index.lock interactive/clone:
False / False`, `git processes running: 0`, `in-progress prompts: 0`, `no PR touched in the last 2 min`.
**No stale lock this run.**

**Watcher clone** `C:\po-watcher\ProjectOperations` `[MEASURED]`:

```
branch main   HEAD 110b1721   its own origin/main 110b1721 (pinned at launch)   behind/ahead 0/0
git diff --name-only 110b1721 02cd539f   ->  3 files, all apps/web/src/pages/tendering/scope-cards/**
```

**So the clone drift is BENIGN this run**: the one commit the clone lacks touches no
`scripts/pr-watcher/**`, so the running watcher is executing current watcher code. (DOCTRINE 9.5,
"a restart adopts nothing" - the relevant question is not whether the clone is behind but whether it
is behind on the code the watcher runs. It is not.)

**Clone dirty = 4** `[MEASURED]` `git status --porcelain`, all four UNTRACKED:

```
?? "C\357\200\272temppr-1648.diff"          <- see F5
?? docs/pr-reviews/pr-1667-review.md
?? docs/pr-reviews/pr-1675-review.md
?? scripts/pr-watcher/.conflict-notified-prs.json
```

**Stash closed loop** `[MEASURED]` `git stash list` in the clone -> **66** entries; newest
`stash@{0}: watcher-preflight-autostash on 'main' at 2026-09-03T18:55:05+10:00` (= 08:55Z 09-03).
Nothing has stashed in 2.6 days, consistent with a watcher that has not been relaunched since
2026-09-04T09:37Z (the launcher stashes only when the tree is dirty at start).

**Queue and failures** `[MEASURED]`: `armed (*-ready.md): 0` - nothing waiting. `failed/`: **41 files,
newest LastWriteTimeUtc 2026-08-28T21:03:55Z**, the known expired-OAuth batch already triaged in
`00-03-machine-minder-2026-08-29-2305-oauth-expired-watcher-cannot-run.md`. **NOTHING NEW TO TRIAGE.**
`needs-marco/ 26 - no-pr-opened/ 109 - blocked/ 120`.

**RULE 2 probe directory is alive** `[MEASURED]` (pinned to the DEV TREE, never the clone - DOCTRINE 9.5):
`C:\ProjectOperations2\docs\pr-prompts\processed` holds **1971** `*.log`, newest `rev-1682-ready.md.log`
at 2026-09-05T22:37:32Z - younger than every open PR, which is the control that separates the live
directory from the clone's 17-day-stale decoy.

**Disk** `[MEASURED]` C: used 773.8 GB, **free 178.5 GB**. Not a constraint.

**Launcher / sentinel inventory** `[MEASURED]`, with the path that DOCTRINE 9.5 says is the
load-bearing half:

```
C:\po-watcher\watcher-launcher-singlelane.ps1   present  2367 B   <- the real launcher
C:\po-watcher\watcher-launcher.ps1              present  2083 B
C:\po-watcher\watcher-launcher-lane2.ps1        present  2352 B
C:\po-watcher\ensure-watcher.ps1                present  5266 B
C:\ProjectOperations2\scripts\restart-watcher-if-wedged.ps1  present  15968 B
C:\po-watcher\STOP-WATCHER                      ABSENT
C:\po-watcher\STOP-WATCHER-LANE2                present  1090 B   <- BY DESIGN since 2026-08-15
NEGATIVE CONTROL C:\po-watcher\zzQq03Needle20260906  -> absent
```

Matches DOCTRINE 9.5 exactly. Not drift, not a stop signal, and NOT re-filed as a finding.

**Prior 03 breadcrumbs** `[MEASURED]` `git ls-tree -r --name-only origin/main -- docs/pr-prompts`
filtered for `00-03-machine-minder` (POSITIVE CONTROL: the same query for `00-00-supervisor`
returns **185**): newest six are 08-29-2305, 08-30-2301, 08-31-2302, 09-01-2302, 09-03-2302,
**09-04-2301**. `[INFERRED]` there is no tracked 03 breadcrumb dated 2026-09-02; that is either a
missed run or a breadcrumb nobody swept up. Not re-derived here - it is 00's freshness probe's job,
and 03's live cadence is daily (see WHAT I DID NOT DO).

## WHAT CHANGED

**Nothing.** Station 03 is REPORT-ONLY. No process started or killed, no worktree pruned, no stash
dropped, no file moved, no prompt armed or disarmed, no label touched, no PR touched, no `sot/` edit.

The only writes this run were four scratch `.ps1` probes under `C:\po-sup-fix-scripts\`
(`s03-probe*-20260905.ps1`, the sanctioned scratch directory) and **this breadcrumb**, written to the
DEV TREE at `C:\ProjectOperations2\docs\pr-prompts\`. It is currently **UNTRACKED** - Station 00 must
sweep it into a board PR or this run is unreported.

---

## FINDINGS

### F1 - S1 - 12 review verdicts today were produced and then thrown away, and the log calls all 12 the same thing

`[MEASURED]` 2026-09-05T23:0xZ from `C:\po-watcher\watcher-launch.log`:

```
Select-String -Pattern 'verdict mirror skipped'   -> 68 total
Select-String -Pattern 'verdict mirrored to PR'   -> 262   (POSITIVE CONTROL)
Select-String -Pattern 'zzQq03Needle20260906'     -> 0     (NEGATIVE CONTROL, minted this run)
```

**Twelve of the 68 are today alone**, 07:34:05Z through 22:37:32Z: PRs 1646, 1651, 1652, 1654, 1660,
1662, 1669, 1672, 1677, 1679, 1680, 1682. Every one of them was filed `[ok] -> processed/` immediately
afterwards, i.e. **recorded as a successful review job.**

Worked instance, `#1682`, the newest and the cleanest:

```
[2026-09-05T22:33:01.689Z] [start] rev-1682-ready.md (max-turns=240)
**VERDICT: MERGE** - PR #1682 is scope-tight and CI-green. ... Verdict written to `docs/pr-reviews/pr-1682-review.md`.
[2026-09-05T22:37:32.922Z] [review] verdict mirror skipped: docs/pr-reviews/pr-1682-review.md not found
[2026-09-05T22:37:32.923Z] [ok] rev-1682-ready.md -> processed/
```

The reviewer says it wrote the file. The watcher says the file is not there. **Both are true**, and the
one log line hides **two different causes**:

`[MEASURED]` presence of each of today's twelve, in all three homes:

```
pr-1646-review.md    clone=False devtree=True  archive=False
pr-1651-review.md    clone=False devtree=True  archive=False
pr-1652-review.md    clone=False devtree=False archive=False
pr-1654-review.md    clone=False devtree=True  archive=False
pr-1660-review.md    clone=False devtree=True  archive=False
pr-1662-review.md    clone=False devtree=True  archive=False
pr-1669-review.md    clone=False devtree=True  archive=False
pr-1672-review.md    clone=False devtree=False archive=False
pr-1677-review.md    clone=False devtree=True  archive=False
pr-1679-review.md    clone=False devtree=False archive=True
pr-1680-review.md    clone=False devtree=True  archive=False
pr-1682-review.md    clone=False devtree=True  archive=False
NEGATIVE CONTROL pr-zzQq03Needle20260906-review.md  clone=False devtree=False archive=False
POSITIVE CONTROL pr-1681-review.md (mirrored OK)    clone=False devtree=False archive=True
```

- **Cause (a), WRONG TREE - nine of twelve.** The review job wrote its verdict into the **dev tree**
  `C:\ProjectOperations2\docs\pr-reviews\` while the watcher's mirror step reads the **clone**.
  `pr-1682-review.md` is 2475 bytes, mtime `2026-09-05T22:37:16Z` - 16 seconds before the mirror step
  declared it missing, and 25 minutes before this measurement. The verdict was never lost; it was
  written to a path nothing consumes.
- **Cause (b), THE ARCHIVE SWEEP RACES THE MIRROR - one of twelve.** `#1679` DID write to the clone.
  `[MEASURED]` from the same log, in order:
  `21:22:23.331Z [review] verdict-archive: moved pr-1679-review.md (state=MERGED) -> C:\po-watcher\verdicts-archive`
  then `21:22:39.711Z [review] verdict mirror skipped: ... not found`. **Sixteen seconds.** The
  five-minute archive sweep removed the file the mirror step was about to read. The positive control
  is `#1681`, where the same two steps ran in the opposite order - mirrored `22:09:42Z`, archived
  `22:12:21Z` - and the verdict reached the PR.
- **Cause (c), NOWHERE AT ALL - two of twelve.** `pr-1652` and `pr-1672` are absent from all three
  homes. `[CANNOT MEASURE]` which of (a) or (b) they were; the artifact no longer exists to ask.

**Why this is S1 and not housekeeping.** `verdictApproves` reads `docs/pr-reviews/pr-<N>-review.md`.
A verdict that lands in the dev tree, or is archived before the mirror runs, is invisible to it - so
the `tests-docs` auto-merge lane cannot consume it, and the PR times out into
`{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}`, which
RULE 2 then correctly forbids any station from clearing. **This is a NEW measured cause for the second
conjunct of DOCTRINE 10.3**, and it is not the one already on file: the open escalation
`needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md` attributes the starvation to
QUEUE LATENCY (93.5 minutes on `#1675`). `#1682`'s review job started 33 seconds after enqueue and
finished in **4.5 minutes** - there was no starvation, the verdict simply went to the wrong tree.
A reader who checks only the queueing table will find `#1682` healthy and conclude the mechanism did
not reproduce. It reproduced, by a different route, twelve times today.

**DISPOSITION: DISPATCHED -> Station 00.** 03 is report-only and this is a `scripts/pr-watcher/**`
change, outside 03's lane in either direction. Handing over: the two causes, the discriminating
evidence for each, the controls, and the three candidate remedies below in RULE 1 order.

RULE 1 (solve it completely, immediately and in future, without damaging existing or future data):

1. **COMPLETE AND ADDITIVE - make the mirror step tree-agnostic and archive-aware.** Resolve the
   verdict path against the clone root explicitly (not a relative `docs/pr-reviews/`), and on a miss
   fall back to `C:\po-watcher\verdicts-archive\` and then to the dev tree before declaring it
   missing. Fixes (a) and (b) together, keeps every existing artifact, and a verdict already written
   is never discarded again. Passes both halves.
2. **Pin the review job's working directory to the clone.** Fixes (a) only. Fails the "future" half -
   `#1679` proves the archive race is independent and would still eat verdicts.
3. **Order the archive sweep after the mirror step.** Fixes (b) only. Fails the "immediately" half for
   the nine PRs in cause (a), which is where the volume is.

None of the three is destructive; none needs Marco. **A fourth option that must NOT be taken: making
the mirror step's failure louder without fixing it.** The log line is already accurate. The defect is
that an accurate line was filed as `[ok]`.

### F2 - S2 - DOCTRINE 9.5's "the dev tree's pr-reviews is a STALE MIRROR" is now wrong, in the dangerous direction

DOCTRINE 9.5 carries, measured 2026-09-05T19:2xZ by Station 00:

> `docs/pr-reviews/` IN THE DEV TREE IS A STALE MIRROR, NOT THE REVIEW LANE'S OUTPUT. ... **Probe the
> clone and that archive before concluding the review lane is dead.**

`[MEASURED]` this run, four hours later: **nine of today's verdicts exist ONLY in the dev tree**, and
the newest of them (`pr-1682-review.md`, 22:37:16Z) is 25 minutes old. The dev tree's newest is
`pr-1682`; the clone's newest is `pr-1675-review.md` (19:03:00Z); the archive's newest is
`pr-1681-review.md` (22:09:18Z).

A reader following that bullet's cure - probe the clone and the archive - finds nothing for those nine
and concludes the verdicts do not exist. **They do, at the one location the cure tells you not to
look.** The bullet is not wrong about the failure it recorded; it is wrong that the dev-tree copy is
always stale. Both trees now hold live output, split unpredictably by F1's cause (a), and neither is
authoritative on its own.

**DISPOSITION: DISPATCHED -> Station 00.** DOCTRINE is 00's lane to edit; 03 may not. Suggested
correction: keep the bullet, add that since 2026-09-05 the review job's write location is
NON-DETERMINISTIC, and that the sound probe is **all three homes** (clone, `verdicts-archive`, dev
tree) until F1 lands. The falsifying probe for the correction is the twelve-row table in F1.

### F3 - S2 - the orphaned worktree C:\po-vg is unchanged 39 hours on, and now measured to hold bytes that exist nowhere else

Second consecutive run reporting this; first report
`00-03-machine-minder-2026-09-04-2301-one-untracked-file-pins-a-dead-worktree-live-forever.md`,
DISPATCHED, not actioned. Per the station brief, a repeat of the same root cause is ESCALATED, not
re-dispatched - and this one now has a measurement that makes it Marco's under DOCTRINE 5.4
(irreversible).

`[MEASURED]`:

```
git worktree list          C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]
status --porcelain         ?? scripts/pipeline/check-pipeline-heartbeat.mjs   (ONE untracked file)
age (status-sweep)         2349 min = 39.2 h
git merge-base --is-ancestor 23c91ba9 origin/main   -> exit 1  (NOT merged)
   POSITIVE CONTROL        84cae7df                 -> exit 0
git ls-remote --heads origin | grep no-rebase-while-checks-run  -> EMPTY  (never pushed)
   POSITIVE CONTROL        refs/heads/main -> 02cd539f...
git rev-list --count origin/main..fix/no-rebase-while-checks-run -> 1
   23c91ba9 fix(pr-watcher): never rebase a PR whose checks are still running
```

And the part that changes the decision:

```
git hash-object C:\po-vg\scripts\pipeline\check-pipeline-heartbeat.mjs   9c4587fb...
git rev-parse origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs  84ec92d4...   DIFFERENT
```

A file of that name **does** exist on `origin/main` - so last run's framing ("the only copy") was too
strong - but the worktree's copy is a **different blob**. Pruning discards bytes that exist in exactly
one place. The commit itself is safe: the local branch ref `fix/no-rebase-while-checks-run` holds it
and `git worktree remove` does not delete a branch.

**DISPOSITION: ESCALATED -> Marco.** A question, with options in RULE 1 order:

1. **COMPLETE AND ADDITIVE - preserve first, then prune.** Copy the untracked file out to
   `C:\po-sup-fix-scripts\` (or commit it onto `fix/no-rebase-while-checks-run` and push the branch,
   which also rescues the unmerged watcher fix), THEN `git worktree remove C:/po-vg`. Nothing is lost,
   the sweep stops reporting an orphan every run, and the "never rebase a PR whose checks are still
   running" fix stops living on one machine. Passes both halves.
2. `git worktree remove --force`. Fails the second half - it discards the untracked file with no
   record of what it said.
3. Leave it. Fails the first half - the sweep will keep classifying it as an aborted-run leftover, and
   an unpushed watcher fix stays one disk failure from gone.

03 will not perform any of these: (1) is a git write in a shared tree and (2) is irreversible.

### F4 - S3 - the watcher clone's stash loop stands at 66 and nothing pops it

`[MEASURED]` `git stash list` in `C:\po-watcher\ProjectOperations` -> **66** entries, newest
`2026-09-03T18:55:05+10:00`. DOCTRINE 9.2 records this as a closed loop by design: the launcher's
preflight stashes on every start and nothing ever pops. A prior 03 run trimmed it on 2026-08-24
(`C:\po-watcher\stash-trim-2026-08-24-station03.log`, 36683 B).

No growth in 2.6 days, which is consistent with no relaunch since 2026-09-04T09:37Z rather than with
the loop being fixed. Not urgent: 66 stashes cost disk, not correctness.

**DISPOSITION: DEFERRED.** What would make it urgent: a restart cadence that resumes adding entries
(watch the newest-stash date move), or a station needing to read stash state and having to page through
66 rows. Report the count and its growth every run - that is the instrument, not the absolute number.

### F5 - S3 - a file literally named `C:<U+F03A>temppr-1648.diff` sits in the watcher clone root

`[MEASURED]` `C:\po-watcher\ProjectOperations\` holds an 8260-byte untracked file whose name git
escapes as `"C\357\200\272temppr-1648.diff"` - `\357\200\272` is **U+F03A**, the private-use
look-alike Windows substitutes for a colon. Written `2026-09-05T07:42:10Z`. Something built the string
`C:\temp\pr-1648.diff` and wrote it as a RELATIVE filename in the clone root instead of an absolute
path, silently, at exit 0.

It is untracked, so it blocks nothing - but it is one of the four entries behind status-sweep's
`watcher clone: branch=main dirty=4 <- NOT clean-on-main; the watcher may refuse to start`, i.e. it
degrades the clone-hygiene signal every station reads. The other three are legitimate work artifacts.

**DISPOSITION: DISPATCHED -> Station 00.** Two things to hand over, and the second is the real one:
delete the stray file (trivial, but a clone-tree write, which is 00's or 02's lane, not 03's); and
find the producer, because a path-building bug that writes to the CWD at exit 0 will do it again - the
diff for `#1648` is presumably also missing from wherever it was meant to go. Grep candidates:
anything writing `.diff` under `scripts/pr-watcher/**` or `scripts/pipeline/**` around 07:42Z on
2026-09-05.

### F6 - heartbeat - the queue is quiet and there is nothing new to triage

`[MEASURED]` `failed/` = 41 files, newest write `2026-08-28T21:03:55Z` - the expired-OAuth batch
already triaged on 2026-08-29. `armed (*-ready.md)` = 0. No new quarantine entries in 8 days, nothing
limit-parked, nothing awaiting a reset. Watcher pid 20000 up 37.5 h, keepalive green on 25 consecutive
10-minute samples, no `index.lock` in either tree, 0 git processes, 178.5 GB free.

**DISPOSITION: ACTIONED.** Verified by the probes quoted above; no triage was owed and none was
performed. Recorded so that a quiet run is distinguishable from a blind one - **this run was SIGHTED.**

### F2-AMENDMENT - Station 04 filed this 51 minutes before me and Station 00 has already ACCEPTED it. F2 is CONFIRMING EVIDENCE, not a new finding.

Checked before filing, which is the discipline: `00-04-scanner-2026-09-05-2210-...md` **F1** already
says DOCTRINE 9.5's `docs/pr-reviews/` bullet points the wrong way, measured at 22:2xZ (dev tree
`pr-1680` 21:46:33Z vs clone `pr-1675` 19:03:00Z), and `00-00-supervisor-2026-09-05-2209-...md`
FINDING D has already **ACCEPTED** it, corrected its scope from "seven station docs" to one file plus
a canonical re-record, and DEFERRED it to the next sighted 00 run.

**My F2 does not re-raise it.** What it adds is the MECHANISM 04 could not see: 04 measured that the
dev tree was AHEAD; F1 above measures WHY (the review job writes to the dev tree while the mirror
step reads the clone) and that it has cost **12 verdicts today**. 04's proposed cure - probe both
trees and the archive, take the newest - is correct for a READER and does not fix the WRITER, which
is what F1 is for. **Ship them together: 04's F1 corrects the doc, my F1 corrects the code.**

### F7 - S1 - machine repairs are dispatched to a station whose own contract forbids performing them, and the backlog is now three items deep

`[MEASURED]` `00-00-supervisor-2026-09-05-2209-...md` FINDING D: *"**F4** (watcher-clone stash = 66) -
**DISPATCHED -> Station 03**, which owns the watcher clone and has a live daily schedule
(`0 9 * * *`), so this dispatch has a consumer. `git stash drop`, never `pop`. **It joins the
already-dispatched watcher-clone dirt and the `C:\po-vg` worktree.**"

`[MEASURED]` what 03 is permitted to do with them:

- `docs/pipeline/stations/03-machine-minder.md`, AUTHORITY section: *"**You are REPORT-ONLY. You
  diagnose; you do not repair.** ... You do not repair, arm, merge, or touch the board. **Station 00
  dispatches the repair** - your job is to make it obvious and unambiguous, not to perform it."*
- `STATION-CAPABILITIES.md` section 5 authority matrix, row *"Repair the machines"*:
  **00 = "dispatches 03"**, **03 = "report-only"**.

**The two halves compose into a loop with no executor.** 00 may not repair, so it dispatches to 03;
03 may not repair, so it reports; the report reaches 00, which dispatches it again. Three items are
now circulating in it - the stash (66, dispatched this evening), the clone dirt (dispatched earlier,
still 4 files, see F5), and `C:\po-vg` (dispatched by me on 2026-09-04, unmoved 39 hours later, F3).
**None of the three is hard**; all three are unperformable by the only two stations named.

This is not a contradiction 03 may resolve by choosing a side. Reading the matrix as authorising 03
to repair would have me `git stash drop` 66 entries and prune a worktree holding unique bytes on the
strength of a document my own station doc contradicts - which is precisely the shape of act DOCTRINE
5.4 and 5.5 reserve for Marco. **And 00's 21:08Z run already named this class of defect** in its own
title: *"a dispatch to a station with no schedule is a finding with no consumer."* This is the same
defect one step further on: a dispatch to a station with a schedule but **no authority** is also a
finding with no consumer, and it looks healthier because the station keeps answering.

**DISPOSITION: ESCALATED -> Marco.** A question, not a status update. Which of these is the rule?

1. **COMPLETE AND ADDITIVE - give 03 a narrow, named REPAIR lane and write it into both documents in
   one PR.** Scope it to exactly the non-board, non-git-history operations 03 already measures:
   `git stash drop` in the watcher clone, deleting untracked junk from the clone root, and pruning a
   worktree **only after** its uncommitted work has been preserved somewhere durable. Everything else
   - branch writes, merges, arming, `sot/`, Azure - stays forbidden, and every repair is still read
   back and reported. Solves it immediately (the three-item backlog drains next run) and in future
   (the loop cannot re-form), and damages no data because preservation precedes every destructive
   step. Passes both halves of RULE 1.
2. **Name a different executor** - 00 repairs the machines itself, or 02 does it on dispatch. Fails
   the "immediately" half: 00's matrix cell currently reads a hard no, so this needs the same document
   change plus a schedule that reaches the box, and 02 has no schedule of its own
   (STATION-CAPABILITIES section 5).
3. **Marco performs them by hand.** Fails the "future" half - it converts a recurring maintenance task
   into recurring work for Marco, which is the thing this pipeline exists to remove, and the stash
   loop regenerates on every relaunch.
4. **Leave it.** Fails both halves. The backlog is monotonic: it has grown from one item to three in
   two days, and each run's honest report makes the next run's report longer.

⚠️ **What is NOT claimed:** that anything is currently broken because of it. The watcher is up 37.5
hours, the queue is empty and the board is moving. The cost so far is 66 stashes, a dirty-clone
signal every station reads and discounts, and one worktree. **The finding is the loop, not the
damage** - and a loop is cheapest to fix while the damage is still cosmetic.

---

## WHAT I DID NOT DO

- **Repaired nothing.** 03 is report-only (STATION-CAPABILITIES section 5: "Repair the machines ->
  03: report-only"). No relaunch was proposed and none is needed - the watcher has been alive
  37.5 hours and the keepalive has not missed a tick.
- **Did not prune `C:/po-vg`, did not `--force` anything, did not drop a stash, did not delete the
  stray clone-root file.** All are writes in shared trees; F3's is irreversible.
- **Did not touch the board**: no merge, no label, no arm, no disarm, no PR. `#1682` is on the board
  RED (13 pass / 1 fail) while its review verdict says "CI-green" - the verdict was written at
  22:37:16Z and the failing check may postdate it. **That is a board question, not a machine
  question**, and is 00's to resolve; it is recorded here only because it is the same PR as F1's
  worked instance, and a reader finding the lost verdict should know the PR is not actually green.
- **Did not edit DOCTRINE** to land F2's correction. 00's lane.
- **Did not re-file the 03 cadence disagreement.** The bootstrap says every 4 hours, the live cron
  says daily; that is already open with Marco as
  `needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`, and
  STATION-CAPABILITIES section 5 records it. Re-filing a known-open escalation is noise. Same for
  `STOP-WATCHER-LANE2` (present by design, DOCTRINE 9.5) - measured, matched, not re-reported.
- **Did not touch Azure / Entra / SharePoint, `/sot/`, or production data.** Absolute.
- **Did not run `git` from the Linux sandbox against the Windows `.git`.** Every git command in this
  report ran through Desktop Commander on the box, the only sanctioned transport
  (STATION-CAPABILITIES section 3, "No second transport").

## For Station 00

Five items, in priority order:

1. **F1 (S1) - NEW** - twelve review verdicts produced and thrown away today, two distinct causes
   behind one log line, remedy (1) fixes both. A live RULE-2-affecting defect, not a cleanup.
   Ship it with 04's F1: **04's F1 corrects the doc, my F1 corrects the code.**
2. **F7 (S1) - ESCALATED to Marco, needs your carry** - your 22:09Z run dispatched the stash to 03
   and noted it "joins the already-dispatched watcher-clone dirt and the `C:\po-vg` worktree".
   03's own contract and the section 5 matrix both say 03 is **report-only**, so all three dispatches
   have no executor. Four options in RULE 1 order in F7; option (1) is one PR touching two documents.
3. **F3 (S2) - ESCALATED to Marco** - `C:/po-vg`, 39 h unmoved, second consecutive report. New
   measurement: the untracked file is a **different blob** from `origin/main`'s, and the commit is
   unmerged AND unpushed. Preserve-then-prune first; `--force` loses bytes.
4. **F5 (S3)** - stray `C:<U+F03A>temppr-1648.diff` in the clone root, and find its producer - a path
   bug that wrote to the CWD at exit 0 will do it again.
5. **F2 - NOT a new finding.** Confirming evidence for 04's F1, which you have already ACCEPTED and
   scope-corrected. Do not count it twice.

**F4 (stash = 66) is your dispatch to me, received and unperformable** - see F7. Re-measured this
run: 66 entries, newest 2026-09-03T08:55Z, no growth in 2.6 days.

**This breadcrumb is UNTRACKED** in the dev tree at
`docs/pr-prompts/00-03-machine-minder-2026-09-05-2301-nine-review-verdicts-landed-in-the-dev-tree-and-the-mirror-step-called-them-missing.md`.
Sweep it into your next board PR or it is unreported.
