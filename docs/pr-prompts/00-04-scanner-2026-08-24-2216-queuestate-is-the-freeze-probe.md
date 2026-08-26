# Station 04 — Scanner breadcrumb, 2026-08-24T22:09–22:20Z

**BLIND RUN — Desktop Commander ABSENT (4th occurrence).** Read-only `stat`/`cat`/`grep`/`python3`
over the mounts. No git run from the VM. GitHub MCP used only for the open-PR list.

⚠️ This file is untracked-by-convention and invisible to a clean worktree. The authoritative copy is
PROJECT MEMORY: `project_scanner_2026_08_24_2216_queuestate_is_the_freeze_probe.md`.
This breadcrumb is inert to the watcher: `READY_PATTERN = /^(pr|rev)-.*-ready\.md$/i` (index.mjs:94)
cannot match a `00-` prefix.

## 1. REFUTED — the pre-arm freeze check IS satisfiable on an empty board [MEASURED]

`index.mjs:102` `RESCAN_INTERVAL_MS = 5*60*1000`; `rescan()` ends in an **unconditional**
`await writeQueueState()`. Only `runArchiveSettledVerdicts()`'s log line is gated (`index.mjs:734`,
`if (archived+kept+skipped > 0)`). Samples of the `ts` field:
22:09:03Z → `22:08:01.837Z`; 22:14:18Z → `22:13:01.330Z`; 22:16:39Z → `22:13:01.330Z` (299.5 s apart,
with `armed=0 owned=0 runnable=0`).

**PROBE:** read the `ts` field **inside the JSON** (never the mtime), ≥2 samples spanning >5 min.
Present-tense liveness only, 5-min resolution, no freeze history.

## 2. The freeze-detector LOG is dead — one-line fix for Station 06 [MEASURED]

`C:\po-watcher\watcher-launch.log` last line 18:53:18.951Z; silent through 22:16Z. `docs/pr-reviews`
in the clone = 0 files (dev tree has 35). Move the `log(...)` out of the `if` at index.mjs:734.

## 3. The heartbeat.log decoy [MEASURED]

`supervise-watcher.ps1:85` → `$wdHeartbeat = $env:PR_WATCHER_REPO_ROOT + "scripts\pr-watcher\heartbeat.log"`,
and `watcher-launcher.ps1:4` sets `PR_WATCHER_REPO_ROOT = C:\po-watcher\ProjectOperations`.
The watchdog therefore reads the **clone** copy (mtime 14:25Z). The **dev-tree** copy is frozen at
**2026-07-08T05:50Z**. The heartbeat-refresh-before-arming mitigation must append to the CLONE copy.
`wdHungMin = 15` confirmed live (line 76).

## 4. PR #1308 — premise true, scope one doc too wide [MEASURED]

Counting `c3 a2 e2 82 ac` with a python byte reader (positive + negative controls both passed):
02-board-driver 69 · 04-scanner 20 · 05-sot-keeper 17 · 03-machine-minder 12 · 00-supervisor 1 ·
**06-pr-master 0**. 00-supervisor and 04-scanner are *mixed* (33 and 28 already-clean `→`/`—`), so a
blanket re-encode of a whole file would corrupt the clean characters.
⚠️ My first instrument (`grep -P '\xc3\x83'`) returned 0 for every file **and for its own positive
control**. The control caught it.

## 5. Refuted / re-measured

- 🟢 **Locked orphan worktree REFUTED.** `.git/worktrees/` registry = `po-wt-h`, `sot-d-register`,
  `sot-readme-fetch`, `sotk-03-ledger` — all unlocked, live gitdirs, no `HEAD.lock`/`index.lock`,
  no `po-scan-*`. Residue only: unregistered dirs `C:\po-worktrees\po-scan-1787002207` and
  `…\scan-1787220682`. `index.lock` absent in both trees.
- 📏 **sot/04 exactly 8 behind, unchanged** (284 `^### Model: ` vs 292 `^model `). Same 8 names:
  AllocationWeightConfig, AllocatorDelegate, ClientShare, ContactShare, EstimatorCapacity,
  TenderAllocationCandidate, TenderAllocationRejection, WorkerShare.
- 📏 **`docs/approvals/` still README.md only** — all 5 gated prompts gate on markers that never
  landed. `pr-rates-s11c-drop-legacy-tables-HOLD.md` (drops DB tables) has **no** `do-not-arm` marker
  in its body; that gate is its only protection.
- 📏 Board: **armed = 0**, 59 `-HOLD.md`, 119 depth-1 entries (control: 105 `.md` seen by same glob).
- 📏 The two suffix-less armable-and-invisible prompts remain: `pr-permission-role-reconciler.md`,
  `pr-smoke-share-worker-tokens.md`.

## 6. Counting rules

- **do-not-arm class = 6 armable.** 14 `-HOLD.md` match `do-not-arm`/`DO NOT ARM` recursively, but 8
  live in `binned-shipped-20260720/`, `superseded/…`, `needs-marco/` and cannot be armed by an
  in-place `git mv`. Depth-1 six: pr-524-rates-b-slice2-canonical, pr-nav-jobs-projects-merge,
  pr-ops-m2b-tipping-tab-reminder, pr-retire-tenderclientnote-s2, pr-siteid-notnull-backfill,
  pr-vendor-invoice-ocr.
- 🔴 `index.mjs:1161` computes `allArmed` with `READY_PATTERN`, which **includes `rev-*-ready.md`**.
  The watchdog's "armed" and the board census's "armed" are different numbers. Say which you mean.

## 7. Standby [MEASURED shape, CONTESTED fraction]

`ensure-watcher.log` (PT10M) gaps: 13:05→14:09:05, 14:58→16:08:51, 16:58→18:08:33, 18:58→20:08:55,
21:08→22:10:38. Five consecutive hours of ~62–70 min silent / ~50–60 min awake, every resume at
**~HH:08 with jitter** — the Kernel-Power id-507 signature. Computes to 59 %, which contradicts the
33.2 % on record. **Adopt neither** — `ensure-watcher.log` over-states (its task misses fires the
node survives) and `watcher-launch.log` is dead. Only the alternating hourly shape is measured.

## 8. Board / concurrency

Open PRs: **#1308 only** (`fix/station-doc-encoding`, sha `0a4e2adc`), opened **22:15:38Z — 7 minutes
into this run** by a concurrent chat. Backlog buckets **NOT re-measured** (blind); carry
`ready=1 needs-marco=1 blocked=5` as STALE.

## For Station 00

1. Dispatch to **06**: unconditional archive-tick log (index.mjs:734) — one line, and it restores the
   gap-based freeze instrument. Joins the 16 × `Date.now()` item.
2. Decide, with Marco: the freeze-check blocker on arming is discharged; RULE 4 and the sleeping box
   are not.
3. Route to #1308's reviewer: scope is 5 docs, and 2 of them are mixed.
4. `MEMORY.md` is 20.1 KB against a 24.4 KB read limit and needs compaction — not Station 04's lane
   to rewrite wholesale.
