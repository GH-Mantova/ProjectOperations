# Station 03 - Machine Minder | 2026-08-25T23:01:50Z-2026-08-25T23:10Z

## GROUND

```
UTC            2026-08-25T23:01:50Z
origin/main    8f0377e5            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 8f0377e5      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                    (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE - this run had full station authority (report-only by lane, not by mismatch).
Reachability: PROVED. `start_process` shell `powershell.exe` returned host time and
`Test-Path C:\ProjectOperations2` = True. This was NOT a blind run.
Channels: chat + this breadcrumb. This device task has **no project-memory tool**, so Station 00
must not expect memory from Station 03 (STATION-CAPABILITIES sec 2).

## WHAT I MEASURED

**Watcher chain - ALIVE, and the sweep's yellow flags are false alarms.**

- [MEASURED] Chain intact and unbroken since 2026-08-24 15:35 Brisbane (~41.5 h):
  launcher pid 10364 (`watcher-launcher-singlelane.ps1`) -> wrapper pid 3552
  (`start-watcher.ps1`) -> node pid 29024 (`...\pr-watcher\index.mjs`). Resolved by
  `Get-CimInstance Win32_Process` command line, never by image name - 9 `node.exe` were
  running and exactly one is the watcher.
- [MEASURED] It is TICKING, not idle-dead. Active daily log written 4.5 min before this line:
  `[2026-08-25T23:03:07.031Z] [review] verdict-archive sweep: archived=0 kept=4 skipped=0`,
  on a 5-minute cadence, plus `[update] PR #1325/#1323/#1320/#1316 branch updated` at 22:12Z.
- [MEASURED] `heartbeat.log` age 391 min is EXPECTED, not wedged: armed prompts = 0, and the
  heartbeat only ticks mid-run (DOCTRINE sec 9.5).
- [MEASURED] Restarter present and healthy: scheduled task `PO Watcher Keepalive`, state Ready,
  lastRun 2026-08-26 09:05 local, lastResult 0, nextRun 09:15.
- [MEASURED] `STOP-WATCHER` absent. `STOP-WATCHER-LANE2` present - by design since 2026-08-15,
  not drift, not a stop signal.

**Locks and concurrency - clean.**

- [MEASURED] `index.lock` ABSENT in both `C:\ProjectOperations2\.git` and
  `C:\po-watcher\ProjectOperations\.git`. No `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` /
  `rebase-merge` / `rebase-apply` / `sequencer` in either tree. `git` processes running: 0.
  No size-and-age judgement was needed because nothing was present to judge.

**Watcher clone - dirty and off-main, but NOT running stale code.**

- [MEASURED] `C:\po-watcher\ProjectOperations` is on branch `docs/sot-04-bp0a-job-canonical`
  @ `b18caa34`, **4 behind / 1 ahead** of `origin/main` (`git rev-list --left-right --count`).
  The 1-ahead commit is PR #1325's head, which is pushed - nothing unique is at risk there.
- [MEASURED] The staleness is NOT behavioural. `git diff --stat origin/main..HEAD --
  scripts/pr-watcher` is **EMPTY**, and `git log HEAD..origin/main -- scripts/pr-watcher
  scripts/pipeline` returns **nothing**. The 4 missing commits are #1321, #1317, #1319, #1322 -
  all app/CI code. The running node is executing watcher code byte-identical to `origin/main`.
- [MEASURED] 34 dirty tracked entries, ALL of them ` D docs/pr-reviews/pr-*-review.md`, plus 4
  untracked `docs/pr-reviews/pr-{1316,1320,1323,1325}-review.md`. Root cause found - see F1.
- [MEASURED] Stash depth **39** (the closed loop). Top four are
  `watcher-preflight-autostash on 'main' at 2026-08-24T15:{35,24}...`, i.e. no new stash since
  the current launch - the clone has not restarted in 41.5 h.
- [INFERRED, from reading `start-watcher.ps1`:57-137] The sweep line "NOT clean-on-main; the
  watcher **may refuse to start**" overstates it. The preflight self-heals: dirty tracked tree
  -> `git stash push --include-untracked` -> read-back -> `git checkout main`. It refuses only
  if the stash itself fails. The real cost of a restart is F1 and F2, not a refusal.

**Box health.**

- [MEASURED] Uptime 199.1 h (booted 2026-08-18 01:59:56). C: free 192.5 GB of 952.4 GB.
- [MEASURED] Kernel-Power id-507 (unexpected resume): 22 events in 7 days, but **0 in the last
  24 h**; the newest is 2026-08-25 08:07:59 local. The ~HH:08 hourly signature Station 04
  recorded on 2026-08-24 is real in the record and has been quiet for ~25 h. id-42 (entering
  sleep): 2 in 7 days, both 2026-08-22.

**Board and queue (context only - not my lane to act on).**

- [MEASURED] Armed `*-ready.md` at TOP LEVEL of `C:\ProjectOperations2\docs\pr-prompts`: **0**
  (globbed top level only; deeper returns the inert retirement files). In-progress prompts: 0.
- [MEASURED] 4 open PRs: #1325 UNSTABLE, #1323 BLOCKED, #1320 CLEAN, #1316 CLEAN. Trunk green.

## WHAT CHANGED

**Nothing.** This station is report-only and this run mutated no repo, no board, no process.
The only writes were four scratch probe scripts under `C:\po-sup-fix-scripts\` (st03-probe*.ps1,
st03-remeasure) and this breadcrumb. No git write, no checkout, no stash, no prune, no kill,
no label, no merge.

## FINDINGS

### F1 - The verdict-archive sweep permanently dirties the watcher clone, by design

[MEASURED] `C:\po-watcher\verdicts-archive` holds **367** `pr-*-review.md` files. Every one of
the 34 names showing as ` D` in the clone worktree is present there - spot-checked
`pr-747-review.md`, `pr-1007-review.md`, `pr-771-review.md`, `pr-1321-review.md`, all True. The
log shows the mechanism live:
`[2026-08-25T22:13:06.665Z] [review] verdict-archive: moved pr-1321-review.md (state=MERGED) -> C:\po-watcher\verdicts-archive`.

The sweep **moves TRACKED files out of a git worktree**. Git therefore reports them as worktree
deletions forever. Three consequences, all measured, none of them a one-off:

1. The clone can never be clean again, so `status-sweep.ps1`'s "watcher clone: dirty=N <- NOT
   clean-on-main" is a **permanent false alarm**. This run spent its first pass treating a
   by-design state as a defect; the next station will too.
2. Every restart hits the preflight autostash path. That is the engine of the stash closed loop
   now at **39** (DOCTRINE sec 9.2: report count and growth; drop, never pop).
3. The deletions accumulate monotonically - 34 today, one more per merged PR.

Complete-and-additive fix (RULE 1, first): make the archive step **`git rm` + commit**, or
**copy-and-leave** rather than move, so the worktree stays honest. Both solve it now and in
future and neither touches data entry. Alternatives and which half each fails: gitignoring
`docs/pr-reviews/**` fails the future half (it would hide genuine review work from the repo and
strand 367 already-tracked files); periodically re-checking-out the deletions fails the
immediate half (it fights the sweep every 5 minutes). Code lives in
`scripts/pr-watcher/index.mjs` (the `[review] verdict-archive` path).

**DISPATCHED** - to Station 00, to route as a fix prompt (06 to stage / 02 to drive). Station 03
may not create a PR. Hand over: the mechanism, the log line above, and the RULE-1 option order.

### F2 - A watcher restart would silently swallow the 4 LIVE review verdicts

[MEASURED] `git check-ignore -v docs/pr-reviews/pr-1316-review.md` and `...pr-1325-review.md`
both exit non-zero: **not ignored**. [INFERRED, `start-watcher.ps1`:73] the preflight runs
`git stash push --include-untracked`, which therefore sweeps the four live verdicts for the four
OPEN PRs (#1316, #1320, #1323, #1325) into `stash@{0}` along with the 34 deletions.

After that restart the verdict-archive sweep would report `kept=0` and the review state for four
open PRs would be gone from where anything looks for it. It is recoverable - `git stash apply
stash@{0}` - but nothing tells the next reader to look, and stash depth 39 makes it a haystack.
This is the F1 defect wearing a worse hat: not "an untidy tree" but "a restart eats work".

**DISPATCHED** - to Station 00. Same fix prompt as F1 closes this: if the archive step commits
or copies instead of moving, the preflight has nothing to stash. Until it lands, treat "restart
the watcher" as an operation that needs the four verdicts saved first.

### F3 - The 4 "orphaned worktrees" each hold one UNPUSHED commit. Do not prune them.

`status-sweep.ps1` labels these "aborted run leftovers - investigate/prune". I investigated.
[MEASURED] `git log --oneline origin/main..HEAD` + `git ls-remote --heads origin <branch>` in
each:

| worktree | branch | head | dirty | on origin? | the commit |
|---|---|---|---|---|---|
| `C:\po-worktrees\sot-d-register` | `docs/sot-05-d-register` | 407b93d2 | 0 | **NO** | docs(sot): register Marco's D1-D55 decision series in sot/05 |
| `C:\po-worktrees\sot-readme-fetch` | `docs/sot-readme-fetch-plain1` | 904fa4e8 | 0 | **NO** | docs(sot): sot/README fetch URLs - replace the wrong blob advice with ?plain=1 |
| `C:\po-worktrees\sotk-03-ledger` | `docs/sot-03-merged-pr-ledger-2026-08-24` | 5db5a7c2 | 0 | **NO** | docs(sot-03): reconcile the progress log - machine-generated merged-PR ledger #496-#1304 |
| `C:\po-wt-h` | `hygiene` | edef9f59 | 1 (`?? .cm.txt`) | **NO** | docs(queue): disarm sor-s9 for splitting, retire three shipped prompts |

Ages 1.4 to 5.7 days by last write. **Four real pieces of work exist in exactly one place on
earth: local branch refs in `C:\ProjectOperations2\.git`.** Three of them are `/sot/` content -
Station 05's lane, and the kind of work this pipeline has lost before by tidying.

Precision, so nobody over-reads this: `git worktree remove` deletes the directory but leaves the
branch ref, so the commits survive that. What loses them is deleting the branch, a re-clone, or
a `--force` sweep that takes the ref with it. The sweep's one-word advice "prune" does not
distinguish those.

Complete-and-additive first: **push the four branches to origin** (or open PRs), then prune the
directories - the work is durable and the disk is tidy, and nothing is decided by deleting.
Alternatives: prune-and-keep-the-refs fails the future half (a re-clone still loses them);
prune-with-force fails both halves outright.

**DISPATCHED** - to Station 00, with a flag that the three `docs/sot-*` branches are Station 05's
to adopt, not 03's and not 00's to rewrite. 03 pushed nothing this run.

### F4 - Instrument trap: the active watcher log is named for the START date, not today

[MEASURED] The log being written right now is
`scripts\pr-watcher\logs\2026-08-24.log`, lastWrite 2026-08-26 09:03 local. There is no
`2026-08-26.log`. Cause: `start-watcher.ps1`:41 computes `$LogFile` **once**, at launch, and the
node process has been running since 2026-08-24 15:35.

This is a DOCTRINE sec 7 instrument lie in waiting. A station that checks "is today's watcher log
present / fresh?" finds nothing and concludes the watcher is dead - the exact shape of lie #1 in
the sec 7 table, which killed a healthy queue. It belongs in DOCTRINE sec 9.5 next to "the
watchdog heartbeat only ticks mid-run". Suggested line: *"The daily log is named for the launch
date, not the current date. A long-lived watcher writes today's lines into an old filename;
never test liveness by looking for `<today>.log`. Test it by the mtime of the NEWEST log."*

**DISPATCHED** - to Station 00, as a one-line DOCTRINE addition. Station 03 may not open a PR.

### F5 - Clone parked 4 behind on a feature branch (low severity, but it will bite on arming)

[MEASURED] as above: `docs/sot-04-bp0a-job-canonical` @ b18caa34, 4 behind, and none of the 4
missing commits touch `scripts/pr-watcher` or `scripts/pipeline`. So today it changes no
behaviour. It matters at the next state change: the moment a prompt is armed, the run happens in
a clone parked off main with a dirty tree, and DOCTRINE sec 9.5 warns that per-PR branch switches
are exactly what a dirty tree poisons.

**DEFERRED**. What makes it urgent, either one: (a) a merge to `main` that touches
`scripts/pr-watcher/**` - the running node would then genuinely be stale code, and a restart is
the only adoption path; or (b) Station 00 arming anything. Before either, return the clone to
main. Note the fix for F1/F2 must land first, or that return costs stash #40 and the 4 verdicts.

### F6 - The sleeping-box signature is quiet, but only for ~25 hours

[MEASURED] 22 Kernel-Power id-507 events in 7 days, newest 2026-08-25 08:07:59 local, **0 in the
last 24 h**. Station 04's 2026-08-24 finding was real; it is not currently firing. I did not
establish why it stopped - no power-plan change was measured, and absence over one day is not
proof of a fix. [CANNOT MEASURE] whether this is a cure or a lull.

**DEFERRED**. Re-check next run. Urgent again if id-507 reappears on the ~HH:08 cadence, or if
the `PO Watcher Keepalive` task starts logging a non-zero lastResult.

## WHAT I DID NOT DO

- **Did not clean the clone.** No `git checkout main`, no stash, no `git rm` of the 34
  deletions. Station 03 is report-only; DOCTRINE sec 9.2 also forbids `checkout .` / `reset
  --hard` / `stash pop` / `git clean` in these trees outright. Station 00 dispatches the repair.
- **Did not prune the four worktrees.** F3 is precisely why - the sweep's advice would have cost
  four unpushed commits, three of them `/sot/`.
- **Did not push the four orphan branches.** Pushing creates refs on origin; that is a board
  mutation and not this station's to make. Named it for 00 instead.
- **Did not restart or relaunch the watcher.** It is alive and ticking; a restart today would
  cost the F2 verdicts and buy nothing. If 00 ever dispatches one: detached
  `Invoke-CimMethod -ClassName Win32_Process -MethodName Create` on
  `C:\po-watcher\watcher-launcher-singlelane.ps1` - `Start-Process` alone does not escape the job
  object - and save the four verdicts first.
- **Did not touch the board, the queue, or any label.** Armed count 0 was read, not changed.
- **Did not open a PR or edit `/sot/`.** F1, F3 and F4 all want a repo change; all four are
  handed to 00 rather than performed.
- **Did not touch Azure / Entra / SharePoint.** Nothing this run went near them.
- **Did not run `git` through the device bridge.** Every git call was PowerShell on the Windows
  host via Desktop Commander, per DOCTRINE sec 9.2.
- **Did not re-triage `failed/` (20) or `no-pr-opened/` (107).** Newest entries are 2026-08-13
  and 2026-08-20 respectively - nothing new since the last triage, and with the queue idle there
  is no fresh failure to classify. Not skipped for lack of time; measured as unchanged.

## For Station 00 - the four things to route

1. **F1 + F2 together, one fix prompt:** the verdict-archive step in `scripts/pr-watcher/index.mjs`
   must commit or copy, not move. It is the root of the permanent clone dirt, the stash loop at
   39, and a restart that eats four live verdicts.
2. **F3, before anyone tidies disk:** push `docs/sot-05-d-register`, `docs/sot-readme-fetch-plain1`,
   `docs/sot-03-merged-pr-ledger-2026-08-24` (Station 05's lane) and `hygiene`, THEN prune.
3. **F4:** one line into DOCTRINE sec 9.5 about the launch-dated log filename.
4. **F5, sequencing:** return the clone to main before arming anything - but land item 1 first,
   or the return itself costs stash #40 and the four verdicts.

**This breadcrumb is UNTRACKED until a board PR commits it** (`docs/pr-prompts/*` staging). It is
at a tracked-eligible path, not in `docs/qa/`. Station 00: sweep it up.

<run-summary>Watcher chain alive and ticking (pid 29024, 41.5 h, log 4.5 min old) with no locks and a healthy keepalive; the real finding is that the verdict-archive sweep moves tracked review files out of the clone, permanently dirtying it, feeding the 39-deep stash loop and setting up a restart that would silently swallow four live PR verdicts - and the four "orphaned" worktrees each hold an unpushed commit, so the sweep's advice to prune them would destroy real work.</run-summary>
