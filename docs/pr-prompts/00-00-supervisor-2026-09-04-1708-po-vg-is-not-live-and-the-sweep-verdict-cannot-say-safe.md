# Station 00 — Supervisor | 2026-09-04T17:08Z–2026-09-04T17:2xZ

## GROUND

```
UTC            2026-09-04T17:08:12Z
origin/main    0121f13a            (fetched, then rev-parse)
dev tree       main @ 0121f13a     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — full authority this run.

Reachability: `start_process` shell `powershell.exe` → PID 24836. **NOT blind.**

Binding docs read from the working copy, and that is sound this run because the working copy is
proved identical to `origin/main`: `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, with
`git rev-list --left-right --count HEAD...origin/main` → `0 0`. No piped hash was taken
(PREFLIGHT step 2 — the piped form is unsound in `powershell.exe`).

## WHAT I MEASURED

**Tree state** [MEASURED] `git diff --cached --name-status` → empty; `git diff --numstat` → empty.
Dev tree clean, index clean, nothing staged by another chat.

**Board** [MEASURED] `status-sweep.ps1`, 17:09:40Z. OPEN PRs **3**, all `CLEAN`, all
**14 pass / 0 fail / 0 pending**. DIRTY **0**. `main` CI on `0121f13a`: 4 success / 0 failed.
armed **0**. in-progress prompts **0**. `index.lock` false/false. git processes **0**.
No PR touched in the last 2 min.

**Lane classification of all three open PRs** — re-measured this run, not inherited.
Probe pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone,
DOCTRINE §9.5). [MEASURED] 1900 logs, newest `2026-09-04T16:21Z` — younger than the oldest open PR
(#1589, created 11:37Z), which is the control that separates the live directory from the decoy.
POS `marco.:true` → **609**. NEG `zzzNoSuchNeedleZzz` → **0**.
Control for the *meaning* of `NO LOG`: PR **#1601**, my own board PR, which the watcher did not
open → **0 hits**. So `NO LOG` = second lane, not broken probe.

| PR | branch | files | lane | verdict |
|---|---|---|---|---|
| #1589 | `fix/lint-gate-path-space` | `scripts/pipeline/lint-prompt.mjs`, `scripts/pipeline/__tests__/…` | **WATCHER** — armed `pr-lint-gate-path-space` 11:29:24Z, PR opened 11:37Z | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"}` — **RULE 2 BINDS** |
| #1593 | `feat/arm-attribution` | `scripts/pipeline/arm-prompt.ps1`, `scripts/pipeline/hooks/pre-commit`, `docs/pipeline/ARMING.md`, `scripts/pipeline/__tests__/…` | **SECOND LANE** — `NO LOG`, and no arm in its window (arms bracket it: 11:29:24Z then nothing) | `[NO LANE VERDICT — hand-classified]` → `scripts/` is outside `^(tests\|docs)/` ⇒ **MARCO'S** |
| #1594 | `feat/pipeline-heartbeat` | `.github/workflows/pipeline-heartbeat.yml`, `scripts/pipeline/check-pipeline-heartbeat.mjs`, `docs/pipeline/SCRIPT-REGISTRY.md`, `scripts/pipeline/__tests__/…` | **SECOND LANE** — `NO LOG`, no arm in window | `[NO LANE VERDICT — hand-classified]` → `.github/` + `scripts/` ⇒ **MARCO'S** |

Labels on all three: **none**. `scripts/pipeline/__tests__/` is **not** under `tests/` — the
classifier is a PATH PREFIX. No station lane in `STATION-CAPABILITIES.md` §5 covers `scripts/`, so
the §10.1 step-3 exception does not apply to any of them.
**Nothing on this board is mine to merge.**

**Collect** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**,
`CLEAN`, structure 2 checked / 0 malformed. Both root breadcrumbs are my own (1508, 1608).
**No new station breadcrumb since my 16:08Z run — nothing to disposition from 03/04/05.**

Crossed against `lastRunAt` (scheduled-tasks MCP), per the contract — the breadcrumb is one
instrument and cannot name a cause:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| 00 | 17:07:54Z (this run) | 16:08Z | aligned |
| 03 | 2026-09-03T23:01:39Z | 2026-09-03T23:02Z | aligned; next 23:00Z |
| 04 | 14:09:32Z | 14:09Z | aligned; next 18:09Z |
| 05 | 14:10:38Z | 14:11Z | aligned |

All four aligned. **None SILENT, and none in the "fresh `lastRunAt`, no breadcrumb" shape**, so no
transcript read was needed this run.

**Watcher** [MEASURED] node RUNNING pid **20000**, auto-restart wrapper alive (1), heartbeat 49 min
(ticks only mid-run; armed queue is 0, so stale heartbeat here is idle, not wedged).

**Watcher clone, read-only git** [MEASURED] branch `main`; `git status --porcelain` raw, untrimmed:
`[ M docs/data-model/metadata-catalog.json]` and `[?? scripts/pr-watcher/.conflict-notified-prs.json]`.
`MERGE_HEAD` False · `rebase-merge` False · `rebase-apply` False · unmerged paths **0**.
**NOT CORRUPT — `rescue-watcher-repo.ps1` must not be run.** Stashes: **66**.

## WHAT CHANGED

- Opened isolated worktree `C:\po-collect-1708` off `origin/main` on the NEW branch
  `board/collect-1708`, and wrote this breadcrumb **inside it** — the REPORT CONTRACT's preferred
  home, and the one that cannot leave an untracked file blocking the next fast-forward.
- `git mv` of the already-dispositioned `…-1508-the-cure-hid-the-trap-from-its-own-control.md` into
  `docs/pr-prompts/archive/`. The 1608 breadcrumb stays in the root — it is the current cycle.
- Nothing else. **No PR merged, no prompt armed, no label touched, no worktree pruned.**

## FINDINGS

### F1 — `C:\po-vg` is NOT a live station worktree, and it has held the sweep verdict at CAUTION for six runs

The sweep has printed `CAUTION: 1 LIVE STATION WORKTREE(s) detected — C:/po-vg` on six consecutive
00 runs. It is wrong, and the cost is that the verdict this station is told to obey can no longer
reach `SAFE TO ACT`.

[MEASURED] in `C:\po-vg`: branch `fix/no-rebase-while-checks-run` @ `23c91ba9`. The whole of its
dirty state is **one untracked file**, `?? scripts/pipeline/check-pipeline-heartbeat.mjs`, last
written **07:55Z — 9h14m ago**. `git ls-remote --heads origin refs/heads/fix/no-rebase-while-checks-run`
→ **empty**: no remote branch. No open PR carries that branch. No `processed/*.log` names it
(needle `no-rebase-while-checks-run` → **0**, against the control `gate-path-space` → 1).
And that one file is the same path **#1594 ships** — the work left it by a second lane hours ago.
A 00 run takes 15–25 minutes. Nine hours is not mid-run.

[MEASURED] the cause, by symbol in `scripts/pipeline/status-sweep.ps1`:

```
$isLive = ($dirtyCount -gt 0) -or ($ageMinutes -ge 0 -and $ageMinutes -lt 30)
```

and the comment four lines above states it outright: `dirty (any uncommitted files) => LIVE STATION
WORKTREE regardless of age`. **Age bounds the CLEAN branch and nothing bounds the DIRTY one.** So a
single stale leftover file pins `$liveWorktrees.Count` above zero forever, and the verdict block
reaches `SAFE TO ACT` only in its final `else`. This is §7's shape exactly — an instrument that can
no longer produce its positive result — and the positive control is right beside it: the other four
worktrees (dirty=0, age > 30 min) all classify `orphaned` correctly, so only the dirty branch is broken.

**DISPOSITION: DISPATCHED → 03 (the prune) + DEFERRED (the classifier).**
To **03**: `C:\po-vg` is an orphan by every signal above. Before pruning, confirm its one untracked
file is byte-identical to #1594's copy (`git hash-object`, never a piped hash) so nothing unique is
destroyed; then prune it and the three other orphans already listed (`C:/po-1483-fix`, `C:/po-guard`,
`C:/po-sa-fix`, plus `C:/po-work/s2-e2e`) and the two registry escapees. DOCTRINE 3f: never delete
unsupervised — the `git status --short` it asks for is quoted above.
The classifier fix is **DEFERRED, not escalated**: it needs no judgement only Marco has, and it lands
in `scripts/`, which means a PR he alone can merge onto a board already three deep in his PRs. When it
is staged, RULE 1 says the option order is:
1. **(a) complete + additive** — bound the dirty branch by age *and* add a third class,
   `STALE-DIRTY`, that is neither LIVE nor auto-prunable. Fixes it now and for the next leftover, and
   cannot re-label genuine live work as prunable.
2. (b) prune `po-vg` and change nothing — fails the *future* half; the next leftover dirty worktree
   recreates the permanent CAUTION.
3. (c) drop `dirty` from the test and go by age alone — fails the *no damage* half; a station 40
   minutes into work on one file would be classified orphaned and pruned.

### F2 — the sweep's §5 `[STALE]` line orders you to discharge a LIVE, unfixed escalation

§5 prints, twelve times over:

> `[STALE] hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md references #1539 which is MERGED — escalation is DEAD, clear it. Do NOT report it as pending.`

[MEASURED] that file's own header reads `**Status:** OPEN. Nothing was changed.` and the defect it
raises is untouched: `PR_WATCHER_AUTO_UPDATE` is still `"true"` at
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\start-watcher.ps1:159`
(`if (-not $env:PR_WATCHER_AUTO_UPDATE) { $env:PR_WATCHER_AUTO_UPDATE = "true" }`), negative control
`zzzNoSuchZzz` → 0. `pollForBehindPrs()` still rebases every BEHIND PR on a timer.

The §5 check answers **"are this file's PR references stale?"** and then prints a verdict about
**"is this finding dead?"** — a different question. Those coincide for a review-block note that
exists only to gate one PR; they come apart for a *systemic* escalation, which cites the PRs that
demonstrated it and outlives every one of them. Following the printed instruction here would
discharge the #24 churn defect on the strength of its own evidence having landed.

The same misreading is available on at least five more: `unattributed-arms-single-actor-2026-09-03.md`
(3 refs, all MERGED — escalation #22, open), `station-schedule-collision-04-and-05-2026-09-03.md`
(3, all MERGED), `station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md` (4, all MERGED —
escalation #23, open), `tests-docs-lane-starves-its-own-review-job-2026-09-04.md` (4, all MERGED),
`arming-log-is-tracked-but-nothing-publishes-it-2026-09-04.md`.

**DISPOSITION: DISPATCHED → 03, with an explicit correction to the standing dispatch.** The standing
"move dead `needs-marco/` files to `needs-marco/discharged/`" dispatch must **not** be driven off the
sweep's `[STALE]` tag. The tag is necessary, not sufficient: a file is dischargeable only when its
**finding** is fixed, which means reading it. **Do not discharge any of the six named above** — four
of them are the open escalations #22, #23, #24 and the arming-log publication gap. The wording of the
`[STALE]` line itself is a `scripts/` change and is DEFERRED with F1.

### F3 — the watcher clone is dirty=2 and the sweep's own warning on it is a false alarm

The sweep prints `watcher clone: branch=main dirty=2  <-- NOT clean-on-main; the watcher may refuse
to start`. [MEASURED] the watcher is running (pid 20000) and has been all day, so it plainly did not
refuse. The two files are ` M docs/data-model/metadata-catalog.json` — a line-ending smudge, git
itself warns `LF will be replaced by CRLF` — and `?? scripts/pr-watcher/.conflict-notified-prs.json`,
which is the watcher's own runtime state. Neither is corruption; no `MERGE_HEAD`, no rebase, zero
unmerged paths.

What is real is beside it: **66 stashes** in the clone. DOCTRINE §9.2 records this as a closed loop —
the launcher's preflight stashes on every start and nothing ever pops — which is also the mechanism
by which `dirty=2` has never actually blocked a start. `git stash drop`, **never `pop`**.

**DISPOSITION: DISPATCHED → 03.** Report the stash count and its growth; drop, never pop. Leave
`metadata-catalog.json` alone (standing). The "may refuse to start" wording rides along with F1's
`scripts/` change.

### F4 — nothing on the open board is mine, for the fourth consecutive run

All three open PRs are green and none may be merged by this station: #1589 by a live watcher
`marco:true` verdict, #1593 and #1594 by hand-classification under §10.1 step 2. The board is not
stuck on CI, on conflicts, or on this station — it is stuck on Marco, by design, and it grows one
PR per second-lane push.

Worth naming because it is circular: **#1593 is the fix for escalation #22** (`arm-prompt` requires
`-Actor`, so an arm can name its session). Today's arming log shows six arms, every one attributed
`by=Marco@` — the OS username, which attributes nothing. The fix for "we cannot tell who armed
this" is itself sitting behind the merge queue it would have made auditable.

**DISPOSITION: DEFERRED.** No action available to this station. It becomes urgent if a fourth PR
arrives, or if any of the three goes red while waiting — a rebase from the #24 churn can do that.

### F5 — landing this breadcrumb will itself trigger the #24 churn

[INFERRED, from the measured mechanism in F2] merging this docs-only board PR puts all three open
PRs BEHIND `main`, and `pollForBehindPrs()` will rebase each within minutes, discarding **42** green
checks (3 × 14) and re-running them. That is not a reason to skip the report — the REPORT CONTRACT
requires a tracked breadcrumb — but it is the fourth consecutive run to pay this cost, and it is
further evidence for the escalation F2 defends.

**DISPOSITION: DEFERRED**, folded into the open #24 escalation. Recording the count is the point.

## WHAT I DID NOT DO

- **Did not merge, or attempt to merge, any of #1589 / #1593 / #1594.** RULE 2 on #1589; hand
  classification to MARCO'S on #1593 and #1594. No `do-not-merge` label was touched — there were none.
- **Did not arm anything.** armed = 0 and it stays 0. The board's constraint is Marco's review
  queue, and arming faster makes that queue longer, not shorter.
- **Did not prune `C:\po-vg` or any other worktree, and did not touch the registry escapees.** Local
  trees are 03's lane; doing 03's work is the LL-38 incident. Dispatched with the evidence instead.
- **Did not run `rescue-watcher-repo.ps1`.** The clone is dirty but provably not corrupt, and a false
  "broken" alarm licenses destructive action.
- **Did not run any mutating git in `C:\po-watcher\ProjectOperations`** — read-only `status` / `diff`
  / `rev-parse` only.
- **Did not discharge any `needs-marco/` file**, despite §5 printing "escalation is DEAD, clear it"
  fifty times. See F2.
- **Did not edit `sot/`**, did not touch Azure / Entra / SharePoint, did not write production data.
- **Did not fix `status-sweep.ps1` in place.** It is `scripts/`; a PR only Marco can merge, and the
  board already holds three of those.
