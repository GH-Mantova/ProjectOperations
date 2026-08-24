# 00-SUPERVISOR / STATION 03 NOTICE - 2026-08-20 06:20Z - QUEUE TREE SYNCED + ONE DISARM

## 1. The tree was synced. It is no longer behind.

    before: HEAD 95a860af   37 behind origin/main   48 dirty
    after:  HEAD ef1e84b2    0 behind origin/main   17 dirty (7 deleted + 10 untracked, 0 modified)

Method (deliberately NOT `reset --hard` and NOT `checkout -- docs/pr-prompts/`, both of which
would have resurrected already-executed prompts):

    git update-index --refresh          # cleared a phantom M on metadata-catalog.json
    git checkout -- docs/data-model/metadata-catalog.json   # working hash == HEAD hash, lossless
    rm 2 untracked blockers             # pr-sot-01-nav5 / pr-sot-02, both verified byte-identical to main
    rm .git/index.lock                  # 242 min old, size 0, 0 live git processes -> provably stale
    git stash push -- docs/pr-prompts/  # parks 35 consumed-prompt deletions AND restores the files
    git merge --ff-only origin/main     # 95a860af -> ef1e84b2
    <re-delete only *-ready.md that also exist in processed/>
    git stash drop                      # NEVER pop - popping re-applies the deletions

The re-delete step is evidence-based: a prompt was removed only where a file of the same name
already exists in processed/, i.e. positive proof it has already run.

REMOVED as already-run (7):
    pr-deps-clear-high-advisories-ready.md
    pr-fix-watchdog-lane-awareness-ready.md
    pr-fuel-price-staleness-and-refresh-ready.md
    pr-migration-naming-guard-ready.md
    pr-queue-sync-lint-cwd-ready.md
    pr-tipfinder-tender-only-ready.md
    pr-waste-variance-transport-message-ready.md

KEPT as genuinely pending (3, premises re-measured TRUE against ef1e84b2):
    pr-e2e-container-s1-trial-workflow-ready.md
    pr-rates-drop-prompt-corrections-ready.md
    pr-sor-s9-register-to-progress-claim-ready.md   <- see section 2

Backup of everything touched: C:\po-watcher\_mm-backup-2026-08-20-queue-tree\
(status-before.txt, head-before.txt, processed-ready-before.txt, the ledger files,
queue-watch-state.md, and a copy of each removed prompt as resurrected-<name>.)

Preserved untracked working state, all verified present after the sync:
    .pr-drafts/ · docs/data-model/sweeps/ · docs/pr-prompts/no-pr-opened/
    .queue-sync-ledger.txt (+ .bak) · queue-watch-state.md
    the 00-supervisor-*.md notice files · pr-settings-home-slice0-DISARMED-*.md

## 2. pr-sor-s9 was DISARMED at 06:19:26Z - deliberately, by Station 00.

The fast-forward brought `pr-sor-s9-register-to-progress-claim-ready.md` in ARMED (PR Master
armed it on main). The watcher queued it at 06:18:48 (depth 2, busy) - queued, not started.

MARCO DECIDED, THIS SESSION: this slice is to be SPLIT at the API/web seam into two slices,
not run as-is. size: 9 is the largest thing in the queue and single nine-scope runs are the
shape that historically produces partial work.

So it was renamed here: pr-sor-s9-register-to-progress-claim-ready.md -> -HOLD.md

It may still sit in the watcher's IN-MEMORY queue from the 06:18:48 enqueue. If you see
"[error] could not read pr-sor-s9-...-ready.md: ENOENT" that is THIS, and it is expected and
harmless. A watcher restart clears it.

MAIN STILL SAYS -ready. A docs PR is needed to rename it back to -HOLD on origin/main,
otherwise the next sync re-arms it. That handover is with Station 06.

## 3. Watcher restart is STILL OUTSTANDING

PID 33692 started 02:10:51Z. #1275 (lane-aware watchdog, scripts/pr-watcher/**) merged 04:17Z.
Per docs/pipeline/stations/03-machine-minder.md a running watcher keeps executing the OLD code
until restarted - so the lane-aware watchdog fix is NOT yet live.

The restart script is written and guarded (C:\po-watcher\_mm-2026-08-20-restart.ps1). It ABORTED
correctly at 06:20:11Z because the watcher had just started pr-rates-drop-prompt-corrections.
Re-run it in the next idle window (0 children, queue drained).

## 4. DOC CORRECTION - the station file names the wrong launcher

docs/pipeline/stations/03-machine-minder.md says:
    "Relaunch is ALWAYS detached ... running C:\po-watcher\watcher-launcher.ps1
     (this is the REAL launcher path)."

MEASURED 2026-08-20 06:04Z: the running wrapper was
    PID 11068  powershell.exe ... -File "C:\po-watcher\watcher-launcher-singlelane.ps1"

Three launcher files exist; the doc names the one last modified 2026-08-12. The -singlelane
wrapper deliberately unsets PR_WATCHER_LANE / LANES. Relaunching per the doc starts the WRONG
wrapper. The doc line needs fixing.

-- Station 00 (Supervisor) acting as Station 03 dispatch
