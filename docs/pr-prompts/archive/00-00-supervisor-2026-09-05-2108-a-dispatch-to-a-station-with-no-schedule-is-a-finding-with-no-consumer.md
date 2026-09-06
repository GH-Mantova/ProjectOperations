# Station 00 — Supervisor | 2026-09-05T21:08Z–2026-09-05T21:4xZ

## GROUND

```
UTC            2026-09-05T21:08:26Z
origin/main    84cae7df            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 84cae7df     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run was not restricted to read-only.
**Sighted run.** `ToolSearch` loaded the Desktop Commander schemas first (PREFLIGHT step 1: a
validation error is not blindness); `start_process` with shell `powershell.exe` then returned a live
prompt on the first call, printing `2026-09-05T21:08:26.6449521Z`.

All three binding documents were read **in full**, in the DEV TREE, after proving the tree sits at
`origin/main` and the documents are byte-identical to it —
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, and
`git rev-list --left-right --count HEAD...origin/main` → `0 0` (§9.1: the `--numstat` form, never a
piped hash).

**Safe to act:** `status-sweep.ps1` captured to a **file** (it returns early and hides its own §7
verdict when its output is consumed inline) → §7 `[LIVE] SAFE TO ACT: no board mutation in
progress, no recent remote activity, no live station worktrees.` 87440 bytes, `SWEEP COMPLETE
2026-09-05 21:09:22Z`.

## WHAT I MEASURED

**[MEASURED] COLLECT — ONE breadcrumb since my last run, and it is my own.**
`Get-ChildItem docs\pr-prompts\00-*.md` → exactly one:
`00-00-supervisor-2026-09-05-2008-the-correction-two-runs-deferred-needed-one-file-not-seven.md`
(the 20:08Z run archived the previous three in `#1678`). Read in full. Its findings A–D are
ACTIONED, E is DISPATCHED→06, F and G are DEFERRED with named re-open conditions. **No station
breadcrumb is undispositioned**, so this run's COLLECT is E — see FINDING A.

**[MEASURED] `check-breadcrumb.mjs --freshness` → CLEAN, exit 0.** `structure: 1 checked, 0
malformed`. `00` 1.1h · `03` 22.2h · `04` 3.0h · `05` 7.0h, all `ok`.
**Crossed against `lastRunAt` from the scheduled-tasks MCP, which is the step the breadcrumb probe
cannot do:** `00` `21:08:07Z` (this run) · `03` `2026-09-04T23:00:50Z` · `04` `18:09:45Z` ·
`05` `14:10:49Z`. Every station's `lastRunAt` is within a minute of its newest breadcrumb, which is
the "both fresh and aligned ⇒ healthy" row of 00's own table. **No station is SILENT and none is in
the "ran and did not report" shape.** ⚠️ The `00` row still prints `(cadence 2h)` against a live
cron of `5 * * * *` — the known `const CADENCE =` defect in `check-breadcrumb.mjs`, already filed
for Marco and deliberately NOT re-filed here (the FINDING D lesson from 20:08Z).

**[MEASURED] Machinery — nothing to fix.** Sweep §2/§3: watcher node **RUNNING pid 20000**,
auto-restart wrapper alive (1), heartbeat 47 min (ticks only mid-run; stale + empty queue = idle,
NOT wedged), `index.lock` **False / False** in both trees, **0** git processes, **0** in-progress
prompts, no PR touched on GitHub in the last 2 min. Watcher clone `dirty=5` and the orphaned
worktree `C:/po-vg` (1 uncommitted file, age 2236 min) are unchanged and already dispatched to 03 —
`--force` there would discard real work.

**[MEASURED] Queue.** `armed (*-ready.md)` → **0**, at the start and at the end of this run.
`needs-marco/` 26 · `no-pr-opened/` 109 · `failed/` 41 · `blocked/` 120. Nothing was armed.

**[MEASURED] Board — the same four open PRs as an hour ago, all CLEAN and green, none of them 00's
to merge.** Lane established for every one before any merge decision (§10.1). RULE 2 probe pinned to
the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` and never the clone (§9.5):
**1966 logs, newest `2026-09-05T20:23:57Z`** — younger than every open PR, which is the control that
separates the live directory from the 21-log corpse in the watcher clone.
POSITIVE `marco.:true` → **613** · POSITIVE per-PR `PR #1606` → **2** · NEGATIVE `PR #999999` → **0**
· NEGATIVE minted needle → **0** (needle minted for this run and, per §9.6, spent by being written
down here).

| PR | probe over `processed\pr-*.log` | launch-log `opened PR #` line | lane | verdict |
|---|---|---|---|---|
| **#1675** | **1 hit**, `marco:true`, reason `timeout waiting for green checks + MERGE verdict` | present, `17:27:48Z`, `policy=tests-docs, waiting…` | watcher | **RULE 2 — NOT MERGED** |
| **#1667** | 0 | **absent** | second lane, `[NO LANE VERDICT — hand-classified]`; `scripts/pipeline/lint-prompt.mjs` matches none of the three `NESTED_TEST_PATHS` forms ⇒ **MARCO'S** | NOT MERGED |
| **#1665** | 0 | **absent** | second lane; `(^\|/)migrations/` ⇒ **MARCO'S** | NOT MERGED |
| **#1662** | 0 | **absent** | second lane; migration that **DROPS five columns** ⇒ **MARCO'S**, §5 hard stop | NOT MERGED |

The launch-log discriminator was run with controls (POSITIVE: the last five `opened PR #` lines,
`#1589 #1606 #1609 #1612 #1675`; NEGATIVE: minted needle → 0), because a bare `NO LOG` has **three**
causes and the third — a watcher PR still inside its `policy=tests-docs, waiting…` window —
hand-classifies as second lane and is not one. **No PR is inside a waiting window right now:** the
newest `waiting…` line is #1675's at `17:27:48Z`, whose 90-minute window closed ≈ `18:57Z`.

**[MEASURED] The instrument behind FINDING A, re-measured this run at `84cae7df`.**
`triage-holds.ps1` → `=== TOTALS spent=0 gates-satisfied=40 still-gated=41 unreadable=0 of 81`,
with `SPENT control: PASS`. Reject-code histogram over the STILL GATED bucket:
`GATE_NOT_RELEASED` **13** · `UI_PROMPT_NEEDS_DESIGN_REF` **11** · `HUMAN_GATE_PRESENT` **9** ·
`FILE_GATE_NOT_RELEASED` **7** = **40 of 41**. All four fire before the premise, verified by call-site
ordering in `lint-prompt.mjs` and anchored by **symbol, never line number** (§9.5): the comment
`// HUMAN_GATE_PRESENT - hard REJECT before the premise runs.`, the `checkGateNotReleased(` call
site and the `validateDesignRef(fm)` call site all precede the `runPremise(String(fm.premise),`
call site. NEGATIVE control over the same file with the minted needle → **0**.
⚠️ **Every number in this paragraph is STATE.** The structural claim is the ordering.

## WHAT CHANGED

1. **New staged prompt `docs/pr-prompts/pr-triage-holds-spent-behind-a-reject-HOLD.md`** — the
   complete-and-additive fix 04 and my 20:08Z run both chose under RULE 1, now an actual artifact
   instead of a dispatch. Read back with the real instrument: `node
   scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-triage-holds-spent-behind-a-reject-HOLD.md`
   → **`ADMIT pr-triage-holds-spent-behind-a-reject-HOLD.md (size 2)`, exit 0.**
   **It is `-HOLD`, not `-ready`: staging is not arming, and committing a `-HOLD.md` cannot start
   work.**
2. **This breadcrumb**, written **inside the PR worktree** `C:\po-worktrees\board-2108`
   (REPORT CONTRACT cure 1) — no loose copy in the dev tree, so the post-merge fast-forward has no
   untracked blocker to trip on.

Nothing else was armed, disarmed, renamed, labelled, restarted, merged or deleted. No `-HOLD` was
promoted, no prompt was retired, and `armed` was **0** before and after.

## FINDINGS

### A — [S2] A finding DISPATCHED to Station 06 has no consumer, because 06 has no schedule — ACTIONED

My 20:08Z run's FINDING E changed a twice-DEFERRED item into **DISPATCHED → 06 (PR Master)**, on
the reasoning that a `scripts/pipeline/triage-holds.ps1` change is outside 00's docs merge lane and
what it needs is a staged `-HOLD.md`, which is 06's lane. That reasoning is right about the lane and
**wrong about the consumer.**

**[MEASURED]** `list_scheduled_tasks` returns five live tasks: `00-supervisor` (`5 * * * *`),
`03-machine-minder` (`0 9 * * *`), `04-scanner` (`0 */4 * * *`), `05-sot-keeper` (`10 0 * * *`),
`weekly-security-audit` (`30 7 * * 1`). **`06-pr-master` is not among them**, and
`STATION-CAPABILITIES.md` §6 records its cadence as *"on demand"*. Nothing wakes it.

This is the exact failure 00's own station doc records one paragraph above the authority matrix:
*"Dispatches naming 02 went to a station with no schedule and no consumer — measured 2026-09-01,
when the #1483 e2e work was dispatched to '01/02' at 18:09Z and 20:09Z and was still undone eight
hours later."* A dispatch to a station that does not run is a **deferral wearing a stronger
disposition's clothes** — and it is worse than a deferral, because DEFERRED is re-read by the next
collect run while DISPATCHED is treated as closed.

**ACTIONED.** The prompt is written and staged in this PR: authoring a `-HOLD.md` under
`docs/pr-prompts/` is inside 00's own `docs/` lane (§10.1 step 3), it starts no work, and it is the
only step that was ever blocked — the *content* of the change was already decided under RULE 1 two
runs ago, so nothing here guesses Marco's intent (§5.5).

**RULE 1, restated in the prompt itself so the builder inherits it:**
**complete-and-additive FIRST — add a `SPENT BEHIND A REJECT` bucket that runs the premise itself
for every prompt lint rejects** (✅ complete: survives any future re-ordering of lint's checks ·
✅ additive: adds a bucket and a denominator, changes no existing verdict or exit code, and
`triage-holds.ps1` mutates nothing). The alternative — re-order `lint-prompt.mjs` so the premise
runs first — is cheaper and fails the *"without damaging existing"* half: the human gate and the
dependency gates are before the premise deliberately, so moving it changes what REJECT means for
**every** caller of the linter, including the watcher. The prompt's *What NOT to do* says so.

⚠️ **Scope note, stated rather than assumed:** if Marco would rather staging stayed exclusively
06's, the cost of this is one `-HOLD.md` file that arms nothing and can be deleted in a line. The
cost of leaving it dispatched was a third silent cycle.

### B — [S3] `spent=0 of 81` reads as a measurement of 81 prompts and is a measurement of 40 — ACTIONED (as the staged prompt)

The substance behind FINDING A, re-measured this run rather than inherited: `triage-holds.ps1`
classifies **by lint exit code alone**, and `exit 1` is returned by four paths that run before the
premise. So the STILL GATED bucket is *un-measured* with respect to SPENT, not
measured-and-not-spent, and a prompt whose work has already shipped can sit in it forever while the
TOTALS line reports `spent=0` over the whole board.

The script's existing `spent-positive-control.md` does not cover this: it proves the exit-3 branch
is **reachable on a fixture**, which it is (`SPENT control: PASS` this run). What is unmeasured is
the 41 real prompts the linter rejected before it looked — a check passing on a fixture while the
population it is quoted about is unexamined.

**ACTIONED** as the prompt landed in this PR, not as a code change: `scripts/**` is outside 00's
merge lane, so arming it will open a `scripts/` PR that `classifyPolicyFiles` routes to Marco, and
RULE 2 will apply to that merge. **That is the correct destination** for a change to the instrument
Station 00 reads before arming. This finding does not ask for the arm — see WHAT I DID NOT DO.

### C — [S3] Four open PRs, none of them 00's to merge — DEFERRED, unchanged

Unchanged from 20:08Z and re-measured, not inherited: #1675 carries a genuine watcher `marco:true`
(whose reason is the *manufactured* timeout string, which does not clear it — §10.3); #1667, #1665
and #1662 are second-lane and hand-classify to Marco's. **There is no PR on this board Station 00
may merge other than its own.** The board is at its documented throughput constraint, not stalled.
It becomes urgent as its own finding only if a docs PR is routed to Marco for a reason that is
**not** the timeout string.

## WHAT I DID NOT DO

- **Merged nothing but my own board PR.** No label was added or removed on any PR; `--admin` was not
  touched; `Assert-SmokedOrEscalate` → `Merge-Pr` was used for this PR and nothing else.
- **Armed nothing, including the prompt this run wrote.** `armed=0` at the start and at the end.
  Arming this one opens a `scripts/` PR for Marco, and RULE 4 says ask first and arm one at a time;
  with `#1665` and `#1662` already holding the exact scope of two ADMIT prompts (§10.6), and the
  `tests-docs` lane still starving its own review job, an arm today buys a PR that times out into
  Marco's queue. **Arming is its own run, and it needs Marco asked first.**
- **Did not touch `scripts/pipeline/triage-holds.ps1` or `lint-prompt.mjs`.** Writing the fix myself
  would have put a `scripts/` change in a board PR, which is outside 00's merge lane and would have
  routed this PR to Marco — turning a docs landing into a fifth thing waiting on him.
- **Did not touch the watcher clone** (`dirty=5`), **`C:\po-vg`** (1 uncommitted file, 2236 min old
  — `--force` would discard it), the dev tree's untracked review mirror, or the dev-tree stashes.
  The first two are already dispatched to 03.
- **Did not restart the watcher.** No WEDGED or DOWN verdict existed; the sweep read node alive,
  wrapper alive, queue empty, and `restart-watcher-if-wedged.ps1` is the only thing that may issue
  one.
- **Did not re-file the `check-breadcrumb.mjs` `CADENCE` defect, the `06` cadence question, or the
  `tests-docs` review-job starvation.** All three are already open with Marco; re-filing a live
  escalation is the failure FINDING D of the 20:08Z run describes.
- **Did not edit `/sot/`, any canonical block, `scripts/**`, Azure, Entra, SharePoint, or production
  data.**
