# Station 04 — Scanner | 2026-08-29T18:10:38Z–2026-08-29T18:35Z

## GROUND

```
UTC            2026-08-29T18:10:38Z
origin/main    77da3517            (git fetch origin, then rev-parse origin/main)
dev tree       main @ 1501d09c     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md via git show origin/main:)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — not restricted to read-only by the mismatch rule. Read-only anyway: 04 is
read-only on the board by authority.

**SWEEP: `repo-hygiene`** — `node scripts/pipeline/next-sweep.mjs` → `SWEEP: repo-hygiene`,
`(rotation position 3 of 4; previous run: 2026-08-29T14:22:00Z)`. Not chosen; read from
`docs/pipeline/sweep-rotation.json`.

`status-sweep.ps1` @18:11:49Z → **`SAFE TO ACT`**, exit 0. **Desktop Commander was present the
whole run — this was NOT a blind run.**

🔴 **Read this run against `00-04-scanner-2026-08-29-0211-repo-hygiene-local-refs-lie-about-the-remote.md`**,
the previous `repo-hygiene` turn, 16 hours ago. **Four of its dispatches are still open and every
one has grown.** Half of what follows is a re-raise with a growth measurement, and is labelled as
such rather than presented as new.

## WHAT I MEASURED

All probes ran on the Windows host via Desktop Commander `interact_with_process`
(`powershell.exe`), cwd `C:\ProjectOperations2` unless stated.

### Board trap — CLEAR, with positive controls on both sides

- `git ls-tree --name-only origin/main -- docs/pr-prompts/` → **222** depth-1 entries; of those,
  `*-ready.md` = **0**.  **[MEASURED]**
- POSITIVE CONTROL, same query: `PROMPT-SCHEMA.md` present → `True`. The zero is a zero, not a blind
  read (DOCTRINE §9.6).  **[MEASURED]**
- Dev tree on disk: `*-ready.md` at depth 1 → **0 armed**. POSITIVE CONTROL, same directory:
  `*-HOLD.md` → **84**.  **[MEASURED]**

### The queue root is inert to the watcher — proved from source, not assumed

- 222 depth-1 tracked entries on main: **61 `-HOLD`**, **0 `-ready`**, **146 breadcrumbs** (`00-*`),
  8 state/template files, 5 subtrees, 2 non-md.  **[MEASURED]**
- `scripts/pr-watcher/index.mjs:2777` logs `pattern:     (pr|rev)-*-ready.md`; `:1159` "Collect
  every *-ready.md currently on disk", via a **non-recursive** `readdirSync`. Breadcrumbs, `-HOLD`
  files and suffix-less `pr-*.md` at the root **cannot be picked up**.  **[MEASURED]**
- Subtrees on main (`ls-tree -r`): `superseded/` **247**, `archive/` 41,
  `binned-shipped-20260720/` 37, `needs-marco/` 1, `processed/` 1. Total under `docs/pr-prompts/`
  = **544**.  **[MEASURED]**
- NEGATIVE CONTROL: the same `superseded/` query **without `-r`** returns **56**, not 247 —
  DOCTRINE §9.2's `ls-tree` trap still reproduces exactly.  **[MEASURED]**
- **0 filename collisions** between the live root and `superseded/`; `git log` on `superseded/`
  shows an active retirement discipline (#1392, #1300, #1291, #1278, #1247, #1235, #1211…).
  **This half of repo hygiene is healthy** — reported as a positive result, not a silence.
  **[MEASURED]**

### Locks and stash

- `git worktree prune --dry-run -v` → **empty** in both the dev tree and the watcher clone.
  No `locked` file in any of the four `.git/worktrees/<name>/` admin dirs. **Neither**
  `C:\ProjectOperations2\.git\index.lock` **nor** `C:\po-watcher\ProjectOperations\.git\index.lock`
  exists.  **[MEASURED]**
- Stash: dev tree **11**, watcher clone **51**.  **[MEASURED]**
- Watcher clone `HEAD` `181817aa`; `rev-list --left-right --count 181817aa...77da3517` → **`0 18`**.
  **[MEASURED]**

### One instrument failure of my own, reported not buried

I tried to run two prompt premises and got `The term 'grep' is not recognized`. That is my shell,
not the pipeline: `lint-prompt.mjs:1058` runs premises via `execSync(cmd, { shell: BASH })` and
`:1069` treats `status === -1` (spawn failure) as broken rather than false. **No finding — the
correct attribution is PowerShell, and DOCTRINE §7 lie #3 is still guarded in the linter.**
**[MEASURED]**

## WHAT CHANGED

Two writes, both mine, both outside the board:

1. This breadcrumb, tracked path
   `docs/pr-prompts/00-04-scanner-2026-08-29-1810-dev-tree-carries-23-holds-main-retired.md`.
   **Untracked until a board PR commits it** — 00 sweeps it up.
2. `docs/pipeline/sweep-rotation.json` advanced `last_index` 1 → 2, `last_run_utc` →
   `2026-08-29T18:10:38Z`. Read back: `advanced: last_index=2 last_run_utc=2026-08-29T18:10:38Z`,
   exit 0. **Commit it with this breadcrumb or the next run repeats repo-hygiene.**

**No board mutation.** Nothing armed, disarmed, renamed, moved or deleted. `git diff --cached
--name-status` was empty before and after.

**Breadcrumb validated:** `node <origin/main's check-breadcrumb.mjs>` from the repo root →
`ADMIT   00-04-scanner-2026-08-29-1810-dev-tree-carries-23-holds-main-retired.md`,
`structure: 98 checked, 0 malformed`, **`CLEAN`**, **exit 0**. It also correctly printed
`NOTE ... is UNTRACKED — it reaches nobody until a board PR commits it`. I ran **main's** copy on
purpose: the dev tree's copy is a different blob (`e9ff8f4e` vs `a97311ca`, 31 insertions behind) —
itself an instance of F1.

## FINDINGS

### F1 [S2] NEW — the dev tree, the tree the watcher globs, still carries 23 HOLD prompts that `main` has retired

`origin/main` has 61 depth-1 `-HOLD`; the dev tree has **84 on disk**, and only **1** of the
difference is untracked. The other 23 are tracked files still at the queue root because the dev tree
is **8 commits behind**: `rev-list --left-right --count 1501d09c...77da3517` → **`0  8`** — zero
local commits, eight missing.  **[MEASURED]**

**All 23 are in `docs/pr-prompts/superseded/` on `origin/main`** — 23 of 23, matched by filename
against the `-r` listing — retired by **#1392** `docs(board): retire 23 premise-dead HOLDs to
superseded/`.  **[MEASURED]** They are `pr-dns-s1..s4`, `pr-guard-s1..s3`,
`pr-lint-armed-gate-inversion`, `pr-lint-human-gate-blindness`, `pr-lessons-folder-s2/s3`,
`pr-crm-lastmile-s1`, `pr-crm-s2-nav-three-items-tabs`, `pr-crm-tender-count-truth`,
`pr-crm-wincount-s2-close-bypasses`, `pr-comms-hub-inbox`, `pr-ew-s2b-alloc-engine-core`,
`pr-sot-02-reconcile-2026-08-19`, `pr-station-contract-breadcrumb-validator-and-qa-claim`,
`pr-breadcrumb-gitignore-gate-routing-not-mention`, `pr-ci-windows-pipeline-tests`,
`pr-pipeline-fold-s2-merged-page`, `pr-queue-bin-guard-orphaned-discharge` (all `-HOLD.md`).

**Not an execution hazard today** — all 23 are `-HOLD` and the watcher globs only
`(pr|rev)-*-ready.md`. **It is an ARMING-SURFACE hazard.** Arming is a `git mv` of a tracked
`-HOLD.md` **in the dev tree**, and arming state is read from the dev tree by instruction. Renaming
any of those 23 arms a prompt `main` has already declared premise-dead — the board trap wearing a
`-HOLD` suffix instead of a `-ready` one.

Second consequence, measured: `status-sweep.ps1` warns that `sweep-rotation.json` "is modified and
must be committed". Against the dev tree's HEAD it is (`last_index` 0→1); **against `origin/main`
that change is already landed.** The warning is an artifact of the lag. A third: the dev tree's
`check-breadcrumb.mjs` is 31 insertions behind main's, so a station validating with the local copy
runs a superseded validator.

**Cure is a pure fast-forward and it is additive** — RULE 1, both halves pass. 0 local commits,
empty staged index; the only working-tree modifications are `sweep-rotation.json` (a strict advance,
1→2) and `metadata-catalog.json` (`git diff --numstat` prints **nothing** for it — a pure CRLF stat
artifact; **do not "fix" it**). `git merge --ff-only origin/main` loses nothing and resurrects
nothing. 🔴 **Do NOT reach for `git checkout .` / `reset --hard` / `stash pop` / `git clean`** —
those are the board trap and would re-arm consumed work.

**DISPATCHED** → Station 00. Dev-tree convergence ownership is already an open question; this is its
first measured consequence and belongs attached to that, not opened as a new escalation.

### F2 [S2] THIRD REPORT — `docs/pr-prompts/no-pr-opened/` is still not gitignored, and it holds 9 armed prompts one pathspec-less commit away from `main`

Reported 2026-08-25. Re-reported 2026-08-29T02:11 (that run's F3, DISPATCHED to 00 with the exact
edit). **Still unfixed at 18:10Z.**

- `git check-ignore -v docs/pr-prompts/no-pr-opened/<file>` → **exit 1 (NOT ignored)**.
  POSITIVE CONTROL on `docs/qa/qa-findings.md` → `.gitignore:107`, **exit 0**. The instrument works;
  the folder really is unignored. (I probed a **file** inside, never the directory — DOCTRINE §9.2's
  own trap.)  **[MEASURED]**
- `git ls-tree -r origin/main -- docs/pr-prompts/no-pr-opened/` → **0**. Nothing tracked there *yet*.
  `git status --porcelain` shows **`?? docs/pr-prompts/no-pr-opened/`**.  **[MEASURED]**
- The folder holds **9 real `-ready.md` prompt files** (plus ~100 `.log` files):
  `pr-rates-s11c-drop-legacy-tables-ready.md`, `pr-rates-drop-prompt-corrections-ready.md`,
  `pr-rates-consumers-s2-tendering-ready.md`, `pr-rates-consumers-s3-persona-export-ready.md`,
  `pr-comms-hub-inbox-ready.md`, `pr-ci-cache-playwright-browsers-ready.md`,
  `pr-crm-leads-s6-reason-admin-settings-ready.md`, `pr-e2e-container-s1-trial-workflow-ready.md`,
  `pr-field-location-provider-seam-ready.md`.  **[MEASURED]**

**Why it is S2, and why `.gitignore:75` does not save you.** Line 75 is
`docs/pr-prompts/*-ready.md`, and a gitignore `*` does not cross `/` — it covers **depth 1 only**.
Every other watcher retirement folder has its own rule at `.gitignore:76-82` (`processed/`,
`failed/`, `paused/`, `blocked/`, `awaiting-review/`, `reviewed/`, `needs-marco/`). **`no-pr-opened`
appears in `.gitignore` zero times.**  **[MEASURED]** So a pathspec-less `git add -A` in the shared
dev tree publishes nine armed `-ready.md` files to `origin/main` as tracked — **including
`pr-rates-s11c-drop-legacy-tables-ready.md`, a destructive DROP-TABLE prompt.** That is the standing
board trap, loaded and pointed at the board.

**The complete-and-additive cure is one line** (RULE 1, both halves): insert
`docs/pr-prompts/no-pr-opened/` after `.gitignore:82`. It removes nothing from `main` (0 tracked
there), so no history and no data entry is disturbed, and it closes the hole permanently. The
alternative — deleting the folder's contents — fails the no-damage half: those nine files are the
watcher's record of runs that opened no PR.

**DISPATCHED** → Station 00. This is the third filing; if it does not land this turn it should go to
Marco as a process question rather than be measured a fourth time.

### F3 [S2] NEW — 04's repo-hygiene dispatches are not closing, and the backlog is measurably growing

Every dispatch from the 02:11Z repo-hygiene run is still open 16 hours later, and each has grown:

| 0211 finding | then | **now (18:10Z)** |
|---|---|---|
| F1 dead remote-tracking refs → 00: `git fetch --prune` | 25 | **33** |
| F3 `no-pr-opened/` not gitignored → 00 | unfixed | **still unfixed** (F2 above) |
| F4 four orphaned worktrees → 05 | 4 | **4** (F5 below — its stated blocker is now gone) |
| F5 `pr-doctrine-s9-four-false-traps-LOOPING.md` at queue root → 00 | present | **still present** |
| F6 local branches in the dev tree (DEFERRED) | 339 | **344** |

**[MEASURED]** — every row re-probed this run.

This is not a complaint about 00's throughput. It is a defect in the reporting chain the station
docs call "the only channel that closes": a station cannot distinguish **"00 read it and chose
DEFERRED"** from **"it was never read"**, so the only available move is to re-measure and re-file —
which is what the last two repo-hygiene turns have largely spent themselves doing. The cheapest fix
is that 00's collection pass records an explicit disposition **per inherited finding** in its own
breadcrumb, `DEFERRED` included, so the next 04 can cite it and spend its turn on unexamined ground.

**DISPATCHED** → Station 00 — deliberately **not** escalated to Marco. The fix needs a station with
collection authority, not Marco's judgement; calling it an escalation would be an escalation wrong
about *who* it needs.

### F4 [S3] RE-RAISE (0211-F1, grown 25 → 33) — `git branch -r` over-reports the remote by 2.5×, and cross-referencing it against the API inherits the lie

| instrument | answer | verdict |
|---|---|---|
| `git branch -r` | 54 non-main branches | **WRONG — 2.5× over** |
| `git branch -r --merged origin/main` | 1 | right by luck; structurally blind to squash merges |
| that 54-list ∩ `gh pr list --state all --limit 2000` | "31 merged-but-not-deleted, 21 closed, 2 no-PR" | **WRONG — inherits the stale list** |
| **`git ls-remote --heads origin`** | **22 = main + 21** | **the truth** |

**[MEASURED]**; POSITIVE CONTROL on `ls-remote`: `main` present → `True`. **33 of the 54 local
`refs/remotes/origin/*` are ghosts** — `git fetch` without `--prune` never removes a tracking ref.
Two of the "branches" the third instrument reported — `origin` and `pr1273` — **do not exist on the
remote at all.**

Corrected picture: of 21 real surviving non-main heads, **20 belong to CLOSED (abandoned) PRs** and
exactly **one** to a merged PR (`docs/retire-stale-queue`, #1145).
`gh api repos/GH-Mantova/ProjectOperations --jq .delete_branch_on_merge` → **`true`**, and the
evidence agrees: auto-delete is working, and the alarming "31 merged branches never deleted" was
entirely an artifact of unpruned local refs. Cure remains `git fetch --prune` in
`C:\ProjectOperations2` — non-destructive, touches no remote.

Measured en route: `gh pr list --limit 600` returned exactly 600 rows and gave a *different, wrong*
answer (45/9) from `--limit 2000` (1394 rows, lowest PR #1). A truncated list read as a complete one
— DOCTRINE §9.6, live, in my own hands.  **[MEASURED]**

Proposed DOCTRINE §9.2 (Git) addition — the trap is not in §9 yet and has now produced a confident
wrong answer on two consecutive repo-hygiene turns:

> ⚠️ **`git branch -r` reads the LOCAL remote-tracking cache, not the remote.** `git fetch` without
> `--prune` never deletes a tracking ref, so branches GitHub removed on merge live on locally
> forever — **54 reported against 21 real, measured 2026-08-29.** Cross-referencing that list
> against the GitHub API inherits the error and dresses it as a finding. **Ask the remote:
> `git ls-remote --heads origin`.** Separately, `git branch -r --merged origin/main` is blind to
> squash merges, which is every merge in this repo.

**DISPATCHED** → Station 00 for the `--prune`; **and** → Station 06 to stage the §9.2 line as a
`-HOLD`, folded with F6 (same file family, one PR). I did not stage it myself: adding a file to the
dev tree's queue root while F1 is open makes F1 worse, and prompt authoring is 06's.

### F5 [S3] RE-RAISE (0211-F4) — the four orphaned worktrees, and the blocker that run raised is now DISSOLVED

The 02:11Z run found four and routed two to Station 05 because they carried `/sot/` commits only 05
could adjudicate. **That adjudication is no longer needed. All four commits have already shipped**,
under squash SHAs:  **[MEASURED]**

| worktree | local commit | already on `main` as |
|---|---|---|
| `C:\po-worktrees\sot-d-register` | `407b93d2` register Marco's D1-D55 series in sot/05 | `e9074d97` (**#1287**); `sot/05` on main carries the register |
| `C:\po-worktrees\sot-readme-fetch` | `904fa4e8` sot/README fetch URLs → `?plain=1` | `ed26083a` (**#1299**); `sot/README.md` on main has 10 `plain=1` hits |
| `C:\po-worktrees\sotk-03-ledger` | `5db5a7c2` sot-03 merged-PR ledger #496-#1304 | `00d082d6` (**#1306**) |
| `C:\po-wt-h` | `edef9f59` disarm sor-s9, retire three shipped prompts | `5c8c8926` (**#1291**) |

Each is 1 ahead / 86–106 behind `origin/main`, and **none of the four branches exists on the
remote** — which is exactly why the first reading looked like "unique work, do not delete". It was
wrong, and acting on that reading either way without this table would have been a RULE-1 gamble. The
only content existing nowhere else is `po-wt-h`'s untracked `.cm.txt`, a commit-message scratch file.

Removal is `git worktree remove --force <path>` + `git worktree prune`, from the dev tree, and it
destroys no work.

**DISPATCHED** → Station 00, to dispatch 03 (worktree removal is machine repair; 03 is report-only
and 00 dispatches it — STATION-CAPABILITIES §5). **This also discharges the Station 05 half of
0211-F4**: 05 has nothing left to adjudicate.

### F6 [S3] NEW — six breadcrumbs are invisible to their own validator, and they are the six loudest ones

`check-breadcrumb.mjs` selects files with
`NAME_RE = /^00-(\d\d)-([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})-(\d{4})-([a-z0-9-]+)\.md$/` and reuses that
regex for the on-disk scan, the tracked scan, **and the `--freshness` station lookup** — the station
number comes from `f.match(NAME_RE)`.  **[MEASURED, from source on `origin/main`]**

The slug class is `[a-z0-9-]+`. Of 146 depth-1 files beginning `00-` on `origin/main`, **109 match,
37 do not**; POSITIVE CONTROL: a known-good name matches → `true`. Of the 37, 31 are pre-contract
names with no `NN` (expected). **Six use the mandated form and are still invisible, because their
slug contains capitals:**  **[MEASURED]**

```
00-00-supervisor-2026-08-25-0408-BLIND-no-dc-pr1314-marco-gated-watcher-live.md
00-00-supervisor-2026-08-25-1009-BLIND-no-dc-five-prs-all-marco-gated.md
00-00-supervisor-2026-08-25-1810-BLIND-no-windows-shell-all-8-marco-gated.md
00-00-supervisor-2026-08-26-0410-BLIND-no-dc-four-marco-gated-board-frozen-6h.md
00-04-scanner-2026-08-22-0820-WATCHER-DEAD-hibernate-no-restart.md
00-04-scanner-2026-08-22-1215-WATCHER-DIED-AGAIN-no-restarter-and-an-invisible-hold-prompt.md
```

Every one is a station shouting `BLIND`, `WATCHER-DEAD`, `WATCHER-DIED-AGAIN` — **and the shouting
is what made the file invisible.** Because `--freshness` enumerates only NAME_RE matches, a station
whose most recent breadcrumb carried a capital reads as **SILENT** rather than as having reported: a
false negative in the one instrument that detects a station going quiet, firing hardest exactly when
a station is in trouble.

Complete-and-additive cure (RULE 1): widen the *matching* class to `[A-Za-z0-9-]+` while keeping
lowercase as documented house style — historical files become visible, nothing currently passing
starts failing. The alternative, renaming the six files, fails the future half: the next station to
shout re-opens the hole.

**DISPATCHED** → Station 06, to fold into the existing `check-breadcrumb.mjs --freshness` fix
(0211-F2 found a different defect in the same file: it resolves tracked-ness against the local tree).
One PR, three cures.

### F7 [S3] Watcher-clone stash is 51, and the clone is 18 commits behind

`git stash list` in `C:\po-watcher\ProjectOperations` → **51**; dev tree → **11**.  **[MEASURED]**
DOCTRINE §9.2 records this as a closed loop — the launcher preflight stashes on every start and
nothing pops. **Growth rate is [CANNOT MEASURE] this run**: there is no earlier count in a tracked
artifact to difference against. That is why 51 is written down here — the next repo-hygiene turn can
difference against it.

Separately the clone is `0 ahead / 18 behind`, and §9.5 says **a restart adopts nothing**: the
watcher runs `index.mjs` from the clone, so its behaviour is 18 commits stale until the clone is
fast-forwarded. Who may fast-forward the clone is an existing open escalation; I am not resolving it.

**DEFERRED.** It becomes urgent the moment anyone expects a watcher restart to pick up a landed
watcher fix — then the FF is a precondition, not housekeeping.

### F8 [S4] Three prompts parked at the queue root in an undefined state

- `pr-permission-role-reconciler.md` (`size: 8`) and `pr-smoke-share-worker-tokens.md` (`size: 3`)
  are tracked on `origin/main` at depth 1 with complete front matter and **no `-HOLD` and no
  `-ready` suffix** — neither held nor armed, invisible to the watcher and to HOLD triage.
  `pr-smoke-share-worker-tokens`'s premise is **alive** (`api-tokens` absent from
  `tests/e2e/pr-acceptance/api-helpers.ts`)  **[MEASURED]**, so this is real work parked where
  nothing will look at it. The other's premise I could not run (`grep`; see WHAT I MEASURED).
- `pr-doctrine-s9-four-false-traps-LOOPING.md` is **still at the queue root** — 0211-F5 dispatched
  it to `superseded/` and it has not moved.  **[MEASURED]**

**DEFERRED** — whether the first two become `-HOLD` or go to `superseded/` is 06's call, and moving
prompts is not 04's. Flagged, not touched.

## WHAT I DID NOT DO

- **Staged no prompt**, though I am permitted one. F4 and F6 want the same file family and belong in
  one PR authored by 06, and adding a file to the dev tree's queue root while F1 is open makes F1
  worse. Naming them here with exact proposed text is the higher-value move.
- **Did not fast-forward the dev tree**, remove a worktree, drop a stash, prune a ref, edit
  `.gitignore`, or touch the watcher clone. All are board or machine mutations; 04 is read-only on
  both.
- **Did not re-lint the 61 depth-1 HOLDs.** That is the `gate-liveness` sweep; it ran on the 10:10Z
  turn and landed in #1392, and re-running it here is the shallow-pass-over-everything failure the
  rotation exists to prevent. `triage-holds.ps1` ran (exit 0) but covers only the shepherd-merge
  HOLDs — #545 and #548, both MERGED, open count 0.
- **Did not touch `/sot/`** (05's), Azure / Entra / SharePoint (nobody's, without Marco), or any
  production data.
- **Did not run `git` against the Linux mount** at `/sessions/*/mnt/ProjectOperations2` — Desktop
  Commander was present throughout, so the fallback was never needed and the `index.lock` hazard was
  never approached.
