# Station 00 - Supervisor | 2026-08-24T08:09-08:14Z | DEV TREE FF'd, LINTER REPAIRED, ONE SLICE ARMED

Breadcrumbs are UNTRACKED - this is not reporting. The durable copy is in project memory as
`project_supervisor_2026_08_24_0815_devtree_ff_repairs_linter.md`.

## What I measured (all [MEASURED] via Desktop Commander / PowerShell on Windows)

- Sweep `bring-up-to-speed.ps1` 08:09:08Z: **0 open PRs**, armed **0**, verdict **SAFE TO ACT**,
  trunk green (3/3), `origin/main = 74066ae9`.
- Watcher node **pid 29024**, up **05:35:04Z**, ancestry detached. `.queue-state.json` age **1.7 min**
  (the real liveness probe). `heartbeat.log` age **310 min** - stale, and NOT a liveness signal.
- **`PO Watcher Keepalive`: State Ready, LastTaskResult 0, next 10 min.** The restarter gap is closed
  and stayed closed. `ensure-watcher.log` shows 7 clean `watcher alive` polls and no crash-loop lines.
- **The watcher clone is at `74066ae9`, 0 ahead / 0 behind**, `index.mjs` 109 527 B with
  `MERGE_WAIT_HEARTBEAT` x4. Station 03's R1 held - **#1304 is LIVE, not inert.**
- **The dev tree was 3 commits BEHIND `origin/main`** (`2247141b`), and the linter greps the dev
  working tree.

## R1 - DEV TREE FAST-FORWARDED. THIS REPAIRED THE LINTER. [ACTIONED]

Pre-flight: the only tracked-dirty paths were `docs/data-model/metadata-catalog.json` (M) and the two
`pr-nopr-s1/s2` deletions (D). `git diff --name-only HEAD origin/main` returned 5 paths
(`.env.example`, 3x `scripts/pr-watcher/*`, 1 spec) - **zero overlap with the dirty paths**, so a
fast-forward could not touch them.

`git merge --ff-only origin/main` -> `2247141b..74066ae9`, 5 files, +669/-171. Post-state
**0 ahead / 0 behind**; all three dirty entries **still present and unstaged**, unchanged.
No `checkout` / `reset --hard` / `stash pop` / `clean` was used - the board trap was not touched.

**The proof this mattered - Station 04's own example flipped:**

| prompt | lint at 06:17Z (dev tree 3 behind) | lint at 08:12Z (dev tree at main) |
|---|---|---|
| `pr-watchdog-heartbeat-during-merge-wait-HOLD.md` | **ADMIT** (would have spawned an agent) | **STALE** - "The work is ALREADY DONE. Binned before spawning an agent." |

Two consequences worth keeping:

1. **Station 04's open `[CANNOT MEASURE]` is now answered.** It could not tell whether
   `lint-prompt.mjs`'s REJECT branch was reachable, because all 60 HOLDs linted ADMIT.
   **It is reachable.** The 60/60 ADMIT was a symptom of the stale tree, not a dead branch.
2. `rev-list --count HEAD..origin/main` belongs at the top of every lint run.

## R2 - HEARTBEAT REFRESHED BEFORE ARMING. TRAP DID NOT FIRE. [ACTIONED, half-measure]

The arming trap is REAL and I re-read it in the running code, not from memory:
`supervise-watcher.ps1` L522 (`armed==0 -> continue`), L577 (`runnable<=0 -> continue`),
**L584-585 (`ageMin` from `heartbeat.log` mtime; `> $HungMin` -> write sentinel, `Stop-Process`)**,
`$wdHungMin = 15` (L76), `$wdPollSec = 120` (L79). With the heartbeat 310 min old, `armed` 0->1
satisfies every kill condition on the next poll.

At 08:13:25Z I appended one audited marker line to `heartbeat.log`, resetting `ageMin` 310 -> 0.
Then armed. **The watcher dequeued 1.2 s later and is alive on the same pid** - no kill.

**This is the immediate half only. It fails RULE 1's "future" half** - the next idle-then-arm
repeats it. The permanent fix is dispatched below.

## R3 - ARMED: `pr-lessons-folder-s1-restore` (ONE, per the rule) [ACTIONED]

`git mv pr-lessons-folder-s1-restore-HOLD.md -> ...-ready.md`. Read back: **armed 0 -> 1**,
`git status` shows `R ` (tracked rename, not a swallowed creation).

Full checklist, not just lint:

- lint **ADMIT** (size 3) against a now-current tree.
- **Body read**: no `<!-- watcher: do-not-arm -->`, no `DO NOT ARM` prose, no `docs/approvals/` gate.
  `escalates: false`, `gate_allow: none`, `backfill: false`.
- **Premise measured with a positive control**: `git ls-tree -r origin/main -- docs/lessons-learned`
  = empty (premise holds); the same command on `docs/pipeline` = **11 files** (instrument works).
  Absent from the working tree too.
- **The dangling reference is real**: `sot/05-decisions-and-lessons.md` lines 155, 158, 166, 562 all
  cite `docs/lessons-learned/...` and the directory does not exist on main.
- **Claim-grep**: only s1 and s2 of its own cluster mention the path. No competing actor.
- **Open-PR overlap**: `gh pr list --state open` = `[]`.
- **Chain order**: `cluster_order 1`, ungated. s2 is the `sot/` doc-reconcile (Station 05's lane,
  correctly a separate PR); s3 carries `requires_file_on_main` pointing at a file only s2 creates.
- Docs-only scope, so the watcher merges it itself under `tests-docs` rather than parking it.

Watcher log: `[queue] pr-lessons-folder-s1-restore-ready.md (depth: 1, source: watch)` 08:13:26.653Z,
`[start] ... (max-turns=240)` 08:13:26.867Z.

## DISPATCHED - Station 06 / PR Master handover (the supervisor does not create PRs, LL-38)

**D1 - the arming-into-a-stale-heartbeat kill. The real one.** #1304 fixed heartbeat during
*merge-wait*. It did **not** fix the superset: an **idle** watcher's heartbeat goes arbitrarily stale,
and `armed` 0->1 then satisfies L585 before the first job tick (which is at elapsed=60 s, while the
watchdog polls at 120 s and measures from the last *write*). Fix shape that is complete-and-additive:
make the staleness test `max(heartbeat mtime, job-start time)`, **or** have `index.mjs` write a
heartbeat tick at elapsed=0 the moment it dequeues. Do **not** just raise `PR_WATCHER_HUNG_MIN` -
that widens the window on the hang this watchdog exists to catch.
**Do NOT re-arm `pr-watchdog-heartbeat-during-merge-wait-HOLD.md` - it is a duplicate of #1304 and
now correctly lints STALE.** This needs a NEW prompt.

**D2 - `lint-prompt.mjs` is blind to every human gate.** Re-measured across the 60 depth-1 HOLDs this
run: **4** carry `<!-- watcher: do-not-arm -->`, **8** carry `DO NOT ARM` prose, **6** carry a
`docs/approvals/` gate - and the linter checks for none of the three, so all of them lint ADMIT.
`ADMIT` is necessary, not sufficient, until this ships.

**D3 - `gate_allow` front matter never reaches the PR body.** CP-12 reads the **body** for a bare
`GATE-ALLOW: env-vars`. Nothing propagates the front-matter field, so those prompts are born doomed.

**D4 - the restarter runbook contains an instruction this Windows build rejects.** Station 03
measured `-RepetitionDuration ([TimeSpan]::MaxValue)` failing with *"value which is incorrectly
formatted or out of range (14,42):Duration:P99999999DT23H59M59S"* and substituted Daily +
`PT10M`/`P1D`. `docs/runbooks/watcher-restarter-scheduled-task.md` still tells the next person to use
the broken form. Small docs fix.

## DISPATCHED - Station 03 / Machine Minder (next quiet window, NOT while a job is running)

- **3 orphan worktrees** persist: `C:/po-worktrees/sot-d-register`, `C:/po-worktrees/sot-readme-fetch`
  (prunable - #1299 merged), `C:/po-wt-h`. Station 03 already proved the safe
  unlock -> remove --force -> prune sequence on `/tmp/po-scan-0CwZSs`.
- **5 dead escalation files** the sweep cross-checked as [STALE] - they reference #1135 (x2), #213,
  #212, #1158, #727, **all merged**. Clear them so they stop being re-reported every run.

## DEFERRED (with the condition that changes it)

- **Watcher clone `dirty=34`** - blocks nothing. Measured: clone is at `origin/main` 0/0 and dequeued
  a prompt fine. Revisit only if a relaunch actually refuses.
- **10-minute worst-case restarter detection gap** - the designed trade-off of a `PT10M` trigger.
  Changes only if a 10-minute outage ever costs a merge window.
- **`pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`** - Station 05 measured that arming it would
  **silently revert #1298** and CI would not catch it. Left unarmed. Condition: re-copy group 7 from
  main into the prompt first. Station 05's lane.
- **`pr-apierr-s12-ci-gate-HOLD.md`** - self-gating and must be LAST in its chain. Arm it only when
  the file-shape grep across `apps/web/src` prints 0.
- **`pr-queue-armed-tracked-detector-HOLD.md`** - ADMIT, but `requires_on_main: ci.yml :: check-sot-refs`
  is created by lessons-folder **s3**. Downstream of the chain I just started.

## ESCALATED - standing, not re-asked in an unattended run

`allocations.service.ts:389` hard-deletes with no audit (cascades Timesheet+GPS / PreStartChecklist /
CompetencyOverride), and `map-locations-waste-rate-coupling` (must be settled BEFORE 11c drops
`estimate_waste_rates`, or option (a)'s backfill becomes impossible). Both already registered.

## LEFT ALONE DELIBERATELY

`/sot/` (Station 05's lane). The two unstaged `pr-nopr-s1/s2` deletions (the FF was chosen precisely
because it could not touch them). All 59 remaining HOLDs - ONE AT A TIME. Merging - there was nothing
to merge; the board was empty on arrival.
