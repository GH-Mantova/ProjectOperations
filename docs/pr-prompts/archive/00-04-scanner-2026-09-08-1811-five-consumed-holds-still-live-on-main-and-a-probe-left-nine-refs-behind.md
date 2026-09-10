# Station 04 — Scanner | 2026-09-08T18:11:10Z–2026-09-08T18:24Z

## GROUND

```
UTC            2026-09-08T18:11:10Z
origin/main    533604dc            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 533604dc     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE, so this run was not read-only on that account.

Sweep this run, named by `node scripts\pipeline\next-sweep.mjs`: **`repo-hygiene`** — "Orphaned
worktrees and their locks, stash growth in the watcher clone, superseded prompt files littering the
queue root, tracked `*-ready.md` at depth 1 (the board trap), branches merged but not deleted, and
HOLD files tracked on main whose work has already shipped. REPORT ONLY." (rotation position 3 of 4;
previous run 2026-09-08T14:25:17Z).

⚠️ **The previous `repo-hygiene` turn was 2026-09-08T02:10Z, sixteen hours ago** — breadcrumb
`00-04-scanner-2026-09-08-0210-eight-stale-remote-heads-and-the-orphan-worktree-holds-a-superseded-draft.md`,
now tracked on `main`. Its F1/F2/F3 were read in full before anything here was written, and per
DOCTRINE §7.1's re-read rule each was **re-verified against the live system rather than re-filed**.
Two are unchanged, one has been discharged by measurement. The findings below are what that run did
not cover.

## WHAT I MEASURED

**Preflight.**

- `[MEASURED]` Device bridge git guard: `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
  → last line `vm-git-guard installed at /sessions/relaxed-busy-bohr/.local/bin/git - refuses mounted
  paths, allows everything else (both controls passed)`. Install PASSED.
- `[MEASURED]` `start_process` shell `powershell.exe` → pid 32796. **SIGHTED run**, not blind.
- `[MEASURED]` The three binding documents were read from a tree PROVED equal to `origin/main`, not
  from a possibly-behind working copy: `git rev-parse --short origin/main` → `533604dc`,
  `git rev-parse --short HEAD` → `533604dc`, and
  `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
  → **EMPTY** for all three, which is the real answer per DOCTRINE §9.3. No piped hash was taken and
  none is quoted (§9.1 — the piped form is unsound under `powershell.exe`).
- `[MEASURED]` `scripts\pipeline\status-sweep.ps1`, captured to a FILE because it returns early and
  hides its own §7 verdict: 359 lines, section 0 controls both `[LIVE]` PASS, section 7 →
  **`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`**
  Re-read before this run's only tree-touching act (advancing the rotation file); no board mutation
  was made, so the `[LIVE]`-expires rule did not bind further.

**Board state at the moment of measurement** (`[LIVE]`, from the sweep and from `gh`):

- 3 OPEN PRs — `#1822` BLOCKED/RED, `#1821` CLEAN green, `#1820` CLEAN green. armed `*-ready.md` = **0**.
- `main` CI on `533604dc`: 4 success / **1 failed** — trunk is RED. Not this sweep's lane; recorded as state.
- watcher node RUNNING pid 31660; clone `branch=main dirty=8`; heartbeat age 281 min with an empty queue.

**Charter item by charter item.**

| item | `[MEASURED]` | control |
|---|---|---|
| tracked `*-ready.md` at depth 1 (THE BOARD TRAP) | **0** | POS: the same depth-1 filter finds **42** `-HOLD.md`, so the filter works |
| orphaned worktrees | **1** — `C:/po-vg`, `fix/no-rebase-while-checks-run` @ `23c91ba9`, 1 untracked file, age **6378 min** | `git worktree list --porcelain` in both trees; clone has none |
| worktree LOCKS | **0** — `.git/worktrees/po-vg/locked` absent | clone has no `.git/worktrees` at all |
| stash growth in the clone | **69**, newest `2026-09-06T09:35:10Z`, oldest `2026-07-14T22:44:31Z` | dev tree **0**, `po-vg` **0** |
| branches merged but not deleted | **1** true instance — see F6 | `git ls-remote --heads origin` (ask the remote, §9.2), **12** heads |
| HOLDs tracked on main whose work has shipped | **5**, plus **1** SPENT — see F1 and F5 | `triage-holds.ps1` GIT control PASS, SPENT fixture control PASS |
| superseded prompt files littering the queue root | none beyond the three named in F4/F7 | `superseded/` holds 379 files on disk in 17 dated `cleared-*` subfolders, 366 tracked |

⚠️ **One of my own readings was wrong first and is corrected here, because it is DOCTRINE §9.2 in
miniature.** `Get-ChildItem docs\pr-prompts\superseded -File` returned **148** against a tracked count
of **366**, which reads as "218 retirements are missing from disk". `-File` with no `-Recurse` counts
one level; the recursive form returns **379**. Nothing warned and nothing was empty. The corrected
delta is 13 untracked retirements awaiting a board PR, which is normal.

**Fresh needle for this run's negative controls: `zzQq04Needle20260908T1815`** — 0 hits over
`docs/pr-prompts/*.md` and over `origin/main`, against POS controls that returned 64 and 2
respectively. 🔴 **It is spent the moment this file lands. Mint a new one next run** (DOCTRINE §9.6).

## WHAT CHANGED

**Nothing on the board.** No branch deleted, no worktree removed, no stash dropped, no prompt armed,
renamed, moved, retired or staged, no PR touched, no label changed, no `git commit` and no push. 04 is
read-only on the board and this sweep's own charter says REPORT ONLY, no agent bulk-deletes.

Two writes were made, both outside the board and both named here so Station 00 can sweep them:

1. `docs/pipeline/sweep-rotation.json` — advanced with
   `node scripts\pipeline\next-sweep.mjs --advance --utc 2026-09-08T18:11:10Z`. **Left DIRTY in the dev
   tree deliberately; Station 00 commits it, because 04 may not.** If it is not committed the next run
   repeats `repo-hygiene` and the rotation silently stops.
2. This breadcrumb, at a tracked path, **currently UNTRACKED** — it reaches nobody until a board PR
   commits it.

## FINDINGS

### F1 — Five consumed prompts are still tracked on `main`, physically present in the build clone, and three of them belong to PRs that are still OPEN

This is the charter's "HOLD files tracked on main whose work has already shipped", in its worst
available form, and the instrument built to catch it is structurally blind to it.

`[MEASURED]` at `533604dc`. Depth-1 tracked `-HOLD.md` under `docs/pr-prompts/` = **42**
(`git ls-tree -r --name-only origin/main -- docs/pr-prompts/`, trailing slash, `-r`, filtered in code
— never globbed, §9.2). Depth-1 `-HOLD.md` on disk = **38**. The set difference is five, and every one
is a genuine deletion rather than a behind-tree artefact:

| prompt | `git diff --numstat origin/main` | status | its PR |
|---|---|---|---|
| `pr-brandtheme-s0-token-foundation-HOLD.md` | `0 158` | ` D` | **#1820 OPEN** |
| `pr-brandtheme-s1-apply-the-saved-scheme-HOLD.md` | `0 261` | ` D` | #1819 MERGED 11:47Z |
| `pr-rates-consumers-s3-persona-export-HOLD.md` | `0 85` | ` D` | **#1821 OPEN** |
| `pr-stationcaps-blind-run-names-one-mount-HOLD.md` | `0 103` | ` D` | #1814 MERGED 06:59Z |
| `pr-tfm-s11-copy-recursive-preserve-HOLD.md` | `0 219` | ` D` | **#1822 OPEN** |

**POSITIVE control that `--numstat` was working:** the same query on `docs/pipeline/DOCTRINE.md`
returned **0 lines**, i.e. no difference, at the same second. **The ` D` is trustworthy here only
because `HEAD == origin/main`** — DOCTRINE §9.2's newest bullet says a ` D` on a behind tree answers a
question about `HEAD`, not about `origin/main`, so the `--numstat` column above is the load-bearing
one and the status column is corroboration. `RD` lines under `docs/pr-prompts` = **0**, so this is not
the staged-rename variant.

🔴 **The blast radius is not hypothetical: all five are ON DISK in the watcher clone right now.**
`Test-Path` on `C:\po-watcher\ProjectOperations\docs\pr-prompts\<name>` → **True for all five**;
clone depth-1 `-HOLD.md` = **42**, matching `main` rather than the dev tree's 38. POSITIVE control, a
HOLD present in both trees → True; NEGATIVE control, the minted needle as a filename → False. The
clone is the tree builds run in, and it is at `533604dc`. Any fresh clone, any CI checkout, and any
`git checkout .` in the dev tree materialises the same five — which is the board trap the charter
names, reached from the direction nobody probes.

🔴 **`triage-holds.ps1` cannot see this class, and its silence reads as an all-clear.** Its
`POSSIBLE DUPLICATES OF AN OPEN PR — CONFIRM BEFORE ARMING` bucket printed `(none)` this run, under
the control line `3 open PR(s) read from the board; 8 admitted prompt(s) scanned`. It enumerates
depth-1 files **on disk**, so the three prompts whose PRs are open were never candidates for its
cross-check. §10.6's warning is about a second lane leaving a prompt behind; this is the mirror — the
watcher consumed the prompt and the PR did not delete it, so the queue looks clean in the one tree
that has been mutated and dirty in every other.

⚠️ **The general defect is already known and still unstaged** (an armed prompt whose PR does not
delete it stays armable forever; `pr-gates-approval-receipt-HOLD` was consumed twice on it). What is
new here is a **measured population of five at once, three of them against live open PRs**, and the
measurement that the clone already holds them.

🔧 **Falsifying probe:** the set difference and the clone `Test-Path` pair above. If a later run finds
depth-1 tracked `-HOLD.md` equal to the on-disk count, this finding is discharged; if the clone stops
holding them, the mechanism has changed and this must be re-measured.

**DISPOSITION: DISPATCHED** — to Station 00, which owns the board PR. Two separable actions, and only
the first is safe today: retire `pr-brandtheme-s1-apply-the-saved-scheme-HOLD.md` and
`pr-stationcaps-blind-run-names-one-mount-HOLD.md` to `docs/pr-prompts/superseded/` in a board PR
(their PRs are merged). **Do NOT retire the three whose PRs are open** — deleting a prompt while its
PR is unmerged loses the text if the PR closes; the right cure is for `#1820`/`#1821`/`#1822` to
delete their own prompts, which is a change to how those PRs are built, not a board action. 04 stages
nothing: this is a queue mutation and 04 is read-only.

### F2 — A probe left nine remote-tracking refs behind in the dev tree six minutes after the last hygiene sweep, in a namespace no refspec owns

`[MEASURED]` `git branch -r` = **34** against `git ls-remote --heads origin` = **12**. Twenty-two
extras, in three families: twelve `refs/remotes/pr/<N>` (1477, 1478, 1483, 1487, 1544, 1571, 1692,
1699, 1709, 1713, 1760), one `pr1273`, and **nine `refs/remotes/staleprobe/*`** mirroring every
non-`main` head that existed at the time.

**Nothing owns them and `--prune` can never remove them.** `git config --get-all remote.origin.fetch`
→ `refs/heads/*:refs/remotes/origin/*`, single line; `git remote` → `origin`, alone. That is exactly
the mechanism DOCTRINE §9.2 records, and its worked figures have now moved: that bullet cites "12
against 7" and "five extras". Re-measure, never quote — this run reads 34 against 12 and 22 extras.

**Who minted them is unmeasurable from the repo, and the timestamp is the tell.** All nine loose refs
under `.git/refs/remotes/staleprobe/` carry `LastWriteTimeUtc` **2026-09-08T02:16:14Z**, identical to
the second; `packed-refs` holds **0** of them. The token `staleprobe` appears **nowhere on
`origin/main`** (`git grep -n -i staleprobe origin/main -- .` → exit 1; POSITIVE control
`classifyPolicyFiles` in `scripts/pr-watcher/index.mjs` → 2; NEGATIVE control, the minted needle →
exit 1) and in **no breadcrumb on disk** (`Select-String -Path docs\pr-prompts\*.md -SimpleMatch
staleprobe` → 0 rows; POSITIVE control `worktree` → 64 rows; NEGATIVE control → 0). So no committed
script created them and no run wrote them down.

🔴 **02:16:14Z is six minutes after the 02:10Z `repo-hygiene` breadcrumb was written, and that
breadcrumb records `git branch -r` answering 22 against a truth of 9.** 34 − 12 = 22 extras today;
22 − 9 = 13 extras then; the difference is exactly nine. The available reading is that the hygiene
sweep's own ad-hoc staleness probe fetched every head into a private namespace and never tore it
down — **permanently degrading the instrument the next hygiene sweep reaches for.** That step is
`[INFERRED]` from the arithmetic and the timestamp; the refs themselves are `[MEASURED]`.

⚠️ **Why it is worth a finding rather than a shrug.** `git branch -r` is the query DOCTRINE §9.2
already forbids, and its over-report is now 2.8× rather than 1.7×. A run that has not read that
bullet gets a longer, more plausible list of "stale branches" every time somebody debugs branches,
and the growth is monotonic and self-inflicted — the same shape as the burned-needle rule in §9.6.

🔧 **Falsifying probe:** `git branch -r` against `git ls-remote --heads origin`, plus
`git config --get-all remote.origin.fetch`. If the `staleprobe/` family disappears without anyone
deleting it, this finding is wrong about refspec ownership.

**DISPOSITION: DISPATCHED** — two halves, two owners. To **Station 03** (dev-tree machine hygiene):
delete `refs/remotes/staleprobe/*` and consider the `pr/*` family with them; these are local
remote-tracking refs mirroring heads `origin/*` already carries, so removing them destroys no commit
and is not DOCTRINE §5 branch deletion — but it is a git write in the shared dev tree, which is 03's
lane and not 04's. To **Station 00** (the doc half): a one-line rule worth adding where §9.2's
`branch -r` bullet lives — *a probe that mints a ref namespace tears it down in the same run, and says
in its report that it did*. 04 authors no DOCTRINE change; that is a `docs/` PR and 00's to decide.

### F3 — 02:10Z's F3 is DISCHARGED by measurement, and it closed exactly the way it predicted it would

`[MEASURED]` `docs/pr-reviews/`: **107** `.md` on disk, **107** tracked on `origin/main`
(`git ls-tree -r`), **0** untracked (`git status --porcelain -- docs/pr-reviews`, `??` lines). At
02:10Z the same three numbers were 106 / 59 / **47**. Station 00's board PRs since have committed all
of them.

🔴 **The systemic half is untouched, and this is the second time it has closed by luck.**
`git grep -l "docs/pr-reviews" origin/main -- scripts/ .github/` still returns **11** files; the only
hit under `scripts/pipeline/` is `visual-smoke.mjs`. **`sweep-breadcrumbs.ps1` still does not name
that directory.** POSITIVE control, the same query for `docs/pr-prompts` → **50** files. So nothing
sweeps `docs/pr-reviews` on purpose; the 47 landed because board PRs happened to `git add` them,
which is precisely the shape DOCTRINE §9.5 records for `.arming-log.txt` — *the gap closes and
re-opens by luck.*

**DISPOSITION: DEFERRED** — real, not now. The immediate risk (five days of merge evidence on one
machine, one `stash --include-untracked` from gone) is currently zero because the backlog is zero.
**What would make it urgent:** the untracked count rising above zero again while a `git clean`,
`stash --include-untracked` or dev-tree reset is in prospect — or a `verdictApproves` lookup failing
for a PR whose only verdict copy was in the dev tree. The fix is a `scripts/` change (widen
`sweep-breadcrumbs.ps1`) and the judgement is 00's, so 04 stages nothing.

### F4 — A HOLD that lints ADMIT exists in exactly one tree on earth

`[MEASURED]` `docs/pr-prompts/pr-vmgitguard-selftest-and-recursion-HOLD.md`, on disk since
**2026-09-08T10:25Z**, is `??` in `git status`, `git ls-files --error-unmatch` → **exit 1**
(POSITIVE control on `pr-rateparity-s1-harness-HOLD.md` → exit 0, prints the path), and
`git check-ignore -v` → **exit 1, empty** — so it is untracked and *not* gitignored, an ordinary
uncommitted file. It is **absent from the watcher clone** (`Test-Path` → False; POSITIVE control, a
HOLD that is on `main` → True).

🔴 **And `triage-holds.ps1` lists it under `GATES SATISFIED — lint ADMITs (exit 0)`**, one of eight
candidates. So the arming decision this board would make from its own instrument includes a prompt
that `origin/main`, CI, the build clone and every other station are blind to. That is the mirror of
F1: F1 is the dev tree being silently BEHIND `main` on prompts; this is the dev tree being silently
AHEAD, in a way only it knows about, which is the harder of the two to notice because nothing is
missing anywhere.

**Committing a `-HOLD.md` cannot start work** — the watcher globs `*-ready.md`. Publishing it costs
nothing and makes the candidate visible to everyone who might arm it.

**DISPOSITION: DISPATCHED** — to Station 00: commit this file with the next board PR, alongside the
rotation file and this breadcrumb. 04 does not commit to the shared dev tree.

### F5 — One SPENT HOLD on the board, and it is 05's

`[MEASURED]` `scripts\pipeline\triage-holds.ps1` (read-only, `--dequeue` never passed) over the 38
depth-1 HOLDs: `spent=1  gates-satisfied=8  still-gated=29  unreadable=0`. The one is
**`pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`**, `lint-prompt.mjs` **exit 3**.

**Both of the script's own controls PASSED**, which is what makes the count believable in the
negative direction as well: `GIT control: PASS — git read origin/main:docs/pipeline/DOCTRINE.md
(136688 chars)`, and `SPENT control: PASS — lint-prompt.mjs emitted exit 3 on the fixture, so the
SPENT bucket is measurable.` Its `SPENT BEHIND A REJECT` bucket returned `(none)` from a direct
re-probe of all 29 REJECTs, and the fixture control proves that zero means none rather than "this
instrument cannot say".

**DISPOSITION: DISPATCHED** — to Station 00, for Station 05. Retiring it to
`docs/pr-prompts/superseded/` is a `sot/`-lane prompt retirement and CP-24 keeps `sot/` work in its
own doc-reconcile PR. 04 arms nothing, retires nothing, and does not touch anything 05 owns.

### F6 — The two findings 02:10Z escalated are both unchanged, and the branch mechanism ticked once more

Re-verified rather than re-filed, per the re-read rule.

- **`C:\po-vg`** — the hash pair that finding turned on is unchanged:
  `git hash-object` on the worktree's `scripts/pipeline/check-pipeline-heartbeat.mjs` → **`9c4587fb`**
  against `git rev-parse origin/main:<same path>` → **`84ec92d4`**. Age is now **6378 min** (4.4 days),
  the single untracked file is the same one, `.git/worktrees/po-vg/locked` is **absent**, and the
  worktree is still registered. Removal is still safe and still nobody's action but 03's.
- **Merged-but-undeleted heads** — `#1778`'s head `chore/sweep-breadcrumbs-20260907-0934` is still on
  `origin` **32.6 hours** after it merged. That is the one true "merged but not deleted" on the board;
  the other seven stale heads are CLOSED-unmerged (`#1612`, `#1703`, `#1705`, `#1707`, `#1708`,
  `#1571`) or have never had a PR (`fix1483`), all resolved per-branch with
  `gh pr list --head <b> --state all` rather than from a list response, since `merged` is unusable on
  a list payload (§9.4). Three NEW heads have appeared since 02:10Z — all three are live open PRs
  (`#1820`, `#1821`, `#1822`), so the head count moved 9 → 12 with **zero** deletions.

The escalation file `docs/pr-prompts/needs-marco/stale-remote-heads-and-auto-delete-2026-09-08.md`
is present (`Test-Path` → True). Its ask is unanswered and its option (a) — enable *Automatically
delete head branches*, then delete the spent heads once — is the complete-and-additive one.

**DISPOSITION: ESCALATED** — already with Marco, and deliberately **not** re-filed as a new
escalation. What this run adds to the existing file is one line of evidence: in the sixteen hours
since it was raised, the board gained three heads and deleted none, and `#1778`'s head has now
outlived its merge by more than a day. No new question is put; the pending one is unchanged.

### F7 — A 1 MB scratch log with a corrupted filename is sitting in the watcher clone's root

`[MEASURED]` `git -C C:\po-watcher\ProjectOperations status --porcelain` lists, among its 8 dirty
entries, an untracked file git quotes as
`"C\357\200\272po-watcherProjectOperations.._scratch_1740_log.txt"`. The octal escape `\357\200\272`
is `EF 80 BA` = **U+F03A**, the private-use codepoint Windows substitutes for a drive colon. So the
name is the *path* `C:\po-watcher\ProjectOperations\..\_scratch_1740_log.txt` collapsed into a single
filename with the colon transliterated and the separators eaten — a path built by string
concatenation somewhere and then used as a leaf name. **1,033,778 bytes, last written
2026-09-07T01:24:17Z.**

⚠️ It matters slightly more than untidiness: a filename containing U+F03A survives ordinary globs and
is awkward to remove from a shell, and it is 1 MB of log accruing in the tree the watcher builds in —
where the launcher's preflight `git stash --include-untracked` will happily swallow it into stash 70.

`[CANNOT MEASURE]` which script built the path. Nothing on `origin/main` names `_scratch_1740_log`,
and the launcher family that would have written it lives in `C:\po-watcher`, outside both git repos.

**DISPOSITION: DISPATCHED** — to Station 03, which owns the clone. Delete the file and, if the
producing launcher can be identified in `C:\po-watcher`, fix the path construction. 04 does not write
in the clone.

## WHAT I DID NOT DO

- **Deleted no branch, removed no worktree, dropped no stash, deleted no ref, retired no prompt,
  merged nothing, armed nothing.** Branch deletion is on DOCTRINE §5's irreversible list; the rest are
  outside 04's lane, and this sweep's own charter is REPORT ONLY with *no agent bulk-deletes*.
- **Did not commit anything.** Not this breadcrumb, not `sweep-rotation.json`, not the untracked
  vmgitguard HOLD, not the 13 untracked files under `superseded/`. The dev tree is on `main` and
  nobody commits to `main` directly; the authority matrix gives 04 *Create a PR: NO*.
- **Did not fast-forward the watcher clone.** It is at `533604dc` and needs nothing today, but the
  standing rule holds: only 03 may, and it belongs to
  `needs-marco/nobody-may-fast-forward-the-watcher-clone-2026-09-07.md`.
- **Did not touch the three open PRs, their labels, or the RED trunk check on `533604dc`.** Trunk CI
  is not this sweep and not 04's lane; it is recorded as state above so 00 sees it.
- **Did not act on any section-5 `[STALE]`/`[FILE]` line** the sweep printed for the `needs-marco/`
  corpus. Acting on one without reading the file is forbidden, and clearing escalations is not 04's.
- **Staged no prompt.** Nothing found this run is fixable by a prompt: F1 and F5 are queue mutations
  (00's), F2 and F7 are machine actions (03's), F3 is a `scripts/` judgement (00's), F4 is a commit,
  and F6 is Marco's.
- **Ran no Part 0 static audit, no GitHub reconciliation and no live-site or visual pass.** The
  station doc gives 04 ONE named sweep per run, chosen by `next-sweep.mjs`, and this run's was
  `repo-hygiene`. A shallow pass over everything is why findings rot.
- **Quoted no `lint-prompt.mjs` verdict on this breadcrumb.** It rejects breadcrumbs for having no
  front matter and never returns a passing verdict on one, in either direction.

---

**Validator.** `node scripts\pipeline\check-breadcrumb.mjs` → **`CLEAN`, exit 0**;
`structure: 13 checked, 0 malformed, 0 skipped as pre-contract`; this file `ADMIT`. It also printed
the expected `NOTE ... is UNTRACKED — it reaches nobody until a board PR commits it`, which is the
contract working rather than a defect. Four breadcrumbs now carry that NOTE and are waiting on
Station 00: the 10:11Z and 14:11Z Station 04 runs, the 14:11Z Station 05 run, and this one.

`node scripts\pipeline\next-sweep.mjs --advance --utc 2026-09-08T18:11:10Z` → exit 0,
`advanced: last_index=2 last_run_utc=2026-09-08T18:11:10Z`, and
`git status --porcelain -- docs/pipeline/sweep-rotation.json` → ` M`. **Left dirty on purpose.**
