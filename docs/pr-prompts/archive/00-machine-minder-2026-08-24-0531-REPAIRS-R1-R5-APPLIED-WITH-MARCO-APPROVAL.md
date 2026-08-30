# Station 03 - Machine Minder | 2026-08-24T05:23-05:31Z | REPAIRS APPLIED

Marco approved R1-R5 from the 05:18Z report in-session. All five executed. Companion to
`00-machine-minder-2026-08-24-0518-CLONE-5-BEHIND-1304-FIX-IS-INERT-WATCHDOG-TRAP-STILL-LIVE.md`
(that file holds the diagnosis; this one holds what changed).
⚠️ No project-memory tool in this session - these breadcrumbs plus chat are the only channels.

## R1 - CLONE FAST-FORWARDED. #1304 IS NOW LIVE. [DONE]

- Pre-flight, 05:21:52Z: `git merge-base --is-ancestor HEAD origin/main` exit **0**; tracked-dirty
  paths with incoming commits = **0**. Armed prompts = 0, open PRs = 0. Clean window confirmed.
- 05:23:06Z created `C:\po-watcher\STOP-WATCHER`, then `Stop-Process` on node **38308**.
  Watcher gone by 05:23:27Z; launcher wrapper 21244 survived (its internal supervisor loop
  scheduled a 60 s restart - `supervise-watcher.ps1` does NOT read the STOP sentinel, only
  `watcher-launcher-singlelane.ps1` does, between iterations).
- 05:24:03Z `git merge --ff-only origin/main` in `C:\po-watcher\ProjectOperations` -> exit **0**,
  `81b1c56f..74066ae9`, 9 files, +1069/-172. HEAD now `74066ae9`, **ahead 0 / behind 0**.
- `index.mjs` **102541 -> 109527 bytes**; `merge-wait|mergeWait|MERGE_WAIT` matches **0 -> 6**
  (control `heartbeat` 10 -> 12). `supervise-watcher.ps1` re-written (38386 -> 38405 B).
- 05:24:37Z removed the STOP sentinel. The supervisor's own loop had already brought node
  **21908** up at **05:24:08.605Z** - i.e. **4.4 s after the ff completed**, so it is running the
  NEW file. Verified alive again 05:31:11Z.
- Ancestry (05:26:34Z): `node 21908 <- powershell 15000 <- powershell 21244 <- pid 32472 NOT_ALIVE`.
  Orphaned at the top = detached. No `Start-Process` was used anywhere.
- Stash grew 142 -> 143 exactly as predicted (preflight autostash on the relaunch).

## R2 - "PO Watcher Keepalive" REGISTERED. [DONE]

- `C:\po-sup-fix-scripts\ensure-watcher.ps1` (5266 B) reviewed line-by-line, then copied to
  `C:\po-watcher\ensure-watcher.ps1`.
- **Dry-run while the watcher was UP (runbook step 2) - PASSED:** logged
  `watcher alive, pid(s) 21908` and started nothing. Watcher count still 1 after.
- 🔴 **Runbook deviation, deliberate:** the runbook's
  `-RepetitionDuration ([TimeSpan]::MaxValue)` is **REJECTED by this Windows build** -
  `The task XML contains a value which is incorrectly formatted or out of range.
  (14,42):Duration:P99999999DT23H59M59S`. Substituted a **Daily** trigger with
  `RepetitionInterval PT10M / RepetitionDuration P1D`, which renews every day and is
  effectively indefinite. **The runbook should be corrected.**
- Registered non-elevated as `LAPTOP-E6NHU4E4\Marco`, `LogonType Interactive`,
  `RunLevel Limited` (deliberate - the `claude` CLI's credentials live in the user profile),
  `MultipleInstances IgnoreNew`, `ExecutionTimeLimit PT10M`. Triggers: AtLogOn + Daily/10-min.
- Verified 05:31:11Z: **State Ready · LastTaskResult 0 · LastRun 15:28:51 (+10) · Next 15:35:00**.
  Scheduled-task total **207 -> 208**, matching `atcher|Keepalive` **0 -> 1**.
- ⚠️ **OUTSTANDING:** runbook **step 5** (deliberately kill the wrapper + node and prove
  `RELAUNCHED` + `VERIFIED ... detached=True`) was **NOT run** - it was not in the approved list.
  The *detector* half is proven; the *relaunch* half is unproven. The queue is empty right now,
  which is the correct window for it.

## R3 - DEAD `/tmp/po-scan-0CwZSs` WORKTREE REMOVED. [DONE]

05:29:53Z, with `git.exe` process count **0** measured at that moment:
`git worktree unlock` (exit 0) -> `git worktree remove --force` (exit 0) -> `git worktree prune -v`
(exit 0). Gone from `git worktree list` **and** from `.git\worktrees\`, taking its 0-byte
`HEAD.lock` + `index.lock` with it. Dev-tree worktrees now **4**: `C:/ProjectOperations2`,
`C:/po-worktrees/sot-d-register`, `C:/po-worktrees/sot-readme-fetch`, `C:/po-wt-h` - all with
Windows gitdirs, none locked.

## R4 - STALE `maintenance.lock` DELETED. [DONE]

`C:\ProjectOperations2\.git\objects\maintenance.lock` - 0 B, mtime 2026-08-18T06:11:47Z,
**age 143.3 h**, `git.exe` count **0** re-checked immediately before removal. Deleted 05:29:54Z.
All of `index.lock` / `HEAD.lock` / `maintenance.lock` now absent in **both** trees.

## R5 - STASH TRIMMED 143 -> 38, BUT NARROWER THAN APPROVED. [DONE, WITH A DEVIATION]

🔴 **I did NOT drop oldest-first as R5 proposed.** Classification at 05:30:10Z showed the 143
entries are **NOT** all launcher noise:

- `watcher-preflight-autostash` (mechanical, the closed loop) ...... **108**
- **hand-named WIP stashes** ....................................... **35**

The oldest entries are precisely the hand-named ones - e.g. `stash@{141} wip-staged-work-not-for-
this-pr`, `stash@{132} WIP on feat/swms-template-catalog`, `stash@{90} WIP on feat/wl3-s1-win-
likelihood`, `stash@{8} machine-minder-2026-08-21-clone`. **Oldest-first would have destroyed real
work, one-way.** So I dropped **only** autostashes, keeping the 3 newest for growth tracking:

- **105 dropped, 0 failed.** Total **143 -> 38** = 3 autostash + **all 35 hand-named preserved**.
- Full before/after list and every dropped label recorded at
  **`C:\po-watcher\stash-trim-2026-08-24-station03.log`** (36683 B).
- Baseline for the next run's growth check: **38**, of which 3 are autostashes.

## 🔴 STILL LIVE AFTER ALL FIVE REPAIRS - THE ARMING TRAP IS NOT FIXED

**Heartbeat mtime is STILL `2026-08-24T03:03:26Z` - age 147.8 min at 05:31:11Z.** The relaunch did
not refresh it and #1304 does not refresh it on startup.

Read the new code: `supervise-watcher.ps1` **L584** still computes
`$ageMin = ((Get-Date).ToUniversalTime() - (Get-Item $Heartbeat).LastWriteTimeUtc).TotalMinutes`
with **no cold-start baseline**, and **L585** kills on `$ageMin -gt $HungMin` ($wdHungMin = 15).
`index.mjs` only ever writes the file from `startHeartbeat(...)`, whose first tick is at
**elapsed=60 s** - there is no write at boot.

**#1304 fixed the merge-wait case (`MERGE_WAIT_HEARTBEAT`, L172, now wired at L1446/1525/1590).
It did NOT fix the idle cold-start superset Station 00 measured at 04:12Z.** The kill condition
needs `armed > 0` AND `runnable > 0` AND 0 in-progress - so with 0 armed nothing happens, but
**the first prompt armed after any idle period > 15 min still trips it before its own first tick.**

That is the same trap, unchanged, and it is armed right now.

Options, none applied - **Marco's call, this is a code/config change, not machine hygiene**:
1. `$env:PR_WATCHER_HUNG_MIN` (read at `supervise-watcher.ps1` L77) raised above the idle gap -
   a knob that already exists, no code change, but it only widens the window.
2. Write a heartbeat line at node startup, or baseline the watchdog's clock to the node's
   `CreationDate` rather than the file's mtime - the actual fix. Needs a PR.
3. Touch `heartbeat.log` immediately before each arming - a manual ritual, and fragile.

## FINAL STATE, MEASURED 05:31:11-05:31:14Z

Watcher **1** (pid 21908) · node total 13 · git procs **0** · Keepalive **Ready/result 0/next 15:35**
· clone `74066ae9` **0/0** · clone stash **38** · dev tree `2247141b` behind **3** (unchanged - the
dev tree was not touched) · worktrees **4**, none locked · all index/HEAD/maintenance locks **absent**
in both trees · `STOP-WATCHER` absent · `STOP-WATCHER-LANE2` present (by design) · armed prompts **0**.

## FOR STATION 00

Board still quiet for a correct reason. **The R1 blocker is cleared - but arming is still unsafe**
until the cold-start heartbeat baseline is dealt with (options above). If you arm, expect the kill.
