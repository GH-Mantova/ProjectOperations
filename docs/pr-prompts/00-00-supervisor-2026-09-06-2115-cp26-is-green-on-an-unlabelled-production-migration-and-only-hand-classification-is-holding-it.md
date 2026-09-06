# Station 00 — Supervisor | 2026-09-06T21:08Z–2026-09-06T21:2xZ

## GROUND

```
UTC            2026-09-06T21:08:41Z
origin/main    549dd065            (fetched, then rev-parse)
dev tree       main @ 549dd065     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — full authority this run.

Sighted run. Desktop Commander reached the box on the first call after `ToolSearch`; the tool ids in
this environment are prefixed `mcp__plugin_desktop-commander_desktop-commander__`, not the bare
`mcp__desktop-commander__` form, which is the environment-specific id drift PREFLIGHT step 1 warns
about — a literal `select:` naming the bare ids returned "no matching deferred tools", and that was
an unloaded schema, not an unreachable machine.

Device-bridge git guard installed at the top of the run, last line quoted verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim` (exit 0).

## WHAT I MEASURED

**Binding documents.** All three read IN FULL from the dev tree, which is sound this run because
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** — the working copies are byte-identical to
`origin/main`. [MEASURED] Quoted per PREFLIGHT step 2's sound-form list; no piped hash was taken.

**Sweep.** `status-sweep.ps1` captured to a file (it returns early and hides its own §7 verdict when
streamed). `SWEEP-EXIT=0`, 94,300 bytes. [MEASURED]
🔴 **The capture arrived UTF-16LE and node read it as UTF-8 as `271 lines` of nothing** — a §9.3
`>`-redirection instance, met live: a first pass filtering for `VERDICT|LIVE|armed` matched **0 of
271 lines** and the available conclusion was *"the sweep printed no verdict"*. Re-decoded with a BOM
sniff (`b[0]===0xFF && b[1]===0xFE → utf16le`) the same bytes are a complete, well-formed report.
Nothing warned and nothing was empty. **Sniff the BOM on every `*>` capture before believing it is
short.**

Section 7 verdict, verbatim: `SAFE TO ACT: no board mutation in progress, no recent remote activity,
no live station worktrees.` Section 3: in-progress prompts **0**, `index.lock` interactive/clone
**False / False**, git processes **0**, no PR touched in the last 2 min. [MEASURED]

**Board.** `gh pr list --state open` → **1**. `main` CI on `549dd065`: 4 success / 0 failed. [MEASURED]

**`#1713` — the only open PR, and it is GREEN.** [MEASURED] via `gh pr view 1713 --json` (assigned
then read, never piped into `Where-Object` — §9.4):

| | |
|---|---|
| state / mergeStateStatus / mergeable | `OPEN` / **`CLEAN`** / `MERGEABLE` |
| createdAt | `2026-09-06T11:46:21Z` — **9.5 h open** |
| head / author | `feat/linefields-s1-model-and-validation` / `GH-Mantova` |
| labels | **`[]` — count 0** |
| autoMergeRequest | `False` |
| files | **12** |
| checks | **15 of 15 SUCCESS, 0 fail, 0 pending** |

Its file list carries `apps/api/prisma/migrations/20260907000000_rate_line_fields/migration.sql`,
plus `apps/api/**`, `apps/web/**`, `packages/config/**` and `docs/data-model/metadata-catalog.json`.

**Lane classification for `#1713`.** [MEASURED], with every control this pipeline mandates:

- RULE 2 probe, **pinned to the live tree** `C:\ProjectOperations2\docs\pr-prompts\processed`:
  **2013** logs; newest `rev-1734-ready.md.log` at **`2026-09-06T20:24:07Z`**, which is *younger than
  the PR's `createdAt`* — that age comparison, not `POS>0`, is the control that rejects the
  `C:\po-watcher` decoy (§9.5). POS `marco.:true` (regex form, no quote character) → **617**;
  NEG, a needle minted this run → **0**.
- `PR #1713` over `processed\pr-*.log`, excluding `rev-*` → **0**; NEG `PR #999999` → **0**.
- Daily clone log `…\pr-watcher\logs\2026-09-06.log`, **copied first** (the live file is held open):
  mtime `21:10:01Z`, **fresher than the PR**, so the freshness precondition passes. `opened PR #` →
  **4**, `opened PR #1713` → **0**, POS `[merge]` → **8**, NEG → **0**.
  Per the 2026-09-06T19:2xZ correction this absence is **`[CANNOT MEASURE]`, never "second lane"**.
- Corroboration the kill loop cannot erase — `.arming-log.txt`: **60** lines, last arm
  `2026-09-06T09:20:50Z pr-watcher-verdict-home-resolver`, **2.4 h BEFORE** `#1713` opened. No arm
  inside the PR's window ⇒ no watcher build could have started for it.

⇒ **`[NO LANE VERDICT — hand-classified]`.** `classifyPolicyFiles` refuses it on its own
`(^|/)migrations/` clause before the `tests|docs` test is even reached, and no §10.1 step-3 station
lane covers migrations. **`#1713` IS MARCO'S. DO NOT MERGE.**

**The migration itself is additive.** [MEASURED] by reading the blob from `refs/remotes/pr/1713`:
one `ALTER TABLE "rate_tables" ADD COLUMN IF NOT EXISTS "line_fields" JSONB`, nullable, writing no
row data, behind a `DO $$` guard that raises a named exception if `rate_tables` is absent. No DROP,
no rename, no retype. This is stated so Marco has the fact, **not** as a merge argument — §10.1 step
2 turns on the path, not on the SQL.

**Arming log publication.** `origin/main` **60** lines vs local **60**;
`git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → **EMPTY**. [MEASURED] The
§9.5 two-line-count falsifying probe currently reads CLOSED. The underlying defect — nothing commits
it on purpose — is untouched.

**Watcher.** [MEASURED] `restart-watcher-if-wedged.ps1` (report-only, no `-Fix`), verbatim:
`VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.`
armed **0**, pid **27236**, restart churn **0 cycles in 20 min**. Node `StartTime`
**`2026-09-06T11:49:57Z`**, parent 28392, watcher-family processes **9**.

**Watcher clone, `C:\po-watcher\ProjectOperations` — read-only git only.** [MEASURED]
HEAD `16ddb58b`; **28 BEHIND** `origin/main`, counted in the DEV tree as
`rev-list --count 16ddb58b..origin/main` so no fetch was performed in the clone and the per-tree
`origin/main` trap cannot fire. Stashes **69**. Dirty = **1 untracked file**,
`docs/pr-reviews/pr-1713-review.md`.
`VERDICT_HOME_RESOLVER` → **0** and `VERDICT_HEADING_TOLERANT` → **0** in the clone's `index.mjs`
(POS `classifyPolicyFiles` → **2**, NEG → **0**).

**Freshness.** `check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`; structure 3 checked, 0
malformed. 00 `1.0h ago`, 03 `22.2h`, 04 `3.0h`, 05 `7.0h`, all `ok`. [MEASURED]
⚠️ It printed `00 … (cadence 2h)` against a live cron of `5 * * * *`. That is the known
`const CADENCE =` defect recorded in `STATION-CAPABILITIES.md` §6, confirmed still live here; it is
already filed for Marco and is **not** re-raised.

## WHAT CHANGED

- **Merged: this run's own board PR** (read back below). Nothing else was merged.
- **Archived two collected breadcrumbs** — `…-1908-…` and `…-1930-…` — into
  `docs/pr-prompts/archive/`, both dispositioned by later runs and superseded by them. The current
  cycle (`…-2015-…`) stays in the root.
- **ARMED NOTHING.** **MERGED NO CODE PR.** No label touched, no `/sot/` edit, no watcher restart,
  no `git` write in the clone, no `-Fix` run.

## FINDINGS

### F1 — `Approval receipt (CP-26)` is GREEN on an unlabelled production migration PR, and only hand-classification is holding it

[MEASURED] `gh pr checks 1713` returns **`SUCCESS   Approval receipt (CP-26)`** among 15 green
checks, on a PR that carries **zero labels**, **no receipt in its diff**, a **production schema
migration**, and changes to `apps/api`, `apps/web` and `packages/config`.

This is the sharpest live instance yet of the already-open hole: **CP-26 is armed by LABELLING, not
by the diff.** An unlabelled PR was never "released", so `RELEASED_NO_RECEIPT` cannot fire, and the
one required check whose job is to stop an un-released production change reaching `main` reports
green. `#1730` merged 14 minutes after opening under exactly this shape (recorded in the 19:30Z
breadcrumb, landed as `#1733`). `#1713` is the same shape, still sitting in it, **fully mergeable by
any actor that trusts the check rollup**.

The only thing standing between `#1713` and `main` right now is a station choosing to hand-classify
it under §10.1 step 2 — a discipline, not a gate. RULE 1 (a), already on file, is the complete and
additive fix: **trigger the receipt requirement off `classifyPolicyFiles` rather than off the
label**, so the gate arms itself from the diff and no labelling decision can disarm it.

This adds evidence to open escalation `#1635`; it does **not** open a new one, and I have not
authored a receipt for anything (NEVER AUTHOR A RECEIPT).

**DISPOSITION: ESCALATED** — appended to the existing CP-26 escalation, with `#1713` named as the
live instance. The question for Marco is unchanged and is in the summary below.

### F2 — `#1713` is green, clean and 9.5 hours old, and it is Marco's alone

[MEASURED] as above: `CLEAN`, `MERGEABLE`, 15/15 green, additive nullable migration, no watcher
verdict, hand-classified Marco's on `migrations/`. Nothing about it is blocked, failing, behind or
conflicted. It is waiting on exactly one thing: Marco.

Reported as a finding rather than left silent because a green PR that no station may merge is
invisible in every "what is red?" view, and this one has now been waiting a third of a day.

**DISPOSITION: ESCALATED** — Marco's decision, PR is ready, no work outstanding on it.

### F3 — the watcher has run 9.4 hours on a clone 28 commits behind, and its two merged fixes are still not in it

[MEASURED] node `StartTime` `11:49:57Z`, clone HEAD `16ddb58b` **28 behind** `origin/main`, both
`VERDICT_HOME_RESOLVER` and `VERDICT_HEADING_TOLERANT` → **0** in the running code (POS 2, NEG 0).
`#1704` (the home resolver) merged `11:41:36Z` and `#1731` (heading-tolerant) merged `19:45Z`;
neither is in the process serving the board. The behind-count has grown 18 → 19 → 22 → 27 → **28**
across five runs.

Unchanged in substance from the 20:15Z dispatch — re-measured, not re-derived. **Only Station 03 may
FF the clone and restart the watcher** (the FF is a `git` write in the watcher repo, forbidden to
me), and 03 runs daily: last `2026-09-05T23:01Z`, so its next occurrence is ~`2026-09-06T23:01Z`,
about 1.9 h from this run's end. The dispatch is therefore live and about to be picked up, not lost.

**DISPOSITION: DISPATCHED → Station 03.** Fifth run carrying it. The task, unchanged: FF the clone
to `origin/main`, **then** restart the watcher — a restart alone adopts nothing (§9.5), measured
here again by a node that relaunched 8 minutes after `#1704` merged and still lacks it. Report each
of the 9 watcher-family processes before killing any, leave one family, `stash drop` never `pop` on
the 69 stashes, **PRESERVE the untracked `docs/pr-reviews/pr-1713-review.md` in the clone** —
`#1713` is open and that is a live review artifact — and read back BOTH markers non-zero afterwards.
**Do NOT re-arm `pr-watcher-verdict-home-resolver`** (shipped as `#1704`); leave the `-LOOPING.md`
on disk.

### F4 — arming stayed at 0 for a twelfth hour, deliberately

[MEASURED] armed `*-ready.md` counted by hand: **0**. Last arm `09:20:50Z`, **11.9 h** ago.

This is a decision, re-taken on this run's own measurements and not inherited: a watcher **28**
commits behind would time the `tests-docs` lane out and write
`{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}` —
byte-identical to a genuine policy routing (§10.3) — so arming anything right now **manufactures
Marco-work** and permanently human-gates a PR that should have merged itself. The precondition to
arm is unchanged: **the F3 dispatch lands first**, then one `tests|docs`-only prompt, one at a time.

Still binding and not re-derived: `armed>=1` is necessary not sufficient; **do not arm**
`pr-sweep-stale-check-retires-live-escalations-HOLD` (routes to Marco) or
`pr-hygiene-s1-guarded-branch-prune-HOLD` (would delete `#1612`'s only copy); a second actor
(`actor=marco-delegated`, seen at `08:22:53Z` in the arming log) can arm concurrently and nothing
enforces the one-at-a-time rule across actors.

**DISPOSITION: DEFERRED** — what would make it urgent: the 03 dispatch landing, or the board going
empty with the clone current.

### F5 — the sweep's §5 `[STALE]` lines were read and not acted on

[MEASURED] Section 5 tagged ~30 `[STALE]` lines across `agent-authored-rule-2-clearance-2026-09-04.md`,
`arming-log-is-tracked-but-nothing-publishes-it-2026-09-04.md`,
`cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md`,
`gitignore-citations-in-the-five-bootstraps-2026-09-06.md` and
`hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md`, each saying "escalation is DEAD, clear it".

They are not cleared. `[STALE]` here means only *"a PR number this file mentions has since merged"* —
which is not the same claim as *"the defect this file describes is fixed"*. The CP-26 file is the
proof: every PR it cites is merged, and F1 above measures its defect **live and green** this hour.
`agent-authored-rule-2-clearance-2026-09-04.md` is additionally on the standing do-not-clear list.

**DISPOSITION: DEFERRED** — the sweep's §5 heuristic over-reports on files whose subject outlives
their citations. Not fixed here; a §5 change is a `scripts/` PR and this run's lane is `docs/`.

## WHAT I DID NOT DO

- **Did not merge `#1713`**, despite `CLEAN` + 15/15 green + an additive migration. §10.1 step 2
  refuses it on `migrations/`, and green is not a lane verdict.
- **Did not touch the watcher, the clone, or its 69 stashes.** No FF, no restart, no `stash drop` —
  that is 03's lane and doing it myself is LL-38.
- **Did not arm anything** (F4).
- **Did not clear any `needs-marco/` file** on a `[STALE]` line (F5), and did not author or touch any
  `merge-approvals/` receipt.
- **Did not prune `C:\po-vg`** — orphaned worktree, `dirty=1`, age 3677 min, holding uncommitted
  work. Unchanged and still deferred; `git worktree remove` would refuse and `--force` would discard
  it.
- **Did not re-raise** the `check-breadcrumb.mjs` `CADENCE` `'00': 2` defect or the
  `pollForBehindPrs()` defect — both already filed.
