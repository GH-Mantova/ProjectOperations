# Station 04 - Scanner | 2026-09-03T18:10:45Z-2026-09-03T18:40Z

## GROUND

```
UTC            2026-09-03T18:10:45Z
origin/main    e7f55174            (git fetch origin --prune, then rev-parse)
dev tree       main @ e7f55174     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

[MEASURED] `origin/main` advanced to `bf0fa62a` at 18:23:06Z, mid-run. **Every finding below is
stamped at `e7f55174`** and was not re-measured against `bf0fa62a`; treat any count as state.

Versions agree, so this run was NOT read-only-by-mismatch.
**SIGHTED, not blind.** `start_process` (powershell.exe) returned PID 22232 on the first
call and every measurement below is a Windows-host probe. This was not a quiet blind run.

Sweep taken: **gate-liveness** (`node scripts/pipeline/next-sweep.mjs` -> `SWEEP: gate-liveness`,
rotation position 1 of 4, previous run 2026-09-03T10:10:38Z). Advanced after the sweep with
`--advance --utc 2026-09-03T18:10:45Z`; `docs/pipeline/sweep-rotation.json` is left **dirty in the
dev tree** for Station 00 to commit (04 may not commit it). Next sweep: `instrument-honesty`.

## WHAT I MEASURED

**Working copy is byte-identical to origin/main for every document this run depends on.**
[MEASURED] `git hash-object <path>` vs `git rev-parse origin/main:<path>` for
`docs/pipeline/stations/04-scanner.md` (4374f07a), `DOCTRINE.md` (ea91409d),
`STATION-CAPABILITIES.md` (eeaaf877), `next-sweep.mjs` (00f7502d), `sweep-rotation.json`
(9cc3f979) - all `same=True`. So reading the working copy was safe this run.

**Board (status-sweep.ps1, 18:11:17Z and 18:11:55Z).** [MEASURED] 4 open PRs (#1544 UNKNOWN green,
#1543 CLEAN green, #1541 CLEAN green, #1536 BLOCKED 2 fail); main CI on `e7f55174` 4 success;
watcher node RUNNING pid 24744, wrapper alive, heartbeat 52 min; 0 in-progress prompts, 0 git
processes, no `index.lock`; armed `*-ready.md` = **0**; 3 orphaned worktrees + 2 registry escapees
(03's, unchanged); watcher clone `dirty=3`. Section 7 verdict: **SAFE TO ACT**. 04 mutated no
board state regardless.

**HOLD triage (`scripts/pipeline/triage-holds.ps1`, read-only, 17.4 s).** [MEASURED] 80 `-HOLD.md`
at depth 1: **spent=1, gates-satisfied=47, still-gated=32, unreadable=0**. Its own two controls
passed - `GIT control: PASS` (read `origin/main:DOCTRINE.md`, 50830 chars) and `SPENT control:
PASS` (exit 3 reachable on a fixture) - so a zero in either bucket would have been meaningful.

**Every HOLD premise executed against the tree at `e7f55174`.** [MEASURED] scratch harness
`C:\po-sup-fix-scripts\04-gate-liveness-2026-09-03.mjs`, which imports lint-prompt.mjs's OWN
exported `parseFrontMatter` (no second front-matter parser) and mirrors `runPremise`'s
Git-for-Windows bash and its broken/false discrimination. Controls first, all three reachable:
`NEEDED` (`test -f CLAUDE.md`), `SPENT` (status 1), `BROKEN` (status 127), plus
`fileOnMain` yes=true / no=false.

```
SUMMARY spent=1 needed=79 broken=0 nopremise=0 of 80
```

**The masking question the sweep exists to ask, answered: nothing is masked.** Gate checks run at
`lint-prompt.mjs:1306/:1319/:1343`, the premise only at `:1525`, so a HOLD stopped by a gate never
has its premise evaluated. [MEASURED] Of the 32 gate-stopped HOLDs, **zero** have a false premise.
The single SPENT prompt, `pr-tfm-s10-guard-site-fallback-HOLD.md`, has no gates at all and is
already visible to lint as exit 3.

**No dead `requires_merged` gate exists.** [MEASURED] 6 HOLDs declare one (#1361, #1317, #1351,
#1348, #1257, #1111); `gh pr view N --json state` returns `MERGED` for all six.

**Gate-target liveness, the "?" cases.** [MEASURED] 9 gates name a path absent from origin/main
(`OtherOperationalCosts.tsx`, `CuttingSection.tsx`, `agreed-record-register.controller.ts`,
`waste-facility.ts`, `backfill-waste-map-location-ids.mjs`, `waste-map-location-backfill.md`,
`STEP-11C-DONE.md`, `allocation.controller.ts`, `ai-form-import.service.ts`, plus four
`docs/approvals/*-approved-by-marco.md`). [INFERRED] Every one is produced by a prompt still live
in the queue (cardui s6->s7->s8, sor-s9a, tipid s1->s2->s3, ew-s2d->s4, fv2-ai-import) or is a
Marco approval file by design. **None is dead**; the chains are intact.

**My gate parser agrees with the real engine on all 80.** [MEASURED] Every prompt my harness
called gate-UNMET, lint rejected with `GATE_NOT_RELEASED`/`FILE_GATE_NOT_RELEASED`; every prompt
lint ADMITted, my harness called gate-MET or gateless. No disagreement in either direction - the
control that would have voided the table.

**BOARD TRAP: clean.** [MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`
(703 entries; 89 at depth 1 - both controls > 0): **0** tracked `*-ready.md` at depth 1.

**Queue publication parity: perfect.** [MEASURED] 80 HOLDs on disk, 80 tracked on main, **0** on
disk only and **0** tracked-but-deleted. The #1546 fix (prompts that lived on one machine only)
is holding.

## WHAT CHANGED

- **Staged one prompt**, lint-clean: `docs/pr-prompts/pr-lint-requires-merged-gate-unevaluated-HOLD.md`
  (`node scripts/pipeline/lint-prompt.mjs <file>` -> `ADMIT (size 3)`, exit 0; negative control
  `pr-cardui-s6-...-HOLD.md` -> `REJECT [GATE_NOT_RELEASED]`, so the ADMIT is not a broken query).
  1 of the 2-per-run staging budget. **Untracked** until a board PR commits it.
- **Advanced the sweep rotation.** `docs/pipeline/sweep-rotation.json` is modified and uncommitted
  in the dev tree. **Station 00 must commit it** or the next run repeats gate-liveness.
- **This breadcrumb.** Untracked until a board PR commits it.
- Nothing armed, disarmed, renamed, moved, merged, labelled or deleted. No `/sot/` edit. No PR
  opened. No Azure/Entra/SharePoint contact of any kind.
- Scratch only, outside the repo: `C:\po-sup-fix-scripts\04-gate-liveness-2026-09-03.mjs`,
  `04-board-trap-2026-09-03.mjs`, `04-prose-gate-detector.mjs`, `04-requires-merged-probe.mjs`,
  their outputs, and three `pr-zzfixture-*-HOLD.md` fixtures. **None is in `docs/pr-prompts/`**,
  so none matches a watcher glob.

## FINDINGS

### F1 - S2 - Two HOLDs assert a dependency gate that their front matter never declares

`pr-bp-s2-worth-chasing-view-HOLD.md` and `pr-ea-s2-dashboard-preset-HOLD.md` each say twice, in
the body, that their predecessor is gated:

```
- **BP-1 is merged** (gated by `requires_file_on_main` above). The endpoint is: ...
- Do NOT use `requires_merged` - dependency is declared via `requires_file_on_main` above.
- **EA-1 is merged** (gated by `requires_file_on_main` above). Report keys available: ...
- Do NOT use `requires_merged` - the dependency is declared via `requires_file_on_main`
```

[MEASURED] **There is no `requires_file_on_main` in either front matter, and no other dependency
key either.** bp-s2 declares `premise / premise_means / scope / done_when / size / gate_allow /
seed_only / escalates`; ea-s2 adds `backfill / rollback_strategy`. Read back through the real
parser (`parseFrontMatter`), both come back with all three dependency keys undefined.

Consequence chain, all of it already tested code:
`hasDeclaredDependencies({requiresMerged:[],requiresFilesOnMain:[],requiresOnMain:[]})` returns
**false** - that exact case is asserted at `scripts/pr-watcher/__tests__/dispatch-gate.test.mjs:14`
- so `unmetDependencies` is never called and the watcher dispatches **immediately**, with no gate
evaluated. `lint-prompt.mjs` ADMITs both, so `triage-holds.ps1` files them under
`GATES SATISFIED`, and the `-HOLD` suffix plus the body's own reassurance both read as "chained".
This is the data-side twin of the code-side regression that test file exists to prevent.

**Angle 5, blast radius:** [MEASURED] exactly **2 of 80** depth-1 prompts have zero dependency
keys while their body names one (`04-prose-gate-detector.mjs`; control: 43 prompts DO declare a
key, so the key detector is not blind; 37 are gateless and 35 of those make no claim).

**Not currently operative.** [MEASURED] both predecessors are on origin/main -
`git grep -l "priority-ranking" origin/main -- apps/api/src` ->
`apps/api/src/modules/tendering/tendering.controller.ts`;
`git grep -l "estimator-turnaround" origin/main -- apps/api/src` ->
`.../reporting/estimating-analytics-report.definitions.ts` (+ its spec); negative control
`zzz-no-such-needle-zzz` -> exit 1. So the gate these two prompts think they have would pass
today anyway. The defect is that **no instrument would have told anyone otherwise**, and a prose
gate is invisible to every one of them (DOCTRINE section 9.5, same shape, second surface).

**Suggested repair, and who owns it.** Add the real key to each - bp-s2:
`requires_file_on_main: apps/api/src/modules/tendering/tendering.controller.ts` is too coarse,
prefer `requires_on_main: apps/api/src/modules/tendering/tendering.controller.ts :: priority-ranking`;
ea-s2: `requires_on_main: apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts
:: estimator-turnaround`. Then delete the two prose lines that claim the gate is already declared.

**DISPATCHED -> 06 (PR Master).** The adversarial-critique contract in
`docs/pipeline/stations/04-scanner.md` is explicit that the scanner never edits the prompt under
critique - it files a report line and the owning station acts. Handing over: the two filenames,
the four quoted body lines, the measured absence of the key, the two suggested gate expressions
above, and the detector script that finds the class.

### F2 - S3 - `requires_merged` is a gate the ARMING path cannot see

[MEASURED] `lint-prompt.mjs` validates `requires_merged` as a positive integer (`:124-150`) and
never resolves its state. Fixture experiment - one real prompt copied to scratch three times with
only the PR number changed, linted through the CLI, reproduced twice byte-identically:

```
requires_merged: 1317   (MERGED)                -> lint exit 0
requires_merged: 1543   (OPEN)                  -> lint exit 0
requires_merged: 999999 (does not exist)        -> lint exit 0
```

The MERGED row is the positive control: all three verdicts are identical, so the ADMIT carries no
information about the gate. This falsifies the post-condition `checkGateNotReleased`'s own header
states - *"a bare ADMIT means all declared gates are satisfied"* - and `PROMPT-SCHEMA.md:353`
documents the check as if it happened here.

**Honestly bounded.** The watcher DOES enforce it: `unmetDependencies` (`index.mjs:1230`) runs
`gh pr view <n> --json state` and fails closed. So an armed prompt with an unmet gate is held,
not run. What is broken is narrower: `arm-prompt.ps1` gates on the linter, and
`triage-holds.ps1` files every exit-0 prompt under `GATES SATISFIED` - a heading the instrument
did not check for this key. Station 00 picks arming candidates from that bucket. Blast radius
today = 6 prompts, all pointing at MERGED PRs, so **latent, not operative**.

**DISPATCHED -> 00 (Supervisor), to arm.** Fix staged and lint-clean as
`docs/pr-prompts/pr-lint-requires-merged-gate-unevaluated-HOLD.md` (size 3, `escalates: false`,
scope: `lint-prompt.mjs` + one new test + one PROMPT-SCHEMA row). It uses the injectable-fetcher
pattern already in the file (`checkFixesPrTargetOpen({fixesPr, fetchState})`, `LINT_GH_BIN`), fails
SAFE with a WARN when `gh` cannot answer, and names the one guard it would otherwise trip -
`test-lint-prompt.mjs:246` and `:674` assert `requires_merged: 42` -> exit 0 and would become
network-dependent. **Arming it opens a `scripts/` PR, so the merge is Marco's (RULE 2).**

### F3 - S4 - One HOLD is spent and should be retired

[MEASURED] `pr-tfm-s10-guard-site-fallback-HOLD.md` - premise exits 1 (SPENT); `triage-holds.ps1`
independently reports `STALE` (lint exit 3) on the same file. Its work has shipped; the prompt is
the only thing left. It belongs in `docs/pr-prompts/superseded/`.

**DISPATCHED -> 00.** Moving a prompt is a board mutation and 04 is read-only on the board.
Handing over: the filename, and the two independent instruments that agree it is spent.

## WHAT I DID NOT DO

- **Did not arm, disarm, promote, rename, move or retire anything** - including the spent HOLD in
  F3 and the two mis-declared prompts in F1. Read-only on the board is the whole of 04's lane.
- **Did not edit either prompt in F1.** The report-not-run rule forbids it, and a silent auto-fix
  would poison the design review the rule exists to enable.
- **Did not commit `sweep-rotation.json` or this breadcrumb.** 04 may not commit; the dev tree is
  on `main`. Both are left dirty/untracked for Station 00.
- **Did not run Part 2 (live-site visual patrol).** The sweep rotation named gate-liveness and the
  station doc says the sweep is not my choice; covering one sweep completely beats a shallow pass.
  Nothing about the live site was measured this run - do not read this breadcrumb as covering it.
- **Did not touch the 3 orphaned worktrees, the 2 registry escapees, the watcher clone's
  `dirty=3`, or the `Claude outputs/` untracked directory in the repo root.** All are Station 03's
  or 00's, and all were already reported.
- **Did not go near Azure / Entra / SharePoint**, production data, `/sot/`, or any `git` write
  against a shared tree.
