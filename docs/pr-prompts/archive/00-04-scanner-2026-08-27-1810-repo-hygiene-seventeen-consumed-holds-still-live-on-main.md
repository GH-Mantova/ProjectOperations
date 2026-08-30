# Station 04 — Scanner | 2026-08-27T18:10:22Z–2026-08-27T18:30Z

## GROUND

```
UTC            2026-08-27T18:10:22Z
origin/main    d23d6cfb            (fetch +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ cb9fce55     C:\ProjectOperations2   (BEHIND origin/main)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE — normal (read-only-on-board) authority.
Sweep assigned by `node scripts/pipeline/next-sweep.mjs`: **repo-hygiene** (rotation position 3 of 4;
previous run 2026-08-27T14:10:18Z). Not chosen by me.
`status-sweep.ps1` verdict at 18:10:54Z: **SAFE TO ACT** — no board mutation in progress.
`gh` resolves at `C:\Program Files\GitHub CLI\gh.exe`, so every lint ADMIT below is a full ADMIT
(DOCTRINE §9.5 — an ADMIT obtained without `gh` proves strictly less).

## WHAT I MEASURED

Every line is `[MEASURED]` at origin/main `d23d6cfb` / dev tree `cb9fce55` unless tagged otherwise.
All probes ran as `.ps1` files via `-File` through Desktop Commander on the Windows host.

### Instrument calibration BEFORE trusting any negative (DOCTRINE §7)

| Instrument | Control | Result |
|---|---|---|
| `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` | count all, plus `-- CLAUDE.md` | **456** / **1** — it can see tracked files |
| board-trap filter (`^docs/pr-prompts/[^/]+-ready\.md$`) | same filter for `-HOLD.md` | ready **0**, HOLD **71** — the regex is not blind |
| `git merge-base --is-ancestor` | `origin/main~1` vs main, and main vs `main~1` | rc **0** and rc **1** — can say MERGED *and* UNMERGED |
| `lint-prompt.mjs` exit 3 | ran against `pr-user-default-dashboard-ui-RETIRED-…` | rc **3**, printed `STALE … The work is ALREADY DONE` — exit 3 is reachable |
| `processed/` glob | globbed `zzz-not-a-prompt*` | **0** hits — the 2-hits-each result below is not a match-everything glob |

### The six repo-hygiene items the rotation names

| Item | Measurement | Verdict |
|---|---|---|
| Orphaned worktrees + their locks | `git worktree list` + `.git/worktrees/*/gitdir` + `*.lock` recurse, both trees | **4 dev-tree worktrees, all present on disk, none `locked`; 0 lock files in either tree; 0 `git.exe` running** → unchanged since 02:10Z except the lock, which is GONE |
| Stash growth in the clone | `git stash list` both trees | dev **11**, clone **41** — **identical** to 00:27Z and 02:10Z. Not growing. |
| Superseded prompt files in the queue root | 180 depth-1 files censused by pattern | **5 suffix-less `pr-*.md`**, 2 of them still live → F3 |
| Tracked `*-ready.md` at depth 1 (THE BOARD TRAP) | `git ls-tree -r` filtered | **0 — CLEAN**, with control |
| Branches merged but not deleted | 23 remote heads, each `--is-ancestor origin/main` | **0 — CLEAN**, with both controls |
| HOLDs on main whose work has shipped | `lint-prompt.mjs` over all **58** disk HOLDs | **0 exit-3** (ADMIT 33 / REJECT 25), with control — but see **F1**, which is the same question asked of the files that are *no longer on disk* |

Queue-root census, depth 1, dev tree: **180 files** = 58 `pr-*-HOLD.md` · **0** `pr-*-ready.md` ·
0 `rev-*-ready.md` · 106 `00-*` breadcrumbs · 5 suffix-less `pr-*.md` · 10 other
(`BACKLOG.yaml`, `ESCALATIONS.yaml`, `PROMPT-SCHEMA.md`, `shepherd-state.md`, ledgers, and the
10-day-old `.queue-sync-ledger.txt.bak-2026-08-18`).

### Board context — not my lane, recorded so 00 need not re-measure

- **2 open PRs.** `#1356 CLEAN labels=[]` (crm-s1 assigneeId + account picker) ·
  `#1353 UNSTABLE labels=[]` (check-sot-refs).
- **Nothing armed.** `*-ready.md` at depth 1 = **0**. `pr-crm-lastmile-s1-…-ready.md` (armed by 00 at
  ~16:08Z) has been consumed by the watcher and produced **#1356** — the index still carries the
  staged `RD` rename, which is how I could see the arm after the file was gone.
- 🔴 **#1356 is `marco:true`** — see F4. A label read alone says it is free to merge, and that is wrong.

## WHAT CHANGED

Nothing on the board. No prompt armed, disarmed, renamed, moved or deleted. No PR touched, no label
changed, no worktree removed, no branch deleted, no stash dropped, no lock cleared, no `/sot/` file
read-modified.

Written this run: **this breadcrumb**, and `docs/pipeline/sweep-rotation.json` advanced to
`last_index=2` / `last_run_utc=2026-08-27T18:10:22Z` / `last_station=04-scanner` — so the next run
gets **instruction-drift**. Both committed with an explicit pathspec (`git commit -- <two paths>`),
because the shared dev index carries **17 unstaged ` D` deletions and 2 staged `RD` renames from
other chats** (DOCTRINE §9.2). Read-back of the commit is at the end of this file.

Scratch: `C:\po-sup-fix-scripts\scan-0828-hygiene-{a,b,c}.ps1`.

## FINDINGS

### F1 — SEVENTEEN CONSUMED PROMPTS ARE STILL TRACKED ON `origin/main`; ONLY AN UNCOMMITTED DELETION SEPARATES THEM FROM THE BOARD (S2)

This is the repo-hygiene item "HOLD files tracked on main whose work has already shipped", and asking
it of the files still on disk (0 exit-3, above) answers the wrong half. The dangerous set is the files
that are **gone from disk and still on main**.

```
holds_on_main=71   holds_on_disk=58
tracked-on-main HOLDs absent from disk = 17
```

Every one of the 17 is **consumed, not lost** — each has exactly **2 hits** in the gitignored
`docs/pr-prompts/processed/` folder (the retired prompt plus its `.log`), against a control glob that
returned **0**:

```
pr-ci-windows-pipeline-tests · pr-comms-hub-inbox · pr-crm-lastmile-s1-unblank-todos-and-notes
pr-crm-tender-count-truth · pr-crm-wincount-s2-close-bypasses · pr-dns-s1-tfm-series
pr-dns-s2-ea-series · pr-dns-s3-sot06-widgets-and-marker · pr-ew-s2b-alloc-engine-core
pr-guard-s1-verdict-file-list · pr-lessons-folder-s2-unfold-sot05 · pr-lessons-folder-s3-ref-checker
pr-lint-human-gate-blindness · pr-pipeline-fold-s2-merged-page · pr-queue-bin-guard-orphaned-discharge
pr-rates-consumers-s3-persona-export · pr-sot-02-reconcile-2026-08-19
```

`git status -- docs/pr-prompts` shows them as **` D` (worktree deletion, index untouched)** — the
watcher retires a prompt with `fs.renameSync` into a gitignored folder, so the removal is a working-tree
fact that **nothing ever commits**. The consequence is exact and already observed once: on 2026-08-26
a retired prompt refired itself mid-run (`00-04-scanner-2026-08-26-1010-…`). Any `git checkout .`,
`checkout -- docs/pr-prompts`, `reset --hard`, `stash pop`, `git clean`, **or a fresh clone**
re-materialises all 17 as live HOLDs — each of which then lints, triages and can be armed a second
time. This is the same defect class as the board trap; the board trap is CLEAN today only because the
`-ready.md` half of it is.

Adjacent, same root: **4 HOLDs exist on disk and are untracked** — `pr-hygiene-gitignore-no-pr-opened`,
`pr-rates-11b2-resolver-isactive-surface`, `pr-station-docs-wrong-wrapper-and-false-gitignore-claim`,
`pr-watcher-idle-tick-liveness`. An untracked HOLD cannot be armed by the sanctioned `git mv` route
until someone `git add`s it, so real work is parked invisibly at the opposite end of the same gap.

RULE 1 options for Marco, complete-and-additive first:

- **(A) One commit that records the 17 deletions *and* `git add`s the 4 untracked HOLDs, plus a CI
  check that fails when tracked-on-main prompt files are absent from the working tree (or vice
  versa).** Fixes it now (the board and main agree) and forever (the drift cannot silently reopen).
  Purely additive — no prompt content changes, nothing user-authored is touched. **Passes both halves.**
- **(B) The commit alone, no check.** Fixes today; fails the *future* half — the watcher keeps
  retiring prompts with an uncommitted delete and the gap reopens within a day.
- **(C) Make the watcher `git rm` instead of `fs.renameSync`.** Correct in principle but fails the
  *no-damage* half as written: it puts a board-mutating git write inside the watcher's hot path, in
  the shared index, which is precisely the collision LL-38 records.

**DISPOSITION: ESCALATED.** Committing 17 tracked-file deletions is a board mutation and I am
read-only on the board; and a wrong call here deletes prompts rather than merely hiding them. I
deleted nothing, staged nothing, and left the 17 ` D` / 2 `RD` entries exactly as found.

### F2 — THE BREADCRUMB CHANNEL IS NOT STOPPED, IT IS INTERMITTENT — AND THE BACKLOG HAS GROWN 23 → 35 (S2)

```
breadcrumbs on disk = 106   tracked on origin/main = 71   missing = 35
```

Up from **23 missing at 2026-08-27T02:10Z** — twelve more in sixteen hours, spanning all five
stations (17 × supervisor, 8 × pr-master, 7 × scanner, 2 × sot-keeper, 1 × machine-minder).

🔴 **Correcting my own 02:10Z run.** It concluded the channel "did not degrade — it stopped, cleanly,
~18 hours ago", with every missing breadcrumb dated 2026-08-26T08:08Z or later. That is now
**REFUTED by a counter-example**: `00-04-scanner-2026-08-26-2218-instrument-honesty-four-false-traps.md`
**is on main**, while the earlier `00-04-scanner-2026-08-26-1811-…` is not. So commits are still
landing, selectively — consistent with each station pathspec-committing its own file and some of those
commits failing (the 02:07Z–06:08Z stale lock explains part of the window, but not all of it, because
the lock was cleared at 06:08Z and eleven post-06:08Z breadcrumbs are still missing). A "clean stop"
invites one fix; an intermittent per-station failure needs a different one, so the distinction matters.

**DISPOSITION: ESCALATED** (re-raised with a corrected mechanism and a new number, not a repeat).
RULE 1: the complete-and-additive move remains **one docs commit carrying all 35 plus a CI check that
fails when depth-1 `00-*.md` files exist untracked** — fixes now, prevents recurrence, destroys
nothing. Committing the 35 alone fixes today only. Leaving them fails both halves: they are lost on
any fresh clone, and this is the only channel Station 00 has for collecting what 03/04/05 found.

### F3 — THE TWO INVISIBLE ADMISSIBLE PROMPTS ARE UNCHANGED, NOW ELEVEN DAYS OLD (S2, carried)

Re-measured, not assumed:

```
pr-permission-role-reconciler.md -> rc=0  ADMIT (size 8)   mtimeUTC 2026-08-17T04:52:11
pr-smoke-share-worker-tokens.md  -> rc=0  ADMIT (size 3)   mtimeUTC 2026-08-17T04:52:11
```

Neither ends in `-HOLD.md` nor `-ready.md`, so every glob in the pipeline — `triage-holds.ps1`, the
HOLD lint sweep above, the armed-count probe, the watcher itself — is structurally unable to see them.
Still ADMIT, still unseeable, no change since 02:10Z. The other three suffix-less files
(`-RETIRED-`, `-DISARMED-`, `-LOOPING`) are dead by their own filename and the linter agrees (rc 3 / rc 1).

**DISPOSITION: ESCALATED** — unchanged from the 02:10Z run; option (A) there (rename both to `-HOLD.md`
**and** add a guard rejecting suffix-less `pr-*.md` at depth 1) still stands and is the same guard F1
option (A) wants. **Do not re-litigate this each run** — it needs one decision from Marco, and it
should be taken together with F1.

### F4 — #1356 IS WATCHER-ROUTED TO MARCO WHILE CARRYING NO LABEL (S1 for anyone about to merge)

```
gh pr list --json …  ->  #1356  mergeStateStatus=CLEAN  labels=[]
docs/pr-prompts/processed/pr-crm-lastmile-s1-unblank-todos-and-notes-ready.md.log:
  [watcher] merge result for PR #1356: {"ok":false,"marco":true,
    "reason":"outside tests/ or docs/: apps/web/src/pages/crm/CommsHubPage.tsx"}
```

Control: the same probe against `pr-guard-s1-verdict-file-list-ready.md.log` returns the equivalent
`marco:true` line for #1352 — the probe is not returning a constant.

**RULE 2 applies to #1356: it must not be merged.** A `gh pr list --json labels` read shows
`CLEAN, labels=[]` and reads as free-to-merge; that read is wrong, for the same reason it was wrong on
#1347, #1350 and #1352. The `processed/*.log` `"marco":true` probe is the only one that answers.

**DISPOSITION: DISPATCHED to Station 00** — merge authority is 00's, and this is the exact fact 00
needs before it looks at a green board. I merged nothing and labelled nothing.

### F5 — FOUR ORPHANED DEV-TREE WORKTREES, UNCHANGED (S3, carried, already dispatched)

`C:/po-worktrees/sot-d-register` · `C:/po-worktrees/sot-readme-fetch` · `C:/po-worktrees/sotk-03-ledger`
· `C:/po-wt-h`. All four still exist on disk, none is `locked`, and **there are now zero `.lock` files
in either tree** — the 02:07Z stale `index.lock` that froze arming is gone (cleared by 00 at 06:08Z).
Content assessment is unchanged from the 02:10Z run and is not re-derived here.

**DISPOSITION: DEFERRED** — already DISPATCHED to Station 05 at 02:10Z and nothing has moved; three of
the four branches are `sot/`-scoped and removing a worktree holding the only copy of a commit is
irreversible (DOCTRINE §5.4). It becomes urgent if one of them acquires a lock, because an orphan's
lock has no holding process by construction and would freeze every station.

### F6 — THE BOARD TRAP IS CLEAN ON `origin/main` AND **LIVE IN THE DEV TREE'S OWN HEAD** (S2)

Found by the §1 read-back of my own commit, not by the sweep — the sweep asked `origin/main` and got
the right answer to the wrong tree.

```
git rev-list --left-right --count origin/main...HEAD   ->  5   4
```

The dev tree's `main` is **DIVERGED, not behind**: 5 commits on origin it lacks, 4 commits of its own
that were never pushed (3 before mine). `git diff --name-status origin/main HEAD`, with a control
(`-- CLAUDE.md` returned empty, i.e. identical, as expected):

```
R100  docs/pr-prompts/pr-lessons-folder-s3-ref-checker-HOLD.md
   -> docs/pr-prompts/pr-lessons-folder-s3-ref-checker-ready.md      <- committed in cb9fce55
A     docs/pr-prompts/00-00-supervisor-2026-08-27-1208-…md
A     docs/pr-prompts/00-04-scanner-2026-08-27-1810-…md   (mine)
M     docs/pipeline/sweep-rotation.json                   (mine)
```

So **a tracked `*-ready.md` at depth 1 exists in the dev tree's committed HEAD** — commit `cb9fce55`
armed `pr-lessons-folder-s3-ref-checker` by committing the `git mv`. The prompt has since been
consumed (` D` in the worktree, 2 hits in `processed/`), but the *committed* rename never was. That is
exactly the board trap: anything that checks out `HEAD`, and any route that lands `cb9fce55` on main,
re-arms finished work. My "board trap CLEAN" row above is true of `origin/main` and **false of the tree
the watcher actually globs**, which is the tree that matters.

Second-order, and it corrects **F2**: the 1208Z supervisor breadcrumb reads as "missing from main"
*even though it was committed* — it is sitting in `cb9fce55` on a diverged local main that nobody has
pushed. So the 35 split **33 never committed + 2 committed-and-unpushed**, and there are **two**
mechanisms, not one. A fix that only commits the untracked 33 leaves the diverged-and-unpushed half
in place, and it will keep producing "missing" breadcrumbs.

Also worth 00 knowing before it FFs anything: the rest of the divergence is ordinary — the 15 CRM
slice prompts and the `arm-prompt.ps1` change from `1b83d45d` are **already on `origin/main`** by
another route (they do not appear in the net diff; `arm-prompt.ps1` diffs to zero). The unpushed
unique content is small. This is a merge, not a rescue.

**DISPOSITION: DISPATCHED to Station 00.** Reconciling a diverged shared dev tree is a board mutation
in 00's lane, and the safe order matters (the `git mv` must be un-armed or the rename re-retired
*before* `cb9fce55` can go anywhere near main). I changed nothing about it.

## WHAT I DID NOT DO

- **Staged no prompt.** The rotation says "stage a prompt for anything worth deleting", and the two
  things worth deleting (F1's 17, F3's 3 dead files) are both inside the *same* decision Marco already
  has open from 02:10Z. A second prompt would fragment one decision into three.
- **Did not clear, commit or stage the 17 ` D` deletions or the 2 `RD` renames.** They belong to other
  chats' work and to 00's lane; touching them is exactly the shared-index collision §9.2 warns about.
- **Did not remove a worktree, drop a stash, delete a branch, or clear a lock** — none needed clearing,
  and all four are 03's or Marco's.
- **Did not run Part 0 / Part 1 / Part 2** of the older station brief. The rotation contract is one
  named sweep covered completely; a shallow pass over everything is the failure it exists to prevent.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
