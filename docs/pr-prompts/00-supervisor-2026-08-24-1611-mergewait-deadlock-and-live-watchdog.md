# 00-SUPERVISOR — 2026-08-24 16:11Z — merge-wait deadlock proven; watchdog is LIVE; nothing merged

Host reached (Desktop Commander / PowerShell). Sweep verdict **SAFE TO ACT**.
Board: 2 open PRs (#1305, #1306), both MERGEABLE/CLEAN, both `labels:[]`, armed=0,
`index.lock` absent in both trees, main `0 behind/0 ahead`. Watcher **pid 29024** alive and IDLE
(last job `rev-1306-ready.md` — matches the newest PR, the correct idle-not-wedged disambiguator).

## 1. The merge-wait / review LANE DEADLOCK — proven end to end on #1305 [MEASURED]

- 08:22:21Z PR #1305 opened. **All CI green by 08:23:47Z** (`statusCheckRollup.completedAt`).
- 08:23:09Z `[merge] …: opened PR #1305, policy=tests-docs, waiting…`
- 08:24:48Z `[review] enqueued … → rev-1305-ready.md` / `[queue] rev-1305-ready.md (depth: 1, **busy**)`
- 08:24:09Z→09:08:10Z merge-wait heartbeat ticks 60s→2700s. ~09:08→~10:05 **box frozen (standby)**.
- **10:05:27Z `[merge] …: PR #1305 stays for Marco (timeout waiting for green checks + MERGE verdict)`**
- **10:05:32Z `[start] rev-1305-ready.md` — 5 SECONDS LATER.** Verdict MERGE written 10:13/10:14:10Z.

**`waitForPolicyMerge()` waits for a MERGE verdict whose producer is lane-blocked behind it.**
The 5-second gap is the signature; the review sat blocked 100 minutes.
**Control:** #1306's review enqueued 14:21:49 with **no `busy`** and `[start]`ed **instantly** —
because no merge-wait held the lane. Launcher is `watcher-launcher-singlelane.ps1`.
⇒ Standby only advanced the clock. **Fix the ORDERING, not just the clock.** → **STATION 06.**
Also: 16 × `Date.now()` in `index.mjs`; every deadline is freeze-blind.

## 2. 🔴 `supervise-watcher.ps1` IS PRESENT — the "DORMANT" call checked the wrong path

`C:\po-watcher\supervise-watcher.ps1` → absent. **`…\ProjectOperations\scripts\pr-watcher\supervise-watcher.ps1` → PRESENT (38 405 B).**
Wrapper chain running: `watcher-launcher-singlelane.ps1`(10364) → `start-watcher.ps1`(3552) → node(29024).
Fires when **heartbeat stale > `wdHungMin`(15) min WHILE `runnable>0` AND 0 in-progress** (L76, L368).
Heartbeat is **105 min stale**; the node lives only because `.queue-state.json` says `runnable: 0`.
🔴 **One `git mv` to `-ready.md` satisfies all three clauses at once and kills the watcher.**
Refresh `heartbeat.log` with a marker line in the same breath as any arming. **Now proven necessary.**

## 3. Standby, re-measured

Six gaps in `ensure-watcher.log` (a `PT10M` task): 33.2 / 63.8 / 67.2 / 63.8 / 64.1 / **70.6** min.
Awake windows ~49-57 min. **Duty cycle ≈ 49 %, not 33 %.** S0ix is the only standby state and AC
idle-sleep is already `never` ⇒ **not powercfg-fixable. Marco's hardware, hard stop.**

## 4. Merged: NOTHING. Both open PRs carry a human gate.

- **#1305** — watcher-routed to Marco ⇒ **RULE 2 absolute**, even though §1 proves the routing reason
  is false on both halves it names.
- **#1306** — 🟢 NOT watcher-routed, and **nothing will merge it automatically** (a station chat
  authored it, so no prompt run owns a `[merge]` step). 🔴 Held anyway: its body ends
  *"Do NOT auto-merge without a human reading the rendered diff — this is a governance doc."*
  That is authored and reasoned, **not** the 64/68 template boilerplate. Pre-verified for Marco:
  2 files (`sot/03` + this class of breadcrumb), CP-24-clean, `numstat 836/1` with the single
  deletion being the `Last updated:` line, CI 7-pass, agent verdict MERGE.

## 5. Dispatched / deferred / left alone

- **→ Station 06:** the §1 ordering defect + monotonic clock. Top board blocker.
- **→ Station 03 (report-only):** 4 orphaned worktrees (`C:/po-worktrees/sot-d-register`,
  `sot-readme-fetch`, `sotk-03-ledger`, `C:/po-wt-h`), watcher clone `dirty=36`, and a stale
  `rev-1162-ready.md` (08-17) in the clone. 🟢 **Nothing to repair on the watcher itself, and do NOT
  touch `PO Watcher Keepalive`** (Ready, PT10M, result 0 — its log gaps are the machine asleep).
- **→ PR Master / 02:** a queue-hygiene docs PR clearing 4 sweep-`[STALE]` dead escalation files
  (refs #1135, #1134, #212, #1158 — all merged). The supervisor does not create PRs (LL-38).
- **ARMING: DEFERRED** on §2 (watchdog live) + §3 (60-min freeze blocks). Re-decide next run.
- **Left alone:** `/sot/`, both open PRs, the keepalive task, `rev-1162-ready.md` (a review job —
  excluded from any board census by design), the 107 `no-pr-opened/` and 20 `failed/` artefacts.

⚠️ Breadcrumbs are the documented channel but project memory is primary — the durable copy is
`project_supervisor_2026_08_24_1611_mergewait_deadlock_proven_watchdog_live.md`.
