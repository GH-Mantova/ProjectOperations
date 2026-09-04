# Station 00 — Supervisor | 2026-09-04T04:09Z–2026-09-04T04:2xZ

## GROUND

```
UTC            2026-09-04T04:09:13Z  (start)
origin/main    149ff172              (git fetch origin --prune, then rev-parse --short origin/main)
dev tree       main @ cd06e4d1 -> 149ff172 after ff   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md)
```

Versions AGREE — this run was not restricted to read-only.

**Tree I read the binding documents in: the DEV TREE `C:\ProjectOperations2`**, per the
`station-contract v2` freshness clause. `DOCTRINE.md` and `STATION-CAPABILITIES.md` were read from
`origin/main` (both differed from `HEAD` at start — 83 and 60 changed lines — so the working copies
were genuinely stale and the fresh text was taken from `git diff HEAD origin/main` plus the working
copy). `00-supervisor.md` was byte-identical between `HEAD` and `origin/main`.

`status-sweep.ps1` at 04:12:13Z: **SAFE TO ACT** — no board mutation in progress, no recent remote
activity, no live station worktrees. Section 0 positive controls both PASSED (`gh` saw merged #1565;
`node` ran). Re-checked immediately before the arm: `in-progress: 0`, `git diff --cached` empty,
watcher node count 1 (pid 24744).

## WHAT I MEASURED

**M1. The board is EMPTY in both directions — this is the headline.**
[MEASURED] `status-sweep.ps1` section 1 at 04:12:13Z: **OPEN PRs: 0**. `main` CI on `149ff172`:
4 success / 0 failed / 0 running (trunk green).
[MEASURED] `Get-ChildItem docs\pr-prompts -Filter *-ready.md` at 04:10Z → **0 files**.
Zero open PRs *and* zero armed prompts means nothing was in flight and nothing would enter flight:
the watcher was alive (pid 24744, wrapper alive) with nothing to consume. An idle watcher with 0
armed prompts is CORRECT, not wedged — but an idle watcher with 0 armed prompts *and* an empty board
is a pipeline that has stopped producing, and 00 is the only station that can restart it.

**M2. There was nothing left to COLLECT.** `node scripts/pipeline/check-breadcrumb.mjs --freshness`
→ exit **0**, `CLEAN`, `structure: 14 checked, 0 malformed`. Freshness: `00` 1.1h (cadence 2h) ok ·
`02` dispatch-only · `03` 5.2h (24h) ok · `04` 2.1h (4h) ok · `05` 6.3h (24h) ok. **No station is
SILENT and no station has a newer breadcrumb than the last 00 run collected.** The newest non-00
breadcrumb is `00-04-scanner-2026-09-04-0210`, and my own 0309Z run (merged as #1565) already
dispositioned all five of its findings — verified by reading that breadcrumb's FINDING 3, which
carries the four dispositions verbatim. **I am not re-dispositioning them; re-collecting a collected
breadcrumb is how one signal gets acted on twice.**

**M3. `git merge --ff-only` was blocked by ONE file, and that file's working content was already
byte-identical to the merge target.** [MEASURED] `git status --porcelain` showed
` M docs/pipeline/sweep-rotation.json`, and the ff aborted naming only that path. But
`git diff -- <path>` and `git diff HEAD origin/main -- <path>` printed the **same** two-line hunk and
the **same** blob id `3a81289c` on both sides: Station 04 advanced the rotation locally at 02:10:41Z
and asked 00 to commit it (its WHAT CHANGED §2), and a later 00 run had **already committed exactly
that content**. So the local edit was not pending work — it was a duplicate of main.
[MEASURED] cure: `git checkout -- docs/pipeline/sweep-rotation.json` (single file pathspec, never
`checkout .`), then `git merge --ff-only origin/main` → `Updating cd06e4d1..149ff172`; read back
`git rev-parse --short HEAD` → `149ff172` and `git hash-object docs/pipeline/sweep-rotation.json`
→ `3a81289c`, i.e. **the advanced rotation state survived the checkout**, because main already
carried it. Nothing was lost. **The general shape is worth keeping: before treating a blocking local
modification as work, compare its blob against the merge target — a `M` that matches the target is a
duplicate, not a conflict.**

**M4. Station 04's request to 00 was already discharged.** 04's breadcrumb says
*"LEFT DIRTY AND UNCOMMITTED ON PURPOSE — Station 00 must commit it… If it is not committed the next
run repeats repo-hygiene and the rotation silently stops."* [MEASURED] `origin/main` holds
`last_index: 2`, `last_run_utc: 2026-09-04T02:10:41Z`, `last_station: 04-scanner` — the rotation
did advance on main. 04's instruction was correct when written and was satisfied between then and
now. **Recorded so the next run does not go looking for an uncommitted rotation.**

**M5. The dev tree's working-tree deletion of a consumed HOLD matched main.**
[MEASURED] at start, ` D docs/pr-prompts/pr-doctrine-s95-cite-symbol-not-line-HOLD.md`; present at
`HEAD`, **absent** from `origin/main` (`git ls-tree -r --name-only origin/main -- <path>` → empty,
against `HEAD` → the path). This is the arming-consumption of #1563 whose HOLD my 0309Z run deleted
from main in #1565. The ff resolved it cleanly (`delete mode 100644 …-HOLD.md` in the merge output).
This is the ` D`-not-`RD` case DOCTRINE 9.5 describes, resolving correctly.

**M6. Watcher and machine state — 03's lane, unchanged from 04's 02:10Z reading.**
[MEASURED] sweep §2: watcher node RUNNING pid 24744, auto-restart wrapper alive (1), heartbeat age
56 min (ticks only mid-run; stale + empty queue = idle, not wedged), **watcher clone `dirty=1`**,
5 non-main worktrees (`C:/po-1483-fix` 2993 min, `C:/po-guard` 248 min, `C:/po-queue` 132 min,
`C:/po-sa-fix` 1355 min, `C:/po-work/s2-e2e` 3121 min — all `dirty=0`), 2 registry escapees
(`fix-1523`, `vs-s2-durable-smoke`, both 0KB, no `.lock`). Sweep §3: 0 in-progress prompts,
`index.lock` false in both trees, 0 git processes, no PR touched in the last 2 min.

**M7. The arming detector, with its positive control.** [MEASURED] case-sensitive
`Select-String -Pattern 'watcher: do-not-arm','DO NOT ARM','Arm ONLY' -CaseSensitive`:
target `pr-queue-armed-tracked-detector-HOLD.md` → **0 lines**; positive control
`pr-524-rates-b-slice2-canonical-HOLD.md` → **2 lines** (`…DO NOT ARM YET. IRREVERSIBLE TABLE
DROP…` and `## Arm ONLY when ALL of these are true…`). **The grep can produce a positive**, so the
zero on the target is a measured zero. I also read the target's body in full: its only gate-shaped
heading is the boilerplate `## STANDING AUTHORITY`, which DOCTRINE 9.5 records as appearing on ~51 of
59 prompts and is an arming GRANT, not a gate. No prose gate.

**M8. The premise and the `requires_on_main` gate, executed rather than read.**
[MEASURED] premise `! test -f scripts/pipeline/check-armed-tracked.mjs`: `Test-Path` → `False` and
`git ls-tree -r --name-only origin/main -- scripts/pipeline/check-armed-tracked.mjs` → empty, so the
premise is TRUE and the work has **not** shipped under another PR.
[MEASURED] `requires_on_main: .github/workflows/ci.yml :: check-sot-refs` → present on `origin/main`
(`- run: node scripts/pipeline/check-sot-refs.mjs`), negative control `zzzNoSuchCheckerZzz` → **0**.
[MEASURED] `node scripts/pipeline/lint-prompt.mjs …` → `ADMIT (size 3)`, exit **0**.

## WHAT CHANGED

1. **Dev tree converged.** `C:\ProjectOperations2` `cd06e4d1` → `149ff172` = `origin/main`, by the
   single-file cure in M3. Read back: `git rev-parse --short HEAD` → `149ff172`.
2. **ARMED exactly one prompt** — `pr-queue-armed-tracked-detector`, via
   `scripts\pipeline\arm-prompt.ps1 -Name pr-queue-armed-tracked-detector` (the primitive; never a
   bare `git mv`). `-WhatIf` first: index clean, plan `D …-HOLD.md` / `A …-ready.md`, all checks
   pass. Then the real run: lock acquired (PID 20292), ADMIT re-run inside the lock, rename, index
   verified to contain exactly the two expected paths, audit line written, index released.
   **Read back:** `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → exactly one file,
   `pr-queue-armed-tracked-detector-ready.md`; `Test-Path …-HOLD.md` → `False`; `.arming-log.txt`
   tail → `2026-09-04T04:15:30Z  ARMED  pr-queue-armed-tracked-detector  escalates=false  pid=20292`.
3. **Archived 9 fully-dispositioned breadcrumbs** (all dated 2026-09-03) into
   `docs/pr-prompts/archive/`, in this PR. Safe for freshness: `check-breadcrumb.mjs` builds its
   tracked set with `git ls-tree -r` and matches by **basename** (DOCTRINE 9.5), so 03's `2302` and
   05's `2154` still count. Re-run of `--freshness` after the move is quoted in this PR body.
4. **This breadcrumb**, written inside this run's own PR — the home the contract calls best.

Nothing else. No PR merged, no label touched, no `/sot/` file read for edit, no lock cleared, no
worktree or branch or stash deleted, no `git` run against the Windows `.git` through the device
bridge.

## FINDINGS

### FINDING 1 — the board reached ZERO open PRs and ZERO armed prompts; the pipeline had stopped producing. — S2

[MEASURED] M1. Both counts were zero at 04:10–04:12Z, with a healthy watcher and a green trunk. That
is not a fault in any component — every instrument reads correctly — and that is exactly why it is
worth naming: **an idle pipeline is indistinguishable, to every liveness probe this pipeline owns,
from a well-behaved one.** `restart-watcher-if-wedged.ps1` would say OK. The heartbeat is stale by
design. `--freshness` says CLEAN. The sweep says SAFE TO ACT. Nothing anywhere says *"and nothing is
being built."*

The cause is ordinary and not a defect: the previous four 00 runs (0009, 0109, 0209, 0309) each
landed their own docs PR and the last of them merged at 03:22Z, draining the board. 37 of 79 HOLDs
lint ADMIT, so the queue is not empty of candidates — only of armed ones.

**DISPOSITION: ACTIONED — armed `pr-queue-armed-tracked-detector` (WHAT CHANGED §2).** Chosen
against 36 other ADMIT candidates on measured damage: `.gitignore:75` swallows any prompt armed by
*creation* rather than by rename, and the prompt's own body records **three** rescued sets plus one
set (`rates-column-hygiene`, 2026-08-20) that was **destroyed** and survived only because it had
already been pushed to a branch. The fix is additive (a new checker plus a test plus one CI wiring
line), touches no existing behaviour, and explicitly forbids changing `.gitignore` — so RULE 1's
*complete* and *does not damage existing or future data entry* halves both pass.

⚠️ **Its scope is `scripts/` and `.github/`, i.e. outside `^(tests|docs)/`, so when the watcher
opens its PR the `tests-docs` policy will route it to Marco.** That is correct and expected; the
next 00 run should drive it green and **leave it unmerged** (RULE 2). Do not read the resulting
`marco:true` as a defect.

### FINDING 2 — a `git merge --ff-only` blocked by a local modification that was already on main — S3

[MEASURED] M3. The naive readings all say "you have uncommitted work": `git status` says ` M`,
`git diff --numstat` says `2 2`, and the ff refuses by name. The reading that settles it is the blob
comparison — `git diff -- <path>` and `git diff HEAD origin/main -- <path>` produce the **identical**
hunk and the identical target blob `3a81289c`. The local edit was a duplicate of a commit already on
`origin/main`, so `git checkout -- <single path>` destroyed nothing and the ff restored the same
bytes.

This matters because the standing cure recorded in project memory is *"`--numstat` empty → `checkout
-- <pathspec>` → ff"*, and `--numstat` here was **not** empty — a run following that rule literally
would have concluded the cure did not apply and either left the dev tree stale (which is the
stale-tree arming trap) or stashed real work. **The generalisation: `--numstat` empty is sufficient
but not necessary. The necessary test is whether the working blob equals the merge target's blob.**

**DISPOSITION: ACTIONED — cured this run, read back at `149ff172`, and the rule generalised above.**
Not escalated: it is a method note, and this breadcrumb is its durable home.

### FINDING 3 — Station 04's hand-off to 00 (`sweep-rotation.json`) was already discharged, and its wording will send the next reader looking — S4

[MEASURED] M4. 04's 02:10Z breadcrumb instructs 00 to commit `docs/pipeline/sweep-rotation.json`,
warning that otherwise *"the next run repeats repo-hygiene and the rotation silently stops."* On
`origin/main` the rotation is already at `last_index: 2 / 2026-09-04T02:10:41Z`. The instruction was
true when written and false by the time the next 00 run read it — the same shape DOCTRINE 9.5 records
about a claim that outlives its own truth, here at a four-hour scale rather than a thirteen-hour one.

Worth one line rather than a fix: the general cure (a disposition addressed to a FUTURE run outlives
its own fix and bills a later run to re-discover it) is already recorded, and 04's note did name the
falsifying probe implicitly — reading the file on main answers it in one command.

**DISPOSITION: DEFERRED.** It becomes worth acting on if a station hand-off of *state* (as opposed to
a finding) happens a third time; the cure would be that a hand-off names the probe that closes it.
Nothing to do today: the rotation is correct on main and the next 04 run will draw `instruction-drift`.

### FINDING 4 — machine hygiene is unchanged and still 03's, with nothing new since 04 measured it — S4

[MEASURED] M6. Five non-main worktrees, all `dirty=0`; two 0KB registry escapees; watcher clone
`dirty=1`. 04's 0210 breadcrumb already measured each of these and my own 0309 run already
dispositioned its findings (`fix1483` DEFERRED — irreversible; the `C:\po-work` scanner blind spot
DISPATCHED → 06; the stash-drop advice ESCALATED → Marco). **No new instance and no change in the
readings**, so there is nothing to re-route.

The one line worth adding: the clone's `dirty=1` at 04:12Z is *not* the same dirt 04 read at 02:20Z
— 04's was the in-flight `pr-doctrine-s95` build, which landed as #1563 at 03:10Z. I did not read
this run's clone diff, so I am not claiming to know what it is. **[CANNOT MEASURE] what the clone's
current dirty path is — I deliberately ran no `git` write in `C:\po-watcher\ProjectOperations`, and
I did not spend a read on it because the board was empty and nothing depended on the answer.**

**DISPOSITION: DISPATCHED → Station 03**, whose lane this is and whose next occurrence should read
the clone diff before calling it drift (04's MEASURED-4 is the standing warning: a dirty clone is
usually a build in flight).

## WHAT I DID NOT DO

- **Merged nothing.** There was nothing to merge: 0 open PRs. No `Assert-SmokedOrEscalate`, no
  `Merge-Pr`, no label touched.
- **Armed only ONE.** 37 HOLDs lint ADMIT and the board is empty, which is the strongest pull toward
  arming several. RULE 4 is one at a time; the second one waits for the next run, by which time the
  first will have proved whether the watcher consumes it.
- **Did not arm `pr-hygiene-s1-guarded-branch-prune-HOLD.md`**, although 04 named it ADMIT and it is
  `fix1483`'s own fix. Its work is the irreversible deletion of a remote branch (DOCTRINE 5.4), and
  my 0309 run already DEFERRED that thread pending the `abandoned/<branch>@<sha>` tag-first cure.
  Arming it now would put an irreversible act into an autonomous lane.
- **Did not arm `pr-tr-s1-reminder-policy-HOLD.md`** (schema migration, Marco's),
  **`pr-524-rates-b-slice2-canonical-HOLD.md`** (two literal never-arm markers, irreversible table
  drop), or **`pr-fv2-formrule-contract-HOLD.md`** (standing never-arm list, 00-supervisor.md §4).
- **Did not commit the arming rename.** `arm-prompt.ps1` released it from the index by design; the
  `-ready.md` is gitignored at `.gitignore:75` and the `-HOLD.md` deletion belongs to the PR the
  watcher opens. Committing it here would race that PR — and F4 of 04's breadcrumb is precisely the
  defect of the HOLD *not* being deleted, which is the armed prompt's own PR's job, not mine.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** No `az`, no `Connect-MgGraph`.
- **Did not clear a lock, prune a worktree, drop a stash, or delete a branch.** All irreversible,
  none mine, and the sweep found no lock to clear.
- **Did not re-disposition Station 04's 0210 findings** — my 0309 run already did, and acting twice
  on one signal is the failure the collect channel exists to prevent.
