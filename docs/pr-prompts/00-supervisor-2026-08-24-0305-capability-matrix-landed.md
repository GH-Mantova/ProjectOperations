# Station 00 - Supervisor | 2026-08-24T02:45-03:10Z

`origin/main` at start `179a8bd5` -> at end **`2247141b`**. Dev tree `C:\ProjectOperations2` on `main`, fast-forwarded.

## What happened

**Caught and fixed a board collision before it reached main.** [MEASURED]
Commit `488f138a` on branch `docs/station-capabilities` had swept up two `git mv` renames belonging
to a *concurrent* arming - `pr-nopr-s1-dismissed-means-proceed` and `pr-nopr-s2-hard-failure-bounded-restage`,
HOLD -> ready - because their rename was already staged in the shared index when I committed.
Merging that would have put **tracked `*-ready.md` back on `main`**: the resurrection trap cleared
by #1300, where any `checkout` / `reset --hard` / `stash pop` re-arms already-executed work.

Fix: `git reset --soft HEAD~1`, `git restore --staged` the four rename paths (working tree never
touched), recommit as `7074c432`, force-push with a lease pinned to `488f138a`.

Verified before opening the PR:

- depth-1 tracked `*-ready.md` under `docs/pr-prompts/` - `origin/main` **0**, branch **0**
- `pr-nopr-s1` / `s2` remain tracked as `-HOLD.md` on main
- `git diff --name-status origin/main...HEAD` = exactly two added files
- disk unchanged throughout: both prompts already consumed into `processed/` (gitignored)

## Landed - PR #1303 (squash `2247141b`), docs-only, CP-24 clean, all gates pass

- **`docs/pipeline/STATION-CAPABILITIES.md`** (181 lines) - the three-layer instruction model
  (task prompt / skill bootstrap / repo station doc), the reachability diagnostic (visibility in
  `list_triggers` == cloud-fired == blind), the tooling inventory with its measured traps
  (`$` stripped from `-Command`, `--jq` quote-stripping, the VM-side-git `index.lock`, Desktop
  Commander's `allowedDirectories: []`), the folder map, the **authority matrix**, the cadence
  table, and the reporting chain.
- **`pr-watchdog-heartbeat-during-merge-wait-HOLD.md`** - staged, NOT armed. Lint ADMIT, size 4.
  Fixes the measured cause of the watcher deaths: the heartbeat only ticks while an agent runs,
  merge-wait is silent, and `wdHungMin = 15` is checked against a 90-minute merge timeout. Three
  kills, three merges, each ~16 min after entering merge-wait.

## Skills refreshed (delivered to Marco; an agent cannot install them)

`supervisor`, `machine-minder`, `scanner`, `sot-keeper`, `pr-master`, `queue-inspect` - each now
carries a **CAPABILITY MATRIX** section pointing at the file above plus its own one-line authority
row. `queue-inspect` also corrected `.gitignore:73` -> **`:75`** [MEASURED: `git show origin/main:.gitignore`].

## Machine state [MEASURED 2026-08-24T03:00Z]

- watcher `node` pid 28308 (started 12:36:02), `supervise-watcher` pid 21244 (started 09:38:27) - alive ~3.5 h
- open PRs: **#1302** (watcher-routed, `[NO-PR]` bounded auto-restage - **Marco's, RULE 2**),
  **#1296** (`GATE-ALLOW: env-vars` sits at column 0 of the body - Marco's fix)
- depth-1 armed prompts on disk: **0**

## Open / deferred

- **DEFERRED** - `pr-nopr-s1`/`s2` are tracked as `-HOLD.md` on main but absent from disk (consumed
  into `processed/`). Harmless while HOLD, but the board over-reports. Reconcile the deletions once
  #1302 merges.
- **ESCALATED** - Marco to register `PO Watcher Keepalive` (`docs/runbooks/watcher-restarter-scheduled-task.md`).
- **ESCALATED** - Marco to install the six refreshed skills.
- **DEFERRED** - `sot/03` still has no owner (~800 unrecorded PRs); `MEMORY.md` index needs compaction.
