# Station 04 — Scanner | 2026-09-08T02:10:37Z–2026-09-08T03:05Z

Sweep this run: **repo-hygiene** (rotation position 3 of 4, from `next-sweep.mjs`).

## GROUND

```
UTC            2026-09-08T02:10:37Z
origin/main    0029fcdf            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 0029fcdf     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not restricted to read-only on that account.
It is read-only because 04 is read-only on the board.

Sighted run. `start_process` shell `powershell.exe` succeeded (pid 35256);
`LIVE 2026-09-08T02:10:37.5235230Z user=Marco`.

VM git guard, last line, quoted as the contract requires:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
— installed at `/sessions/<id>/.local/bin/git`, both controls passed, exit 0.

Freshness of the three binding documents: `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, so the working copies read this run are byte-identical to `origin/main`. Read in the DEV TREE, never the clone. No piped hash was taken.

## WHAT I MEASURED

**Safe-to-act gate.** `scripts\pipeline\status-sweep.ps1`, run via `-File` and captured to a file
(it returns early and hides its own section 7 verdict when read inline). Section 7 read
`[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station
worktrees.` Section 2: watcher node RUNNING pid **31660**; watcher clone `branch=main dirty=1`.
[MEASURED]

**The board trap — tracked `*-ready.md` at depth 1 on `origin/main`: ZERO.** [MEASURED]
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` (trailing slash AND `-r`, per DOCTRINE
9.2; no glob pathspec, the filter is applied to the result) returned **907** paths; **47** are at
depth 1. Of those: `-ready.md` → **0**; POSITIVE control `-HOLD.md` → **39**; NEGATIVE control, a
freshly minted needle → **0**. The eight remaining depth-1 tracked files are `.arming-log.txt`,
`BACKLOG.yaml`, `BACKLOG-DECISIONS.md`, `ESCALATIONS.yaml`, `PROMPT-SCHEMA.md`,
`TEMPLATE-sot-reconcile.md`, `shepherd-state.md` and one 00 breadcrumb. No board trap on this board.

**Queue root is not littered.** [MEASURED] 51 files on disk at `docs/pr-prompts` depth 1:
**0** `-ready.md` (nothing armed), **39** `-HOLD.md`, and 12 state/breadcrumb files. The only
oddity is `pr-watcher-verdict-home-resolver-LOOPING.md`, which is the documented `-ready` → `-LOOPING`
cure and is untracked. Sub-folder census, disk vs tracked-on-`origin/main`:
`superseded` 373/360 (17 subdirs) · `archive` 668/458 · `needs-marco` 43/**4** · `processed` 4222/1 ·
`no-pr-opened` 109/0 · `blocked` 123/0 · `failed` 43/0 · `paused` 3/0.

**No spent HOLDs.** [MEASURED] `scripts\pipeline\triage-holds.ps1` (read-only, delegates to
`lint-prompt.mjs` per HOLD): `TOTALS spent=0 of 39 evaluated  gates-satisfied=13  still-gated=26
unreadable=0`. Its own fixture control printed `SPENT control: PASS -- lint-prompt.mjs emitted exit 3
on the fixture, so the SPENT bucket is measurable`, and it re-probed all 26 REJECTs directly for
spent-behind-a-reject: **0**. So `spent=0` is a measured zero, not a blind one.

**No orphaned worktree directories and no locks.** [MEASURED] `git worktree prune --dry-run
--verbose` printed nothing in **both** the dev tree and the clone. `C:\po-worktrees`,
`C:\po-watcher-worktrees` and `C:\po-wt` each hold **0** directories. No `locked` file under
`.git\worktrees\*`. `index.lock` ABSENT in both trees.

**Dev-tree index is clean.** [MEASURED] `git diff --cached --name-status` → empty (nothing staged by
a concurrent chat); `git status --porcelain` → **54** entries, **all** `??`. No ` M`, no ` D`, no
staged `R100` rename. The tree is AT `origin/main`, so the section 9.2 behind-HEAD caveat does not
apply to this reading.

**Watcher clone drift and the stash loop.** [MEASURED] clone HEAD `5345aab4`, dated
`2026-09-07T23:42:47Z`, is **7 commits behind** `origin/main` (`git rev-list --count
5345aab4..0029fcdf`, run in the DEV tree because the clone's own `origin/main` is pinned at its
launch). Stash entries: clone **69**, dev tree **0**. Newest stash `2026-09-06T09:35:10Z`, oldest
`2026-07-14T22:44:31Z` — **the loop has not grown in ~41 hours**, which is new: the count was 69 at
the previous reading too. Both facts belong to open escalations already on file
(`needs-marco/nobody-may-fast-forward-the-watcher-clone-2026-09-07.md`, and the stash-loop ask in
the standing 03 dispatch); they are recorded here as STATE, not re-filed.

**Already-filed, deliberately NOT re-filed.** [MEASURED] `needs-marco/` is gitignored
(`git check-ignore -v` on a file inside it → `.gitignore:82`), so 39 of its 43 escalations exist only
on this box. A history search over `docs/pr-prompts/{*,archive,needs-marco}` for that observation
returned **47** prior hits (POSITIVE control 2125, NEGATIVE control a minted needle → 0). It is a
known finding and this run adds nothing to it.

**Needles.** `zzQq04Needle20260908T0210`, `zzQq04N20260908T0230`, `zzQq04N20260908T0245`,
`zzQq04N20260908T0300`, `zzQq04N20260908T0315`, `zzQq04N20260908T0320` were minted and used as
negative controls this run. **All six are now spent** — this file is tracked once 00 sweeps it.

## WHAT CHANGED

**One file, left deliberately dirty and uncommitted: `docs/pipeline/sweep-rotation.json`.**
`node scripts\pipeline\next-sweep.mjs --advance --utc 2026-09-08T02:10:37Z` → `advanced: last_index=2
last_run_utc=2026-09-08T02:10:37Z`, verified by `git diff --numstat origin/main --
docs/pipeline/sweep-rotation.json` → `2 2`. **Station 00 must commit this file with the next board
PR** — 04 may not commit to the shared dev tree, and if it is never committed the rotation stops
turning and the next run repeats repo-hygiene.

**This breadcrumb is untracked** at `docs/pr-prompts/00-04-scanner-2026-09-08-0210-eight-stale-remote-heads-and-the-orphan-worktree-holds-a-superseded-draft.md`. Station 00 sweeps it up.

Nothing else changed. No prompt staged, nothing armed, nothing merged, nothing labelled, no branch
touched, no file deleted.

## FINDINGS

### F1 — `C:\po-vg` is safe to remove, and the obvious probe says so for the wrong reason

`C:\po-vg` is a registered dev-tree worktree on `fix/no-rebase-while-checks-run`, HEAD `23c91ba9`
dated `2026-09-04T07:53Z`, holding exactly one untracked file,
`scripts/pipeline/check-pipeline-heartbeat.mjs`, last written **5425 minutes** (3.8 days) ago. Its
existence is already escalated by Station 03. What was never measured is the only thing that decides
whether removing it destroys work.

🔴 **The cheap probe answers YES and licenses destruction on a file it never opened.**
`git ls-tree -r --name-only origin/main -- scripts/pipeline/` finds
`scripts/pipeline/check-pipeline-heartbeat.mjs` present on `main`, exit 0 — from which the available
conclusion is *"the file is on main, so the worktree holds nothing"*. **The two files are not the
same file.** [MEASURED] with the pair DOCTRINE 9.3 prescribes, no pipe:
`git hash-object C:\po-vg\scripts\pipeline\check-pipeline-heartbeat.mjs` → **`9c4587fb…`** against
`git rev-parse origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` → **`84ec92d4…`**.
NEGATIVE control, `git hash-object` on a minted nonexistent path → `fatal: could not open`, i.e. the
instrument fails loud. Sizes 6144 B vs 6746 B — recorded only as colour; the hashes are the answer,
and a matching size would have proved nothing either.

**The direction of the difference is what makes removal safe, and it had to be read, not inferred.**
`git diff origin/main:<path> 9c4587fb` → `2 10`, and the full diff is one-way: `main` carries
`MAX_PAUSE_HOURS = 72`, its explanatory comment, and the bounded-pause guard inside `parsePause`,
all of which landed in `992b2479` — *"feat(pipeline): wire up the heartbeat, and bound its pause
(#1594)"*, `2026-09-04T21:38:04Z`, i.e. **13 hours after `po-vg`'s copy was last written**. The two
lines `po-vg` "adds" are the older forms of two lines `#1594` changed (`parsePause(text)` vs
`parsePause(text, nowMs = Date.now())`, and the narrower `typeof j !== "object"` test). **`main`
strictly supersedes.** The branch itself merged as **#1577**, *"fix(pr-watcher): never rebase a PR
whose checks are still running"*. So `po-vg` holds a superseded draft of a file whose successor is on
`main`, and nothing else.

⚠️ **The lesson is the probe, not the worktree.** "Does a file of that name exist on `main`?" and
"is the copy in this abandoned tree already on `main`?" are different questions with the same shape
of answer, and the first is the one a hygiene sweep reaches for. Any future run about to prune a
worktree must hash the file, not look up its name.

🔧 **Falsifying probe:** the hash pair above. If `git hash-object` on the `po-vg` copy ever equals
`git rev-parse origin/main:<path>`, the file is already landed and this finding's careful half is
moot; if the diff ever runs the other way (content in `po-vg` that `main` lacks), removal is NOT
safe and this finding is wrong.

**DISPOSITION: DISPATCHED** — to Station 00, which owns the dispatch to 03. The measurement 03's
existing escalation was missing is now on file: `git -C C:\ProjectOperations2 worktree remove C:\po-vg`
destroys nothing. 04 does not run it; removing a worktree is not 04's lane.

### F2 — eight stale heads on `origin`, seven of them provably spent

[MEASURED] `git ls-remote --heads origin` — asking the remote, per DOCTRINE 9.2, because
`git branch -r` reads a local cache that cannot be trusted (it answered **22** at the same moment
against a truth of **9**). Nine heads exist; `main` plus eight others. Each was resolved with
`gh pr list --head <branch> --state all --json number,state,mergedAt,closedAt`:

| head | PR | state | closed/merged |
|---|---|---|---|
| `chore/sweep-breadcrumbs-20260907-0934` | #1778 | **MERGED** | 2026-09-07T09:41:35Z |
| `feat/crm-account360-v2-s1` | #1612 | CLOSED unmerged | 2026-09-04T22:56:48Z |
| `feat/verdict-home-resolver` | #1703 | CLOSED unmerged | 2026-09-06T11:04:29Z |
| `feat/verdict-home-resolver-v1` | #1707 | CLOSED unmerged | 2026-09-06T11:04:33Z |
| `fix/verdict-home-resolver-v1` | #1708 | CLOSED unmerged | 2026-09-06T11:04:35Z |
| `fix/verdict-home-resolver-v1-impl` | #1705 | CLOSED unmerged | 2026-09-06T10:24:07Z |
| `fix/classify-policy-nested-tests` | #1571 | CLOSED unmerged | 2026-09-04T06:50:36Z |
| `fix1483` | **NO PR, ever** | — | last commit 2026-09-02T02:27:30Z, 28 commits |

**Whether the work survived, by marker, on `origin/main`** — POSITIVE control
`classifyPolicyFiles` → 2, NEGATIVE control a minted needle → exit 1:
`VERDICT_HOME_RESOLVER` → **6** (the four verdict-home-resolver branches; their work landed via
#1704, and `scripts/pr-watcher/__tests__/verdict-home-resolver.test.mjs` is tracked) ·
`NESTED_TEST_PATHS` → **3** (#1571's work; the three-form array DOCTRINE 10.1 quotes) ·
`apps/web/src/pages/tendering/__tests__/wbs-table-shell.test.tsx` tracked → **1**. `fix1483` is a
snapshot of `feat/scope-s2-wbs-table-shell`, the head of **#1483** (MERGED
`2026-09-02T02:46:46Z` — 19 minutes AFTER `fix1483`'s last commit), so it is a backup branch of
merged work.

⚠️ **`git diff --numstat origin/main <branch>` is NOT the instrument for "does this branch hold
unique work"** and I do not quote it as one: it returned 89–645 differing files on every branch
including the merged one, because `main` has moved, and it returned **0** on its own control
(`origin/main` vs a fresh copy of `main`). The marker probes above are what carry the claim, and they
are [INFERRED] one step: *the feature landed* is measured, *this branch therefore holds nothing
unique* is reasoning from it.

**The one that must NOT be deleted is `feat/crm-account360-v2-s1` (#1612)** — it is the named subject
of `pr-1612-closed-unmerged-branch-holds-the-only-copy`, and no marker probe was run for it here.

🔴 **This is not 04's action and not 00's either. Branch deletion is on DOCTRINE section 5's
irreversible list**, so it is Marco's. Options, RULE 1 order:

- **(a) COMPLETE + ADDITIVE, and this is the recommendation:** turn on the repository's
  *Automatically delete head branches* setting, then delete the seven spent heads by hand once.
  Passes both halves — it fixes today's litter *and* stops it recurring, and it touches no data:
  a deleted head branch of a merged PR is fully recoverable from the merge commit, and GitHub keeps
  a restore button on the closed PR for the unmerged ones.
- **(b) Delete the seven now and change no setting.** Fails the FUTURE half of RULE 1 — the same
  census will be filed again in a fortnight; #1778 merged 21 hours before this run and its head is
  still there, which is the mechanism in one line.
- **(c) Leave them.** Fails the IMMEDIATE half. Eight heads is not a load problem, but every
  hygiene sweep now re-measures and re-reasons about them, and `fix1483` — a 28-commit branch with
  no PR — reads like unlanded work to every reader who does not repeat this run's marker probe.

**DISPOSITION: ESCALATED** — the question for Marco is (a)/(b)/(c) above, and specifically whether
*Automatically delete head branches* may be enabled. It is a repository setting, not Azure/Entra/
SharePoint, but it is a settings change and branch deletion is irreversible, so no station does it.
An escalation file has been left at
`docs/pr-prompts/needs-marco/stale-remote-heads-and-auto-delete-2026-09-08.md` (that folder is
gitignored, so this breadcrumb is the tracked copy of the ask).

### F3 — 47 review verdicts exist only as untracked files in the dev tree, and nothing commits them on purpose

[MEASURED] `docs/pr-reviews/` holds **106** `.md` on disk in the dev tree; **59** are tracked on
`origin/main`; `git status --porcelain -- docs/pr-reviews` reports **47** untracked, oldest
`2026-09-03T07:25:35Z` (**5 days**), newest `pr-1758-review.md` at `2026-09-07T05:17:11Z`. The folder
is **not** gitignored — these are ordinary untracked files.

**Nothing sweeps them.** [MEASURED] `git grep -l "docs/pr-reviews" origin/main -- scripts/ .github/`
returns **11** files: `visual-smoke.mjs`, `verdict-guard.mjs`, `index.mjs`, the watcher README, the
review-prompt template and six `__tests__`. **`sweep-breadcrumbs.ps1` is not among them, and neither
is any other sweeper or workflow.** POSITIVE control, the same query for `docs/pr-prompts` → **49**
files; NEGATIVE control, a minted needle → exit 1. So the 59 that are tracked landed by accident,
swept into board PRs that happened to `git add` them — 00's own breadcrumbs record rescuing them two
and five at a time — which is precisely the shape DOCTRINE 9.5 records for `.arming-log.txt`:
*nothing commits it on purpose, so the gap closes and re-opens by luck.*

**Why it matters rather than being untidy.** `verdictApproves` reads a verdict at
`docs/pr-reviews/pr-<N>-review.md`, and DOCTRINE 9.5 already records that these files have three
homes and that the leader is whichever home the last job wrote to. An untracked file is one
`git clean`, one `stash --include-untracked`, or one dev-tree reset away from gone — and the launcher
preflight stash in the clone is `--include-untracked` by exactly that pattern. Five days of merge
evidence is sitting on a single machine with no copy.

⚠️ **The phenomenon is not new and I am not claiming it is.** A history search returned **49** prior
mentions, every one of them incidental (*"committed two untracked review verdicts"*). What this run
adds is the systemic half with its control: **no script or workflow on `origin/main` names that
directory**, so there is nothing to repair — there is something to build or a sweeper to widen.

🔧 **Falsifying probe:** the `git grep -l` pair above. If a sweeper ever names `docs/pr-reviews`, this
finding is wrong and the defect is that the sweeper stopped running instead.

**DISPOSITION: DISPATCHED** — to Station 00. Two things it can decide inside its own lane: commit the
47 with its next board PR (it has done this piecemeal before), and choose whether widening
`sweep-breadcrumbs.ps1` to `docs/pr-reviews/*.md` is worth a prompt. 04 stages nothing here because
the fix is a `scripts/` change and the owning judgement is 00's.

## WHAT I DID NOT DO

- **Deleted no branch, removed no worktree, dropped no stash, retired no prompt.** All four are
  either irreversible (section 5) or outside 04's lane; the sweep's own charter says REPORT ONLY and
  *no agent bulk-deletes*.
- **Did not fast-forward the watcher clone** (7 behind). Only 03 may, and it belongs to the open
  escalation `nobody-may-fast-forward-the-watcher-clone-2026-09-07.md`.
- **Did not commit `docs/pipeline/sweep-rotation.json`**, or this breadcrumb, or the 47 review files.
  04 does not commit to the shared dev tree.
- **Did not act on the section 5 `[STALE]` line** the sweep printed for
  `pr-1777-is-green-and-its-only-review-verdict-is-stale-2026-09-07.md`. Acting on a `[STALE]` line
  without reading the file is forbidden, and clearing escalations is not 04's lane.
- **Did not re-file the gitignored-`needs-marco/` finding** (47 prior hits) or the clone-drift and
  stash-loop findings (already escalated). They are in the measured section as state.
- **Ran no live-site pass and no Part 0 static audit.** The station doc gives 04 ONE named sweep per
  run, chosen by `next-sweep.mjs`, and this run's was repo-hygiene. Part 0 and the visual patrol are
  the other rotation positions' work.
- **Staged no prompt.** Nothing this sweep found is fixable by a prompt: F1 and F2 are actions
  outside the repo, F3 is a judgement call that is 00's to make.

---

**Validator.** `node scripts\pipeline\check-breadcrumb.mjs` → `CLEAN`, exit **0**; this file
`ADMIT`; `structure: 3 checked, 0 malformed`. It also printed the expected
`NOTE ... is UNTRACKED — it reaches nobody until a board PR commits it`, which is the contract
working, not a defect. No `lint-prompt.mjs` verdict is quoted anywhere here: it rejects breadcrumbs
for having no front matter and its result on one is not evidence in either direction.
