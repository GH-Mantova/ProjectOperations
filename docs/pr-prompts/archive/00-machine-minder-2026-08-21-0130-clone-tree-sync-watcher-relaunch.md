# STATION 03 — MACHINE MINDER — 2026-08-21 01:30–01:45Z

Clone + dev-tree sync, arming hold enforced, watcher relaunched.
Repairs explicitly authorised by Marco for this run. No commits, no pushes, no PRs, no merges to any remote.

## Gate (STEP 0)

`status-sweep.ps1` at 01:33:11Z — §7 `SAFE TO ACT`, §3 `in-progress prompts: 0`,
`git processes running: 0`, `git index.lock interactive/clone: False / False`. Proceeded.

## Pre-state → post-state

| | DEV TREE `C:\ProjectOperations2` | BUILD CLONE `C:\po-watcher\ProjectOperations` |
|---|---|---|
| branch (before/after) | main / main | main / main |
| HEAD before | `c211ad62` | `fa061e02` |
| HEAD after | `c1737312` | `c1737312` |
| origin/main | `c1737312` | `c1737312` |
| behind before → after | 3 → **0** | 6 → **0** |
| ahead before → after | 0 → 0 | 0 → 0 |
| porcelain before | 27 (1 `RD`, 7 ` D`, 19 `??`) | 34 (all ` D`) |
| porcelain after (tracked) | 7 ` D` + 2 `R ` renames | 34 ` D` (re-created by the watcher, see note) |
| armed `*-ready.md` after | **0** | 2 (inert — see note) |

`origin/main` was refreshed on both with the refspec form
`git fetch origin +refs/heads/main:refs/remotes/origin/main`, not `git fetch origin main`.

## STEP 2 — the STOP sentinel does NOT stop a running watcher. Read this.

`C:\po-watcher\STOP-WATCHER` was created and polled every 15 s for a full 3 minutes.
The watcher node and both wrapper shells were **still alive at t=180 s**.

Root cause, measured by reading `C:\po-watcher\watcher-launcher-singlelane.ps1` directly:
the sentinel is only tested by the launcher's `while (-not (Test-Path $stopSentinel))`
loop condition and again immediately after `supervise-watcher.ps1` **returns**. Nothing
inside `index.mjs` ever reads it (`Select-String STOP` on `index.mjs` returns only
`PR_WATCHER_STOP_AT` cutoff logic — a different mechanism). An idle watcher polling an
empty queue never returns, so the sentinel can prevent a *relaunch* but can never
*terminate* a live node. **The sentinel is a no-op against an idle watcher.** Any station
budgeting 3 minutes for a graceful stop should expect to fall through to the PID path.

PID fallback used, wrapper FIRST, each command line printed and re-verified against the
expected pattern immediately before the kill:

- `40456` `powershell.exe … -File "C:\po-watcher\watcher-launcher-singlelane.ps1"` — killed
- `43628` `powershell.exe … -File …\scripts\pr-watcher\start-watcher.ps1` — killed
- `23584` `node.exe --no-deprecation …\scripts\pr-watcher\index.mjs` — killed

`Get-Process node | Stop-Process` was never used. 6 unrelated `node.exe` (MCP servers,
including the desktop bridge) were left untouched and verified still running afterwards.

## STEP 3 — build clone fast-forwarded (this is what makes watcher fixes live)

All 34 dirty entries classified: **100 % ` D`** (tracked deletions), zero `??`. They are
`docs/pr-reviews/pr-*-review.md` retired by the watcher's own `verdict-archive` sweep into
`C:\po-watcher\verdicts-archive` — the same consume-then-never-commit pattern as the prompts.

Per procedure: `git stash push -m "machine-minder-2026-08-21-clone"` → dirty 0 →
`git merge --ff-only origin/main` → `Updating fa061e02..c1737312`, exit 0, 25 files changed.

**Stash left in place, NOT popped and NOT dropped: `stash@{0}: On main: machine-minder-2026-08-21-clone`.**
Note the clone carries 134 older stashes below it (mostly `watcher-preflight-autostash`);
this one is the top entry.

Read-back: HEAD `c1737312` == origin/main, behind 0, ahead 0, branch main, dirty 0.

## STEP 4 — dev tree, and the 7 deletions with their consumed-proof

`git stash push -- docs/pr-prompts/` (path-scoped) parked the 7 deletions **and** the staged
`RD` rename, restoring the path to HEAD. The 19 untracked `00-*.md` breadcrumbs survived, as
designed. Then `git merge --ff-only origin/main` → `Updating c211ad62..c1737312`, exit 0.

That left **9** `*-ready.md` at the top level of `docs/pr-prompts/`. Each was tested for a
same-named file in `processed/` or `no-pr-opened/` before any deletion. 7 proved consumed
and were deleted; 2 had no proof and were **kept**:

| deleted `*-ready.md` | consumed-proof pairing |
|---|---|
| `pr-deps-clear-high-advisories-ready.md` | `processed/pr-deps-clear-high-advisories-ready.md` |
| `pr-e2e-container-s1-trial-workflow-ready.md` | `no-pr-opened/pr-e2e-container-s1-trial-workflow-ready.md` |
| `pr-fuel-price-staleness-and-refresh-ready.md` | `processed/pr-fuel-price-staleness-and-refresh-ready.md` |
| `pr-rates-consumers-s2-restore-plant-category-ready.md` | `processed/pr-rates-consumers-s2-restore-plant-category-ready.md` |
| `pr-rates-drop-prompt-corrections-ready.md` | `no-pr-opened/pr-rates-drop-prompt-corrections-ready.md` |
| `pr-tipfinder-tender-only-ready.md` | `processed/pr-tipfinder-tender-only-ready.md` |
| `pr-waste-variance-transport-message-ready.md` | `processed/pr-waste-variance-transport-message-ready.md` |

Deleted count: **7**, exactly as expected. Nothing was deleted without a printed pairing.

`git stash drop` (**never** `pop`) — dropped `refs/stash@{0}` `ae672f78`, the exact ref
created in this step, identified by its `WIP on main: c211ad62 … (#1257)` message.

No `git checkout .`, no `git checkout -- <folder>`, no `git reset --hard`, no `git clean`,
no `git stash pop` was run at any point in this session.

## STEP 5 — arming hold enforced (Marco's ruling 2026-08-21: HOLD arming)

The two prompts that arrived with #1293 and were never in this tree are the genuinely-pending
pair. They were disarmed the documented way — `git mv` back to `-HOLD.md`, which keeps them
tracked and leaves a clean staged rename for a later docs PR to commit (as #1291 did for `sor-s9`):

- `R  docs/pr-prompts/pr-qa-backlog-discharge-fold-key-guard-ready.md -> …-HOLD.md`
- `R  docs/pr-prompts/pr-qa-scanner-brief-instrument-corrections-ready.md -> …-HOLD.md`

They are **not deleted and not lost** — they are held, per Marco's hold on all arming until
the three known failure modes are fixed. Re-arm by `git mv` back to `-ready.md`.

### comms-hub index landmine — repaired, and by a cheaper route than expected

Pre-state carried `RD docs/pr-prompts/pr-comms-hub-inbox-HOLD.md -> …-ready.md`: staged in
the index as **ARMED**, deleted in the worktree. That prompt died to failure Mode B and must
stay held.

The path-scoped `git stash push -- docs/pr-prompts/` in STEP 4 **already reverted the index
for this path**, so the repair was complete before the prescribed commands ran. Measured
after the fact, not assumed:

- `git diff --cached --name-status -- …-HOLD.md …-ready.md` → **0 staged entries**
- `pr-comms-hub-inbox-HOLD.md` on disk: **True**; on `origin/main`: **present (1)**
- `pr-comms-hub-inbox-ready.md` on disk: **False**; on `origin/main`: **absent (0)**

Because the state was already correct, `git restore --staged` and the single-file
`git checkout --` were **deliberately not run**. Running a `git checkout --` that is a
provable no-op is pure downside on this board.

### Acceptance test

`*-ready.md` at the top level of `C:\ProjectOperations2\docs\pr-prompts\` = **0**. PASS.
Independently confirmed by the closing sweep: §4 `armed (*-ready.md): 0`.

## STEP 6 — worktrees: 1 pruned, 3 kept

Correction worth recording: all four worktrees belong to the **dev tree**
`C:\ProjectOperations2`, not to the clone. `git worktree list` in the clone returns only the
clone itself. Assessing them against the clone gives false readings — two branch refs do not
even resolve there.

| worktree | path on disk | locked | commits not on origin/main | action |
|---|---|---|---|---|
| `/tmp/po-scan-0CwZSs` | **gone** | **yes** (`initializing`) | 0 (HEAD == `c1737312`) | **KEPT** — locked, rule (a) fails |
| `C:/po-worktrees/sot-d-register` `[docs/sot-05-d-register]` | exists | no | **1** — `407b93d2 docs(sot): register Marco's D1-D55 decision series in sot/05` | **KEPT** — unmerged work |
| `C:/po-wt/wt-reaudit` (detached `6bf3614d`) | exists | no | **0** | **PRUNED** |
| `C:/po-wt-h` `[hygiene]` | exists | no | **1** — `edef9f59 docs(queue): disarm sor-s9 for splitting, retire three shipped prompts` | **KEPT** — unmerged work |

`git worktree remove -f 'C:/po-wt/wt-reaudit'` (exit 0) then `git worktree prune -v` (exit 0).
`git worktree list` now shows 4 entries (the dev tree + the 3 kept). Path
`C:\po-wt\wt-reaudit` gone from disk. **No branch was deleted** — `git branch --list` still
shows `docs/sot-05-d-register` and `hygiene`, both marked `+` (checked out in a worktree).

Nuance for whoever picks these up: both kept branches carry a commit whose **title** matches
an already-merged PR (`407b93d2` ≈ #1287, `edef9f59` ≈ #1291), so they are probably
pre-squash duplicates rather than real orphaned work. They were still kept, because the rule
is *zero unreachable commits*, and "probably a duplicate" is not zero. Someone should confirm
and retire them deliberately.

## STEP 7 — relaunch and proof the new code is actually live

1. `C:\po-watcher\STOP-WATCHER` removed (verified absent).
2. Relaunched detached in the pre-state form:
   `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\po-watcher\watcher-launcher-singlelane.ps1"`
   — the launcher path was **verified on disk**, not assumed; `watcher-launcher.ps1` and
   `watcher-launcher-lane2.ps1` also exist and are the wrong ones.
3. Alive after 60 s:
   - watcher node **PID 13372** (old PID was **23584**)
   - wrapper **PID 6088** (old **40456**), child `start-watcher.ps1` **PID 6684**
   - `watcher-launch.log`: `starting supervise-watcher` ×1, `restarting in 10s` ×0 —
     **no crash loop**. Log tail shows a normal boot: verdict-archive sweep
     `archived=34 kept=0 skipped=0`, reviewed-set seeded with 829 PRs,
     `poll-every: 90 s, min-age: 2 min`.
4. **artifact-runs, not merely artifact-exists:**
   - `scripts/pr-watcher/lane-classify.mjs` present in the clone: **True**
   - `PR_WATCHER_LANE` in `scripts/pr-watcher/supervise-watcher.ps1`: **13 occurrences**
     (was 0 before #1275), including the live guard at :93–:99 and the
     `2026-08-20: lane-aware watchdog` block at :87. #1275, #1254 and #1253 are now
     executing code, not inert files.

### Closing sweep (01:44:06Z) — verbatim

```
==================== 2. WATCHER ====================
  [LIVE] watcher node: RUNNING pid 13372
  [LIVE] auto-restart wrapper: alive (1)
  [LIVE] heartbeat age: 441 min  (ticks only mid-run; stale + empty queue = idle, NOT wedged)
  [LIVE] watcher clone: branch=main dirty=34  <-- NOT clean-on-main; the watcher may refuse to start
  [LIVE] orphaned worktrees: 3 (aborted run leftovers -- investigate/prune):
  [LIVE]    /tmp/po-scan-0CwZSs            c1737312 (detached HEAD) locked
  [LIVE]    C:/po-worktrees/sot-d-register 407b93d2 [docs/sot-05-d-register]
  [LIVE]    C:/po-wt-h                     edef9f59 [hygiene]
  [LIVE] guard hook (.claude/hooks/guard.mjs): present

==================== 3. IS THE BOARD BUSY? ====================
  [LIVE] in-progress prompts (a station is running one): 0
  [LIVE] git index.lock  interactive/clone: False / False
  [LIVE] git processes running: 0
  [INFO] headless claude-code sessions: 0
  [LIVE] no PR touched on GitHub in the last 2 min

==================== 4. QUEUE (docs/pr-prompts on disk) ====================
  [LIVE] armed (*-ready.md): 0
  [LIVE] needs-marco/: 9
  [LIVE] no-pr-opened/: 107
  [LIVE] failed/: 20
  [LIVE] blocked/: 0

==================== 7. VERDICT ====================
  [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity.
```

## Two residual items the next station must not misread

**1. `clone dirty=34` in the closing sweep is NOT the pre-existing drift.** It is new and
self-inflicted-then-self-healed. The STEP 3 stash restored those 34 `docs/pr-reviews/*.md`
into the clone; the relaunched watcher's first `verdict-archive` sweep at 01:42–01:43Z
re-archived all 34 to `C:\po-watcher\verdicts-archive` (`archived=34 kept=0 skipped=0`),
so they are once again uncommitted deletions. The number is coincidentally identical to
the pre-state. **The clone is at `origin/main` with behind=0, which it was not before.**
The sweep line `may refuse to start` is not applicable — the watcher started clean.

**2. The clone now carries 2 `*-ready.md` of its own, and they are inert.** The ff merge
brought `pr-qa-backlog-discharge-fold-key-guard-ready.md` and
`pr-qa-scanner-brief-instrument-corrections-ready.md` into
`C:\po-watcher\ProjectOperations\docs\pr-prompts\`. They cannot arm anything: the launcher
sets `$env:PR_WATCHER_PROMPT_DIR = "C:\ProjectOperations2\docs\pr-prompts"` (read directly
from `watcher-launcher-singlelane.ps1`), so the watcher reads the **dev tree** queue, which
is at 0 armed. They were left alone deliberately — a `git mv` there would dirty a clone that
is currently exactly at `origin/main`, for no safety gain. If the prompt dir is ever
repointed at the clone, disarm them first.

## Deliberately not done

- No commits, no push, no PR, no merge to any remote, no label changes. Every change above
  lives only in the two working trees.
- No Azure / Entra / SharePoint contact of any kind.
- Nothing was armed. The acceptance test is 0 armed and it passed.
- The clone stash was not popped or dropped.
- The two kept worktrees' branches were not deleted or touched.
- `git restore --staged` / single-file `git checkout --` for comms-hub skipped as a
  measured no-op (see STEP 5).

## Verdicts

- **DEV TREE `C:\ProjectOperations2` — GREEN.** main @ `c1737312` == origin/main, behind 0,
  ahead 0. 7 dead prompts deleted with proof, 2 pending prompts held at `-HOLD`, comms-hub
  index landmine cleared. 0 armed.
- **BUILD CLONE `C:\po-watcher\ProjectOperations` — GREEN.** main @ `c1737312` == origin/main,
  behind 0 (was 6). #1275 / #1254 / #1253 verified executing, not merely present.
  `stash@{0} machine-minder-2026-08-21-clone` parked for review.
- **WATCHER — GREEN.** node PID 13372 (was 23584), wrapper PID 6088 (was 40456), clean single
  start, no crash loop, sweep verdict `SAFE TO ACT`.

**AMBER footnote, not a machine verdict:** the STOP sentinel cannot stop a running watcher
(STEP 2). Until that is fixed, every stop on this box is a PID kill in practice. Worth a
prompt: have `index.mjs` poll `C:\po-watcher\STOP-WATCHER` in its idle loop and exit cleanly.

— Station 03, Machine Minder, 2026-08-21 01:45Z
