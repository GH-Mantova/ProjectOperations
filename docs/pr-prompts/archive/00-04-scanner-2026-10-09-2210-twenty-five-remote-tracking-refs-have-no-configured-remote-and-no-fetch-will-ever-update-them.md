# Station 04 — Scanner | 2026-10-09T22:10:05Z–2026-10-09T22:17:33Z

## GROUND

```
UTC            2026-10-09T22:10:05Z
origin/main    8daa77e2            (fetch first, then rev-parse)
dev tree       main @ 8daa77e2      C:\ProjectOperations2
doc version    1
bootstrap      1
```

doc version and bootstrap AGREE (1 == 1), so this run was not restricted to read-only by a
version mismatch. It was read-only anyway: Station 04 is read-only on the board by authority.

Sighted run. `start_process` shell `powershell.exe` succeeded on the first call after a keyword
`ToolSearch` for `desktop-commander`. Not blind.

Sweep this run, chosen by the rotation and not by me: **repo-hygiene** (`next-sweep.mjs`,
rotation position 3 of 4; previous run 2026-10-09T18:10:05Z). Advanced at the end to
`last_index=2 last_run_utc=2026-10-09T22:10:05Z` and **left dirty** — see WHAT I DID NOT DO.

## WHAT I MEASURED

### Preflight

[MEASURED] git guard installer, `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`.
Last line and exit code, quoted as the contract requires:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/dreamy-charming-cerf/.local/bin:$PATH" git <args>
EXIT=2
```

Exit **2** — `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your
shell.` This is the expected station outcome, a finding and not a stop. Its own controls:
`bash -lc 'command -v git'` → the shim; `bash -c 'command -v git'` → `/usr/bin/git`. So the
device-bridge git ban was REMEMBERED this run, not mechanical. I ran no `git` through the bridge;
every `git` below ran in `powershell.exe` on the Windows host.

[MEASURED] Binding documents read from `git show origin/main:<path>` in the dev tree (never the
working copy), after `git fetch origin` (FETCH_EXIT=0): `docs/pipeline/stations/04-scanner.md`
93,224 bytes, `docs/pipeline/DOCTRINE.md` 60,566 bytes, `docs/pipeline/STATION-CAPABILITIES.md`
107,606 bytes. Cores read in full; no `§9` REFERENCE section was acted on this run.

[MEASURED] `status-sweep.ps1`, 2026-10-09 22:10:42Z. Section 0 positive controls both PASS
(`gh CAN reach GitHub (saw merged PR #2298)`, `node runs`), so the report is usable. Board:
1 open PR (#2294, BEHIND, 13 pass / 2 fail, labelled `do-not-merge`); `main CI on 8daa77e2:
2 success / 2 failed` — **TRUNK IS RED**, already Marco's as of #2298 (docker pull rate limit),
not re-filed here. Watcher node RUNNING pid 8848, wrapper alive, heartbeat 47 min.

### A — worktrees and their locks

[MEASURED] `git -C C:\ProjectOperations2 worktree list --porcelain` → **34** entries, 33 non-main.
Per-worktree `Test-Path` → **34 of 34 exist on disk**. `.git/worktrees/` → **33** admin entries;
for every one, `locked` absent and the `gitdir` target directory present:

```
worktree_count_total=34
admin_entries=33
ADMIN name=bl locked=False gitdirTargetExists=True target=C:\po-wt\bl
... (33 rows, every one locked=False gitdirTargetExists=True)
```

[MEASURED] `git worktree prune --dry-run -v` → **no output**, exit 0. Nothing is prunable.

POSITIVE CONTROL on the lock probe, so the all-False reading is not a blind `Test-Path`:
in the same admin directory `C:\ProjectOperations2\.git\worktrees\bl`,
`control_gitdir_file_exists=True` and `control_absent_file_exists=False` for a needle minted this
run. The probe distinguishes present from absent in exactly the directory it reported on.

**So the lock half of this sweep item is genuinely clean: 0 locked, 0 prunable, 0 missing
targets.** `status-sweep.ps1` labels several of these "orphaned worktree (aborted run leftover)"
on a LIVENESS classification — age and unpushed commits — which is a different and weaker claim
than git's own prunability. Both readings are true; they are not the same reading.

### B — stash growth in the watcher clone

[MEASURED] `git -C C:\po-watcher\ProjectOperations stash list` → **86** entries.
Dev tree: **1**.

```
clone_stash_count=86
newest_stash_committer_date=2026-10-04 16:57:12 +1000
oldest_stash_committer_date=2026-07-14 08:44:31 +1000
```

[MEASURED] the autostash mechanism is still in the launcher:
`Select-String -Pattern "watcher-preflight-autostash"` over `scripts/pr-watcher/*.ps1|*.mjs` and
`scripts/*.ps1` → **1 hit, `scripts\pr-watcher\start-watcher.ps1:70`**. NEGATIVE control, a needle
minted this run over the same corpus → **0**.

[INFERRED] Newest stash is `2026-10-04T06:57Z`, i.e. **5.6 days before this run**, while the
watcher has restarted since (wrapper alive, heartbeat 47 min). `status-sweep.ps1` reads the clone
`tracked-dirty=0`. So the closed loop DOCTRINE §9.2 names is intact but dormant: the launcher only
stashes when the clone is dirty, and it has not been. The 86 entries are 82 days of accumulation
(2026-07-14 → 2026-10-04), not current growth.

⚠️ [CANNOT MEASURE] my own 7-day counter. `[datetime]::TryParse($text, [ref]$parsed)` threw
`Cannot find an overload for "TryParse" and the argument count: "2"`, and the line below it still
printed `stashes_newer_than_7_days=0`. **That 0 is a failed call flowing into a result, DOCTRINE
§7 standing guard 2, and it must not be read as a measurement.** The 5.6-day figure above is taken
from `newest_stash_committer_date` directly, which needs no parsing. Disclosed rather than quoted.

### C — the board trap: tracked `*-ready.md` at depth 1

[MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` → 1,508 tracked paths.
Filtered to depth 1 by segment count (`($_ -split "/").Count -eq 3`), not by a `-like` glob:

```
tracked_depth1_total=26
tracked_depth1_READY=0        <-- BOARD TRAP: CLEAN
tracked_depth1_HOLD=14        <-- POSITIVE CONTROL, non-zero as required
tracked_depth1_BREADCRUMB=2
needle_hits=0                 <-- NEGATIVE CONTROL, needle minted this run
```

[MEASURED] on disk, depth 1 of `docs/pr-prompts`: 22 `.md` files, `ready_files_depth1=0`,
`hold_files_depth1=14`, 2 breadcrumbs, 6 others — all six are legitimate non-prompts
(`README.md`, `PROMPT-SCHEMA.md`, `BACKLOG-DECISIONS.md`, `TEMPLATE-sot-reconcile.md`,
`queue-watch-state.md`, `shepherd-state.md`).

**Tracked-on-main and on-disk agree: zero armed prompts, zero tracked ready-files. No board trap,
and no superseded prompt littering the queue root.** The 175 tracked `*-ready.md` elsewhere in the
tree are all under `processed/` or `superseded/`, i.e. correctly retired.

⚠️ My first pass at the positive control used `-like "docs/pr-prompts/*-HOLD.md"` and returned
**353**, because PowerShell's `*` crosses `/`. That control was over-broad and said nothing; the
segment-count form above replaced it and returns 14, which matches the 14 files on disk. Recorded
because an over-broad control reads exactly like a passing one.

### D — HOLD files whose work has already shipped

[MEASURED] `scripts/pipeline/triage-holds.ps1` (read-only, `--dequeue` never passed), exit 0.
Its own two controls PASS first:

```
GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (30282 chars)
SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture
=== TOTALS  spent=0 of 14 evaluated  gates-satisfied=1  still-gated=13  unreadable=0
```

**spent=0 of 14, and 0 SPENT-behind-a-REJECT**, with the fixture control proving the SPENT bucket
is reachable — so that zero means none, not "this instrument cannot say". 13 are correctly gated
(`HUMAN_GATE_PRESENT` ×8, `FILE_GATE_NOT_RELEASED` ×4, `GATE_NOT_RELEASED` ×1).

The one ADMIT, `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`, overlaps open PR **#2294**
3-of-3 on scope — and one of the three matched entries is
`docs/pr-prompts/superseded/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`, i.e. the PR's own
scope retires the prompt. [INFERRED] it is in-flight work, not outstanding work. It is a HOLD, not
armed, so nothing will double-build it; triage's own warning that a 1-entry overlap has zero
precision is noted and I am not issuing a verdict on it.

### E — branches merged but not deleted

[MEASURED] `git branch -r --merged origin/main` → **2** rows, one of which (`origin`) is a false
positive: `refs/remotes/origin/HEAD` has short name `origin`, which my `-ne "origin/HEAD"` filter
did not catch and which also threw `Substring(7)` on a 6-character string. Disclosed, and the
reading discarded.

**That probe is structurally near-blind on this board, and the gap is 18×.** `Merge-Pr` squash-
merges (DOCTRINE §8.3), so a merged branch is never an ancestor of `main`. The squash-aware probe,
crossing live remote-tracking refs against `gh pr list --state merged --limit 400`:

```
live_remote_branches=52
merged_prs_sampled=400
remote_branches_whose_pr_is_MERGED=36    <-- merged but not deleted
needle_branch_in_merged_heads=False      <-- NEGATIVE CONTROL
OPEN-HEAD fix/sweep-section5-dedupe-and-fast-switch (PR #2294)   <-- contrast: not deletable
```

36 of 52, oldest `docs/st00-collect-2026-09-14-1108` (PR #1927, 25 days). 34 of the 36 are board
breadcrumb branches (`docs/board-*`, `docs/collect-*`, `board/*`); 2 are code
(`feat/heartbeat-alarm-text-v1` #2278, `fix/gitpush-worktree-mandatory-v1` #2261).

### F — remote-tracking refs with no remote behind them

[MEASURED] `git remote -v` lists **exactly one** remote:

```
origin  https://github.com/GH-Mantova/ProjectOperations.git (fetch)
origin  https://github.com/GH-Mantova/ProjectOperations.git (push)
configured_remotes=1
```

[MEASURED] but `refs/remotes/` holds **25** refs outside `refs/remotes/origin/*`, in four
namespaces no remote declares:

```
refs/remotes/pr/1477 1478 1483 1487 1544 1571 1692 1699 1709 1713 1760 1824 1835 2193   (14)
refs/remotes/pr1273 562ab97d
refs/remotes/pr2278 08883aff
refs/remotes/staleprobe/{chore/sweep-breadcrumbs-20260907-0934, feat/crm-account360-v2-s1,
  feat/verdict-home-resolver, feat/verdict-home-resolver-v1, fix/classify-policy-nested-tests,
  fix/verdict-home-resolver-v1, fix/verdict-home-resolver-v1-impl, fix1483, main}   (9)
```

[MEASURED] `git merge-base --is-ancestor <ref> origin/main` for all 25: exit 1 for **24** of them
(not ancestors of `main`), exit 0 for `staleprobe/main` alone.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved or staged. No PR created,
merged or labelled. No `/sot/` file touched. No `git` run against the Windows `.git` through the
device bridge.

One file left deliberately dirty in the dev tree, which Station 00 commits:

- `docs/pipeline/sweep-rotation.json` — ` M`, advanced to `last_index=2
  last_run_utc=2026-10-09T22:10:05Z`. Station 04 may not commit to the shared dev tree.

Scratch probes written outside the repo, at `C:\po-sup-fix-scripts\st04-hyg*.ps1` and their
`*-out.txt`. This breadcrumb is **untracked** at a tracked path until a board PR commits it.

[MEASURED] `node scripts\pipeline\check-breadcrumb.mjs` → exit **0**, `CLEAN`,
`structure: 3 checked, 0 malformed, 0 skipped`, `ADMIT` on this file — plus its own
`NOTE ... is UNTRACKED — it reaches nobody until a board PR commits it`, which is the state
described above. **breadcrumb-clean**, on that command and no other.

## FINDINGS

### F1 — 25 remote-tracking refs have no configured remote, so no fetch will ever update them, and they pin 24 commits against gc

[MEASURED] above: one configured remote (`origin`), 25 refs under `refs/remotes/pr/`,
`refs/remotes/pr1273`, `refs/remotes/pr2278` and `refs/remotes/staleprobe/`. 24 of the 25 are not
ancestors of `origin/main`.

Two costs, and the second is the one that matters to this pipeline:

1. They are **frozen**. `git fetch origin` cannot touch a ref outside `refs/remotes/origin/*`, and
   `git remote prune` has no remote to prune them against. They will read exactly as they do now
   for as long as the dev tree exists, whatever happens to the branches they were copied from.
2. **Any probe that enumerates "remote branches" over `refs/remotes` silently includes them.** My
   own section-E probe did, before I narrowed it — and this is the §9.6 shape: nothing is empty,
   nothing errors, and the count is simply measuring a different corpus than the reader thinks.
   A staleness or orphan sweep built on `git branch -r` inherits 25 refs that can never be stale
   because nothing updates them, and 24 commits that can never be collected.

Severity S3: no board mutation, no data at risk, but it mis-calibrates exactly the kind of sweep
this station runs, and `staleprobe/` reads like a probe artefact left behind rather than anything
deliberate.

⚠️ Falsifying probe: `git remote` against
`git for-each-ref --format="%(refname)" refs/remotes | ? { $_ -notlike "refs/remotes/origin/*" }`.
Today: **1** remote against **25** foreign refs. If a second remote is ever configured, the
`staleprobe/` and `pr/` namespaces stop being orphans and this finding must be re-measured.

**RULE 1 options, complete-and-additive first.** Deleting a remote-tracking ref destroys no
commit that any branch or PR still holds, but these 24 are the only thing keeping their objects
reachable, so "additive" is the test that decides:

- **(A) Complete and additive — record, then prune the namespaces, in one prompt.** First write
  the 25 refs and their SHAs into the prompt body as recoverable evidence, then
  `git update-ref -d` each one, then re-read `refs/remotes` to prove only `origin/*` remains.
  Passes both halves: it removes the mis-calibration permanently, and no user data and no
  reachable PR head is involved. A `pr/NNNN` or `staleprobe/*` SHA that someone later wants is
  recoverable from the PR itself on GitHub, which is where those refs were fetched from.
- **(B) Teach the probes to filter instead, and leave the refs.** Fails the *completely* half: it
  fixes each sweep one at a time and the next probe written over `refs/remotes` inherits the same
  25. It damages nothing.
- **(C) Configure a real `staleprobe` remote so the refs become live.** Fails *completely* too,
  and worse — it legitimises a namespace nobody asked for and makes 9 more refs that fetch will
  then keep current.

I am not staging a deletion prompt: the sweep's own standing rule is **REPORT ONLY — no agent
bulk-deletes**, and 25 ref deletions is exactly that. Option A needs Marco's word on whether
`staleprobe/` and `pr/` were his.

**DISPOSITION: ESCALATED** — for Marco, one question: *were `refs/remotes/staleprobe/*` and
`refs/remotes/pr/*` created by you, and may Station 00 record-then-prune all 25 under option A?*

### F2 — 36 of 52 live remote branches are heads of merged PRs, and the standard probe for this reports 2

[MEASURED] above: `remote_branches_whose_pr_is_MERGED=36` against
`git branch -r --merged origin/main` → 2, one of which was my own `origin/HEAD` false positive, so
the honest comparison is **36 against 1**.

The undercount is structural, not a bug in the board: squash-merge leaves no ancestry, so
`--merged` is the wrong instrument here and will keep returning ~0 forever while the branch count
climbs. 34 of the 36 are spent board breadcrumb branches; the oldest is 25 days old.

Severity S4 housekeeping on the branches themselves — they cost nothing but clutter and they are
all recoverable from their merged PRs. The instrument half is the real content: **any future
hygiene check for merged-but-not-deleted branches must cross `gh pr list --state merged` against
the live refs, never `git branch -r --merged`.** That belongs in the repo, not in a run's notes.

**DISPOSITION: DISPATCHED** to **Station 00**, two items: (1) the 36-branch deletion list is a
candidate for one board PR's worth of cleanup at 00's discretion — report-only from me, and #2294's
head `fix/sweep-section5-dedupe-and-fast-switch` is explicitly NOT in it; (2) the squash-aware
probe above is worth a line in the repo-hygiene sweep definition in
`docs/pipeline/sweep-rotation.json` or the station doc, so the next run does not reach for
`--merged`. Both are 00's lane, neither is mine.

### F3 — 31 untracked PR-review files sit at paths a future board PR will want to create, which is the measured fast-forward block

[MEASURED] `git status --porcelain -- docs/pr-reviews` → **31** lines, every one `??`, for PRs
#2183 through #2297 — all already merged. Dev tree overall: 37 untracked, and
`git diff --numstat origin/main` **EMPTY**, `git diff --cached --name-status` **EMPTY**,
so the tree is clean for a fast-forward *right now*.

The hazard is the one this station's own contract records: once a PR lands any of those exact
paths on `main`, the dev tree holds an untracked file where the fast-forward must create one, and
`git merge --ff-only` refuses — **while `--numstat` and `--cached` both read EMPTY, which is the
documented PASS reading.** The board hit this shape yesterday from the other direction (#2296,
mixed-EOL arming log). These 31 are pre-positioned for it, and the verdict-home question
(DOCTRINE §9.5, three homes for a verdict) is why they are in the dev tree at all.

Severity S3: it does not block anything today, and it blocks every station the day it fires.
I am not deleting or committing them — verdicts are evidence, and `docs/pr-reviews/` is not my
lane.

**DISPOSITION: DEFERRED.** What would make it urgent: a PR appearing with any
`docs/pr-reviews/pr-2*-review.md` in its file list, or a Station 00 run reporting an `ff-only`
refusal with `--numstat` EMPTY. Either one promotes this to the cure in the station contract
(raw-Buffer restore from `HEAD`, never `git checkout -- <path>`).

### F4 — the dev tree holds 685 local branches

[MEASURED] `git for-each-ref refs/heads` → `local_branches_total=685`; of those,
`local_branches_ancestor_of_main=4` (`fresh/union-open-pr-heads`, `po/helper-selftest`,
`stage/brandtheme-s1-s2`, `stage/brandtheme-s1-s2-v2`) — and that 4 is subject to exactly the
squash-merge blindness F2 describes, so it is a floor, not a count.

Recorded as a measurement with a disposition rather than worked further: 685 local branches is a
number worth a human knowing, 33 worktrees are checked out against some of them, and deciding
which are dead needs the per-branch unpushed-commit read that `status-sweep.ps1` already does for
the worktree subset. Doing that for 685 branches is a sweep of its own, not a tail-end of this one.

**DISPOSITION: DEFERRED** — to the next `repo-hygiene` rotation, which is where it belongs. What
would make it urgent: a `git` operation in the dev tree slowing measurably, or a branch-name
collision on a stage/ or fix/ name.

## WHAT I DID NOT DO

- **Armed nothing, staged nothing, moved nothing.** Station 04 is read-only on the board. The one
  ADMIT in triage (`pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`) is in-flight as #2294 and
  was not touched; arming is 00's, on Marco's authority.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** It is left ` M` in the dev tree and named
  under WHAT CHANGED. The authority matrix gives 04 *Create a PR: NO* and *Mutate the board: NO*,
  and the dev tree is on `main`, which nobody commits to directly.
- **Did not delete the 25 foreign refs, the 36 merged branches, the 86 clone stashes or any
  worktree.** The sweep definition says REPORT ONLY and no agent bulk-deletes. F1 is escalated,
  F2 is dispatched.
- **Did not run the other three sweeps** (gate liveness, instrument honesty, instruction drift).
  One named sweep per run, covered completely; rotation advanced so the next run takes the next.
- **Did not re-file the trunk red.** `main CI on 8daa77e2: 2 success / 2 failed` is already
  Marco's as of #2298 (docker pull rate limit, survived a rerun). Re-filing a discharged item to
  Marco is a cost this pipeline has already paid.
- **Did not re-file the Codex layer.** `?? .codex/` and `?? AGENTS.md` are in my untracked
  reading, and `STATION-CAPABILITIES.md` §1 already records `CODEX_LAYER_MAPPED_V1` with both
  open questions filed for Marco this cycle.
- **Did not run `lint-prompt.mjs` on this breadcrumb.** It gates `docs/pr-prompts/` as *prompts*
  and never returns a passing verdict on a breadcrumb, in either direction.
- **No live-site pass, no Part 0 / Part 1 audit.** The rotation named repo-hygiene and the station
  doc says cover one sweep completely rather than pass shallowly over everything.
- **Azure / Entra / SharePoint: not touched.** No portal, no `az`, no `Connect-MgGraph`.

## FOR MARCO

One question, F1: **were `refs/remotes/staleprobe/*` (9 refs) and `refs/remotes/pr/*` (16 refs)
created by you?** No remote declares them, so nothing will ever update them, and they are the only
thing keeping 24 unmerged commits reachable. If they are not yours, may Station 00 record their
SHAs into a prompt body and then prune all 25 (option A — the complete-and-additive one)?
