# Station 00 — Supervisor | 2026-08-30T20:08:17Z–2026-08-30T20:5xZ

## GROUND

```
UTC            2026-08-30T20:08:17Z
origin/main    cb392adb            (fetched, then rev-parse; full SHA cb392adb6622d2caa447f16967da5be93ff57515)
dev tree       main @ cb392adb     C:\ProjectOperations2   (converged, 0 ahead / 0 behind)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md: station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was not read-only-by-mismatch.

**SIGHTED.** `start_process` shell `powershell.exe` returned `SHELL-OK 2026-08-30T20:08:17Z`. This
breaks a run of **two consecutive blind runs** (16:08Z, 18:07Z) and is the first Station 00 run with
a Windows shell since 14:08Z. The blindness escalation trigger recorded at 18:07Z — *a third
consecutive blind run* — did **not** fire.

The three binding docs were read from the working copy, which is legitimate this run and only this
run: `git diff --stat origin/main -- docs/pipeline/` returned **only** `sweep-rotation.json`, so
`DOCTRINE.md`, `STATION-CAPABILITIES.md` and `stations/00-supervisor.md` are byte-identical to
`origin/main`. [MEASURED]

`status-sweep.ps1` (20:09:16Z): **SAFE TO ACT.** Section 0 positive controls both LIVE. OPEN 0 ·
ARMED 0 · HOLD 61 · in-progress 0 · `index.lock` False/False · git processes 0 · main CI 3/3 success ·
watcher node RUNNING pid 26364, wrapper alive (3), orphaned worktrees none. [MEASURED]

## WHAT I MEASURED

**1. Main CI on `cb392adb6622d2caa447f16967da5be93ff57515` — CLOSED.** [MEASURED] This was left
in flight by the 14:08Z run and two blind runs failed to read it back. Four runs, all
`completed`/`success`: **Deploy · Tendering Browser Smoke · CI · Push on main**. Queried with the
FULL 40-char SHA per DOCTRINE §9.4; control on `62fd27f1527e963165bfa37962a5476bbaf36d7d` returned
its four `success` runs the same minute. Do not re-raise this item.

**2. Breadcrumb freshness — CLEAN, exit 0.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs
--freshness`: `structure: 17 checked, 0 malformed`. Nobody SILENT — 00 2.0h/2 · 02 dispatch-only ·
03 21.1h/24 · 04 2.0h/4 · 05 6.0h/24. Three breadcrumbs were flagged UNTRACKED (1608, 1807, 1809);
**all three are committed by this run's PR.**

**3. OAuth — EIGHTEENTH reading, taken directly from `C:\Users\Marco\.claude\.credentials.json`.**
[MEASURED] `expiresAt` 1787933615984 → `2026-08-28T16:13:35.984Z`, **expired 51.94 h**, file mtime
**unchanged** at `2026-08-28T16:13:26.909Z`. Nobody has re-authenticated. **The OAuth block stands.
ARMED 0 at the start of this run and ARMED 0 at the end — nothing was armed.**

**4. `ConvertFrom-Json` collapsed a 4-element `gh` array into one object with array-valued
properties.** [MEASURED] `gh run list --json name,status,conclusion` piped straight into
`ConvertFrom-Json` printed `System.Object[] System.Object[]` per field and `count=1`. This is the
same collapse DOCTRINE §9.4 records for `Where-Object`, reached through a different door: the fix
that worked was `Out-String` before `ConvertFrom-Json`. Recorded here rather than in DOCTRINE
because the existing §9.4 bullet already prescribes the cure (`--json` + parse, assign-then-foreach)
and one more restatement is drift, not coverage.

**5. Block scalars in prompt front matter — 61 files scanned, both controls green.** See F3.

## WHAT CHANGED

One PR off `origin/main` in a disposable worktree (`C:\po-worktrees\sup-2010`), torn down at the end
of the run. `git diff --cached --name-status` in the shared dev tree was **empty** at the start and
I staged nothing there. The dev tree was never written to except by copy-out of files it already had.

- `docs/pipeline/DOCTRINE.md` — two bullets added (§9.3 for 04's F2, §9.5 for my F3). `+22 −0`.
- `docs/pipeline/stations/_canonical-blocks.json` — `instruments v2` hash re-recorded
  `6568700884268aca` → `b9f8a22b4aa71b19` via `lint-station.mjs --write-canonical`. `+1 −1`.
- `scripts/pipeline/triage-holds.ps1` — SPENT positive control wired in; calibration line now names
  the verdicts it saw. `+39 −1`.
- `scripts/pipeline/fixtures/spent-positive-control.md` — **new**, the checked-in fixture.
- `CLAUDE.md` — line 19 no longer restates a count that has a machine-readable home. `+1 −1`.
- `docs/pipeline/sweep-rotation.json` — 04's rotation advance, carried in from the dev tree working
  copy where 04 left it unstaged (`last_index 3 → 0`, `last_run_utc → 2026-08-30T18:09:54Z`). Without
  this, 04 repeats `gate-liveness` and `instrument-honesty` never runs.
- Three untracked breadcrumbs committed: `…-1608-…`, `…-1807-…`, `…-1809-…`.

`lint-station.mjs`: **REJECT 1 of 7** before the re-record (`instruments` edited, as expected for a
DOCTRINE-only §9 change), **ADMIT all 7** after. [MEASURED]

Nothing was armed, disarmed, renamed, retired or moved in the queue. No watcher action. No `/sot/`
edit. ARMED stayed 0, HOLD stayed 61.

## FINDINGS

### F1 [S3] 04's `triage-holds.ps1` SPENT-bucket control — **ACTIONED**, option (A) as recommended

04 found that the script printed `calibrated: 2 distinct verdicts observed` while `spent=0` on two
consecutive runs, i.e. it reassured the reader about the one bucket it had never exercised, and it
proved `exit 3` reachable only by a hand-run fixture that was not checked in.

Landed option (A) verbatim in intent: `scripts/pipeline/fixtures/spent-positive-control.md` (outside
`docs/pr-prompts/`, so no watcher glob, no HOLD count, no arming surface) plus a control at the top
of `triage-holds.ps1` that lints it and requires exit 3.

**Both branches proved to fire, same run:** [MEASURED]

```
-Repo C:\po-worktrees\sup-2010   (fixture present)
   SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture, so the SPENT bucket is measurable.
   === TOTALS  spent=0  gates-satisfied=30  still-gated=31  unreadable=0  of 61
       calibrated: 2 distinct verdicts observed on the board (ADMIT, REJECT).

-Repo C:\ProjectOperations2      (fixture absent — NEGATIVE CONTROL)
   !!! SUSPECT: the SPENT bucket is UNMEASURABLE this run -- fixture missing: ...
   !!! SUSPECT: spent=0 is UNMEASURED -- the SPENT positive control did not pass (...)
```

A control that has only ever been seen to pass is the defect 04 reported; this one has now been seen
to do both. Note the calibration line no longer claims coverage it does not have — it names `ADMIT,
REJECT` explicitly.

**ACTIONED.**

### F2 [S3] 04's `[regex]::Escape()` + `-SimpleMatch` bullet — **ACTIONED** into DOCTRINE §9.3

Landed 04's proposed bullet in the `instruments v2` canonical block, with the `instruments` hash
re-recorded in the same PR (the #1401/#1402 procedure). 04 verified the same run that this is
doctrine and not a live code repair: `SimpleMatch` appears on 5 lines of `status-sweep.ps1` and none
of them wraps its pattern in `[regex]::Escape`.

**ACTIONED.**

### F3 [S2] — CORRECTED MID-RUN. The front-matter parser eats block scalars, and it IS breaking a live gate

**I got this wrong first and am recording both the wrong answer and how it was caught, because the
wrong answer is the more instructive half.**

Found while proving F1's fixture honest: my first fixture wrote `premise_means:` as a folded scalar
and the linter reported `Premise no longer holds: ">-"`. `parseFrontMatter`
(`lint-prompt.mjs:934-966`) matches only `^([a-z_]+):\s*(.*)$` and a list-item form, so **a block
scalar stores the literal two characters and the indented body falls through the loop and is
discarded.** That much was right.

**What I then asserted, and it was wrong:** I scanned `premise` and the four `requires_*` keys, found
0, and wrote *"no gate is broken today."* Two things refuted it before this PR merged. Project memory
carries this same defect found on **2026-08-19** and again on **2026-08-28** — so it was never mine to
call NEW — and the 08-28 finding named the key I had not looked at. Re-measured, same engine, both
controls green: [MEASURED]

```
block-scalar on rollback_strategy      10      <- the one that matters
block-scalar on premise_means          19
block-scalar on done_when              12
block-scalar on premise                 0
block-scalar on scope / fixes_pr / requires_*   0
```

`lint-prompt.mjs:1241-1252` demands a non-empty `rollback_strategy` for any `prisma/migrations`-scoped
prompt. `">-"` is neither missing nor empty, **so the gate passes without reading anything.** Of the
**17** migration-scoped prompts on the board, **7 are rubber-stamped**: [MEASURED]

```
pr-524-rates-b-slice2-canonical-HOLD        (irreversible table drop)
pr-rates-s11c-drop-legacy-tables-HOLD       (irreversible table drop)
pr-siteid-notnull-backfill-HOLD
pr-company-manage-s1-permission-and-grant-HOLD
pr-crm-s11-archive-reason-delete-empty-HOLD
pr-crm-s3-account-on-client-create-HOLD
pr-crm-s7-interaction-log-HOLD
```

The other 10 carry real rollback prose and gate correctly — that split is the positive control: the
gate is not broken for everything, it is broken for exactly the folded ones.

**Two things keep this at S2 rather than S1.** `premise` collapsed on **zero** prompts on all three
measurement dates, so nothing has ever been mis-binned as already-done. And the watcher is unaffected:
`scripts/pr-watcher/index.mjs` has its own extractor that folds correctly, so the linter gates on `""`
while the watcher runs the real text.

**ACTIONED** as doctrine: the DOCTRINE §9.5 bullet in this PR now states the rubber-stamp plainly
instead of my original "no gate is broken", and tells the reader to read `rollback_strategy` by eye
before trusting a migration-scoped ADMIT.

**The code fix is already staged and needs no new work from anyone:**
`pr-lint-frontmatter-block-scalar-collapse-HOLD.md`, lint **ADMIT exit 0, size 2**, premise
`! grep -q "foldBlockScalar" scripts/pipeline/lint-prompt.mjs` still alive. It is one of the 30
gate-satisfied HOLDs and I could not arm it — **the OAuth block (F8)**. It is the strongest
next-arm candidate the moment Marco re-authenticates, ahead of the existing next-arm order, because
until it lands three destructive-migration prompts have a rollback gate that reads two characters.

**The method note worth keeping:** the reason I nearly shipped a false all-clear is that I chose the
key set from the failure I happened to trip over (`premise_means`) instead of from the set of keys
any gate actually reads. DOCTRINE §7's "prove your instrument can produce a positive" does not cover
this — my controls were green and my scan was correct; it just answered a narrower question than the
sentence I wrote about it. **Check that the population you measured is the population your claim is
about.**


### F4 [S4] 04's F3 (approval-marker gates report two different reasons) — **DEFERRED**, ratified

04 measured that 3 of the 5 approval-gated prompts report `HUMAN_GATE_PRESENT` rather than
`FILE_GATE_NOT_RELEASED`, because the do-not-arm check at `lint-prompt.mjs:728` short-circuits before
the file gate. It is fail-closed; all five front-matter gate lines were verified present and
correctly spelled, and `git ls-tree -r origin/main -- docs/approvals/` still returns only
`README.md`. I ratify 04's disposition and its urgency trigger unchanged.

**DEFERRED** — urgent the moment a do-not-arm comment is edited on any of the five, or the first
approval marker lands.

### F5 [S2] `sot-refs-baseline.json`'s `_readme` TRAP 2 is stale — **still DISPATCHED → 05, do not re-dispatch**

Re-verified live this run rather than repeated from the 16:08Z breadcrumb. The `_readme` still says
*"Until that step counts entries instead of '+' lines, NEVER delete the last element"* and still says
*"the other 13"* against `entries.length` **14**. But `.github/workflows/ci.yml:201-217` no longer
greps `+` lines: #1407 replaced it with `node scripts/pipeline/check-sot-baseline-ratchet.mjs`
comparing the two baselines as **sets**. [MEASURED] So entry 14 is parked for a reason that died,
and the instruction that parks it is the last stale one in that file.

05 last ran 14:11Z on a 24 h cadence — **6.0h in, waiting correctly, not overdue.** The exact patch is
in the 16:08Z breadcrumb, which this PR commits, so 05 will find it. **DISPATCHED → Station 05**
(unchanged; this is a re-verification, not a second dispatch).

### F6 [S3] `CLAUDE.md:19` said the baseline tracks 23 refs — **ACTIONED**

It tracked 14 (`entries.length = 14`, read by node). This was labelled DEFERRED at 18:07Z with the
trigger *"the first 00 run with a Windows shell"*; this is that run, so it is actioned rather than
deferred again.

The RULE 1 move is **not** to write "14" — that is the same defect with a fresher number, and it will
be wrong again the next time 05 burns an entry. The line now points at the file and says the count
lives there:

> SOT reference baseline: `docs/qa/sot-refs-baseline.json` records the known-dangling `sot/` refs —
> the count lives in that file, never here. It may only SHRINK; burn-down is Station 05's (fix in
> `sot/`, delete the entry, same PR). Read its `_readme` before touching it.

Complete (no number to go stale) and additive (nothing else in the file changes). **ACTIONED.**

### F7 [S2] "DISPATCHED → a FUTURE RUN of a station" is a disposition with no owner — **ESCALATED, unchanged and now with a worked example**

Raised at 18:07Z. This run is the evidence it was waiting for, in both directions. The 16:08Z run
dispatched `CLAUDE.md:19` to "the next sighted 00"; the 18:07Z run was blind, so it could not move it,
and re-labelled it DEFERRED with a stated trigger. **This run had a shell, the trigger fired, and the
item closed in one pass (F6).** Re-labelling worked; "next sighted 00" would have worked only by luck,
because blindness is intermittent at ~40% and no instrument counts a parked item —
`check-breadcrumb.mjs --freshness` watches STATIONS, not ITEMS.

The 06 item is the same shape and has not been so lucky: `CADENCE` at `check-breadcrumb.mjs:36` has
no `'06'` key at all, so `DISPATCHED → 06` parks invisibly, and a defect named in a breadcrumb
filename on 08-26 was still live three days later.

**RULE 1 options, unchanged — (A) first because it is the only complete one:**

- **(A) A tracked carry-forward ledger.** `docs/pipeline/OPEN-DISPATCHES.md`, or a parseable
  `dispositions` block, that every station's preflight prints when an item exceeds 2× its addressee's
  cadence. **Complete** (catches every future park, including 06's, which no cadence key can) and
  **additive** (a new file plus a read-only check; blocks no PR, changes no existing behaviour).
- **(B) Ban "next sighted 00" as an addressee** — a disposition must name a STATION; anything needing
  sight becomes DEFERRED with a stated trigger, as this run just demonstrated works. **Fails the
  "completely/future" half:** it stops the mislabel but still counts nothing.
- **(C) Leave it.** Fails both halves; it is how the 08-26 defect survived three days.

Note (A) **subsumes** the separate 06-cadence question, so decide them together. The 06 half remains
inseparable in its own right: `'06': <n>` without a real scheduled task makes `--freshness`
`process.exit(2)` on every station's preflight forever (`:224`), and `'06': null` prints
*"dispatch-only — no cadence to miss"*, which is true of 02 and **false** of 06. Cadence key **and**
scheduled task, or neither — and the scheduled task is Marco's box.

**ESCALATED → Marco.**

### F8 [S1] OAuth has been dead for 51.94 hours and nothing can be armed until Marco re-authenticates — **ESCALATED, standing**

Eighteenth consecutive reading, mtime unchanged since 2026-08-28T16:13:26.909Z. Every armed prompt
burns on `401 OAuth access token has expired` — `status-sweep.ps1` §4B still shows the 08-29 burns
(`pr-crm-s3-account-on-client-create`, `rev-1386`). This is why both 04's dispatches were landed by
hand this run instead of staged as prompts, and why 30 gate-satisfied HOLDs sit unarmed.

**ESCALATED → Marco.** One action clears it: re-authenticate on the box. Nothing an agent can do
substitutes, and no reading short of a changed mtime lifts the block.

## WHAT I DID NOT DO

- **Armed nothing.** ARMED 0 → 0. The OAuth block stands (F8), and 30 HOLDs read gates-satisfied that
  I deliberately left alone. `pr-dns-s5-checker-flip-to-fail-HOLD` remains never-arm and is now
  linter-locked; `pr-lint-not-a-prompt-HOLD` still wants a re-lint against current main before anyone
  considers it.
- **Did not touch `/sot/` or `docs/qa/sot-refs-baseline.json`.** The baseline fix is 05's (F5), and
  CP-24 hard-fails any PR mixing `sot/` with code — this PR carries code, so it could not have taken
  the `sot/` half even if it were mine.
- **Did not change `parseFrontMatter`.** Reasoning in F3: zero gate-bearing occurrences today, and a
  parser change alters how every prompt is read.
- **Did not restart the watcher.** RUNNING pid 26364, 3 wrappers, orphaned worktrees none. An idle
  watcher with an empty queue is correct, not wedged; `restart-watcher-if-wedged.ps1` was not run
  with `-Fix` and no verdict called for it.
- **Did not touch the watcher clone or its `dirty=35`.** Standing amber, 03's lane
  (`verdict-archive` moves 35 tracked files without committing). 03 is 21.1h into a 24h cadence.
- **Did not clear the 13 `[STALE]` escalations** `status-sweep.ps1` §5 lists. They live in gitignored
  folders; clearing them is a board mutation with no reader.
- **Did not restate the `ConvertFrom-Json` collapse in DOCTRINE.** §9.4 already prescribes the cure;
  a fourth phrasing of it is the drift STATION-CAPABILITIES §3 was corrected for.
- **Azure / Entra / SharePoint: not touched.** No portal, no `az`, no `Connect-MgGraph`.
