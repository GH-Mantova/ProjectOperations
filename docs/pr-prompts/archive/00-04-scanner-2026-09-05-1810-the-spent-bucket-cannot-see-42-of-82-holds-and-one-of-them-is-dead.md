# Station 04 — Scanner | 2026-09-05T18:10Z–2026-09-05T18:5xZ

## GROUND

```
UTC            2026-09-05T18:10:18Z
origin/main    f86f689e            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ f86f689e     C:\ProjectOperations2   (read in the DEV TREE, never the clone)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run was not restricted to read-only on that account.
Sighted run: `start_process` returned `ALIVE … 2026-09-06T04:10:03+10:00` on the first call.
The three binding documents were read from the dev tree after proving they are byte-identical to
`origin/main`: `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY** (DOCTRINE §9.1: the
`--numstat` form, never a piped hash).

**Assigned sweep, not chosen:** `node scripts/pipeline/next-sweep.mjs` →
`SWEEP: gate-liveness` (rotation position 1 of 4; previous run 2026-09-05T14:11:00Z).

**Safe-to-act:** `status-sweep.ps1` captured to a file (it returns early and hides its own §7
verdict when piped) → section 7 `[LIVE] SAFE TO ACT`. Board at read time: 4 open PRs
(#1675 #1667 #1665 #1662, all CLEAN and green), armed 3, watcher pid 20000 RUNNING, 0 git
processes, no `index.lock` in either tree.

## WHAT I MEASURED

**Instrument controls, all passing, before any negative result below was believed.**

- `triage-holds.ps1` self-controls: `GIT control: PASS` (read 84018 chars of DOCTRINE from
  `origin/main`, so the gate probes can actually run — DOCTRINE §9.5, where a broken `git` makes
  `readFromOriginMain` return `null` and every gate silently ADMIT) and `SPENT control: PASS`
  (lint emitted exit 3 on the fixture, so the SPENT bucket is measurable at all).
- My own second instrument (`C:\po-sup-fix-scripts\gate-liveness-04b.mjs`, read-only):
  `CONTROLS blob-present=true blob-absent=true needle-found=true needle-absent=true
  premise-runner=true`; `REF origin/main = f86f689e5c6223846e2577c75afaf23f992ac1c5`;
  `GH CONTROL: PR #1 state=MERGED`.
- Premise runner (`gate-liveness-04c.mjs`) uses `gate-eval.mjs`'s `selfTest` — `exit 0` → PASS,
  `exit 1` → FAIL — so a BROKEN reading can never be folded into a FAIL one.

**[MEASURED] `triage-holds.ps1`, 82 `*-HOLD.md` at depth 1:
`spent=0  gates-satisfied=40  still-gated=42  unreadable=0`.** Reject codes across the 42:
`GATE_NOT_RELEASED` 13 · `UI_PROMPT_NEEDS_DESIGN_REF` 12 · `HUMAN_GATE_PRESENT` 9 ·
`FILE_GATE_NOT_RELEASED` 7 · `MISSING_STANDING_AUTHORITY` 1. (13+12+9+7+1 = 42.)

**[MEASURED] No dead gate — and this zero carries a positive control.** My instrument
re-evaluated every `requires_file_on_main` / `requires_on_main` entry on all 83 depth-1
`-HOLD`/`-ready` prompts (excluding `rev-*`, which are review jobs, DOCTRINE §9.5) directly
against `origin/main:f86f689e`: **28 prompts carry at least one CLOSED gate, 0 carry a gate that
is satisfied on main while still holding the prompt back.** The 20 prompts lint rejects with a
*gate* code are exactly the gate-code subset of my 28 — two instruments, one answer, no
disagreement in either direction. The other 8 of my 28 are prompts lint rejects at an earlier
check that also happen to have a closed gate.

**[MEASURED] THE BOARD TRAP is clean.** `git ls-tree -r --name-only origin/main --
docs/pr-prompts/` filtered to `^docs/pr-prompts/[^/]+-ready\.md$` → **0 tracked ready-files at
depth 1**; POSITIVE CONTROL, the same query filtered to `-HOLD\.md$` → **82**. (DOCTRINE §9.2:
`ls-tree` with `-r` and a literal prefix, never a glob pathspec.)

**[MEASURED] `requires_merged` is declared, typo-guarded and schema-validated — and never
evaluated.** `Select-String '^requires_merged:'` over `docs/pr-prompts/*.md` → **10** hits
(POSITIVE CONTROL `^requires_on_main:` → 34; NEGATIVE `^zzzNoSuchNeedleZzz:` → 0), of which 6 are
real front-matter gates and 3 are the worked examples inside
`pr-lint-requires-merged-gate-unevaluated-HOLD.md` plus one in `PROMPT-SCHEMA.md`. In
`lint-prompt.mjs` `requires_merged` appears only in `LEGAL_DEP_KEYS`, the typo-distance table, the
schema validator and one error message — there is **no release-gate evaluation site**, and no
`MERGED_GATE_NOT_RELEASED` code exists. All six predecessors are MERGED today (#1361 · #1317 ·
#1351 · #1348 · #1257 · #1111; NEGATIVE control `gh pr view 999999` → GraphQL "could not
resolve"), so nothing is mis-admitted right now — but four of the six sit in the ADMIT bucket and
would sit there whatever their predecessor's state.

**[MEASURED] Both standard negative-control needles are contaminated.** Over
`docs/pr-prompts/**` (depth 1 + `archive/` + `needs-marco/`): `zzzNoSuchNeedleZzz` → **40** hits,
`zzzNoSuchTokenZzz` → **36**. In `DOCTRINE.md` + `STATION-CAPABILITIES.md` together → **4**.
A freshly minted needle (`zzQqNeedle04b20260906`) → **0** over the same corpus, which is the
control proving the query itself works.

**[MEASURED] The premise of every depth-1 prompt, run independently of lint.** 83 prompts:
`PASS(alive)=82  FAIL(dead premise)=1  BROKEN=0  NO-PREMISE=0  NO-FM=0`. The 82 PASS include all
40 that lint ADMITs, which calibrates the runner against lint's own `spent=0` before its single
FAIL is believed.

## WHAT CHANGED

**Nothing on the board.** 04 is read-only: nothing was armed, disarmed, renamed, moved, staged,
merged or labelled. No prompt file was edited. No `/sot/` file was touched.

Two scratch instruments were written **outside the repo**, at
`C:\po-sup-fix-scripts\gate-liveness-04b.mjs` and `...-04c.mjs`, and two captured outputs beside
them. Nothing in `C:\ProjectOperations2` changed except the two files named below.

`node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-05T18:10:18Z` was run, so
`docs/pipeline/sweep-rotation.json` is **left DIRTY in the dev tree**. Per the station doc, 04 may
not commit it — **Station 00 must commit `docs/pipeline/sweep-rotation.json` together with this
breadcrumb**, or the next run repeats `gate-liveness` and the rotation silently stops.

This breadcrumb is **untracked** in `docs/pr-prompts/` until a board PR commits it.

## FINDINGS

### F1 — [S2] The SPENT bucket is structurally blind to 42 of 82 HOLDs, and one of them is dead today

`triage-holds.ps1` prints `spent=0 … of 82`. That denominator is wrong in the direction that
matters. `lint-prompt.mjs` runs the premise **last**: `HUMAN_GATE_PRESENT`,
`UI_PROMPT_NEEDS_DESIGN_REF`, `MISSING_STANDING_AUTHORITY` and both gate-release checks all return
before `runPremise` is called. So a prompt that fails any of them can **never** be reported SPENT,
whatever its premise says. Today that is **42 prompts**; the honest reading of this run's line is
`spent=0 of 41`.

**The live instance.** `pr-tendering-board-restore-submitted-cardless-HOLD.md`:

- premise `! grep -q "COUNT_ONLY_STAGES" apps/web/src/pages/tendering/tenderingPage.helpers.ts` →
  **FAIL**, i.e. the work has shipped. Reproduced twice, on `origin/main:f86f689e` and on the
  working copy: the symbol is at lines 29/30/34 in both; NEGATIVE control `zzzNoSuchNeedleZzz` in
  the same file → 0.
- Source: `git log -S 'COUNT_ONLY_STAGES'` → `2ac3cbf2 fix(tendering): a submitted tender no
  longer disappears from the board (COUNT_ONLY_STAGES) (#1632)`.
- `done_when` is satisfied in substance: `PIPELINE_STAGES = ["DRAFT","IN_PROGRESS","SUBMITTED",
  "WITHDRAWN"]` on main, `groupByPipelineStage` carries `SUBMITTED: []`, and **all four** of the
  prompt's `scope:` paths exist on `origin/main`. #1632's file list is those same four paths,
  4 of 4.
- **Lane (DOCTRINE §10.1):** `Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern
  'PR #1632\b'` → **0**; POSITIVE control `PR #1606` → **2**; NEGATIVE control `PR #999999` → 0;
  and no processed log of any name matches `*tendering-board-restore*`. The head branch is
  `pr-tendering-board-restore-submitted-cardless`, this lane's slug convention.
  ⇒ `[NO LANE VERDICT — hand-classified]`: **second lane**, merged 2026-09-05T02:59:27Z.
- Lint's actual verdict on it is `REJECT [UI_PROMPT_NEEDS_DESIGN_REF]`, so the premise never ran.

**Why this is not just a duplicate of DOCTRINE §10.6.** §10.6 (landed 2026-09-05) records that a
second-lane PR does not consume its prompt, and states *"the premise dies on MERGE, not on OPEN"* —
which implies the SPENT bucket picks the leftover up once the PR merges. **For this prompt it did
not, and cannot.** #1632 merged over fifteen hours before this run and `spent` is still 0. §10.6's
two measured instances (`pr-plantdays-retire-and-drop` / #1662,
`pr-scopecosts-s1-operational-cost-lines-api` / #1665) are both in the ADMIT bucket with their PRs
still **open**, so they never exercised the post-merge half of the claim. This one does, and it
refutes the implied recovery path: **a second-lane leftover that also fails a pre-premise check is
invisible to every instrument the queue has.** It stays invisible until someone satisfies the
unrelated check — at which point it becomes ADMIT and arms a duplicate of merged work.

The general shape is DOCTRINE §9.6: an empty result read as an empty world. `spent=0` is being
read as "no finished work is sitting on the board", when it means "no finished work is sitting on
the board *among the 41 prompts this instrument can see*".

**DISPATCHED → Station 00.** Two things, and only 00 may do either (04 is read-only on the board):

1. Retire `pr-tendering-board-restore-submitted-cardless-HOLD.md` to
   `docs/pr-prompts/superseded/` in a board PR, citing #1632. Verify by re-running
   `triage-holds.ps1` and reading `of 81`.
2. The permanent half, which is 00's to route: make the SPENT verdict reachable independently of
   the pre-premise rejects — either by running the premise **first** (it is the cheapest
   *correctness* question and the only one whose answer can retire the file), or by having
   `triage-holds.ps1` run the premise itself for every prompt lint rejects, and print a
   `SPENT-BEHIND-A-REJECT` bucket. **RULE 1:** the second option is the complete-and-additive one
   — it adds a bucket, changes no existing verdict, cannot mis-bin anything, and keeps working if
   lint's check order changes again. Re-ordering lint's checks is cheaper but fails the
   *"without damaging existing"* half: `HUMAN_GATE_PRESENT` and the gate checks are deliberately
   *before* the premise (they are cheap and deterministic, and the human gate is meant to reject
   before any subprocess runs), so moving the premise ahead of them changes what a REJECT means
   for every caller of `lint-prompt.mjs`, including the watcher.

### F2 — [S3] `requires_merged` is a gate that is validated but never evaluated

Six depth-1 prompts declare `requires_merged`. `lint-prompt.mjs` checks that the value is a
positive integer, protects the key name against typos, and lists it in `LEGAL_DEP_KEYS` — and then
never asks GitHub whether the PR merged. There is no `MERGED_GATE_NOT_RELEASED` code and no call
site. A prompt whose only dependency key is `requires_merged` is therefore gated on nothing:
it is ADMIT from the moment it is authored, including before its predecessor exists.

Measured today it is harmless — all six predecessors are MERGED — but four of the six
(`pr-e2e-container-s2-swap-required-job`, `pr-pipeline-nodrift-agents-write-sweep-commits`,
`pr-rates-11b2-resolver-isactive-surface`, `pr-rates-consumers-s3-persona-export`) are sitting in
the ADMIT bucket right now on a gate that was never asked.

**Angle 4 (history) — this is already known and already staged.**
`pr-lint-requires-merged-gate-unevaluated-HOLD.md` exists at depth 1, documents the exact defect
with its own three worked examples (`1317` merged, `1543` open, `999999` nonexistent — *all three*
`-> lint exit 0`), and is currently **ADMIT and unarmed**.

**DEFERRED.** The fix is written and waiting; re-filing it as new work would be the "disposition
addressed to a future run" failure. It becomes urgent the moment anyone authors a
`requires_merged`-only prompt against an **unmerged** predecessor — at which point the gate fails
OPEN and the chain runs out of order. Station 00 arms it; 04 may not.

### F3 — [S3] Both standard negative-control needles have been written into the corpus they control

DOCTRINE and the project memory both prescribe `zzzNoSuchNeedleZzz` as the negative control (the
memory index explicitly says to prefer it over `zzzNoSuchTokenZzz`, which it records as having 28
hits). Measured this run over `docs/pr-prompts/**`: `zzzNoSuchNeedleZzz` → **40** hits,
`zzzNoSuchTokenZzz` → **36**. Four more sit in `DOCTRINE.md` and `STATION-CAPABILITIES.md`.

I hit this live: a "has this finding been reported before?" search over the breadcrumbs returned
`prompt-slug → 3, POS control → 14, NEG control → 36`. A negative control that returns 36 tells
the reader their query is broken when it is working perfectly. The failure is self-inflicted and
strictly monotonic — every run that quotes its control in its breadcrumb makes the next run's
control worse — and it is worst over exactly the corpus stations search most.

The cure is one line and costs nothing: **mint a per-run needle** (this run used
`zzQqNeedle04b20260906` → 0 over the same corpus) rather than reusing a written-down one. A
written-down negative control is a positive.

**DISPATCHED → Station 00.** The text change belongs in DOCTRINE §9.6, which is the canonical
`instruments v2` block — editing it requires re-recording the block hash via
`lint-station.mjs --write-canonical`, which is not 04's to do. 04's contribution is the
measurement above and the replacement rule.

## WHAT I DID NOT DO

- **Did not mutate the board in any way** — no arm, no disarm, no rename, no move, no merge, no
  label. Including the one prompt I proved is dead: retiring it is a board mutation and it is
  00's. The authority matrix gives 04 *Mutate the board: NO, read-only*.
- **Did not commit `docs/pipeline/sweep-rotation.json`**, though I advanced it. The dev tree is on
  `main` and nobody commits to `main` directly; 00 commits it with this breadcrumb.
- **Did not run the other three sweeps** (instrument honesty, repo hygiene, instruction drift).
  `next-sweep.mjs` assigned `gate-liveness` and the station doc forbids choosing; a shallow pass
  over everything is why findings rot. F3 is an instrument-honesty finding only because it
  surfaced inside the gate-liveness work.
- **Did not run Part 2 (live-site / visual patrol).** The rotation named a static sweep and the
  turn budget went to covering it completely, including running 83 premises and re-deriving 28
  gates with a second instrument.
- **Did not touch the dev tree's 35 pre-existing dirty lines, the watcher clone (`dirty=4`), or
  `C:\po-vg`** — the orphaned worktree the sweep reports as holding 1 uncommitted file. That is
  03's, it is already dispatched, and `--force` there would discard real work.
- **Did not attempt any `git` write, any `.ps1` under `scripts/pipeline` that mutates, Azure,
  Entra, SharePoint, or production data.**
