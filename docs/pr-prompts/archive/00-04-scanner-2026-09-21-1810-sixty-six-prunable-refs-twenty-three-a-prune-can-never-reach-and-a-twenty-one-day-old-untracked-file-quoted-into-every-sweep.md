# Station 04 — Scanner | 2026-09-21T18:09:53Z–2026-09-21T18:18:39Z

## GROUND

```
UTC            2026-09-21T18:09:53Z
origin/main    939c77bc                      (fetched, then rev-parse)
dev tree       main @ 939c77bc               C:\ProjectOperations2
doc version    1        (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1        (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not read-only-by-mismatch.

**Sweep this run: `repo-hygiene`** (rotation position 3 of 4, chosen by
`node scripts/pipeline/next-sweep.mjs`, not by me). Advanced with
`--advance --utc 2026-09-21T18:09:53Z` → `last_index=2`.
🔴 **`docs/pipeline/sweep-rotation.json` IS LEFT DIRTY IN THE DEV TREE (` M`). STATION 00 MUST
COMMIT IT** — 04 is read-only on the board and the dev tree is on `main`. If it is not committed,
the next run repeats `repo-hygiene` and the rotation silently stops.

**This breadcrumb is UNTRACKED** until a board PR sweeps it up.

---

## WHAT I MEASURED

**PREFLIGHT.** Desktop Commander `start_process` shell `powershell.exe` — **REACHED THE BOX.** Not a
blind run. Device-bridge git guard installed, last line quoted verbatim:

> `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd, allows everything else (three controls passed)`
> `persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`

All three binding documents were read **in full** and each was proved current against `origin/main`
with the sound form (§9.1 — no piped hash):
`git diff --numstat origin/main -- <path>` → **EMPTY for all three**
(`stations/04-scanner.md`, `DOCTRINE.md`, `STATION-CAPABILITIES.md`). Dev tree `HEAD ==
origin/main`, so the working copies are the same bytes as `main`. [MEASURED]

**SWEEP.** `scripts/pipeline/status-sweep.ps1`, captured with `*>` and decoded `utf16le` per §9.3
(`ENC=utf16le BYTES=157572`). Section 0 controls both `[LIVE]` PASS. Section 7 verdict:
**`SAFE TO ACT`**. No `index.lock` in either tree (`Test-Path` → False / False). [MEASURED]

Every measurement below was taken through `interact_with_process`/`start_process` with a **literal
marker echoed after each statement** (§9.1's `EARLY_RETURN_REPORTED_AS_TERMINATION_V1` guard 1).
**Every marker printed on every call** — no statement in this run is UNRUN-read-as-EMPTY.

### Worktrees, locks, stashes

```
git -C C:\ProjectOperations2 worktree list
  C:/ProjectOperations2         939c77bc [main]
  C:/PR-Master/worktrees/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]
git -C C:\po-watcher\ProjectOperations worktree list
  C:/po-watcher/ProjectOperations 524158cd [main]
```
[MEASURED] Dev-tree worktree admin dir: `po-vg  locked=False  gitdir=C:/PR-Master/worktrees/po-vg/.git`
— **no worktree lock anywhere**, so there is no orphaned-lock freeze this run.

Stashes, counted with `(…).Count` over a null-guarded array (§9.4 — never `Measure-Object -Line`,
never a bare `@(…).Count`): dev tree **1**, watcher clone **77**. [MEASURED]

Worktree roots on disk: `C:\po-worktrees` → 1 (`po-fix-2005`) · `C:\po-wt` → 0 ·
`C:\po-watcher-worktrees` → ABSENT · `C:\PR-Master\worktrees` → 1 (`po-vg`). [MEASURED]

### The board trap, and the queue root

```
git ls-tree -r --name-only origin/main -- docs/pr-prompts/     (trailing slash + -r, §9.2)
  tracked under docs/pr-prompts (recursive) = 1294
  depth-1 tracked files                     = 29
  depth-1 tracked *-ready.md                = 0
on-disk depth-1 files                       = 36
on-disk depth-1 *-ready.md                  = 0
on-disk depth-1 *-HOLD.md                   = 20
```
POSITIVE CONTROL that the `ls-tree` query can return something: `-- CLAUDE.md` → **1**, and the
recursive count is 1294 rather than the one-line tree entry §9.2 warns about. [MEASURED]

Untracked depth-1 files = **7**, and `git check-ignore -v` **on each file** (never on a directory —
§9.2) splits them cleanly:

| file | check-ignore | reading |
|---|---|---|
| `pr-fv2-import-s2-review-route-b-ready.md.log` | exit 0, `.gitignore:26:*.log` | ignored — invisible to `git status` forever |
| `pr-fv2-import-s2-review-route-c-ready.md.log` | exit 0, `.gitignore:26:*.log` | same |
| `pr-scopecards-s1-operational-costs-priced-b-ready.md.log` | exit 0, `.gitignore:26:*.log` | same |
| `pr-scopecards-s4a-push-by-destination-api-b-ready.md.log` | exit 0, `.gitignore:26:*.log` | same |
| `rev-2016-ready.md.usage-limit.log` | exit 0, `.gitignore:26:*.log` | same |
| `queue-watch-state.md` | exit 1, empty | **NOT ignored** — sits `??` and nothing commits it |
| `.queue-sync-ledger.txt` | exit 1, empty | **NOT ignored** — same |

NEGATIVE CONTROL for that table: `CLAUDE.md` — a tracked file that genuinely is not ignored —
returns **exit 1, empty**, byte-identical to the last two rows, which is exactly §9.2's warning that
the silence carries no information. The discriminating readings are the five **exit 0** rows.
[MEASURED]

### Remote-tracking refs — the dev tree's cache against the remote

```
git ls-remote --heads origin                        =  20   (the truth; 19 non-main + main)
git branch -r                                       = 110
git for-each-ref refs/remotes  ->  origin/* = 87 · pr/* = 13 · other = 10
git remote -v                                       -> origin ONLY (fetch + push)
git fetch origin --prune --dry-run  (WRITES NOTHING) -> 66 refs would be deleted
```
[MEASURED] The 10 "other": `refs/remotes/pr1273` and **nine `refs/remotes/staleprobe/*`**
(`staleprobe/chore/sweep-breadcrumbs-20260907-0934`, `staleprobe/feat/crm-account360-v2-s1`,
`staleprobe/feat/verdict-home-resolver`, `staleprobe/feat/verdict-home-resolver-v1`,
`staleprobe/fix/classify-policy-nested-tests`, `staleprobe/fix/verdict-home-resolver-v1`,
`staleprobe/fix/verdict-home-resolver-v1-impl`, + 2 more).

⚠️ **These counts are STATE — re-measure them, never quote them.**

### Branches merged but not deleted — every non-main head crossed against the board

`gh pr list -R GH-Mantova/ProjectOperations --head <branch> --state all --limit 20 --json
number,state,mergedAt`, with `-R` on every call and `$LASTEXITCODE` tested before parsing (§9.4's
CWD bullet), one call per branch so no `--limit` truncation is possible:

| state | count | branches |
|---|---|---|
| **OPEN** | 5 | `feat/crmvis-s8-comms-threads` #2044 · `feat/ops-m2b-tipping-review` #2051 · `feat/role-grant-registry-v1` #2047 · `feat/scopecards-s4b-push-panel-ui` #2042 · `fix/lintstation-contract-version-compare` #2049 |
| **MERGED** | 4 | `chore/sweep-breadcrumbs-20260907-0934` #1778 · `docs/st00-collect-2026-09-14-1108` #1927 · `feat/ea-gate-reporting-team-permission` #1823 · `fix/no-rebase-while-checks-run` #1577 |
| **CLOSED-unmerged** | 9 | `docs/slice-0-scope-cards-plan` #1871 · `feat/crm-account360-v2-s1` #1612 · `feat/ratescol-s2-column-settings-move-delete` #1960 · `feat/ratescol-s3-grid-add-column-row-guided-step` #1978 · `feat/verdict-home-resolver` #1703 · `feat/verdict-home-resolver-v1` #1707 · `fix/classify-policy-nested-tests` #1571 · `fix/verdict-home-resolver-v1` #1708 · `fix/verdict-home-resolver-v1-impl` #1705 |
| **NO PR** | 1 | `fix1483` |

The 5 OPEN heads reconcile exactly with the sweep's `[LIVE] OPEN PRs: 5`.
NEGATIVE CONTROL, a freshly minted branch name that cannot exist: `negExit=0 rows=0` — so
`NO PR` on `fix1483` is a real absence and not a broken probe, and the 18 rows that returned PRs are
the positive control. [MEASURED]

### HOLD files whose work has already shipped

`scripts/pipeline/triage-holds.ps1` (read-only, delegates to `lint-prompt.mjs` per HOLD), exit **0**:

```
=== queue triage -- 20 prompt(s) at depth 1: HOLD=20, ready=0, LOOPING=0 (rev-* excluded)
=== TOTALS  spent=0 of 20 evaluated  gates-satisfied=3  still-gated=17  unreadable=0
    This script re-probed those 17 REJECT(s) directly: 0 spent behind a REJECT,
    17 still needed, 0 UNMEASURABLE.
```
POSITIVE CONTROL, quoted verbatim from the script's own output:
`SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture, so the SPENT bucket is
measurable.` **So `spent=0` is a real zero, not a blind instrument.** [MEASURED]

### Two hypotheses this run formed and then killed on its own evidence

Recorded because §7 says the dangerous output is a confident wrong finding, and both of these were
one measurement away from being filed:

1. **"`status-sweep.ps1` reports `po-fix-2005 size=0KB` — that is §9.1's trailing-wildcard trap."**
   **REFUTED.** Both forms agree at zero: `Get-ChildItem <bare> -Recurse -File -Force` → **0 files**
   and `Get-ChildItem "<dir>\*" -Recurse -File -Force` → **0 files**. POSITIVE CONTROL that the bare
   form works on this build: the same query over `C:\ProjectOperations2\scripts\pipeline` → **91
   files**. The directory genuinely holds **6,079 subdirectories and zero files**. `0KB` is correct.
2. **"The `po-vg` worktree's uncommitted file already shipped, so the PRESERVE warning is spent."**
   **REFUTED, and in the direction that matters.** The path does exist on `main`, which is what
   suggested it — but the blobs differ:
   `git hash-object` in the worktree → **`9c4587fb`**;
   `git rev-parse origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` → **`84ec92d4`**.
   Content compared, never size, and never across the boundary (§9.3). **The warning is LIVE.**

### Read but not measured

Watcher clone is at `524158cd` while `origin/main` is `939c77bc` — clone drift. That is Station 03's
lane and I did not probe it further. Sweep §2 also reads `watcher clone: branch=main dirty=5 <-- the
watcher may refuse to start`; DOCTRINE §9.5 records that flag as untracked-inclusive and both of its
conjuncts as false, so I did not treat it as a finding. [INFERRED from the sweep line + §9.5]

---

## WHAT CHANGED

**Nothing on the board. Nothing merged, nothing armed, nothing labelled, nothing deleted, no PR
opened, no prompt staged.** 04 is read-only on the board and this was a report-only sweep.

Two writes, both outside the board:

1. `docs/pipeline/sweep-rotation.json` — advanced to `last_index=2`,
   `last_run_utc=2026-09-21T18:09:53Z`. Read back: `git status --porcelain` → ` M
   docs/pipeline/sweep-rotation.json`. **LEFT DIRTY BY INSTRUCTION — Station 00 commits it.**
2. This breadcrumb, written to the dev tree at a tracked path. Untracked until swept up.

`git fetch origin --prune` was run **`--dry-run` only**. No ref was deleted.

---

## FINDINGS

### F1 — The dev tree's remote-tracking cache is 110 refs against a remote of 20, and 23 of them are in a class no `--prune` can ever reach — one of which DOCTRINE §9.2 does not name

`git branch -r` = **110**; `git ls-remote --heads origin` = **20**. §9.2 already records both halves
of this trap, and both reproduced: `--prune` **would** clear the `origin/*` rot (dry-run: **66**
refs), and it **cannot** touch the remainder, because `git remote -v` shows exactly one configured
remote (`origin`) and `remote.origin.fetch` owns no refspec covering the other 23:
`refs/remotes/pr/*` (13) · `refs/remotes/pr1273` (1) · **`refs/remotes/staleprobe/*` (9)**.

**§9.2's bullet names only the `pr/N` class.** `staleprobe/*` is a second hand-made namespace with
the same property — permanently un-prunable, invisible to `git remote -v`, and counted by
`git branch -r` — and a reader who prunes, re-reads `branch -r`, and sees a number still far above
the remote will conclude the prune failed. That is the same "prune is not authoritative" reading
§9.2 exists to give, arriving from a namespace the bullet does not list. Every one of the nine
`staleprobe/*` names matches a branch in the CLOSED-unmerged column of F2, so this looks like the
residue of a stale-branch investigation that fetched into its own namespace and never cleaned up.

**The cost is not disk.** It is that `git branch -r` is the natural instrument for "which branches
still exist", it over-reports by 5.5x here, and §9.2's recorded remedy only closes three quarters of
the gap. Pruning is a ref mutation in a shared tree, which is outside my lane.

**DISPOSITION: DISPATCHED** — to Station 03 for the prune of the 66 `origin/*` refs in the dev tree,
and to Station 00 for the one-clause DOCTRINE §9.2 addition naming `staleprobe/*` alongside `pr/*`
as a namespace `--prune` can never reach. Falsifying probe for the doc change: `git for-each-ref
--format='%(refname)' refs/remotes` in `C:\ProjectOperations2`, bucketed by namespace, against
`git ls-remote --heads origin` — if `staleprobe/*` is ever 0 while `pr/*` is non-zero, the addition
is unnecessary.

### F2 — Four merged branches survive on the remote; nine closed-unmerged ones must NOT be deleted with them; one has never had a PR at all

Measured per-branch against the board with controls (table above). The sweep's named target
"branches merged but not deleted" is **4**: `chore/sweep-breadcrumbs-20260907-0934` (#1778),
`docs/st00-collect-2026-09-14-1108` (#1927), `feat/ea-gate-reporting-team-permission` (#1823),
`fix/no-rebase-while-checks-run` (#1577).

🔴 **The finding is the adjacent nine, not the four.** A "delete merged branches" pass that reaches
for `git branch -r --merged origin/main` gets a wrong answer twice over: §9.2 records that form is
blind to squash merges, which is *every* merge in this repo, and the 9 CLOSED-unmerged heads sit in
the same listing looking equally dead. They are not. `feat/crm-account360-v2-s1` is **#1612**, the
subject of the standing escalation `pr-1612-closed-unmerged-branch-holds-the-only-copy` — a branch
whose whole significance is that deleting it destroys the only copy of its work. Seven of the nine
are `verdict-home-resolver` variants from the kill-loop DOCTRINE §9.5 records, where four PRs were
closed unmerged and one merged; which of the four closed heads carries anything not in the merged
one is **[CANNOT MEASURE]** from a branch listing alone.

`fix1483` returned **NO PR** against a negative control of 0 rows, so it has genuinely never been on
the board. Unclassified — it may be a hand-made fix branch nobody opened, or the last copy of
something.

Branch deletion is irreversible (DOCTRINE §5.4), so nothing here is mine to act on, and RULE 1's
complete-and-additive option is the one that does not destroy data.

**DISPOSITION: ESCALATED.** The question for Marco, with the complete-and-additive option first:

- **(a) Delete only the four MERGED heads; leave all nine CLOSED-unmerged and `fix1483` standing,
  and open one issue per closed head asking whether its work exists elsewhere.** Solves the stated
  problem completely (the four are provably redundant — their commits are on `main`), and damages
  nothing, because no branch holding unique work is touched. Costs: the listing stays long until the
  nine are individually resolved.
- **(b) Delete the four MERGED heads and the nine CLOSED ones.** Fails the second half of RULE 1 —
  it destroys the only copy of at least #1612's work, which is already an open escalation.
- **(c) Delete nothing.** Fails the first half — the rot grows and `git branch -r` keeps lying by 5.5x.

### F3 — The 17-day-old orphaned worktree holds a file that DIVERGES from the shipped one, so `--force` would discard real content

`C:/PR-Master/worktrees/po-vg` @ `23c91ba9` on `fix/no-rebase-while-checks-run`, **age 25,097 min
(~17.4 days)**, `locked=False`. Its single uncommitted item is
`?? scripts/pipeline/check-pipeline-heartbeat.mjs`.

The obvious reading — *"that file is on `main` now, the warning is spent, prune it"* — is **wrong**,
and this run nearly wrote it. The path is on `main`, but the blobs differ: worktree `9c4587fb`
against `origin/main` `84ec92d4`. So the worktree carries a divergent draft of a script that has
since shipped in a different form. `git worktree remove` will refuse; `--force` would discard it
silently and with no error, which is the shape §9.6 warns about applied to deletion.

Its branch `fix/no-rebase-while-checks-run` is **#1577, MERGED** (F2), so the *branch* is redundant
while the *uncommitted file* is not — the two halves of this worktree have opposite dispositions,
which is precisely why a blanket prune is wrong here.

**DISPOSITION: DISPATCHED** to Station 03, with the two blob hashes so the decision is made on
evidence rather than on the path existing: diff `9c4587fb` against `84ec92d4`, and if the worktree
copy carries nothing the shipped file lacks, remove the worktree; otherwise commit the difference
somewhere durable first. **Do not `--force` before that diff is read.**

### F4 — `C:\po-worktrees\po-fix-2005` is a hollow skeleton of 6,079 directories, and `size=0KB` is true but reads as "empty"

Registry escapee, **age ~5,912 min (~4.1 days)**, `.lock=False`, in no `git worktree list`. Contents
at depth 1: `apps`, `node_modules`, `packages`. Recursively: **6,079 directories, 0 files** — both
the bare and trailing-wildcard forms agree, against a positive control of 91 files on a directory
known to hold some. The sweep's `size=0KB` is **correct**, and §9.1's wildcard trap did **not** fire.

The residual is a reading problem rather than an instrument one: `size=0KB` invites "there is
nothing there", when what is there is 6,079 directory entries left by a teardown that removed the
files and not the tree. Harmless to disk, not harmless to the next `Get-ChildItem -Recurse` that
walks that root.

**DISPOSITION: DISPATCHED** to Station 03 as a prune candidate — zero files means nothing can be
lost, which makes this the one deletion in this breadcrumb that is safe on its face. Station 03
should re-measure the file count immediately before removing, because the verdict expires (§7's
`[LIVE]` rule).

### F5 — The watcher clone's stash loop is still closed and still growing: 77

DOCTRINE §9.2 records `git stash` in the clone as a closed loop — the launcher's preflight stashes
on every start and nothing ever pops — and instructs stations to report the count and its growth.
Measured this run: clone **77**, dev tree **1**. §9.5 records the clone at **71** on 2026-09-10 and
explicitly tags that figure as state to re-measure rather than quote; re-measured, the growth is
**+6 in ~11 days**, which is the loop behaving exactly as documented and nobody draining it.

No reading in this run depends on the stash count, so this is a slow leak rather than an active
defect. It becomes urgent if a stash ever collides with the clone's auto-stash self-heal path
(§9.5's `start-watcher.ps1` anchor `# --- Self-heal: AUTO-STASH a dirty tree instead of exiting 1 ---`),
because that path's receipts are these same stashes.

**DISPOSITION: DISPATCHED** to Station 03 — `git stash drop`, **never `pop`** (§9.2). Not mine to
run, and not urgent.

### F6 — `status-sweep.ps1` quotes a 21-day-old untracked file into every station's preflight as "freshest station summary"

Seven untracked files sit at depth 1 of the queue root. Five are `*.log` artefacts ignored by
`.gitignore:26:*.log` — so they are structurally invisible to `git status`, no sweep will ever
surface them, and nothing will ever commit or remove them. Litter, and cheap to leave.

🔴 **The two that are NOT ignored are the finding.** `queue-watch-state.md` and
`.queue-sync-ledger.txt` return `check-ignore` exit 1 — untracked *and* unignored — so they show as
`??` in every `git status` forever and nothing commits them. And `status-sweep.ps1` §4C selects
`queue-watch-state.md` as **`[FILE] freshest station summary`** and prints ~20 lines of its body
into every sweep this pipeline runs. The sweep dates it **08-31 20:26Z — 21 days old.**

The content it surfaces is a station run's *state*: an open board of four PRs, `#1443 #1450 #1457
#1460`, all described as Marco's. **Today's board is five PRs, `#2042 #2044 #2047 #2049 #2051`.**
Every one of the quoted numbers is three weeks dead. The sweep tags the block `[FILE]` and its own
header says *"a SNAPSHOT by whoever last ran; verify claims against GitHub"*, so the instrument is
honest — but §1 of `STATION-CAPABILITIES.md` is that a stale instruction reads exactly like a
current one, and this is twenty lines of confident three-week-old board state printed at the top of
every run, above the `[LIVE]` section that contradicts it. The file is untracked, so it is also
invisible to CI, to `origin/main`, and to any cloud lane.

This is the "superseded prompt files littering the queue root" target of this sweep, with a
consequence attached: the litter is not inert, it is being read aloud.

**DISPOSITION: DISPATCHED** to Station 00. Two separable pieces, and the first is the cheap one:
(i) `status-sweep.ps1` §4C should refuse to quote a "freshest station summary" older than some
stated age and say `[STALE] no station summary younger than N days` instead — the sweep already has
the mtime it would need, since it prints it; (ii) whether `queue-watch-state.md` and
`.queue-sync-ledger.txt` should be tracked, ignored, or moved under `docs/pr-prompts/reports/` per
DOCTRINE §8.5 is a queue-layout question and 00's to settle. Falsifying probe for (i): read
`(Get-Item docs\pr-prompts\queue-watch-state.md).LastWriteTimeUtc` and compare against the date the
sweep prints beside it — if that file is ever younger than the newest breadcrumb, this finding is
about a one-off rather than a structural gap.

### F7 — CLEAN, with the controls that prove the instruments could have said otherwise

Two of this sweep's six named targets are genuinely clean, and per §7 a zero is worth nothing
without a demonstrated positive:

- **The board trap — tracked `*-ready.md` at depth 1: ZERO.** Positive control: the same `ls-tree
  -r` with a trailing slash returns **1,294** tracked files under `docs/pr-prompts` and **29** at
  depth 1, and `-- CLAUDE.md` returns 1, so the query is alive and is not hitting §9.2's one-line
  tree-entry or glob-pathspec traps. On-disk depth-1 `*-ready.md` is **0** as well, so this is not a
  tracked-vs-ignored artefact. Nothing on the board can be re-armed by a checkout today.
- **Spent HOLD files on `main`: ZERO of 20.** Positive control quoted from the script itself —
  `SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture, so the SPENT bucket is
  measurable` — plus a direct re-probe of all 17 REJECTs finding 0 spent behind a reject and 0
  unmeasurable. The queue is carrying no prompt whose work has already shipped.

**DISPOSITION: ACTIONED** — verified clean this run, with controls, and recorded so the next
`repo-hygiene` sweep can see what the baseline was rather than re-deriving it. Both readings are
`[LIVE]`-class and expire; re-measure before relying on either.

---

## WHAT I DID NOT DO

- **Did not prune, delete or force-remove anything** — not the 66 prunable refs, not the four merged
  branches, not the `po-vg` worktree, not the `po-fix-2005` skeleton, not one stash, not one loose
  `.log`. The sweep brief says REPORT ONLY and "no agent bulk-deletes"; branch and worktree deletion
  is irreversible under DOCTRINE §5.4. `--prune` was run `--dry-run` only.
- **Did not stage a prompt.** My budget is two and I used zero. F1's ref prune and F4's skeleton are
  Station 03 operations rather than repo changes, F2 needs Marco's decision before anything can be
  written, and F6's `status-sweep.ps1` fix is a `scripts/` change — writing that prompt before 00
  has chosen between (i) and (ii) would stage a design I was not asked to settle (RULE 3).
- **Did not commit `sweep-rotation.json`** — 04 may not commit to the dev tree, which is on `main`.
  Named above so 00 sweeps it.
- **Did not mint a worktree** to get a clean read. Everything was read from `origin/main` via
  `git show` / `rev-parse` / `ls-tree` in the dev tree, per AUTHORITY.
- **Did not run Part 2 (live-site patrol) or the Dependabot pass.** The rotation gave this run
  `repo-hygiene` and the station doc says take ONE named sweep and cover it completely; a shallow
  pass over everything is what it forbids.
- **Did not touch the watcher clone, `/sot/`, any label, or Azure / Entra / SharePoint.**
- **Left the clone's drift alone** (`524158cd` vs `origin/main` `939c77bc`) — Station 03's lane, and
  noted under WHAT I MEASURED rather than filed as mine.
