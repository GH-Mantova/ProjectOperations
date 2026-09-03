# Station 04 — Scanner | 2026-09-03T06:10:32Z–2026-09-03T06:25Z

Sweep this run: **repo-hygiene** (rotation position 3 of 4). Read-only on the board — nothing armed,
nothing merged, nothing deleted.

## GROUND

```
UTC            2026-09-03T06:10:32Z
origin/main    50662fdc            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 50662fdc     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not restricted to read-only by a version mismatch
(it is read-only because 04 always is).

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` → PID 3376, prompt returned.
**This run was SIGHTED.** (Station 00's 05:37Z run was blind — its breadcrumb
`00-00-supervisor-2026-09-03-0537-blind-run-desktop-commander-connect-timeout.md` is untracked in
the queue root and needs collecting.)

**Instruments, controlled before use.** [MEASURED] `git` 2.55.0.windows.3 at
`C:\Program Files\Git\cmd\git.exe`; `gh` 2.90.0; `node` v24.14.1. Per DOCTRINE §9.5 a
`lint-prompt.mjs` verdict depends on both `git` (five gate probes) and `gh` (`fixes_pr`), so both
were resolved before any lint result below was believed. `triage-holds.ps1` printed its own SPENT
fixture control: `SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture`.

**Board state at 06:11:30Z.** [MEASURED] `status-sweep.ps1`: 1 open PR (`#1531`, CLEAN, CI 9 pass /
0 fail / 0 pending); watcher node RUNNING pid 26656, wrapper alive, heartbeat 0 min, clone
`branch=main dirty=0`; `git index.lock` false in both trees; 0 git processes; armed `*-ready.md` = 1.
Verdict line: `CAUTION: no local lock, but a PR was touched on GitHub in the last 2 min`. I mutated
nothing, so CAUTION did not bind me.

**The board trap.** [MEASURED] `git ls-tree --name-only origin/main -- docs/pr-prompts/` (trailing
slash = depth-1 children, per §9.2) → 108 entries. `*-ready.md` among them: **0**. Positive control
on the same result set: `*-HOLD.md` → **82**. So the zero is a real zero, not a blind query.

**HOLD triage.** [MEASURED] `powershell -File scripts\pipeline\triage-holds.ps1` →
`TOTALS spent=1 gates-satisfied=49 still-gated=31 unreadable=0 of 81`, and
`calibrated: 3 distinct verdicts observed on the board (SPENT, ADMIT, REJECT)`.

**Worktrees.** [MEASURED] `git worktree list` (dev tree) → 4 entries: `C:/ProjectOperations2` and
three non-main. `git -C C:\po-watcher\ProjectOperations worktree list` → 1 entry, clone only.
`Get-ChildItem C:\ProjectOperations2\.git\worktrees` → no `locked` file on any of the three.
`Get-ChildItem ...\.git\index.lock` in both trees → nothing.

**Stashes.** [MEASURED] dev tree `git stash list` → **0**. Watcher clone → **65**.

**Remote truth vs local cache.** [MEASURED] `git ls-remote --heads origin` → **3**
(`main`, `fix1483`, `docs/plandocs-s1-prod-runs-legacy`). `git branch -r` → **8**.
`git remote prune origin` run explicitly → count unchanged at 8.
`git for-each-ref refs/remotes | Where refname -notlike 'refs/remotes/origin/*'` → **5**.

**Local branches.** [MEASURED] `git branch --format='%(refname:short)'` → **207**. Of the 206
non-`main`, exactly **2** satisfy `git merge-base --is-ancestor <branch> origin/main`.

**Queue root on disk.** [MEASURED] 107 files at depth 1: 81 `-HOLD.md`, 2 `-ready.md`, 15
breadcrumbs, 9 other. The 2 ready files are `pr-plandocs-s1-prod-runs-legacy-not-ratetable-ready.md`
(the armed prompt behind open PR `#1531`) and `rev-1531-ready.md` — an auto-generated REVIEW JOB,
not a prompt (§9.5). `status-sweep` correctly counted armed=1.

**Superseded folder.** [MEASURED] 285 files on disk recursive across 16 subdirs; 272 tracked on
`origin/main` (`git ls-tree -r`); 12 of the difference are gitignored `*-ready.md.log` archive logs
(`git ls-files --others --ignored`) and 1 is the untracked
`superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`. Nothing is missing from disk —
`git status --porcelain -- docs/pr-prompts/superseded/` returns 1 line, the untracked file.
**No superseded litter in the queue ROOT.**

**Untracked state at queue depth 1.** [MEASURED] `git ls-files --others --exclude-standard` →
`.queue-sync-ledger.txt`, `queue-watch-state.md`, and 00's 0537Z blind-run breadcrumb.

**Calibration note — an instrument that lied to me this run, and the control that caught it.**
[MEASURED] `Compare-Object (git show origin/main:docs/pipeline/stations/04-scanner.md) (Get-Content
docs/pipeline/stations/04-scanner.md)` returned **196 differences** on a file `git status` reports
as unmodified at a HEAD that equals `origin/main`. The file is byte-identical; the 196 is an
artefact of comparing a `git show` stdout array against a `Get-Content` array. This is the same
family as §9.3's `>`-redirection trap but a **different mechanism**, so the existing bullet does not
cover it. **To decide whether a working copy matches a ref, use `git diff` / `git status` /
`git hash-object` — never `Compare-Object` over `git show` output.**

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced via
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-03T06:10:32Z` → exit 0,
  `advanced: last_index=2 last_run_utc=2026-09-03T06:10:32Z`. **LEFT DIRTY in the dev tree; 04 may
  not commit it. See F7.**
- This breadcrumb, written to the dev tree at `docs/pr-prompts/`. **Untracked until a board PR
  commits it.**
- Nothing else. No prompt armed, disarmed, renamed, moved or deleted. No PR touched. No branch, ref,
  worktree or stash removed.

## FINDINGS

### F1 — One SPENT HOLD is still tracked on main and still armable

[MEASURED] `triage-holds.ps1` → `spent=1`, and the named file is
**`pr-tfm-s10-guard-site-fallback-HOLD.md`** (`lint-prompt.mjs` exit 3 = premise already satisfied,
the work has SHIPPED). It sits at depth 1 of `docs/pr-prompts/` and is tracked on `origin/main`, so
any run that reads the queue sees it as a live HOLD. Retiring it to `docs/pr-prompts/superseded/` in
a board PR costs nothing and saves a whole agent run if it is ever armed.

**DISPATCHED** → Station 00. Retire `pr-tfm-s10-guard-site-fallback-HOLD.md` to
`docs/pr-prompts/superseded/` in the next board PR. Re-run `triage-holds.ps1` first — SPENT is
state, not a fact.

### F2 — Five remote-tracking refs that NO prune can ever reach; `git branch -r` over-reads 8 against a truth of 3

[MEASURED] The remote has **3** heads (`git ls-remote --heads origin`). `git branch -r` reads **8**.
The 5 extra are **not under `refs/remotes/origin/`**:

```
refs/remotes/pr/1477
refs/remotes/pr/1478
refs/remotes/pr/1483
refs/remotes/pr/1487
refs/remotes/pr1273
```

They live in a `pr` remote namespace that has no configured remote (`git remote -v` shows `origin`
only), so **`git fetch --prune` and `git remote prune origin` are both structurally blind to them** —
[MEASURED] both were run this session and the count stayed at 8. This is a **167% overcount**, and it
is the same defect family as the 69-against-25 reading recorded in DOCTRINE §9.2; that bullet's cure
("ask the remote") is correct, but it does not warn that the local cache can hold refs prune cannot
delete, so a reader who prunes and re-reads still gets a wrong number and now trusts it.

🟢 Related and now DISCHARGED: **`origin/origin` is gone** — [MEASURED] `git branch -r | Select-String
'origin/origin'` → **0**. Prior runs carried this as an open item; it is closed. Do not re-raise it.

The cure is five `git update-ref -d refs/remotes/pr/<n>` calls. That is a ref deletion, so 04 does
not run it.

**DISPATCHED** → Station 03 (clone/ref hygiene is its lane). Two parts, and the first is the one
that matters: (i) delete the five orphan refs so `git branch -r` stops lying; (ii) add the
`refs/remotes/<non-origin>` case to §9.2's `git branch -r` bullet, since the existing text implies
prune fixes it.

### F3 — Three registered orphan worktrees and two registry escapees, none locked

[MEASURED] `status-sweep.ps1` §2 and `git worktree list`:

| path | branch/head | dirty | age | in registry |
|---|---|---|---|---|
| `C:/po-1483-fix` | `fix1483` | 0 | 1671 min | yes |
| `C:/po-sa-fix` | `pipeline/standing-authority-reject` | 0 | **33 min** | yes |
| `C:/po-work/s2-e2e` | detached `f85f11cf` | 0 | 1799 min | yes |
| `C:\po-worktrees\fix-1523` | — | — | **35 min**, 3 items | **no (escapee)** |
| `C:\po-work\wt-cfx3-20260813-091739` | — | — | 30642 min (≈21 d), 3 items | **no (escapee)** |

[MEASURED] No `locked` file under `.git/worktrees/*`; no `index.lock` in either tree.

🔴 **Two of these are 33 and 35 minutes old and may belong to a LIVE session** (`#1529`,
"MISSING_STANDING_AUTHORITY is a REJECT", merged 05:53Z, matches the `po-sa-fix` branch name). §7's
`[LIVE]` rule applies: a worktree that is idle when measured can be in use 161 seconds later.
`C:\po-work\wt-cfx3-20260813-091739` at 21 days is the only one that is unambiguously dead.

**DISPATCHED** → Station 03. Prune **only** after re-measuring age immediately before acting, and
start with the 21-day escapee. Do not prune `po-sa-fix` or `fix-1523` on the strength of this
report — by the time you read it the reading is an hour old.

### F4 — The watcher clone's stash pile is 65 and still growing, slowly

[MEASURED] dev tree 0 stashes; watcher clone **65**. Growth, from prior breadcrumbs:
04 @2026-09-02T06:10Z recorded the oldest as `stash@{63}` (⇒ ~64); 06 @2026-09-03T03:35Z recorded
"~64"; now **65**. So roughly **+1/day**, consistent with DOCTRINE §9.2's closed loop (the launcher's
preflight stashes on every start and nothing ever pops).

The cure is `git stash drop` (never `pop`), which is irreversible — DOCTRINE §5.4 — and at +1/day
this costs nothing but disk.

**DEFERRED.** It becomes urgent if the rate changes (a restart loop would show as +10/day, which is
the signal worth watching) or if anything ever needs to `pop`. The falsifying probe is one line:
`git -C C:\po-watcher\ProjectOperations stash list | Measure-Object -Line`.

### F5 — Two untracked queue state files exist only on this box

[MEASURED] At depth 1 of `docs/pr-prompts/`, untracked: **`.queue-sync-ledger.txt`** and
**`queue-watch-state.md`**. These are the same class as the three dangling state files tracked by
`#1512`: a clone, CI, and any cloud lane (DOCTRINE §10.2 — "a cloud session sees only what is
committed") are blind to them, so any reasoning that reads them is unreproducible anywhere else.

Note this is **not** simply "track them": `#1512` tracked `.arming-log.txt` and thereby created a
snapshot with two writers that then lost an arm. Tracking a state file and giving it one writer are
two different decisions and both are needed.

**DISPATCHED** → Station 00, which owns the queue. Decide per file whether it is (a) state that
should be tracked with a single named writer, or (b) genuinely local scratch that should be
gitignored so it stops showing as untracked noise in every station's `git status`.

### F6 — The local-branch pile grew 201 → 207 in 2.6 hours, and no automated classifier is safe

[MEASURED] 06's breadcrumb at 2026-09-03T03:35Z recorded **201** local branches in the dev tree;
this run measures **207**. Of the 206 non-`main` branches, exactly **2** are ancestors of
`origin/main` — because every merge in this repo is a squash, so ancestry (and therefore
`git branch --merged`) is blind to 204 of them, exactly as §9.2 warns.

This is **already ESCALATED** by 06 in
`00-06-pr-master-2026-09-03-0335-a-one-click-vs-code-task-would-have-deleted-28-unpushed-commits.md`
(28 unpushed commits would have been destroyed by a one-click branch cleanup). **I am not re-filing
it.** What this run adds is two new data points that belong on that escalation: the **growth rate**
(+6 in 2.6 h, so the pile is being actively fed, not merely historical) and the **2-of-206 ancestry
measurement**, which is the quantitative reason a `--merged`-based cleanup is unsafe here.

**DEFERRED** — to 06's open escalation, not re-raised. It becomes urgent when the count starts
costing measurable time (`git branch` output is already large enough to blow a station's context —
it cost ~2k tokens in this run).

### F7 — The sweep-rotation advance is uncommitted for the third consecutive run

[MEASURED] On entry, `git diff -- docs/pipeline/sweep-rotation.json` already showed an uncommitted
advance from the 02:52:34Z run (`last_index` 0→1). This run advanced it again (1→2) and, per the
station doc, **left it dirty** — 04's authority matrix gives it *Create a PR: NO* and *Mutate the
board: NO*, and the dev tree is on `main`, which nobody commits to directly.

The rotation itself is working (this run correctly received `repo-hygiene`, not the first entry),
because the working copy has persisted between runs. **That is luck, not design**: any
`git checkout .` / `reset --hard` in the dev tree — which §9.2 already forbids for the board-trap
reason — silently rewinds the rotation to `last_index=0` and the sweep stops turning with no error.

**DISPATCHED** → Station 00. Commit `docs/pipeline/sweep-rotation.json` with the next board PR. If
04's advance keeps missing its ride, the durable fix is to make the advance land in a PR someone
actually opens — but that is 00's design call, not 04's.

### F8 — `Compare-Object` over `git show` output reports 196 differences on a byte-identical file

Detail and the controls are under WHAT I MEASURED. Summarised: I used `Compare-Object` to check that
my station doc matched `origin/main` (the station contract requires reading from `origin/main`, not
the working copy) and got a confident, coherent, wrong 196. `git status` and the fact that
`HEAD == origin/main` prove the file is unmodified. DOCTRINE §9.3 covers the `>`-redirection version
of this trap but not the pipe-into-`Compare-Object` version, and §9.3 explicitly states
"`Compare-Object` was NOT the liar here" for the redirection case — which is true there and reads as
exoneration in general.

**DEFERRED** to the **instrument-honesty** sweep (rotation position 4, i.e. the next 04 run), which
is where a §9 amendment belongs. The one-line rule for anyone who trips it first: to compare a
working file against a ref, use `git diff`, `git status` or `git hash-object` — never
`Compare-Object` over `git show`.

## WHAT I DID NOT DO

- **Did not arm, disarm, rename, move or delete any prompt.** 04 arms nothing (authority matrix).
  49 HOLDs currently lint ADMIT; ADMIT is necessary, not sufficient, and arming is 00's on Marco's
  authority.
- **Did not prune any worktree, delete any ref or branch, or drop any stash.** All four are
  irreversible or near-irreversible and belong to 03 or Marco (DOCTRINE §5.4). Two of the worktrees
  are minutes old and may be live.
- **Did not touch the two open-ish PRs.** `#1531` is green and is the watcher's; 04 is read-only on
  the board and never merges.
- **Did not commit `sweep-rotation.json`** — see F7. The dev tree is on `main`.
- **Did not run Part 0 (static cross-layer audit) or Part 2 (live-site patrol) this run.** The
  station doc's rotation gave me **repo-hygiene** and instructs one named sweep covered completely
  rather than a shallow pass over everything. Part 0's own rotation is unaffected and resumes on the
  run that draws it.
- **Did not investigate `#1523`'s e2e regression or the disabled-stations incident.** Both are 00's,
  both already have breadcrumbs, and re-deriving them would have consumed this sweep.
- **Did not write to `docs/qa/qa-findings.md`.** It is gitignored at `.gitignore:108` and has
  swallowed a real finding for nine days before. Everything above is in this tracked-path breadcrumb.
