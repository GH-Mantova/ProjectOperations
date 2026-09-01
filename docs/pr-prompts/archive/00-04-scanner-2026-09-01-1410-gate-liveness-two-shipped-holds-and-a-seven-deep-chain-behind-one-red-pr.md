# Station 04 — Scanner | 2026-09-01T14:10:41Z–2026-09-01T14:22Z

> ⚠️ **`origin/main` advanced inside this run: `3f021384` → `5b08e6ef` (`#1494`, docs(runbooks),
> merged by another actor).** Every measurement below is stamped at `3f021384`. **Re-checked at
> `5b08e6ef` before filing:** `#1494` is docs-only under `docs/runbooks/`, the depth-1 HOLD count is
> still **72**, tracked `-ready.md` at depth 1 is still **0**, and both prompts named in F1 and F2
> are still tracked on the new main. **No finding is invalidated.** See also F6 — a second actor was
> demonstrably active in this tree during the run.

## GROUND

```
UTC            2026-09-01T14:10:52Z
origin/main    3f021384            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 3f021384     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version: 1 in the scheduled-task file)
```

Doc version and bootstrap **agree** — full authority, not read-only.

Run was **SIGHTED**. `start_process` shell `powershell.exe` returned
`2026-09-01T00:10:41.3017133+10:00` / `LAPTOP-E6NHU4E4` on the first call. This was **not** a blind
run, and "no news" below is a measured quiet, not an unreachable box.

Dev tree HEAD **equals** `origin/main` at `3f021384`. `git status --porcelain` is 8 lines and
**every one is `??` (untracked)** — no tracked file is modified — so reading the working copy of
DOCTRINE, STATION-CAPABILITIES and this station's doc is byte-equivalent to reading `origin/main`.
Confirmed independently: `git diff --stat origin/main` over all three returned **empty**.

**Sweep this run: `gate-liveness`** — `node scripts/pipeline/next-sweep.mjs` →
`SWEEP: gate-liveness`, `(rotation position 1 of 4; previous run: 2026-09-01T10:10:55Z)`.

## WHAT I MEASURED

### Instrument controls, run before any negative conclusion (DOCTRINE §7)

- [MEASURED] **`$`-expansion control passed** — `interact_with_process` with `$CTRL=42` echoed
  `CTRL=42`. §9.1's exemption for `interact_with_process` still holds, so the persistent session is
  a safe place to write `$`.
- [MEASURED] **§9.1 reproduced first-hand in the same run.** A `-Command "... foreach ($fn in @(...))"`
  call died with `Missing variable name after foreach` and the echoed line showed `foreach ( in @(`
  — the token gone. Re-issued through `interact_with_process` and it ran. **The trap is still trapped.**
- [MEASURED] `git` and `gh` both resolve — `C:\Program Files\Git\cmd\git.exe`,
  `C:\Program Files\GitHub CLI\gh.exe`, git 2.55.0.windows.3. Required by §9.5 before any ADMIT is
  believed: the five gate probes shell `git`, and a `fixes_pr` verdict shells `gh`.
- [MEASURED] `triage-holds.ps1` self-controls: `GIT control: PASS` (read
  `origin/main:docs/pipeline/DOCTRINE.md`, 46137 chars) and `SPENT control: PASS` (lint emitted
  exit 3 on the fixture). **So `spent=2` below is a measured 2, not an artefact.**
- [MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` → **634** paths; positive
  control `-- CLAUDE.md` → `CLAUDE.md`. §9.2 obeyed: `-r`, trailing slash, no glob pathspec.
- [MEASURED] file-gate probe: `fileOnMain(CLAUDE.md)=true`, `fileOnMain(zz-bogus-qqzz.md)=false`.
- [MEASURED] premise runner: `pos=TRUE` / `neg=FALSE` / `missingfile=BROKEN` — all three buckets of
  `runPremise`'s own semantics proved reachable before any premise verdict was believed.
- 🔴 [MEASURED] **One of my own controls failed and I caught it.** I first ran the needle negative
  control as `zzzNoSuchTokenZzz` against DOCTRINE and it returned **1**, which reads as "the
  instrument cannot say NO". It is not a broken instrument: **that token is literally quoted in
  DOCTRINE §9.5** as the control from PR #1414's write-up. Re-run with `qqzz9917xyz` → **0**, with
  the positive `SHARED DOCTRINE` → **1**. *Lesson worth keeping: a negative control drawn from the
  pipeline's own doctrine text can be present in the corpus **because** doctrine records it.*

### Board state [LIVE], `status-sweep.ps1` at 2026-09-01T14:11:29Z

Verdict **SAFE TO ACT** — no board mutation in progress, no git `index.lock` in either tree, 0 git
processes, no PR touched in the last 2 min. Trunk **green** (4 success / 0 failed on `3f021384`).
Watcher node **RUNNING pid 28400**, wrapper alive (1), clone `dirty=0`. Armed `*-ready.md` **0**.
Open PRs **3**: `#1494` CLEAN 9/0/0 · `#1483` BLOCKED 11/3 red · `#1477` BLOCKED 12/2 red.

### The corpus, and the board trap

- [MEASURED] Depth-1 on `origin/main`: **92** files, of which **72 `-HOLD.md`** and
  🟢 **0 `-ready.md`**.
- [MEASURED] On disk: 91 `.md` at depth 1, **72 `-HOLD.md`**, **0 `-ready.md`**.
- [MEASURED] `Compare-Object` tracked-HOLD basenames vs disk-HOLD names → **empty**.
  🟢 **No tracked ready-file at depth 1 and no tracked HOLD with no file on disk. The board trap is
  clear**, and F4 of the 02:10Z run (two consumed HOLDs still tracked) is **verified discharged**.

### Every gate, evaluated against `3f021384`

`triage-holds.ps1` over all 72: **spent=2 · gates-satisfied=40 · still-gated=30 · unreadable=0**,
with 3 distinct verdicts observed on the board plus the fixture control — i.e. calibrated.

- [MEASURED] **42 `requires_*` gates across the 72.** 15 satisfied-or-n/a, **27 held**.
- [MEASURED] **`requires_merged` — 6 distinct PRs, every one released.** `#1317`, `#1348`, `#1351`,
  `#1257`, `#1111` all lint through to ADMIT; `#1361` (`pr-dns-s5`) rejects earlier on
  `HUMAN_GATE_PRESENT`, which fires at `lint-prompt.mjs:728` *before* any gate. **No
  `requires_merged` points at a CLOSED-unmerged PR.**
- [MEASURED] **`requires_file_on_main` and `requires_on_main` — 27 held, and I checked each for a
  producer still in the queue.** Only **5** have no producing prompt, and all 5 are the
  `docs/approvals/<slug>-approved-by-marco.md` markers, whose producer is **Marco, by design**
  (`docs/approvals/README.md` on main: *"Since nothing in any chain creates it, the only way it
  appears is a human landing it deliberately"*). 🟢 **There is no machine-dead gate on this board.**
- [MEASURED] The two chain gates I could not resolve from front matter alone both have live
  producers: `supervise-watcher.ps1 :: heartbeat-only` ← `pr-watchdog-dead-inprog-guard-HOLD.md`
  (ADMIT, its `done_when` greps that exact token) and `status-sweep.ps1 :: buildRunning` ←
  `pr-sweep-dead-queue-dir-reads-HOLD.md` (ADMIT). Controls on the same query: `classifyPolicyFiles`
  → `origin/main:scripts/pr-watcher/index.mjs:2`, `heartbeat-only` and `buildRunning` → 0.

### Unmasking the premises the gates hide

`lint-prompt.mjs` stops at the first failing gate and **never evaluates the premise**, so a gated
prompt whose work has already shipped is invisible to `triage-holds.ps1`. I ran all **30** still-gated
premises directly, reusing `lint-prompt.mjs`'s own `runPremise` semantics (Git-for-Windows
`bash.exe`, `cwd` = repo root, broken-vs-false discrimination on exit status) — legitimate here only
because the dev tree is byte-identical to `origin/main` for tracked content, proved above.

🟢 [MEASURED] **All 30 came back TRUE. No finished work is hiding behind a gate.**

### The `docs/approvals/README.md` claim, re-verified

- [MEASURED] The README asserts 3 of the 5 approval-gated prompts also carry a body marker.
  `triage-holds.ps1` independently reproduces it exactly: `pr-524-rates-b-slice2-canonical`,
  `pr-retire-tenderclientnote-s2`, `pr-siteid-notnull-backfill` → `HUMAN_GATE_PRESENT`;
  `pr-rates-s11c-drop-legacy-tables`, `pr-tenant-mt4-s2-ownership-migration` →
  `FILE_GATE_NOT_RELEASED`. **A doc claim that is still true at `3f021384`.**

### Carried findings from the 02:10Z gate-liveness run, re-checked

- [MEASURED] **F3 discharged** — `docs/pipeline/sweep-rotation.json` on disk is byte-identical to
  `origin/main` (`git status` clean for it). The advance is committed; `origin/main` is no longer a
  sweep behind.
- [MEASURED] **F4 discharged** — see the `Compare-Object` empty result above.
- [MEASURED] **F1 discharged** — `pr-statussweep-orphan-worktree-dirs-HOLD.md` is absent from both
  the tracked and the on-disk depth-1 sets (retired in `#1475`).

## WHAT CHANGED

**On the board: nothing.** Nothing was armed, disarmed, renamed, moved, deleted or merged. No PR was
touched. No `/sot/` file was read for edit. No git write ran in either tree.

Two writes, both outside the board:

1. `C:\po-sup-fix-scripts\scan-gates-2026-09-01.mjs`, `unmask-premises-2026-09-01.mjs`,
   `orphan-gates-2026-09-01.mjs` — read-only probes in the sanctioned scratch folder.
2. This breadcrumb, at the tracked path `docs/pr-prompts/`, and
   `docs/pipeline/sweep-rotation.json` advanced per the station contract (see F4 below).

I also ran `node scripts/data-model/build-relationship-map.mjs --check` once, as the control for F6.
It exited 0 (`293 models, 68 enums, 488 edges`) and [MEASURED] **wrote nothing** — the mtime of
`metadata-catalog.json` was byte-identical before and after (`2026-09-01T14:13:55.5496697Z` both
times). The station doc's description of `--check` as non-writing is confirmed, not assumed.

## FINDINGS

### F1 — `pr-crm-uifix-s1-cold-threshold-and-tab-shells-HOLD.md` has SHIPPED and is still on the board. **S3.**

Its premise is `! grep -q "CRM_COLD_V2" apps/api/src/modules/crm/accounts/accounts.service.ts`.
[MEASURED] the premise returns **FALSE** at `3f021384` (controls `pos=TRUE`/`neg=FALSE`/`broken=BROKEN`
all passed in the same invocation), and `triage-holds.ps1` independently classifies it **SPENT**
(lint exit 3). The shipping commit is named: `git log origin/main -S 'CRM_COLD_V2' --` →
**`515cb53e fix(crm): CRM UIFIX S1 — one cold threshold, one tab bar, one win-rate formatter
(CRM_COLD_V2) (#1486)`**, merged 2026-09-01 07:11Z. Two independent instruments, one commit.

**DISPATCHED → Station 00.** Retire it to `docs/pr-prompts/superseded/` in the next board PR,
naming `#1486`. Do **not** arm it. Note it did **not** exist as spent at the 02:10Z gate-liveness run
(`spent=0` there, and that zero was controlled), so this is new since 07:11Z, not a re-file.

### F2 — `pr-scopesub-s4-linked-items-and-quotes-HOLD.md` has SHIPPED and is still on the board. **S3.**

Same shape, same controls. Premise
`! grep -q "SUB_LINE_PRICES_LINKED_ITEM" apps/api/src/modules/tendering/scope-redesign.service.ts`
returns **FALSE**; `triage-holds.ps1` says **SPENT**. Shipping commit:
**`605aca10 feat(scope-sub): SUB line linkage and double-count guard
(SUB_LINE_PRICES_LINKED_ITEM) (#1478)`**.

⚠️ **This one is `escalates: true`, `size: 9`, `cluster: scope-subcontracted`, `cluster_order: 4`.**
Retiring it must not be read as retiring the cluster — `cluster_order: 5`
(`pr-scopesub-s5-sub-tab-ui-HOLD.md`) is still live and still needed. See F3.

**DISPATCHED → Station 00.** Retire to `superseded/` in the same board PR as F1, naming `#1478`.

### F3 — Seven HOLD prompts are transitively gated on one RED PR, `#1483`. **S3 — a throughput fact, not a defect.**

[MEASURED] `gh pr view 1483` → `feat(scope-s2): WBS item table shell and identity columns
(SCOPE_WBS_TABLE_V1)`, branch `feat/scope-s2-wbs-table-shell`, `mergeStateStatus: BLOCKED`, CI
**11 pass / 3 fail**. `gh pr diff 1483 --name-only` confirms it is the sole producer of
`SCOPE_WBS_TABLE_V1` in `ScopeQuantitiesTable.tsx`.

The gate chain, each link measured against `3f021384`:

```
#1483  SCOPE_WBS_TABLE_V1     -> pr-cardui-s3-manpower-columns
       SCOPE_WBS_MANPOWER_V1  -> pr-cardui-s4-plant-columns
       SCOPE_WBS_PLANT_V1     -> pr-cardui-s5-actions-and-expandables
       SCOPE_WBS_ACTIONS_V1   -> pr-cardui-s6-other-operational-costs
       SCOPE_OTHER_COSTS_V1   -> pr-cardui-s7-cutting-section
       SCOPE_CUTTING_V1       -> pr-cardui-s8-waste-section
                              -> pr-scopesub-s5-sub-tab-ui   (cross-cluster)
```

**Six `cardui` slices plus `pr-scopesub-s5` — 7 of the 30 still-gated prompts, 23% of the held
board — sit behind a single red PR.** The cross-cluster link is the part worth naming: `scopesub-s5`
lists **two** `requires_on_main`, and the first (`SUB_LINE_PRICES_LINKED_ITEM`) is already
satisfied — so the *only* thing holding the subcontracted cluster is `CuttingSection.tsx`, six
`cardui` slices away in a different cluster. Reading either cluster alone hides that.

**DISPATCHED → Station 00.** Two things follow. (a) `#1483` is the highest-leverage red on the
board — unblocking it releases seven prompts, and no other open PR releases more than zero.
(b) When 06 next stages a cross-cluster gate, the dependency deserves to be visible in **both**
prompts' `premise_means`, not only in the gate list of the downstream one.

### F4 — The sweep rotation advance cannot be committed by this station. **S3, procedural.**

The station contract says to run `next-sweep.mjs --advance --utc <measured>` and **commit that file
with the breadcrumb**. Station 04 has no PR authority (STATION-CAPABILITIES §5: *Create a PR* ❌).
So I advance the file and it sits modified-uncommitted in the dev tree. That is exactly the state
F3 of the 02:10Z run reported as a defect — and it recurs every run by construction, because the
instruction and the authority matrix disagree.

**DISPATCHED → Station 00.** Commit `docs/pipeline/sweep-rotation.json` **together with this
breadcrumb** in the next board PR. If it is not committed, `origin/main` falls a sweep behind and
the next 04 run repeats `gate-liveness` instead of rotating to `instrument-honesty`.

### F5 — The gate-liveness sweep is otherwise CLEAN, and here is the control that says so. **No defect.**

Reported deliberately, because a clean sweep and a broken instrument produce the same silence.
**Every one of the 42 gates was evaluated, all 30 masked premises were executed, and the SPENT
bucket, the ADMIT bucket and the REJECT bucket were each observed non-empty on this corpus.** Zero
dead gates is therefore a measurement. The two SPENT prompts are the sweep's whole yield, and they
were found because the bucket was proved reachable first.

**ACTIONED.** Verified by the control set listed under WHAT I MEASURED; nothing to fix.

### F6 — A concurrent actor regenerated the data-model artifacts INSIDE this run, and left one tracked file dirty. **S3, shared-tree hazard.**

[MEASURED] At `2026-09-01T14:10:52Z` `git status --porcelain` was **8 lines, all `??`**. At
`14:19:42Z` it carried **` M docs/data-model/metadata-catalog.json`**. [MEASURED] all three
data-model outputs share one mtime to the millisecond —
`metadata-catalog.json 14:13:55.5496697Z`, `relationship-map.json` and `relationship-map.md`
`14:13:55.5486543Z` — which is a **full generator run**, not an edit.

[MEASURED] `git diff --numstat` on the file returns **no rows**: the content is identical to
`origin/main`, and git reports only `LF will be replaced by CRLF`. So this is an **end-of-line
flip**, not a content change — which is why it is easy to sweep into an unrelated commit without
noticing, and why a `--numstat` reading is the probe that tells you so (DOCTRINE §9.3).

**Two candidate writers, both eliminated.** [MEASURED] `build-relationship-map.mjs --check` does
not write (control above, mtime unchanged across an exit-0 run). [MEASURED] **no prompt's
`premise:` line invokes the generator** — `Select-String '^premise:.*build-relationship-map'` over
all 72 HOLDs returns **zero**; the 11 files that mention it do so only in `done_when` or prose,
which `lint-prompt.mjs` never executes. **So `triage-holds.ps1` is exonerated and its
"Mutates nothing" claim survives.**

🔴 [CANNOT MEASURE] **which process ran the generator.** I have no writer audit, and I will not
guess: `status-sweep.ps1` reported **3 headless claude-code sessions** at 14:11:29Z, of which one is
this run, so a concurrent actor is the live hypothesis and it is not provable from here.

**DISPATCHED → Station 00.** The actionable half is concrete and does not need the writer
identified: **commit this breadcrumb and `docs/pipeline/sweep-rotation.json` with an explicit
pathspec** (`git commit -- docs/pr-prompts/00-04-… docs/pipeline/sweep-rotation.json`). A bare
`git commit -a` would carry a whitespace-only rewrite of `metadata-catalog.json` into a board PR,
where it reads as data-model drift and can trip CP-24. This is DOCTRINE §9.2's shared-index warning
firing for real, in a run that did not touch the file.

## WHAT I DID NOT DO

- **Armed nothing, retired nothing.** F1 and F2 name files that should move to `superseded/`; Station
  04 is READ-ONLY on the board and moving them is 00's. I did not `git mv`, and I did not stage a
  prompt to do it — a two-file retirement is a line in a board PR, not an agent run.
- **Did not open a PR** for this breadcrumb. Not my authority. It is untracked in the dev tree at
  `docs/pr-prompts/` for 00 to sweep up.
- **Did not touch `#1483`, `#1477` or `#1494`.** Diagnosing the three red checks on `#1483` is
  Station 02's on dispatch, and merging is 00's. F3 reports the blast radius; it does not act on it.
- **Did not mint a worktree.** Read `origin/main` with `git show` throughout, per AUTHORITY.
- **Did not run any `git` write in either tree**, and did not run `git` through the device bridge.
- **Did not `git checkout` or `git restore` `docs/data-model/metadata-catalog.json`** to clean F6.
  Restoring one file in the dev tree is the board trap's own shape, and the file is content-identical
  to `main` anyway — the cure is a pathspec commit, not a checkout.
- **Left alone:** `/sot/`, Azure/Entra/SharePoint, the 11 registry-escapee worktrees and 2 orphaned
  worktrees (Station 03's clone-hygiene dispatch), the 39 `needs-marco/` files and the 3 `[STALE]`
  escalations the sweep flags every run, `.pr-drafts/`, `PR-BODY-crm-chain-v1.md`, `outputs/`, and
  the untracked `queue-watch-state.md`.
- **Did not run Part 0, Part 1 or Part 2** of the legacy station brief. The contract is one named
  sweep per run, covered completely; this run's rotation named `gate-liveness`.
