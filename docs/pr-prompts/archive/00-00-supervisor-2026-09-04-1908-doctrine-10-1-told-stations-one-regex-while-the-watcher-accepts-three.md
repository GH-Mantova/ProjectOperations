# Station 00 — Supervisor | 2026-09-04T19:08:15Z–2026-09-04T19:4xZ

## GROUND

```
UTC            2026-09-04T19:08:15Z
origin/main    5a846659            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 5a846659     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Versions agree — full authority, not read-only.

**Which tree I read in.** All three binding documents were read **in the dev tree**
`C:\ProjectOperations2`, never the watcher clone. [MEASURED] `git diff --numstat origin/main --
docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
returned **empty output** — the working copies are not different from `origin/main`. Per PREFLIGHT
step 2 I did **not** compare a piped `git hash-object --stdin` value against anything.

---

## WHAT I MEASURED

**Preflight**

- [MEASURED] `start_process` shell `powershell.exe` → PID 27516, prompt returned. **Not a blind run.**
- [MEASURED] `status-sweep.ps1` at 19:09:04Z. §0 positive controls both pass (`gh CAN reach GitHub
  (saw merged PR #1603)`, `node runs`). §7 verdict **CAUTION**, on the sole ground that `C:/po-vg` is
  classified a LIVE STATION WORKTREE — the known classifier defect, see F1.

**The board — 3 open PRs, unchanged since my 18:08Z run**

- [MEASURED] `#1594`, `#1593`, `#1589` — all `CLEAN`, all `14 pass / 0 fail / 0 pending`.
  `main CI on 5a846659: 4 success / 0 failed` (trunk green). Newest merge is my own `#1603`
  (18:19Z); nothing has landed since.
- [MEASURED] **All three re-classified under the ACTUAL `classifyPolicyFiles`, not the doc shorthand**
  (`gh pr view <n> --json files,labels`): `#1589` → `scripts/pipeline/lint-prompt.mjs`;
  `#1593` → `scripts/pipeline/arm-prompt.ps1`, `scripts/pipeline/hooks/pre-commit`;
  `#1594` → `.github/workflows/pipeline-heartbeat.yml`, `scripts/pipeline/check-pipeline-heartbeat.mjs`.
  Each has at least one path outside all three `NESTED_TEST_PATHS` forms, so **all three remain
  MARCO'S and RULE 2 still binds — the correction in F3 clears nothing on today's board.** Labels `[]`
  on all three. Their lane classification (`#1589` watcher-opened with a live `marco:true` verdict;
  `#1593`/`#1594` second-lane, `NO LOG`, hand-classified) was measured at 18:1xZ and is unchanged;
  I did not re-run the `marco.:true` probe because **I am not merging any of them**, so no verdict of
  mine depends on it.
- [MEASURED] `git fetch origin --prune` moved three remote-tracking refs this run
  (`feat/arm-attribution`, `feat/pipeline-heartbeat`, `fix/lint-gate-path-space`) — i.e. all three
  open PRs had their heads rewritten since my last fetch. That is `PR_WATCHER_AUTO_UPDATE=true`
  rebasing behind-PRs on a timer (escalation #24), still live and still unfixed.

**Queue and machinery**

- [MEASURED] armed (`*-ready.md`): **0**. `needs-marco/` 16 · `no-pr-opened/` 109 · `failed/` 41 ·
  `blocked/` 117. Nothing armed means nothing for the watcher to eat; heartbeat age 49 min on an
  empty queue is **idle, not wedged** (DOCTRINE §9.5).
- [MEASURED] watcher node RUNNING pid 20000, auto-restart wrapper alive (1). Watcher clone
  `branch=main dirty=2` — 04 measured both entries this hour as runtime residue, no `MERGE_HEAD`,
  no rebase state. **Not corrupt.**
- [MEASURED] §3 safe-to-act gate: in-progress prompts **0**, `index.lock` false in both trees,
  git processes **0**, no PR touched in the last 2 min.

**COLLECT — breadcrumbs since my last run**

- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **exit 0, CLEAN**;
  structure `3 checked, 0 malformed`. One `NOTE`: 04's 18:10Z breadcrumb is **UNTRACKED — it reaches
  nobody until a board PR commits it.** This PR commits it.
- [MEASURED] Exactly **one** new breadcrumb since 18:08Z:
  `00-04-scanner-2026-09-04-1810-repo-hygiene-five-worktrees-queued-for-pruning-hold-nothing-unique.md`.
  Read in full; its four findings are dispositioned below.
- [MEASURED] **Freshness crossed against `lastRunAt`** (scheduled-tasks MCP), as the station doc
  requires — the breadcrumb clock alone cannot name a cause:

  | station | `lastRunAt` | newest breadcrumb | reading |
  |---|---|---|---|
  | 00 | 2026-09-04T19:07:55Z (this run) | 18:08Z | aligned |
  | 03 | 2026-09-03T23:01:39Z | 09-03T23:02Z | aligned; next fire 09-04T23:00Z, inside cadence |
  | 04 | 2026-09-04T18:09:34Z | 18:10Z | aligned |
  | 05 | 2026-09-04T14:10:38Z | 14:11Z | aligned |

  **No station is SILENT and none is a false `ok`** — every one has a `lastRunAt` and a breadcrumb
  within one cadence of each other, which is the "both fresh and aligned" row. No transcript read was
  needed, because no station presented the fresh-`lastRunAt`-no-breadcrumb shape that requires it.
- [MEASURED, lead not finding] `weekly-security-audit` reports `lastRunAt 2026-09-02T23:58:18Z`
  against a `30 7 * * 1` (Monday) cron and `nextRunAt 2026-09-06T21:32Z`. 2026-09-02 was a Wednesday,
  and that timestamp is the exact minute the 09-02 all-stations outage ended — consistent with a
  catch-up fire, not a schedule defect. It is not a pipeline station, files no breadcrumb, and is
  outside the freshness contract. Recorded, not promoted.

**F3's central claim, verified by me before I acted on it**

- [MEASURED] `git show origin/main:scripts/pr-watcher/index.mjs | Select-String -Pattern
  'NESTED_TEST_PATHS|function classifyPolicyFiles' -Context 1,6` returns the array with **three**
  elements — `/^(tests|docs)\//`, `/(^|\/)__tests__\//`, `/\.(test|spec)\.[cm]?[jt]sx?$/` — above
  `isTestOrDocsPath` and `classifyPolicyFiles`, with the source comment stating the single-regex form
  *"classifies every real test-only PR as 'outside' and routes it to Marco"*. **04's F3 reproduces
  independently.**
- [MEASURED] Post-edit read-back on the worktree copy of `DOCTRINE.md`:
  `old_shorthand_present=false`, `NESTED_TEST_PATHS_count=4`, `total_lines=923`, and
  `git diff --numstat` → **`28  2`** — 28 added, 2 removed, i.e. a two-line replacement and **no
  whole-file line-ending smudge** (§9.3). Edited with node `readFileSync`/`writeFileSync`, never
  `Set-Content`.

---

## WHAT CHANGED

All work done in a **disposable worktree** `C:\po-collect-1908` cut from `origin/main` `5a846659`
(branch `docs/board-collect-1908`) — never the dev tree, never the watcher clone.

1. `docs/pipeline/DOCTRINE.md` §10.1 step 2 — the two-line shorthand replaced with the real
   three-form rule, a worked consequence, the history of the drift, and a named falsifying probe.
   `28  2` per `--numstat`.
2. `docs/pr-prompts/00-04-scanner-2026-09-04-1810-…-hold-nothing-unique.md` — 04's breadcrumb,
   committed so it stops being untracked. Copied byte-identical: `git hash-object` reads
   `2ce0e767…` in **both** trees.
3. `docs/pipeline/sweep-rotation.json` — 04's rotation advance (`last_index=2`,
   `last_run_utc=2026-09-04T18:09:55Z`), which 04 correctly left dirty because a read-only station
   may not commit to the shared tree. Copied byte-identical: `92114684…` in both trees.
4. `docs/pr-prompts/00-00-supervisor-2026-09-04-1708-….md` → `docs/pr-prompts/archive/` — fully
   dispositioned two runs ago.
5. This breadcrumb, written **inside the PR worktree** — so no untracked copy is left in the dev tree
   to block the next fast-forward (the failure four consecutive runs paid for on 2026-09-04).

**Nothing armed. Nothing disarmed. No prompt renamed, moved or deleted. No PR merged but my own
board PR. No label touched. No worktree pruned, no branch or tag created or deleted, no stash
dropped. No `sot/` file read-modified. Nothing in Azure / Entra / SharePoint.**

---

## FINDINGS

### F1 — 04 has discharged the fear that was blocking the worktree prune, and the prune has an owner problem — S3

04's F1 checked all five non-main worktrees individually and proved **none holds a unique commit or
a unique file**: `fix1483`'s 28 commits are on `origin/fix1483`; `f85f11cf` is reachable from
`fix1483` in two refs; `12c20e90` and `23c91ba9` landed on main by squash (their test files exist on
`origin/main`, `cat-file -e` exit 0, negative control exit 128); and `C:/po-vg`'s single dirty file is
byte-identical to main's blob (`9c4587fb…` both sides).

That directly discharges the fear my own 11:09Z run recorded — *"pruning po-vg might destroy the only
copy of `check-pipeline-heartbeat.mjs`"*. It is **wrong, and measured wrong.** It also means the
sweep's standing `CAUTION` on `po-vg` is now doubly unfounded: the classifier is wrong about it being
live (already dispatched, merged in `#1602`) **and** there is nothing in it to protect.

⚠️ 04 named a real boundary I must answer rather than pass on: the authority matrix gives **03**
`Repair the machines: ⚠️ report-only`, and **00** `❌ dispatches 03`. Read literally, *nobody* may
run `git worktree remove`, and this prune has now been dispatched across three runs without moving.
I am not going to launder that by doing it myself in 03's lane (LL-38 is exactly that move).

**DISPOSITION: DISPATCHED → Station 03 (machine-minder), with an explicit authorisation attached.**
03's next fire is 2026-09-04T23:00Z. Handed over: 04's five-row table and its controls, and this
authorisation — **00 authorises the prune of `C:/po-1483-fix`, `C:/po-guard`, `C:/po-sa-fix`,
`C:/po-vg` and `C:/po-work/s2-e2e`, plus the two registry escapees `C:\po-worktrees\fix-1523` and
`C:\po-worktrees\vs-s2-durable-smoke`.** Constraints: `git worktree remove` only (which does not
delete a branch ref); **do not delete `origin/fix1483`** — 28 never-proposed commits, no
`abandoned/*` tag, irreversible, still Marco's per DOCTRINE §5.4; re-measure liveness immediately
before removing each one, because `[LIVE]` means "true when measured" (§7).

### F2 — a dead never-arm guard exists on exactly one machine, and reviving it would poison my own station doc — S3

04's F2: commit `dd954645` on local-only branch `guard/never-arm-cd-s1` (in `C:/po-guard`) adds ten
lines to `docs/pipeline/stations/00-supervisor.md` forbidding the arming of
`pr-claudedesign-s1-track-the-written-half` — a prompt that **no longer exists on `origin/main`**,
whose gating condition was met by `#1559`/`#1578`, and whose own self-delete trigger therefore can
never be observed. `origin/main:docs/pipeline/stations/00-supervisor.md` contains **0** occurrences
of `claudedesign` (positive control `Supervisor` → 20).

This is addressed to me, and it is the *"a stale instruction reads exactly like a current one"*
failure aimed straight at my own instructions.

**DISPOSITION: ACTIONED, in part — and the rest DEFERRED, deliberately.**
ACTIONED now, and recorded both here and in project memory: 🔴 **`guard/never-arm-cd-s1` /
`dd954645` must never be pushed, merged or cherry-picked.** Its content is provably obsolete and
landing it would give this station a permanent never-arm rule for a prompt nobody can find.
DEFERRED: deleting the local branch ref. `git worktree remove` does not touch a branch ref, so the
commit is not at risk from F1's prune, and branch deletion is on DOCTRINE §5.4's irreversible list —
doing it *before* the prune, on a run with no other need to, buys nothing and spends an irreversible
action. **What would make it urgent:** any sign that something is about to publish this branch — an
`origin/guard/never-arm-cd-s1` appearing in `git ls-remote --heads origin`, or a `claudedesign`
occurrence returning to `origin/main:docs/pipeline/stations/00-supervisor.md`. Either flips it to
ACTION-NOW, with an `abandoned/guard-never-arm-cd-s1@dd954645` tag pushed **first** (escalation #14's
cure: tag, push, then delete — never the other way round).

### F3 — DOCTRINE §10.1 told every station to hand-classify on ONE regex while the watcher accepts THREE — S3, fixed this run

04 deferred this to 00 or 05 for exact hand-landing. It is binding law, it is mine, and I have landed
it.

§10.1 step 2 is the rule I execute every run on every second-lane PR. It read *"any path outside
`^(tests|docs)/` … means it is Marco's"*. [MEASURED, by me, above] `classifyPolicyFiles` on
`origin/main` has not anchored on that regex for days: `NESTED_TEST_PATHS` accepts
`^(tests|docs)/`, `(^|/)__tests__/`, **and** `\.(test|spec)\.[cm]?[jt]sx?$`, and the source comment
says the single-regex form was replaced *because* it *"classifies every real test-only PR as
'outside' and routes it to Marco"*.

So the doc and the code disagreed about the same PR. A station following the parenthetical routes a
nested-test-only second-lane PR to Marco that the watcher's own lane would have merged with no human.
It fails in the **safe** direction — nothing of Marco's could merge on it — which is precisely why it
survived: **the only cost is human decisions manufactured by the lane built to remove them**, and
nothing red ever appears. That is §9.5's closing bullet happening inside §10's own text.

⚠️ **This corrects two lines in my own project memory that are wrong in the same way** — *"`scripts/…/__tests__/`
is NOT under `tests/`"* and *"a `.spec.ts` under `apps/api/` is OUTSIDE `tests/` — the rule is a PATH
PREFIX, not a file kind."* Against today's `classifyPolicyFiles` both are **REFUTED**. They are
corrected in memory this run, not just here, because memory is the channel that survives.

**DISPOSITION: ACTIONED.** Landed in this PR. Verified: `old_shorthand_present=false`,
`NESTED_TEST_PATHS` present, `--numstat 28 2` (a two-line replacement, not a rewrite), §10 sits
**outside** both hash-gated canonical blocks (`instruments v2` ends before §10), so no
`_canonical-blocks.json` re-record is required.
⚠️ **`lint-station.mjs` REJECTED my first draft, and it was right to.** I had illustrated the rule
with invented paths (`…/foo.test.mjs`, `…/x.spec.ts`); the linter's dangling-repo-path check fired —
*"names a repo path that git does not track … a clone, CI, and any cloud-fired station will not see
it"* — so I replaced them with two paths that are genuinely tracked on `origin/main`
(`scripts/pipeline/__tests__/backlog-parser.test.mjs`, `apps/api/src/bootstrap/dev-helper.spec.ts`),
which makes the example itself checkable. [MEASURED] the instrument answered in **both** directions
this run: `REJECT: 1 of 8` on the bad draft, `ADMIT: all 8 docs clean` exit 0 after the fix, and
`ADMIT: all 8` as a positive control against the untouched dev tree at `origin/main` — so neither
reading is a §7 empty-world. Final `--numstat` `29  2`.
**Hand-landed rather than armed**, per §10.3: the content is a correction to DOCTRINE
itself and must be exact. The replacement carries its own falsifying probe, so the next run can kill
it in one command if the code moves again.

### F4 — the rest of 04's repo-hygiene sweep is clean, and its instruments proved they could say otherwise — no severity

Board trap **0** tracked `*-ready.md` at depth 1 (positive control: the same filter returns
`PROMPT-SCHEMA.md`). Spent HOLDs **0 of 97** via `triage-holds.ps1`, with `SPENT` proved reachable by
its own fixture. Watcher clone dirty=2, both runtime residue. The one `-LOOPING.md` at queue-root
depth 1 is a corpse whose work is on main and which matches no watcher glob.

**DISPOSITION: ACTIONED** — accepted as measured, at `origin/main` `95a47ceb`, and recorded here so
the next repo-hygiene run diffs against it instead of re-deriving it. Nothing to do.

---

## WHAT I DID NOT DO

- **Merged nothing.** All three open PRs (`#1594`, `#1593`, `#1589`) are green and CLEAN and all
  three are **MARCO'S** — re-established this run against the *corrected* rule, not inherited.
  RULE 2 binds. `#1589` carries a live watcher `marco:true` verdict; `#1593`/`#1594` are second lane
  and hand-classified. Green is not a clearance and neither is an empty label list.
- **Armed nothing** — armed count is **0** and I did not raise it. Nothing on the board is waiting on
  an arm; the constraint is Marco's merge queue, not the queue depth, and arming faster makes the
  board longer rather than shorter. The two named never-arm prompts
  (`pr-cardui-s2-wbs-table-shell-HOLD` while `#1483` is open, and `pr-tr-s1-reminder-policy-HOLD`
  without asking Marco) were not touched.
- **Did not prune any worktree, drop any stash, or delete any branch or tag.** F1 is 03's lane and
  F2's ref deletion is irreversible and not yet warranted. `origin/fix1483` untouched.
- **Did not re-run the `marco.:true` probe.** I am merging none of the three PRs, so no verdict of
  mine rests on it; re-running a probe whose answer cannot change my action spends budget for nothing.
  The moment one of them becomes mergeable that changes, and the probe must be re-run against the
  **live** tree `C:\ProjectOperations2\docs\pr-prompts\processed` with both controls.
- **Did not touch escalations #17, #19, #21, #22, #23, #24** or any other open item. All are
  unchanged, none newly measurable this run, and re-stating an unchanged escalation is how a report
  fills up with things nobody needs to read.
- **Did not fold the F3 fix into `pr-gates.mjs`** or any code path. It is a documentation correction;
  the code was already right.
- **Did not read `/sot/`-modifying anything, and edited nothing under `sot/`.** Station 05's lane.
- **Left `docs/qa/qa-findings.md` and the other four gitignored sinks alone**, and reported nothing
  into them.
