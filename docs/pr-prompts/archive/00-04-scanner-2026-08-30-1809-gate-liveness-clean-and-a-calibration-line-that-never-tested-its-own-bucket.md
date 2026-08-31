# Station 04 — Scanner | 2026-08-30T18:09:54Z–2026-08-30T18:19:21Z

## GROUND

```
UTC            2026-08-30T18:09:54Z
origin/main    cb392adb            (fetched, then rev-parse; full SHA cb392adb6622d2caa447f16967da5be93ff57515)
dev tree       main @ cb392adb     C:\ProjectOperations2   (git rev-list --left-right --count origin/main...HEAD = 0 0)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md: station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was not read-only-by-mismatch.

SIGHTED. `start_process` shell `powershell.exe` succeeded, PID 40624. This was **not** a blind run.

The station doc requires the three binding docs be read from `git show origin/main:<path>` rather
than the working copy. `git diff --name-only origin/main -- docs/pipeline/stations/04-scanner.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **empty** at a dev tree
that is `0 0` against `origin/main`, so the working copies read this run ARE the `origin/main`
bytes. [MEASURED]

`status-sweep.ps1` (18:10:27Z): **SAFE TO ACT**. Section 0 positive controls both LIVE. OPEN 0 ·
ARMED 0 · HOLD 61 · in-progress 0 · `index.lock` False/False · git processes 0 · main CI 3/3
success. Watcher node RUNNING pid 26364, wrapper alive (3). [MEASURED]

**SWEEP THIS RUN: `gate-liveness`** — `node scripts/pipeline/next-sweep.mjs` printed
`SWEEP: gate-liveness` `(rotation position 1 of 4; previous run: 2026-08-30T14:09:54Z)`. [MEASURED]

## WHAT I MEASURED

**1. HOLD population and lint classification.** [MEASURED]
`powershell -File scripts\pipeline\triage-holds.ps1` over 61 `*-HOLD.md` at depth 1, 0 `*-ready.md`:

```
=== TOTALS  spent=0  gates-satisfied=30  still-gated=31  unreadable=0  of 61
```

Still-gated splits: `GATE_NOT_RELEASED` 15 · `FILE_GATE_NOT_RELEASED` 9 · `HUMAN_GATE_PRESENT` 7.

**2. Every machine gate, named.** [MEASURED] `lint-prompt.mjs` run per HOLD (61 invocations,
read-only, `--dequeue` never passed) prints the exact gate. All 24 machine gates collected; full
output at `C:\po-sup-fix-scripts\gate-detail-1810.txt`. Example:

```
FILE_GATE_NOT_RELEASED: requires_file_on_main:
"apps/api/src/modules/tendering/allocation.controller.ts" — the file is not on origin/main yet.
```

**3. ZERO orphaned gates. Every gate has a live producer on the board.** [MEASURED]
For each of the 24 gate needles I grepped all 82 depth-1 prompt files for the needle. Every needle
appears in at least one *other* prompt — the predecessor that creates it — and every chain head is
either lint-ADMIT (live) or a Marco approval marker. No gate on this board points at something
nothing produces.

Chain heads verified live: `crm-s3` → s4→s5→s6→s7→{s8,s12}→s9→s10→s11 · `ew-s2c` → s2d→{s3,s4}→s5 ·
`fv2-ai-import` → ai-digests → output-channels · `tr-s1` → s2→s3→s4 · `rates-value-column-units` →
`rates-column-edit-ui` → `transport-capacity-column-order` · `company-manage-s1` → s2 ·
`sor-s9a` → `sor-s9b`.

**4. The 31 premises the gates were MASKING are all ALIVE. No finished work is hiding.** [MEASURED]
This is the half of the sweep `triage-holds.ps1` structurally cannot answer: `lint-prompt.mjs`
rejects at the gate (`exit 1`) *before* the premise runs, so for 31 of 61 HOLDs nobody has ever
measured whether the work is already done. I ran ONLY the premise for all 61, importing the
linter's own `parseFrontMatter` (no second parser) and copying `runPremise` verbatim including its
`broken` status list (no second gate engine — gates were not evaluated at all).

Three-way calibration, same run, same engine:

```
=== CONTROL-known-dead-premise (must read PREMISE-DEAD)  (1)
    alive=0  premise-dead=1  broken=0
=== CONTROL-lint-says-alive (ADMIT; must all read alive)  (30)
    alive=30  premise-dead=0  broken=0
=== GATED-premise-masked-by-gate (the real question)  (31)
    alive=31  premise-dead=0  broken=0
```

The engine can say DEAD (control 1), and it agrees with `lint-prompt.mjs` on all 30 prompts whose
premises the linter has already proved alive (control 2). Only then is `alive=31` believable.
Script: `C:\po-sup-fix-scripts\scan-1810-premise-behind-gate.mjs`.

**5. The five approval-marker gates are correctly spelled and all still closed.** [MEASURED]
`docs/approvals/README.md` names five prompts held on `requires_file_on_main:
docs/approvals/<slug>-approved-by-marco.md`. All five carry that exact line in front matter, each
matching the README table byte for byte, and all five also carry `escalates: true`.
`git ls-tree -r --name-only origin/main -- docs/approvals/` returns **only `README.md`** — no
approval marker has landed, so all five gates are correctly closed and waiting on Marco.

**6. LEAD, for the next `instruction-drift` rotation (not my sweep this run).** [INFERRED]
`docs/pipeline/stations/04-scanner.md` tells this station two different things about scope: the
AUTHORITY section says *"Take ONE named sweep per run and cover it completely"*, and the older
station brief below it says PART 0 *"do this FIRST, ALWAYS"* plus PART 1 and PART 2 every run. The
file's own preamble resolves it (`the contract and DOCTRINE win`), so this is not a defect — but a
fresh run pays to re-derive that every time. Worth folding when the rotation reaches
`instruction-drift`.

## WHAT CHANGED

`docs/pipeline/sweep-rotation.json` — advanced, in the dev tree working copy, **unstaged**:

```
node scripts\pipeline\next-sweep.mjs --advance --utc 2026-08-30T18:09:54Z
advanced: last_index=0 last_run_utc=2026-08-30T18:09:54Z
git diff --stat -- docs/pipeline/sweep-rotation.json  ->  1 file changed, 2 insertions(+), 2 deletions(-)
```

**Station 00: this file and this breadcrumb must be committed together**, or the next run repeats
`gate-liveness` and `instrument-honesty` never runs. `git diff --cached --name-status` was **empty**
at the start of this run and I staged nothing — the shared dev index is as I found it.

Nothing else changed. No prompt was armed, disarmed, renamed, moved, staged or deleted. No PR was
touched. `triage-holds.ps1` and `lint-prompt.mjs` were both run without `--dequeue`.

## FINDINGS

### F1 [S3] `triage-holds.ps1` prints "calibrated" without ever exercising the one bucket it exists for

The script's own header calls `exit 3` (SPENT) *"the literal answer to 'already satisfied' and the
reason this script exists."* Its self-calibration counts how many of the three buckets are non-empty
and, at 2 or more, prints:

```
calibrated: 2 distinct verdicts observed, so the probe can both pass and fail.
```

`spent=0` has now been the reading on **two consecutive runs** — 59 HOLDs at 12:2xZ, 61 HOLDs at
18:1xZ — so the two verdicts observed were `ADMIT` and `REJECT` **both times**, and the SPENT branch
has never once been seen to fire. DOCTRINE §7 standing guard 1: *prove the check CAN pass before
believing it failed.* As written the line reassures the reader about exactly the bucket it did not
test. [MEASURED, `scripts/pipeline/triage-holds.ps1:118-127`]

I proved `exit 3` IS reachable today, with a fixture written **outside** the queue so it matches no
watcher glob (`C:\po-sup-fix-scripts\fixture-spent-1810.md`, premise
`grep -q "zz-scanner-positive-control-never-present-zz" package.json`):

```
STALE  fixture-spent-1810.md
       Premise no longer holds: ...  The work is ALREADY DONE. Binned before spawning an agent.
EXIT=3
```

So `spent=0` is a true reading of this board — but only because I ran that control by hand, and the
next run will not.

**RULE 1 options.**

- **(A) complete + additive — check the fixture in and make the script run it.** Add
  `scripts/pipeline/fixtures/spent-positive-control.md` (a prompt with a legitimately-false premise;
  NOT under `docs/pr-prompts/`, so no glob, no queue count, no arming surface). At the top of
  `triage-holds.ps1`, lint that fixture and require `exit 3`; if it is anything else, print
  `!!! SUSPECT: the SPENT bucket is UNMEASURABLE this run — spent=0 proves nothing` and say so again
  in the TOTALS line. Solves it immediately and permanently, adds a file and a check, changes no
  existing behaviour, touches no data. Both halves of RULE 1 pass.
- **(B) weaken the sentence only** — change `calibrated: N distinct verdicts` to name *which*
  verdicts were seen, so `spent` never silently counts as covered. Fixes the false reassurance;
  **fails the "completely / future" half** — the bucket is still untested every run.
- **(C) leave it** — fails both halves.

**DISPATCHED → Station 00.** Landing this is a `scripts/` + fixture change; Station 04 is read-only
on the board and cannot open a PR (STATION-CAPABILITIES §5). While the OAuth block stands an armed
prompt would burn on the 401 without producing the fix, so this is handed over as a patch to land by
hand, not staged as a prompt. Recommend (A).

### F2 [S3] `[regex]::Escape()` fed to `Select-String -SimpleMatch` matches NOTHING, silently — it nearly cost this run six phantom findings

`-SimpleMatch` takes a **literal**. `[regex]::Escape("reminder-policy.service.ts")` returns
`reminder-policy\.service\.ts`, and searched literally that string is in no file, so the query
returns zero and reads as *"nothing on the board produces this gate's target."* It exits 0 and warns
nothing. [MEASURED]

In this run's first producer scan it reported **6 of 7** gate producers ABSENT:
`allocation.controller.ts`, `ai-form-import.service.ts`, `form-digests.service.ts`,
`reminder-policy.service.ts`, `tender-reminder.service.ts`,
`tender-reminder-escalation.service.ts`, `company.manage` — every needle containing a `.`. The two
needles that reported correctly, `detectUnallocated` and `pushBack`, are the only two with no regex
metacharacter in them. Written up as-is it would have read as *"six orphaned gates, six chains
parked forever"* — six confident, coherent, wrong findings, in the same shape as all six §7 lies.

Caught because the arithmetic did not close: the successor's own front matter **contains** the path
it gates on, so a board-wide count of zero was impossible. Re-run without the escape, with a
`zz-...-zz` negative control returning 0 and both dotless positives returning hits, every producer
appeared (see WHAT I MEASURED item 3).

**Not a live code defect.** All 115 scripts under `scripts/` were scanned: `SimpleMatch` appears on
5 lines, all in `status-sweep.ps1:73,74,75,87,88`, and **none** of them wraps the pattern in
`[regex]::Escape` — every one is a bare literal, which is correct usage. So this is doctrine, not a
repair. [MEASURED]

Proposed bullet for **DOCTRINE §9.3** (inside `CANONICAL-BLOCK: instruments v2`, so
`lint-station.mjs`'s recorded hash must be re-recorded in the same PR — the #1401/#1402 procedure):

> 🔴 **`Select-String -SimpleMatch` takes a LITERAL, so `[regex]::Escape()` must NEVER be applied to
> its pattern.** The escaped form `reminder-policy\.service\.ts` is searched *with the backslashes*,
> matches nothing, and exits 0 — an absent-needle reading that is really an unusable query. Measured
> 2026-08-30: it reported 6 of 7 gate producers absent, and the only 2 needles it got right were the
> only 2 with no `.` in them. **Control every literal search against a needle you know is present
> AND one you know is not** — a dotless control passes while every dotted query silently fails.

**DISPATCHED → Station 00**, same reasoning as F1: a docs PR is outside 04's authority, and while
OAuth is dead a DOCTRINE correction is landed by hand rather than armed.

### F3 [S4] Lint output cannot tell an operator "this is waiting on Marco's approval marker"

Of the five prompts `docs/approvals/README.md` holds on an approval marker, only **two** report
`FILE_GATE_NOT_RELEASED` naming the marker (`rates-s11c-drop-legacy-tables`,
`tenant-mt4-s2-ownership-migration`). The other three — `pr-524-rates-b-slice2-canonical`,
`pr-retire-tenderclientnote-s2`, `pr-siteid-notnull-backfill` — report `HUMAN_GATE_PRESENT`,
because the literal do-not-arm check fires at `lint-prompt.mjs:728` **before** the file gate is
evaluated. Same protection, two different reported reasons, and for those three the approval gate
is invisible in lint output. [MEASURED]

This is **fail-closed** — the file gate still holds even when unreported — which is why it is S4 and
not higher. The risk it carries: someone who removes a do-not-arm comment believing the approval has
landed gets an `ADMIT`-looking picture from a prompt that drops production tables, and only the file
gate underneath is still holding. All five front-matter gate lines were verified present and
correctly spelled this run, so nothing is broken today.

**DEFERRED.** It becomes urgent the moment a do-not-arm comment is edited on any of the five, or the
first approval marker lands and the pair stop agreeing. If it is worth fixing, the cheap version is
for `lint-prompt.mjs` to report *both* gates when both are present rather than short-circuiting on
the first.

## WHAT I DID NOT DO

- **Armed, disarmed, staged, renamed or retired nothing.** ARMED stayed 0, HOLD stayed 61. The
  OAuth block stands (Station 00's standing item) and 04 has no arming authority in any case.
- **Staged no fix prompt**, though my budget allows two. Both F1 and F2 are handed to Station 00 as
  patches to land by hand instead. A prompt armed while the OAuth token is expired burns on the 401
  and produces no fix; a prompt staged and not armed is a 62nd HOLD in a queue this station has just
  spent a run measuring. Dispatching with the exact patch text is the complete-and-additive move.
- **Did not repair any gate**, because none needed repair — 0 dead, 0 orphaned, 0 spent.
- **Did not run Part 0 / Part 1 / Part 2** of the older station brief. The AUTHORITY section's
  one-sweep-per-run rule governs (`the contract and DOCTRINE win`), and `gate-liveness` was covered
  completely. Logged as a lead for the `instruction-drift` rotation (WHAT I MEASURED item 6).
- **Did not touch the watcher, the watcher clone, or its `dirty=35`.** That is Station 03's lane and
  a known standing amber (`verdict-archive` moves 35 tracked files without committing).
- **Did not mint a worktree.** Everything was read from `origin/main` at a named SHA in the dev tree,
  per the 2026-08-24 supersession of the CLEAN-TREE MANDATE.
- **Did not clear the `[STALE]` escalations** `status-sweep.ps1` §5 lists (7 files referencing merged
  or closed PRs). They live in gitignored folders and clearing them is a board mutation.
- **Azure / Entra / SharePoint: not touched.** No portal, no `az`, no `Connect-MgGraph`.
