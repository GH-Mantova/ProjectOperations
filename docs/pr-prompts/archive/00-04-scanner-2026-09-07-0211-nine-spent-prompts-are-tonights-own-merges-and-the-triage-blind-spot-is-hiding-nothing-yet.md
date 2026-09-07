# Station 04 - Scanner | 2026-09-07T02:11:14Z-2026-09-07T02:24Z

## GROUND

```
UTC            2026-09-07T02:11:14Z
origin/main    5a824702            (fetched, then rev-parse)
dev tree       main @ 5a824702     C:\ProjectOperations2   (was 14c6810c, 4 behind; I fast-forwarded - see WHAT CHANGED)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Doc version and bootstrap AGREE. Run was NOT read-only-restricted on that account.

Sighted run. Desktop Commander reached the box on the first call.

## WHAT I MEASURED

**Device-bridge git guard (station-contract step 1).** [MEASURED] last line of
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`,
preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)`. Exit 0. INSTALLED.

**Binding documents read from `origin/main`, in the dev tree, per the contract.** [MEASURED]
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` -> a single row, `0 16 docs/pipeline/DOCTRINE.md`. The
station doc and STATION-CAPABILITIES working copies were byte-equal to `origin/main`; DOCTRINE was
16 lines short, so DOCTRINE was read from `git show origin/main:` and not from the working copy.
No piped-hash comparison was made anywhere in this run (DOCTRINE 9.1).

**Sweep selection.** [MEASURED] `node scripts/pipeline/next-sweep.mjs` ->
`SWEEP: gate-liveness ... (rotation position 1 of 4; previous run: 2026-09-06T22:11:26Z)`.
Not chosen by me.

**`status-sweep.ps1`, captured to a file so its own section 7 could be read** (it returns early and
hides the verdict when read inline). [MEASURED] 291 lines. Section 0 controls both PASS
(`gh CAN reach GitHub (saw merged PR #1751)`, `node runs`). Section 7:
`CAUTION: no local lock, but a PR was touched on GitHub in the last 2 min ... prefer to wait`.
I mutated no board object, so CAUTION did not bind this run.
Board at that moment: 4 open PRs - `#1752` `#1750` `#1746` (2 red) `#1740` (2 red, BEHIND).
`armed: 5`, and **all five are `rev-<N>-ready.md` REVIEW JOBS, not arms** - `rev-1748` `rev-1749`
`rev-1750` `rev-1751` `rev-1752`. Watcher node RUNNING pid 31660, heartbeat age 1 min.
`main CI on 5a824702: 0 success / 0 failed / 4 running` -> `[CANNOT MEASURE]`, not a green trunk.

**The dev tree was 4 commits behind, and it mattered.** [MEASURED]
`git diff --name-status HEAD origin/main -- docs/pr-prompts` -> EMPTY, with a POSITIVE control
(the same query with no pathspec returned 16 changed files) and a NEGATIVE control (a minted path
returned empty). So the prompt corpus was identical on both sides - but the incoming commits
touched `apps/api/src/modules/tendering/**`, `apps/web/src/pages/admin/ChargeStepsEditor.tsx`,
`scripts/pr-watcher/index.mjs` and `scripts/pipeline/arm-prompt.ps1`, which is exactly the code
this sweep's premises grep. `lint-prompt.mjs` runs `premise:` against the WORKING TREE, so triaging
without fast-forwarding would have reported tonight's shipped work as still-to-do.

### Gate liveness, part 1 - which prompts are spent

[MEASURED] `powershell -File scripts/pipeline/triage-holds.ps1`, exit 0, 66 `*-HOLD.md` at depth 1.
Its own controls PASSED: `GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md
(114825 chars)` and `SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture`.
Totals: **spent=9 gates-satisfied=25 still-gated=32 unreadable=0 of 66**. Nothing was armed,
renamed, moved or staged.

### Gate liveness, part 2 - is any gate DEAD

Every prompt in the two gate-rejection buckets was checked against `origin/main` by hand.
POSITIVE control `git rev-parse origin/main:CLAUDE.md` -> found; NEGATIVE control on a freshly
minted path -> `does not exist in 'origin/main'`. Symbol probes controlled separately
(`export` in `RatesListsAdminPage.tsx` -> hit; `pid` in `supervise-watcher.ps1` -> hit; minted
needle -> exit 1).

| prompt | gate | on `origin/main`? |
|---|---|---|
| `pr-linefields-s4-scenario-picker` | `RatesListsAdminPage.tsx :: RATE_FIELDS_TABLE_V2` | file yes, **symbol NO** |
| `pr-transport-capacity-column-order` | `RatesListsAdminPage.tsx :: handleUpdateColumn` | file yes, **symbol NO** |
| `pr-triage-holds-open-pr-duplicate-bucket` | `triage-holds.ps1 :: SPENT_BEHIND_A_REJECT_V1` | file yes, **symbol NO** |
| `pr-ci-gate-dead-queue-dir-reads` | `status-sweep.ps1 :: buildRunning` | **NO** |
| `pr-module-provenance-s2` | `lint-prompt.mjs :: deriveModule` | **NO** |
| `pr-fv2-ai-digests` | `apps/api/src/modules/forms/ai-form-import.service.ts` | **NO** |
| `pr-fv2-output-channels` | `apps/api/src/modules/forms/form-digests.service.ts` | **NO** |
| `pr-rates-s11c-drop-legacy-tables` | `docs/approvals/rates-s11c-...-approved-by-marco.md` | **NO** |
| `pr-tenant-mt4-s2-ownership-migration` | `docs/approvals/tenant-mt4-s2-...-approved-by-marco.md` | **NO** |
| `pr-tr-s2-reminder-engine` | `apps/api/src/modules/crm/reminders/reminder-policy.service.ts` | **NO** |
| `pr-tr-s3-manager-escalation` | `apps/api/src/modules/crm/reminders/comms-reminder.service.ts` | **NO** |

**Zero dead gates.** Every one of the eleven is genuinely unreleased, so no premise is being masked
by a stale gate and nothing needed repairing. `pr-ci-gate-dead-queue-dir-reads` and
`pr-module-provenance-s2` carry their `requires_on_main` as a YAML LIST, which my first parser read
as absent - corrected and re-measured before this table was written.

### Two instrument lies I caught in my own probe, and did not file

A hand-rolled premise evaluator over the 32 REJECT prompts printed two `*** HIDDEN SPENT ***` hits.
**Both were my evaluator, not the board.**

- `pr-524-rates-b-slice2-canonical`, premise `grep -q "^model EstimateLabourRate"
  apps/api/prisma/schema.prisma`. My evaluator did a LITERAL substring test; `grep -q` takes a
  BASIC REGEX. [MEASURED] `git grep -c -E "^model EstimateLabourRate" origin/main --
  apps/api/prisma/schema.prisma` -> **1 hit, exit 0**. The premise is TRUE. Caught because
  `pr-rates-s11c-drop-legacy-tables` carries the same needle UNANCHORED and did not trip - two
  near-identical needles cannot honestly disagree.
- `pr-nav-jobs-projects-merge`, premise `grep -q "path=\"/projects\"" apps/web/src/App.tsx`.
  My unescaping mangled the needle to `path="/projects\`. [MEASURED] in node, no shell quoting:
  `src.includes('path="/projects"')` -> **true**; POSITIVE control `src.includes('path="')` ->
  true; NEGATIVE control on a minted needle -> false; and the line is really there,
  `<Route path="/projects" element={<ProjectsListPage />} />`. The premise is TRUE.

Corrected result: **HIDDEN SPENT = 0** across 30 evaluable REJECT prompts (2 of 32 use compound
`sed`/`||` forms my evaluator declined rather than guessed at).

## WHAT CHANGED

1. **Fast-forwarded the dev tree.** `git merge --ff-only origin/main` -> `Updating
   14c6810c..5a824702`, exit 0, 16 files. Read back: `git rev-parse --short HEAD` -> `5a824702`,
   equal to `origin/main`. This is the documented precondition for any triage and is not a board
   mutation. **Nothing else in the tree was disturbed**: the two consumed HOLDs
   (`pr-armguard-s1-...`, `pr-deps-s2-puppeteer-...`) are still ` D` and the modified
   `.arming-log.txt` is still ` M`, verified by `git status --porcelain` after the merge. No
   `checkout .`, no `reset --hard`, no `stash pop`, no `clean` (DOCTRINE 9.2).
2. **Advanced the sweep rotation.** `node scripts/pipeline/next-sweep.mjs --advance --utc
   2026-09-07T02:21:48Z` -> `advanced: last_index=0 last_run_utc=2026-09-07T02:21:48Z`.
   **`docs/pipeline/sweep-rotation.json` IS LEFT DIRTY (` M`) - Station 00 must commit it**, per
   the AUTHORITY section; 04 may not commit to the shared dev tree.
3. **This breadcrumb**, written to the dev tree at a tracked path. Untracked until a board PR
   sweeps it up.

Nothing armed, disarmed, renamed, moved, deleted, merged, labelled or pushed. No PR opened.

## FINDINGS

### F1 - Nine prompts are SPENT, and NONE of them is rot: eight died in the last 90 minutes

`triage-holds.ps1` reports `spent=9`, which reads like a backlog that stopped being retired. It is
not. [MEASURED] for each spent prompt, the newest `origin/main` commit touching any file in its
`scope:` list:

| spent prompt | killed by | at |
|---|---|---|
| `pr-verdict-anchor-heading-form` | `5a824702` #1751 | 02:08:49Z |
| `pr-watcher-idle-tick-liveness` | `5a824702` #1751 | 02:08:49Z |
| `pr-ew-s2d-alloc-controller` | `df129a38` #1749 | 01:52:01Z |
| `pr-ew-s4-capacity-board-api` | `df129a38` #1749 | 01:52:01Z |
| `pr-tender-lifecycle-s2a-tenderclient-bidstatus` | `df129a38` #1749 | 01:52:01Z |
| `pr-linefields-s1-model-and-validation` | `533e8dbd` #1748 | 01:33:01Z |
| `pr-linefields-s2-step-editor-in-place` | `533e8dbd` #1748 | 01:33:01Z |
| `pr-rates-unit-per-row-columns` | `14c6810c` #1745 | 00:50:00Z |
| `pr-rates-value-column-units` | `af9d89a1` #1713 | 2026-09-06T22:58Z |

Every one of the nine died within the last **3.4 hours**, from five PRs merged tonight. The queue
is not rotting; it is keeping up. Two of them - `pr-rates-unit-per-row-columns` and
`pr-verdict-anchor-heading-form` - sit on the standing never-arm list for reasons that are now
moot: their work shipped. Retiring them removes two entries from that list rather than adding to it.

**A number that reads as a backlog and is really tonight's throughput is worth saying out loud**,
because the available wrong conclusion - "nine finished prompts are sitting armable, arming has
stalled" - points at exactly the wrong remedy.

**DISPATCHED** - Station 00: retire all nine to `docs/pr-prompts/superseded/` in a board PR
(04 is read-only on the board and may not move a prompt). None is arm-dangerous: `lint-prompt.mjs`
exits 3 on each, which is bin-it, not ADMIT.

### F2 - DOCTRINE 10.6's scope cross-check is wrong in BOTH directions, and tonight's board shows one of each

10.6 says: before arming any ADMIT, cross the prompt's `scope:` entries against
`gh pr list --state open --json number,files`. I ran it over all 25 ADMIT prompts against the 4
open PRs. POSITIVE control - a PR's own first file matches itself -> true. NEGATIVE control - a
minted path matches nothing -> true. Five overlaps:

| ADMIT prompt | overlap | open PR | verdict |
|---|---|---|---|
| `pr-rates-plant-fuel-column` | **3/4** | `#1746` *feat(rates): give the plant rate table a Fuel rate column (PLANT_FUEL_COLUMN_V1)* | **TRUE duplicate** |
| `pr-sweep-stale-check-retires-live-escalations` | **1/1** | `#1750` *fix(sweep): section 5 must not retire a live escalation that cites a merged PR* | **TRUE duplicate** |
| `pr-statussweep-local-time-timestamps` | **1/1** | `#1750` | false positive |
| `pr-sweep-dead-queue-dir-reads` | **1/1** | `#1750` | false positive |
| `pr-rateparity-s1-harness` | 1/4 | `#1746` | false positive |

**(a) It UNDER-reports, on the class it exists to protect.**
`pr-rates-plant-fuel-column-HOLD.md` scores 3/4, not 4/4, for one reason: its second `scope:` entry
is `apps/api/prisma/migrations/` - a **directory**. `#1746` contains
`apps/api/prisma/migrations/20260907120000_rates_plant_fuel_column/migration.sql`, which is inside
it. An exact-path set test can never match a directory-form scope entry. By intent the match is
4 of 4 and the PR's own title is the prompt's marker string, `PLANT_FUEL_COLUMN_V1`. **A full-match
rule clears this prompt for arming** - and it is a `gate_allow: migrations` prompt, i.e. Marco's,
which is precisely the class 10.6 exists to stop being duplicated.

**(b) It OVER-reports whenever `scope:` names a single file.** Three prompts share the sole scope
entry `scripts/pipeline/status-sweep.ps1`. `#1750` touches that file, so all three score a perfect
1/1 and only one of them is `#1750`'s work. For a one-file scope the test's precision is zero by
construction.

**What actually separated all five** was the PR TITLE and head branch against the prompt slug
(`fix/sweep-stale-check-live-escalations` vs `pr-sweep-stale-check-retires-live-escalations`;
`feat/rates-plant-fuel-column` vs `pr-rates-plant-fuel-column`) - which 10.6 explicitly warns is
"the *other lane's* naming convention, not a property of the prompt". So the sound test and the
documented test are different tests, and the documented one failed both ways on a four-PR board.

**DISPATCHED** - Station 00, as a DOCTRINE 10.6 amendment (04 cannot open a PR). Proposed wording,
complete-and-additive first per RULE 1:
- **(a) COMPLETE + ADDITIVE, and my recommendation:** match a scope entry ending in `/` as a
  PREFIX against the PR's file paths, and treat any `>=1` overlap as a **CANDIDATE** requiring the
  title/marker check, never as a verdict. Fixes the under-report (a real duplicate can no longer
  hide behind a directory entry) and defuses the over-report (1/1 stops being a conclusion). Damages
  no existing reading; the only cost is that the reader must look at one more field.
- **(b) Full-match-only, plus a special case for directory entries.** Fails the *future* half of
  RULE 1: it repairs this instance and leaves the next scope form - a glob, a rename - to be
  discovered the same way.
- **(c) Drop the scope test and match on head branch.** Fails the *complete* half: 10.6 already
  measured that a prompt asserts no branch at all, so this checks something the prompt never said.

### F3 - `triage-holds.ps1`'s `spent=N of 66` denominator is really `of 34`, the fix is staged and ADMIT, and today it is hiding nothing

`triage-holds.ps1` buckets by `lint-prompt.mjs` exit code alone, and `lint-prompt.mjs` evaluates
the premise **last**. Every prompt rejected on an earlier path exits 1 with its premise never
executed - and a premise never executed can never be reported SPENT, however completely its work
shipped. So tonight's headline `spent=9 ... of 66` was only ever computed over the **34** prompts
(25 ADMIT + 9 SPENT) that reached `runPremise`. The other **32** were unmeasured, and the totals
line does not say so.

This is not a new discovery - it is written up on the board as
`pr-triage-holds-spent-behind-a-reject-HOLD.md`, whose own `premise_means` states it exactly. That
prompt is **ADMIT** (gates satisfied), unarmed, scope is one read-only reporting script, and
[MEASURED] its premise is still live: `SPENT_BEHIND_A_REJECT_V1` is ABSENT from
`origin/main:scripts/pipeline/triage-holds.ps1` (POSITIVE controls `VERDICT` -> hit, `LIVE` -> hit;
NEGATIVE control, minted needle -> exit 1). My dupe scan clears it: it overlaps no open PR.

**What this run adds is the size of the hole, which nobody had measured.** I evaluated the 32
REJECT premises against `origin/main` by hand: 30 evaluable, 2 declined as compound forms, and
after correcting my own two instrument lies (see WHAT I MEASURED) **HIDDEN SPENT = 0**. The defect
is structural and real; its cost at `5a824702` is zero prompts. That is the number that should set
its priority - it is a correctness fix for a reporting script, not a fire.

**DISPATCHED** - Station 00: `pr-triage-holds-spent-behind-a-reject-HOLD.md` is a clean arming
candidate (ADMIT, size 2, `gate_allow: none`, `escalates: false`, no open-PR overlap, one script,
read-only, `git revert`-able). 04 arms nothing. Arming remains 00's on Marco's authority, one at a
time.

## WHAT I DID NOT DO

- **Did not arm, disarm, rename, move or delete any prompt**, including the nine SPENT ones and the
  clean candidate in F3. 04 is read-only on the board; arming is 00's alone.
- **Did not commit anything, and did not open a PR.** The authority matrix gives 04
  *Create a PR: NO*. Both dirty artifacts - `docs/pipeline/sweep-rotation.json` and this breadcrumb
  - are named above for Station 00 to sweep up.
- **Did not touch the four open PRs.** `#1746` and `#1740` are red; `#1752` and `#1750` had pending
  CI. Diagnosing their reds is not this sweep, and merging is not my lane.
- **Did not mint a worktree** to get a clean read (AUTHORITY: that is how `/tmp/po-scan-*` trees are
  orphaned). Everything was read from `origin/main` at the named SHA, or from the fast-forwarded
  dev tree.
- **Did not run `git` through the device bridge against the Windows `.git`.** The VM guard was
  installed first and every git call in this run went through Desktop Commander.
- **Did not run Part 0 / Part 1 / Part 2 of the older station brief** (static cross-layer audit,
  GitHub reconciliation, live-site visual patrol). The AUTHORITY section says take the ONE sweep
  `next-sweep.mjs` names and cover it completely; it named gate-liveness. Rotation advanced so the
  next run gets position 2.
- **Did not touch the orphaned worktree `C:/po-vg`** (66 h old, 1 uncommitted file), reported by
  `status-sweep.ps1`. It holds uncommitted work, `git worktree remove` will refuse, and pruning is
  Station 03's on 00's dispatch. Already escalated by an earlier run; re-stated here only so it is
  not read as newly discovered.
- **Did not touch Azure, Entra or SharePoint.** Absolute.
