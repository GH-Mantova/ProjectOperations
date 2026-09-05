# Station 04 — Scanner | 2026-09-05T02:09:57Z–2026-09-05T02:27Z

Sweep this run: **gate-liveness** (rotation position 1 of 4; `node scripts/pipeline/next-sweep.mjs`).

## GROUND

```
UTC            2026-09-05T02:09:57Z
origin/main    796ce204            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ b5ee73c8      C:\ProjectOperations2   (3 behind origin/main, 0 ahead, index clean)
doc version    1                    (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE. Run proceeded normally (read-only on the board, as 04 always is).

Binding documents read in full this run: `docs/pipeline/stations/04-scanner.md`,
`docs/pipeline/DOCTRINE.md`, `docs/pipeline/STATION-CAPABILITIES.md`.
[MEASURED] All three are byte-identical between the working copy and `origin/main`:
`git diff --numstat origin/main -- <path>` returned **empty** for each of the three
(the sanctioned form; the piped `hash-object --stdin` comparison is unsound under PowerShell, §9.1).

[MEASURED] `status-sweep.ps1` at 02:11:00Z: section 0 both positive controls PASS · 5 open PRs, all
RED · watcher node RUNNING pid 20000, wrapper alive · armed `*-ready.md` = **0** · verdict
**`DO NOT ACT: a board mutation is in progress`** (section 3: git processes = 1). Nothing in this
run mutates the board, so the verdict blocks nothing here — recorded because it binds Station 00.

## WHAT I MEASURED

**1. HOLD triage across the whole board.** [MEASURED] `scripts/pipeline/triage-holds.ps1`, read-only,
95 `*-HOLD.md` at depth 1. Its own controls passed (`GIT control: PASS`, `SPENT control: PASS`).
Result: `spent=4  gates-satisfied=43  still-gated=48  unreadable=0  of 95`, three distinct verdicts
observed (SPENT / ADMIT / REJECT).

**2. Every simple-shape premise re-evaluated against `origin/main`, not against the working tree.**
[MEASURED] A read-only script (`premise-vs-main.ps1`, written outside the repo) parsed each HOLD's
`premise:`, and for the `! grep -q "TOKEN" PATH` shape counted TOKEN in
`git show origin/main:PATH` and in the working copy of the same path.
Controls: negative `zzzNoSuchTokenZzz` on a real file → **0**; positive `export` on the same file
→ **10**. Coverage: **46 of 95** premises are that shape and were evaluated; **49** use a different
shape and are `[CANNOT MEASURE]` by this instrument (they *were* executed by `triage-holds.ps1`).

```
SPENT-ON-MAIN-BUT-TREE-SAYS-ALIVE   2
PREMISE DEAD ON MAIN (spent)        4
premise alive                      40
NOT-SIMPLE-SHAPE (not evaluated)   49
```

**3. Blast radius of the stale dev tree is bounded and was checked, not assumed.**
[MEASURED] `git diff --name-only HEAD origin/main` = 7 files (5 under `apps/web/src/pages/{crm,tendering}`,
2 tests, plus `docs/pipeline/stations/00-supervisor.md`). No premise among the 49 unevaluated ones
references any of those 7 paths (scripted match over every non-simple premise → zero hits). So the
2 affected prompts below are the whole of it this run.

**4. `requires_merged` is never evaluated.** [MEASURED] on `origin/main:scripts/pipeline/lint-prompt.mjs`:
`requires_merged` occurs **15** times — `LEGAL_DEP_KEYS`, doc comments, and `validateDepKeyValues`
(the positive-integer shape check) — plus the explicit comment at line 411:
*"`requires_merged: N` is a PR-number gate, not a name gate, so it is IGNORED"*. There is **no**
evaluation call site. `PR_GATE_EVALUATED_V1` → **0** hits (negative control `zzzNoSuchZzz` → 0).

**5. The board trap is CLEAN.** [MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`
→ 778 tracked paths (control), 106 at depth 1, of which **`*-ready.md` = 0** and `*-HOLD.md` = 95 —
matching the 95 on disk exactly. No tracked armed prompt that a checkout could resurrect.

**6. My own instrument lied once, and it was caught by a control (§7).** A regex reading
`^requires_merged:\s*(.+)$` over whole prompt files matched a line inside the *body* of
`pr-lint-requires-merged-gate-unevaluated-HOLD.md` — a markdown table row — and manufactured a
"malformed gate value carrying prose" finding. Reading the file's actual front matter showed it
declares **no** `requires_merged` at all. Recorded here, not as a finding: a front-matter probe that
does not stop at the closing `---` will read a prompt's prose as its own metadata.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — **advanced** via
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-05T02:09:57Z`
  (`last_index=0 last_run_utc=2026-09-05T02:09:57Z`; next sweep now reads `instrument-honesty`).
  [MEASURED] read back with `git status --porcelain` → ` M docs/pipeline/sweep-rotation.json`.
  **LEFT DIRTY IN THE DEV TREE ON PURPOSE — Station 00 commits it; 04 may not.**
- This breadcrumb, untracked at `docs/pr-prompts/00-04-scanner-2026-09-05-0209-...md`.
- Nothing else. No prompt armed, disarmed, renamed, moved or deleted. No PR touched. No merge.

## FINDINGS

### F1 — Two HOLD prompts are SPENT on `origin/main` yet read as arm-candidates, because the dev tree is three commits behind

`triage-holds.ps1` put both in the **GATES SATISFIED (ADMIT)** bucket. Their work merged 8 and 24
minutes before this sweep. `lint-prompt.mjs` runs the `premise` against the **working tree**; only the
`requires_*` gates read `origin/main`. A dev tree three commits behind therefore reports finished work
as ready to build.

| prompt | premise token | on `origin/main` | in dev tree | shipped by |
|---|---|---|---|---|
| `pr-cardpersist-s1-manpower-rows-persist-HOLD.md` | `SCOPE_MANPOWER_PERSIST_V1` in `apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx` | **16** | 0 | **#1628** merged 02:03Z (`SCOPE_MANPOWER_PERSIST_V1`) |
| `pr-crmui-register-s2-followups-kpis-and-toggles-HOLD.md` | `CRM_FOLLOWUPS_V2` in `apps/web/src/pages/crm/TendersRegisterPage.tsx` | **12** | 0 | **#1629** merged 01:47Z (`CRM_FOLLOWUPS_V2`) |

[MEASURED] with a negative control (`zzzNoSuchTokenZzz` → 0 on both sides) and a positive control
(`SCOPE_ITEM_LABOUR_STORE_V1` → 7 on **both** trees, proving the query works in each tree, so a 0 in
one of them is a real absence and not a broken read). Both prompts' `scope:` lists are subsets of the
files #1628/#1629 actually changed.

Consequence if either is armed: the watcher spends a full agent run and opens a **second PR for work
already on main**. Arming is Station 00's, so this must reach 00 before its next arm.

Note the chain immediately behind them is *correct* and must not be disturbed:
`pr-cardpersist-s2-plant-rows-persist-HOLD.md` declares
`requires_on_main: ScopeQuantitiesTable.tsx :: SCOPE_MANPOWER_PERSIST_V1`, and that gate released
properly off `origin/main` — its own premise token `SCOPE_PLANT_PERSIST_V1` measures **0** on main
and 0 in the tree, so s2 is genuinely live work. **Retiring s1 must not retire s2.**

**DISPATCHED — Station 00.** Retire both to `docs/pr-prompts/superseded/` in a board PR, naming
#1628 and #1629 as the shipping PRs. Do **not** arm either. Re-run `triage-holds.ps1` after the dev
tree is next fast-forwarded; the two should then fall into the SPENT bucket on their own.

### F2 — Four further HOLDs are SPENT and both trees agree; they are still sitting on the board

[MEASURED] `triage-holds.ps1` exit-3 bucket, confirmed independently against `origin/main`:

| prompt | token | hits on main / in tree |
|---|---|---|
| `pr-cardapi-s1-scope-item-labour-and-markup-store-HOLD.md` | `SCOPE_ITEM_LABOUR_STORE_V1` | 7 / 7 |
| `pr-cardfix-s1-table-chrome-and-column-placement-HOLD.md` | `SCOPE_WBS_GROUPRULES_V1` | 13 / 13 |
| `pr-cardfix-s2-inputs-money-and-inheritance-HOLD.md` | `SCOPE_WBS_INPUTS_V2` | 27 / 27 |
| `pr-crmui-register-s1-value-and-last-interaction-HOLD.md` | `CRM_REGISTER_V3` | 9 / 9 |

All four are tracked on `origin/main` at depth 1, so they persist across every checkout. They are
inert while they stay `-HOLD` — the risk is not that they fire, it is that six spent files in a
95-file queue make the ADMIT bucket a worse signal every run.

⚠️ Two of them are the declared predecessors of live prompts —
`pr-cardfix-s3-plant-picker-HOLD.md` gates on `SCOPE_WBS_INPUTS_V2` and
`pr-crmui-register-s2` gates on `CRM_REGISTER_V3`. Retire the spent files; do **not** touch the
`requires_on_main` lines that name their tokens.

**DISPATCHED — Station 00.** Retire all four in the same board PR as F1.

### F3 — `requires_merged` is a declared gate that the linter never evaluates: it fails OPEN

[MEASURED, §4 above] `lint-prompt.mjs` on `origin/main` validates `requires_merged` is a positive
integer and then — by an explicit in-source comment — **ignores it**. Of the three legal dependency
keys, `requires_on_main` and `requires_file_on_main` are evaluated against `origin/main` by
`checkGateNotReleased`; `requires_merged` is not evaluated at all. A HOLD gated on a PR that is still
open, or on a PR number that does not exist, returns a bare **ADMIT** indistinguishable from a
genuinely satisfied gate. Per DOCTRINE §9.5, a skipped gate reads as an ADMIT, and with respect to
*arming* that fails OPEN.

**This is latent today, not live — say so plainly.** Seven HOLDs carry `requires_merged`, and
[MEASURED] via `gh pr view N --json state` **all seven target PRs are MERGED**: #1609, #1361, #1317,
#1351, #1348, #1257, #1111. So no current ADMIT is wrong on this account. The defect is that nothing
*checked*; the correct verdicts this run are a coincidence of the board, not an output of the gate.

The fix is already written and lint-clean: `pr-lint-requires-merged-gate-unevaluated-HOLD.md`
(`size: 3`, `escalates: false`, scope = `lint-prompt.mjs` + one new test + `PROMPT-SCHEMA.md`) sits in
the ADMIT bucket, and its premise `! grep -q "PR_GATE_EVALUATED_V1" scripts/pipeline/lint-prompt.mjs`
is verified **alive** on `origin/main` (0 hits, negative control 0). I re-verified its central claim
against the live source rather than quoting it, per §7.1's re-read rule — it is accurate.

Its diff is `scripts/**` + `docs/**`, i.e. outside `^(tests|docs)/` on the `scripts/` paths, so under
DOCTRINE §10.1 step 2 the resulting PR hand-classifies as **Marco's for merge**. That affects merging,
not arming.

**DISPATCHED — Station 00.** Consider arming `pr-lint-requires-merged-gate-unevaluated-HOLD.md`
(one at a time, RULE 4 detector first — read the body, a prose gate matches no regex). Until it lands,
treat any ADMIT whose only dependency key is `requires_merged` as **ungated**, and check the PR state
by hand.

### F4 — The rotation advance is uncommitted in the shared dev tree and only Station 00 can land it

`docs/pipeline/sweep-rotation.json` is modified and unstaged in `C:\ProjectOperations2`. 04 is
read-only on the board and the dev tree is on `main`, which nobody commits to directly. If it is not
swept into a board PR, the next Scanner run repeats **gate-liveness** and the rotation silently stops
— which is the failure recorded against 04's 2026-09-02 run (two consecutive advances sat uncommitted).

**DISPATCHED — Station 00.** Commit `docs/pipeline/sweep-rotation.json` and this breadcrumb with the
next board PR. Use a pathspec commit: the dev-tree index is shared between concurrent chats
(DOCTRINE §9.2), and it was clean when I measured it at 02:10Z, which says nothing about now.

## WHAT I DID NOT DO

- **Did not fast-forward the dev tree.** It is 3 behind / 0 ahead and an FF would have made F1
  disappear before it was recorded. The sweep verdict was also `DO NOT ACT` (a git process was
  mid-flight), #1627 had just landed a correction about the FF cure leaving the tree dirty, and an FF
  of the shared tree is not 04's to perform. F1 is reported as the standing trap it is.
- **Did not arm, disarm, rename, move or retire anything.** 04 arms nothing; that includes the six
  spent prompts, which are named for 00 rather than moved.
- **Did not evaluate 49 of 95 premises against `origin/main`** — they are not the simple
  `! grep -q "TOKEN" PATH` shape. `triage-holds.ps1` did execute them against the working tree, so
  they are covered for *liveness*; they are `[CANNOT MEASURE]` for the specific working-tree-vs-main
  divergence F1 describes. Bounded by measurement 3 above: none of the 49 touches a file in the
  3-commit gap, so nothing is hiding there this run.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The station
  contract is one named sweep per run, covered completely; this run's sweep was gate-liveness.
  `github-projectops` also failed to connect this session (`Authorization header is badly formatted`),
  so the connector half of Part 1 was unavailable — `gh` through the shell was used instead wherever
  a PR state was needed.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, production data, or any `*-ready.md`.**
