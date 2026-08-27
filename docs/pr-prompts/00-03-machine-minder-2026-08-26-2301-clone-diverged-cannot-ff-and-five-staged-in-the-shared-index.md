# Station 03 - Machine Minder | 2026-08-26T23:01:37Z-2026-08-26T23:20:00Z

## GROUND

```
UTC            2026-08-26T23:01:37Z
origin/main    549537a4              (fetched with +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 7ad50697       C:\ProjectOperations2   (8 behind origin/main, 0 ahead, CAN fast-forward)
doc version    1                     (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                     (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE. Full authority run (which, for this station, is still REPORT-ONLY).

Reachability: **NOT blind.** Desktop Commander present; PowerShell 5.1.26100.9168 on the box.
Machine clock is Brisbane UTC+10 (local 2026-08-27T09:01:37 == UTC 2026-08-26T23:01:37Z);
every timestamp below is UTC unless it says local.

This station does **not** appear in the scheduled-task listing shown to this run, and it did
reach the host - consistent with STATION-CAPABILITIES section 2 (device task, not cloud-fired).
No project-memory tool was offered, so this breadcrumb plus the chat report are the only
channels. Station 00 must not expect memory from this run.

## WHAT I MEASURED

### Instrument controls run first (DOCTRINE section 7)

- `[MEASURED]` `$` survives `interact_with_process` even though it is stripped from
  `-Command "..."`. Positive control: `$probe = 'DOLLAR-OK'; ... PROBE=DOLLAR-OK`. Everything
  with a `$LASTEXITCODE` in it was still moved into a `.ps1` run with `-File`.
- `[MEASURED]` `status-sweep.ps1` section 0: `gh CAN reach GitHub (saw merged PR #1342)`,
  `node runs`. **No `[BROKEN]` line.** The sweep is trustworthy this run.
- `[MEASURED]` Armed-prompt glob control. `docs/pr-prompts\*-ready.md` at top level = **0**;
  control `docs/pr-prompts\*.md` at top level = **150**. The glob works; the zero is real, not
  an instrument failure.
- `[MEASURED]` `git ls-tree` control. Every `ls-tree` below used `-r` and was controlled against
  a path known to be tracked (`docs/pipeline/DOCTRINE.md` returned itself).
- `[MEASURED]` **One near-miss, corrected.** `git log HEAD..origin/main -- scripts/pr-watcher`
  returned **empty**, which reads as "no watcher code changed". Control: total changed files
  `HEAD..origin/main` = **31**, so the query was live. The real cause is that `lint-prompt.mjs`
  lives in `scripts/pipeline/`, **not** `scripts/pr-watcher/`. The empty result was a wrong path,
  not an empty world (DOCTRINE 9.6). Re-run on `scripts/` returned the three real files.

### The watcher chain - alive, and re-measured immediately before writing

`[MEASURED]` Resolved by **command line**, never by image name (DOCTRINE 9.5). 28 `node.exe` /
`powershell.exe` processes were running; exactly one was the watcher.

```
WRAPPER        pid 10364  powershell -File C:\po-watcher\watcher-launcher-singlelane.ps1   start 2026-08-24 15:35:01 local
START_WATCHER  pid  3552  powershell -File ...\pr-watcher\start-watcher.ps1                start 2026-08-24 15:35:03 local
WATCHER_NODE   pid 29024  node --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
                                                                                          start 2026-08-24 15:35:04 local
REMEASURED_UTC=2026-08-26T23:16:35Z  - all three still present, same PIDs
```

Chain uptime **2d 17h 41m**, unbroken. The launcher is the correct one
(`watcher-launcher-singlelane.ps1`), matching the station doc.

- `[MEASURED]` Keepalive restarter present and healthy: scheduled task **`PO Watcher Keepalive`**,
  State `Ready`, LastRun `2026-08-27 09:05:01` local, **LastTaskResult 0**, NextRun `09:15:00`.
  `ensure-watcher.log` tail is 10-minute `watcher alive, pid(s) 29024` lines through
  `2026-08-26T23:05:02Z`.
- `[MEASURED]` `.queue-state.json` ts `2026-08-26T23:13:07.604Z` - `armed 0, owned 0, runnable 0`.
  `.watcher-children.json` = `{"pids": []}`. **Idle, not wedged** - and the heartbeat only ticks
  mid-run (DOCTRINE 9.5), so a 28-minute heartbeat age against an empty queue is the expected
  shape, not a hang.
- `[MEASURED]` Sentinels: `C:\po-watcher\STOP-WATCHER` **absent** (correct).
  `C:\po-watcher\STOP-WATCHER-LANE2` **present - by design since 2026-08-15** (DOCTRINE 9.5).
  Not drift, not a stop signal.
- `[MEASURED]` Guard hook `.claude/hooks/guard.mjs`: present (status-sweep section 2).

### Locks - none, in either tree

`[MEASURED]` Checked for existence **and** would have measured byte size and age had any been
found. All absent:

```
absent  C:\ProjectOperations2\.git\index.lock
absent  C:\po-watcher\ProjectOperations\.git\index.lock
absent  C:\ProjectOperations2\.git\MERGE_HEAD | rebase-merge | rebase-apply
absent  C:\po-watcher\ProjectOperations\.git\MERGE_HEAD
```

`[MEASURED]` `git processes running: 0` (status-sweep section 3). No 0-byte orphan lock this run.
Every git command in this run was native PowerShell through Desktop Commander - **not** the
device bridge (DOCTRINE 9.2).

### The two trees

```
[MEASURED] dev tree   C:\ProjectOperations2            main @ 7ad50697   8 behind / 0 ahead   merge-base --is-ancestor exit 0  -> CAN fast-forward
[MEASURED] clone      C:\po-watcher\ProjectOperations  main @ 355dfdec  12 behind / 1 AHEAD   merge-base --is-ancestor exit 1  -> DIVERGED
```

`[MEASURED]` The clone's one local commit:

```
355dfdec | 2026-08-26 23:36:33 +1000 | Marco | docs(pr-reviews): verdict on pr-1339 (d-namespace-s2 EA rename)
git branch -a --contains 355dfdec  ->  feat/orphaned-discharge-guard, * main, remotes/origin/feat/orphaned-discharge-guard
```

`[MEASURED]` Its content already reached `origin/main`: `git ls-tree -r origin/main --
docs/pr-reviews/pr-1339-review.md` returns the file. So the commit is **redundant in content and
load-bearing only as an obstruction.**

`[MEASURED]` Nothing in the chain ever fast-forwards the clone. `watcher-launcher-singlelane.ps1`
line 32 runs `git fetch origin --prune` and nothing else; a content search of
`scripts/pr-watcher/*.ps1` for `git pull|reset --hard|merge --ff-only|rebase|autostash` matched
**only** the `start-watcher.ps1` autostash preflight (line 60-73), which stashes and explicitly
does **not** reset.

`[MEASURED]` The 12 commits the clone is missing, and what they touch:

```
549537a4 #1342 docs(sot-02)      c63c5504 #1341 docs(sot-04)      44b5f3af #1340 lint-prompt ORPHANED_DISCHARGE
cfc74982 #1339 docs(d-ns-s2)     05e5f051 #1338 docs(d-ns-s1)     b9eb3cf3 #1336 lint-prompt human-gate
9ff24903 #1335 ci windows        8bf95711 #1334 feat(tendering)   7ad50697 #1333 feat(crm) comms hub
5cda119b #1332 docs(pr-prompts)  1f3a3747 #1331 fix(crm)          895e7342 #1330 lint-prompt GATE_RELEASED

changed under scripts/  ->  scripts/pipeline/lint-prompt.mjs
                            scripts/pipeline/test-lint-prompt.mjs
                            scripts/pipeline/__tests__/lint-prompt.human-gate.test.mjs
ZERO files under scripts/pr-watcher/  (controlled: 31 files changed in total)
```

**So the running watcher's own code is not stale.** What is stale is `lint-prompt.mjs`, and that
runs out of the **dev** tree via `arm-prompt.ps1` - see finding 2.

### The clone's 37 dirty paths - explained, and it is the watcher's own doing

`[MEASURED]` `git status --porcelain` in the clone: 35 ` D docs/pr-reviews/pr-*-review.md`
plus 2 `?? pr-1343 / pr-1344`. `[MEASURED]` `watcher-launch.log` names the actor:

```
[2026-08-26T22:38:33.965Z] [review] verdict-archive sweep: archived=35 kept=2 skipped=0
[2026-08-26T23:03:07.781Z] [review] verdict-archive sweep: archived=0 kept=2 skipped=0
```

`[MEASURED]` `C:\po-watcher\verdicts-archive` holds **383** files. `[INFERRED]` The sweep moves
review docs for MERGED PRs out of the working tree by design; because they are **tracked**, the
move registers as 35 unstaged deletions and the clone can never read clean again between
restarts.

### Stash closed loop

`[MEASURED]` `git stash list` in the clone = **39** entries. Newest three are all
`watcher-preflight-autostash`, timestamped `2026-08-24 15:24:07`, `15:35:04` local - i.e. the
chain start. Oldest is `2026-07-14 08:44:31`. **Growth since the last restart: 0.** The loop is
real but currently static because nothing has restarted in 2.7 days.

### Orphaned worktrees (dev-tree repo, not the clone)

`[MEASURED]` `git worktree list` in `C:\ProjectOperations2`; the clone's own list contains only
itself.

```
C:/po-worktrees/sot-d-register    407b93d2 [docs/sot-05-d-register]                last write 2026-08-20 17:23 local  age 6.7 d
C:/po-worktrees/sot-readme-fetch  904fa4e8 [docs/sot-readme-fetch-plain1]          last write 2026-08-24 10:58 local  age 2.9 d
C:/po-worktrees/sotk-03-ledger    5db5a7c2 [docs/sot-03-merged-pr-ledger-...]      last write 2026-08-25 00:17 local  age 2.4 d
C:/po-wt-h                        edef9f59 [hygiene]                               last write 2026-08-20 18:25 local  age 6.6 d
```

### Host

- `[MEASURED]` Uptime **223.1 h** (last boot 2026-08-18 01:59:56 local). No reboot this period,
  so no post-reboot relaunch was owed.
- `[MEASURED]` Disk `C:` free **184.4 GB of 952.4 GB = 19.4% free**.
- `[MEASURED]` Board, for context only (status-sweep section 1, `[LIVE]`): 2 open PRs - #1344
  UNSTABLE 7/1/0, #1343 CLEAN 13/0/0; main CI last 3 runs 3/3 success. Not my lane; recorded so
  Station 00 can cross-check.
- `[CANNOT MEASURE]` Who ran `git commit` in the clone at 2026-08-26 13:36Z. The commit is
  authored and committed as `Marco`, which is the identity every agent on this box commits under,
  so authorship does not discriminate between Marco at the keyboard and an agent in his shell.

## WHAT CHANGED

Two scratch probe scripts written to the sanctioned scratch directory, and nothing else:

```
C:\po-sup-fix-scripts\_mm-2026-08-27-probe.ps1        (25 lines, read-only probes)
C:\po-sup-fix-scripts\_mm-2026-08-27-remeasure.ps1    (10 lines, read-only probes)
```

Plus this breadcrumb. **No repair, no relaunch, no arming, no merge, no label, no stage, no
commit, no push, no worktree pruned, no stash dropped, no lock cleared.** Verified: `git status
--porcelain` in the dev tree shows this file as `??` only, and the 5 pre-existing staged entries
in finding 3 are untouched and were not mine.

## FINDINGS

### F1. The watcher clone's `main` has DIVERGED and can no longer fast-forward. Nothing in the chain would ever have caught it.

`[MEASURED]` `C:\po-watcher\ProjectOperations` is `main @ 355dfdec`, **12 behind and 1 ahead** of
`origin/main @ 549537a4`. `git merge-base --is-ancestor HEAD origin/main` exits **1**. The one
local commit is `355dfdec docs(pr-reviews): verdict on pr-1339`, made in the clone at
2026-08-26 13:36Z - a direct commit to `main` in the shared clone, which DOCTRINE section 4
forbids outright.

`[MEASURED]` Its content is already on `origin/main` (`pr-1339-review.md` is tracked there), and
the commit also sits on `origin/feat/orphaned-discharge-guard`. It carries no unique work. It is
pure obstruction.

`[MEASURED]` The launcher only ever runs `git fetch origin --prune`; no script in the chain pulls,
resets, or fast-forwards. `[INFERRED]` So the clone has not advanced since 2026-08-24 and will not
advance on its own, and DOCTRINE 9.5's "a restart adopts nothing - the clone must be
fast-forwarded before a restart changes any behaviour" is now stronger than it reads: a restart
would not merely fail to adopt, **a `pull --ff-only` would be refused outright.**

`[MEASURED]` Blast radius is smaller than it looks and should not be overstated: **zero** of the
12 missing commits touch `scripts/pr-watcher/**` (controlled - 31 files changed in total). The
running `index.mjs` is current. The exposure is that the next person to try to update the clone
hits a divergence with no obvious cause, and that the clone drifts further every merge.

RULE 1, complete-and-additive first:

- **(a) COMPLETE + ADDITIVE.** Confirm `355dfdec` is contained in `origin/feat/orphaned-discharge-guard`
  (already measured, re-measure before acting), then `git fetch` and
  `git reset --hard origin/main` **on `main` in the clone only**, after `git stash push
  --include-untracked` of the 37 dirty paths. Nothing is lost: the commit's content is on
  `origin/main`, the dirty paths are the archive sweep's own deletions, and the stash is
  reversible. Passes both halves - it resolves the divergence permanently and destroys no data.
  It is nonetheless a `reset --hard` in a shared tree, which is a DOCTRINE section 5 item 4
  irreversible action, so **Marco or Station 00 authorises it; Station 03 does not perform it.**
- **(b) Fetch and `git merge --ff-only` and hope.** Fails the *immediate* half - it will simply be
  refused while the tree is diverged. Not a fix, only a diagnosis re-run.
- **(c) Leave it and let the clone drift.** Fails the *future* half. Every merge widens the gap and
  the first `scripts/pr-watcher/**` change to land will silently not take effect.

**DISPATCHED** - to **Station 00**, which dispatches repairs. Station 03 is report-only and
performed none of it. What 00 needs to decide is authorisation for option (a), and separately
whether the chain should fast-forward the clone at start (see F6 for why that is not free).

### F2. `lint-prompt.mjs` in the DEV tree is 3 versions stale, and that is the linter Station 00 arms with.

`[MEASURED]` `C:\ProjectOperations2` is 8 behind `origin/main`, and of the 24 files that differ,
the only ones under `scripts/` are `scripts/pipeline/lint-prompt.mjs`,
`scripts/pipeline/test-lint-prompt.mjs`, and
`scripts/pipeline/__tests__/lint-prompt.human-gate.test.mjs`.

`[INFERRED]` The three merged changes the local linter therefore does **not** have are
**#1330 `GATE_RELEASED` promotes HOLDs rather than rejecting them**, **#1336 human-gate detector /
code-context normalizer / `GATE_NOT_RELEASED`**, and **#1340 `ORPHANED_DISCHARGE` guard against a
stale prompt deleting a BACKLOG.yaml pointer**. Arming anything through `arm-prompt.ps1` today
runs the pre-#1330 linter. DOCTRINE 9.5 already warns that ADMIT is necessary and not sufficient;
this makes the local ADMIT weaker still.

`[MEASURED]` Unlike the clone, the dev tree **can** fast-forward (`merge-base --is-ancestor` exits
0, 0 ahead). The remedy is a plain `git pull --ff-only` - but the dev tree has 52 dirty paths and
5 staged entries (F3), so it is not mine to run and not safe to run blind.

**DISPATCHED** - to **Station 00**, as a precondition on its own arming step: fast-forward
`C:\ProjectOperations2` before the next `arm-prompt.ps1`, or accept and state that it armed with a
linter missing three gates.

### F3. Five entries are sitting STAGED in the dev tree's shared git index, and any commit without a pathspec will carry them.

`[MEASURED]` `git diff --cached --name-status` in `C:\ProjectOperations2` returns **5**:

```
A   docs/pr-prompts/00-04-scanner-2026-08-26-2218-instrument-honesty-four-false-traps.md
A   docs/pr-prompts/pr-doctrine-s9-four-false-traps-HOLD.md
RD  docs/pr-prompts/pr-ew-s2b-alloc-engine-core-HOLD.md        -> ...-ready.md
RD  docs/pr-prompts/pr-lessons-folder-s2-unfold-sot05-HOLD.md  -> ...-ready.md
RD  docs/pr-prompts/pr-sot-02-reconcile-2026-08-19-HOLD.md     -> ...-ready.md
```

`[INFERRED]` `RD` is renamed-in-index, deleted-in-worktree: three prompts were staged as
HOLD-to-ready renames and have since been consumed by the watcher, consistent with `armed = 0`.
The two `A` entries are a Station 04 breadcrumb and a HOLD prompt staged by some other chat.

This is exactly the collision DOCTRINE 9.2 records ("two collisions in two sessions, both caught
by eye rather than by a guard"). It is caught by eye again here. **The next station to run `git
commit` in the dev tree without a pathspec will silently ship a Station 04 breadcrumb, a HOLD
prompt, and three rename records inside an unrelated PR.**

RULE 1: the complete-and-additive move is to **commit them deliberately** - they are all real work
that belongs on main - rather than `git reset` them, which would fail the future half by throwing
away another chat's staging with no record of what it was.

**DISPATCHED** - to **Station 00**, which owns the queue and can decide whether these five belong
in its next board commit. Station 03 staged nothing, unstaged nothing, and committed nothing.

### F4. Station 04's "`watcher-launch.log` is dead" is refuted. It is the live transcript.

`[MEASURED]` The freshest station summary carried by `status-sweep.ps1` section 4C
(`00-04-scanner-2026-08-24-2216-queuestate-is-the-freeze-probe.md`, file mtime 2026-08-26 18:05)
states "`watcher-launch.log` is dead" and rests a freeze-instrument argument on it.
`[MEASURED]` The file is 1,605,836 bytes, last written 2026-08-27 02:18 local, and its tail is a
running 5-minute cadence through `[2026-08-26T23:03:07.781Z] [review] verdict-archive sweep`.

`[INFERRED]` The claim was probably true of `[launcher-single] ...` lines specifically - the
launcher only writes those on a restart, and there has been no restart since 2026-08-24 15:35 -
but as written it reads as "the transcript is not being produced", and it is. That is a section
7.1 provenance failure: an inference about one line-type presented as a measurement about a file.

**DISPATCHED** - to **Station 00**, to route to **Station 04** as a correction to its own
instrument note. Not Station 03's document to edit.

### F5. Four orphaned worktrees, 2.4 to 6.7 days old.

`[MEASURED]` `C:/po-worktrees/sot-d-register` (6.7 d), `C:/po-wt-h` (6.6 d),
`C:/po-worktrees/sot-readme-fetch` (2.9 d), `C:/po-worktrees/sotk-03-ledger` (2.4 d). All are
registered against the dev-tree repo; the clone's worktree list contains only itself. No lock,
no rebase state, no git process in any of them.

They cost disk and they keep three `docs/sot-*` branches alive, which matters because F7 puts the
volume under 20% free. Pruning them is a delete, and DOCTRINE section 5 item 4 makes a delete
Marco's or 00's call, not mine - and "absent from origin/main is NOT orphaned" (DOCTRINE 9.4)
means each branch needs an open-PR check first.

**DEFERRED** - real, not now. It becomes urgent if free space drops below ~10%, or if any of the
three `docs/sot-*` branches turns out to have an open PR (which would make "orphaned" the wrong
word and a prune actively harmful).

### F6. The verdict-archive sweep keeps the clone permanently dirty, which feeds the autostash closed loop.

`[MEASURED]` At 2026-08-26T22:38:33Z the watcher archived 35 **tracked** review docs out of the
clone's working tree (`archived=35 kept=2 skipped=0`), leaving 35 unstaged deletions. `[MEASURED]`
`start-watcher.ps1` lines 60-73 stash on every start with `watcher-preflight-autostash`, and
DOCTRINE 9.2 records that nothing ever pops. `[MEASURED]` 39 stashes now; **growth since the last
restart is 0**, only because nothing has restarted in 2.7 days.

`[INFERRED]` The next restart converts these 35 deletions into stash #40, restores the files, and
the sweep archives them again on its next 5-minute tick. The loop is designed-in, not a defect
anyone introduced, and it is the reason "clone dirty" can never be used as a health signal.

**DEFERRED** - it is costing one stash per restart and one false "NOT clean-on-main" warning per
sweep, neither of which is currently blocking anything. It becomes urgent the moment a restart is
needed under time pressure, because `start-watcher.ps1` self-heals by stashing rather than
failing, and a reader will not know whether the 37 dirty paths are the archive sweep or real work.
The durable fix is for the archive sweep to `git rm` and commit, or for the review docs not to be
tracked in the clone at all - a design change, which is Station 06's or Marco's, not mine.

### F7. Disk is at 19.4% free.

`[MEASURED]` `C:` free 184.4 GB of 952.4 GB. Not a problem today. Recorded because four orphaned
worktrees (F5), a 1.6 MB and growing transcript, 383 archived verdicts and 39 stashes all sit on
this volume, and because a full disk is how a healthy watcher dies loudly at 03:00.

**DEFERRED** - it becomes urgent below 10% free, or immediately if a `pnpm build` or a smoke run
starts failing on ENOSPC.

## WHAT I DID NOT DO

- **Did not repair the clone divergence.** F1's option (a) is a `reset --hard` in a shared tree -
  a DOCTRINE section 5 item 4 irreversible action - and this station is report-only besides.
  Station 00 dispatches repairs.
- **Did not fast-forward the dev tree**, even though it can fast-forward cleanly. It has 52 dirty
  paths and 5 staged entries belonging to other chats (F3); a pull there is a board mutation.
- **Did not touch the shared index.** Nothing staged, nothing unstaged, nothing reset. Read it
  with `git diff --cached --name-status` and left it exactly as found.
- **Did not restart, kill, or relaunch anything.** The chain has been up 2d 17h and is idle with
  an empty queue - DOCTRINE section 3, "silence is not death", and there was nothing to adopt.
- **Did not prune worktrees, drop stashes, or delete archived verdicts.** All deletes.
- **Did not arm, disarm, merge, label, or open a PR.** Not this station's lane at all
  (STATION-CAPABILITIES section 5).
- **Did not touch Azure, Entra, or SharePoint**, and had no reason to go near them.
- **Did not edit `/sot/`**, `docs/pipeline/stations/04-scanner.md`, or any other station's
  document, including for the F4 correction.
- **Did not run `git` through the device bridge.** Every git call was native PowerShell on the
  host (DOCTRINE 9.2).
- **Did not diagnose the two open PRs (#1343, #1344).** Board state is Station 00's and 02's; it
  is recorded above for cross-checking only.

---

**This breadcrumb is UNTRACKED until a board PR commits it.** `docs/pr-prompts/` is tracked, but
this file is new and Station 03 does not commit. Station 00 should sweep it up. Every claim above
is stamped against `origin/main 549537a4` and the clone at `355dfdec`; anything read after those
move is a lead, not a finding.
