# Station 03 - Machine Minder | 2026-08-24T05:13-05:19Z | REPORT-ONLY (no repairs made)

Host reachable: Desktop Commander PowerShell on LAPTOP-E6NHU4E4. NOT a blind run.
⚠️ NO PROJECT-MEMORY TOOL exists in this session. This breadcrumb + the chat report are the
ONLY channels. Station 00: do not expect a memory entry from this run.

## VERDICTS

- Watcher process ................ GREEN (pid 38308, alive, re-measured 05:18:53Z)
- Queue tree (C:\ProjectOperations2) GREEN (no ready-prompt deletion hazard, no pull hazard)
- Build clone .................... 🔴 RED (5 behind; the #1304 fix is INERT)
- Restarter ("PO Watcher Keepalive") 🔴 RED (still absent; 207 tasks, 0 match)
- Worktrees ...................... AMBER (/tmp/po-scan-0CwZSs still registered+locked, 79 h)
- Locks .......................... AMBER (2 stale 0-byte locks, no git process anywhere)

## 🔴 FINDING 1 - PR #1304 MERGED AT 04:51:56Z BUT THE WATCHER STILL RUNS THE OLD CODE

- origin/main = `74066ae9` = "fix(pr-watcher): keep heartbeat ticking during merge-wait so
  watchdog stops killing healthy runs (#1304)" [MEASURED 05:17:23Z]
- Clone HEAD  = `81b1c56f`, **behind by 5** (`git rev-list --left-right --count HEAD...origin/main`
  = `0  5`, in C:\po-watcher\ProjectOperations, 05:17:23Z)
- Clone `scripts/pr-watcher/index.mjs`: 102541 bytes, `merge-wait|mergeWait|MERGE-WAIT` = **0
  matches** (positive control: `heartbeat` = 10 matches). The merged fix is NOT in the running file.
- The watchdog also runs from the clone: `C:\po-watcher\ProjectOperations\scripts\pr-watcher\
  supervise-watcher.ps1`, mtime 2026-08-20T08:29:27Z. #1304 touched that file too (+1/-1) -
  also inert.
- Heartbeat mtime is STILL `2026-08-24T03:03:26Z` (age 134 min at 05:17:52Z), exactly the
  precondition Station 00 documented at 04:30Z.

**Consequence: the trap Station 00 measured at 04:12Z is UNCHANGED. The next prompt armed by
anyone kills the watcher inside ~30 s, because the fix that would prevent it sits on main and
not in the clone.** RESTART ALONE ADOPTS NOTHING - the clone must be fast-forwarded with the
watcher STOPPED, then relaunched.

## 🔴 FINDING 2 - RESTARTER STILL ABSENT (4th consecutive run)

- `Get-ScheduledTask` total = **207**; matching `atcher|Keepalive` = **0** [05:14:50Z].
  Positive control: filter `a` matches 169 of 207, and the first five names read back
  (AcerUserSensingLauncher, GH Branch Prune, ...) - the query works.
- `C:\po-watcher\ensure-watcher.log` ABSENT. `C:\po-watcher\ensure-watcher.ps1` ABSENT.
- What IS relaunching the watcher: the **launcher loop process itself**,
  pid 21244 `watcher-launcher-singlelane.ps1`, up since 2026-08-23T23:38:27Z. Chain measured:
  node 38308 <- powershell 43208 (start-watcher.ps1, 04:23:39Z) <- powershell 21244 (launcher)
  <- pid 32472 NOT_ALIVE. **That loop is a single unsupervised process with a dead grandparent.
  If 21244 dies, nothing on this box restarts anything.**
- 5 watcher starts in 24 h (preflight lines): 23:38:32, 00:02:41, 00:33:15, 02:36:48, 04:24:09.
  Zero `RELAUNCH`/`CRASH`/`detached=False` lines - consistent with launcher-loop restarts, not a
  keepalive task.

## Measurements (command -> value @ UTC)

- `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` -> **19 total**, exactly **1** matching
  `pr-watcher[\\/]index\.mjs` @ 05:14:23Z, re-measured **1** @ 05:18:51Z. Watcher pid **38308**,
  created 04:23:40.345Z.
- `Get-CimInstance ... Name='git.exe'` -> **0** git processes @ 05:14:23Z and 05:18:51Z.
- Heartbeat `heartbeat.log`: 40255 bytes, mtime 03:03:26.286Z, age **131.4 min** @ 05:14:50Z /
  **134.5 min** @ 05:17:52Z. Last line: `rev-1302-ready.md elapsed=180s`.
- **VERDICT: IDLE, not wedged, and not merge-wait.** Evidence: armed `*-ready.md` at depth 1 in
  C:\ProjectOperations2\docs\pr-prompts = **0**, and `gh pr list --state open` = **`[]`** (zero
  open PRs) @ 05:17:52Z. There is nothing for the watcher to tick for.
- `STOP-WATCHER` -> **ABSENT**. `STOP-WATCHER-LANE2` -> present, 1090 B, mtime 2026-08-18T04:44:50Z
  (BY DESIGN, SLICE 4 not built). `.watcher.lock` -> **ABSENT while a watcher is running** - the
  log shows the previous instance's lock was overwritten as stale at 04:23:40.421Z
  ("stale lockfile (PID 28308 not found)"); the current instance is holding no visible lock file.
- Dev tree @ 05:16:25Z: HEAD `2247141b` (branch main), origin/main `74066ae9`, **ahead 0 / behind 3**.
  `git status --porcelain` = 15 lines: **2 deleted, 1 modified, 12 untracked, 0 other**.
  Deleted: `docs/pr-prompts/pr-nopr-s1-dismissed-means-proceed-HOLD.md`,
  `docs/pr-prompts/pr-nopr-s2-hard-failure-bounded-restage-HOLD.md`.
  Modified: `docs/data-model/metadata-catalog.json`.
- **DELETION/RESURRECTION HAZARD: ZERO.** `git ls-tree -r --name-only origin/main --
  docs/pr-prompts` -> **397 paths** (control: `docs/pr-prompts/PROMPT-SCHEMA.md` found = 1).
  Tracked `*-ready.md` at depth 1 on origin/main = **0**. Deleted-in-tree tracked ready files =
  **0**. On-disk `*-ready.md` at depth 1 = **0**. On-disk `*-HOLD.md` = **60**.
  A `git checkout .` would resurrect two **HOLD** files, not armed prompts.
- **PULL HAZARD: ZERO.** `git log --oneline HEAD..origin/main -- <path>` = **0** for all three
  dirty tracked paths. Incoming: `74066ae9` (#1304), `9aa112df` (#1302), `81e8168a` (#1296).
- Clone @ 05:17:23Z: 34 dirty entries, **all `D docs/pr-reviews/pr-*-review.md`** - the
  verdict-archive sweep at 04:24:10-04:24:35Z that moved 34 merged verdicts out. Expected
  behaviour, but it leaves the tracked tree dirty, so the next preflight autostash will fire.
- **Clone stash count = 142** (was 140 on 2026-08-24 earlier run) -> **+2 in the interval**.
  Newest: `stash@{0} watcher-preflight-autostash ... 2026-08-24T14:23:39+10:00` (= 04:23:39Z, the
  relaunch). Closed loop confirmed. `drop`, NEVER `pop`.
- Worktrees (dev tree, `git worktree list` @ 05:16:55Z) - **5**, one MORE than the 4 last measured:
  `C:/ProjectOperations2 2247141b [main]`; `/tmp/po-scan-0CwZSs c1737312 (detached) locked`;
  `C:/po-worktrees/sot-d-register 407b93d2`; **`C:/po-worktrees/sot-readme-fetch 904fa4e8
  [docs/sot-readme-fetch-plain1]` (NEW, gitdir is a Windows path, 4.3 h old - looks legitimate)**;
  `C:/po-wt-h edef9f59 [hygiene]`. Clone has exactly 1 worktree (itself).
- Stale locks, all with **0 git processes on the box** at both measurement times:
  - `.git/worktrees/po-scan-0CwZSs/index.lock` 0 B, 2026-08-20T22:12:00Z, **79.1 h** - STALE
  - `.git/worktrees/po-scan-0CwZSs/HEAD.lock` 0 B, 2026-08-20T22:12:00Z, **79.1 h** - STALE
  - `.git/worktrees/po-scan-0CwZSs/gitdir` -> `/tmp/po-scan-0CwZSs/.git` (DESTROYED Linux VM),
    `locked` file content = `initializing`
  - `C:\ProjectOperations2\.git\objects\maintenance.lock` 0 B, 2026-08-18T06:11:47Z, **143.1 h** - STALE
  - Dev tree and clone `.git\index.lock`, `HEAD.lock`, `config.lock`: **ABSENT** in both trees.
    No new VM-side lock was created by this run.
- Quarantine: `C:\po-watcher\quarantine-2026-08-20-pr1273-duplicates` only. 26 `00-*.md` notices
  on disk in docs/pr-prompts, all untracked.

## REPAIRS I WOULD MAKE - FOR MARCO'S APPROVAL (none performed)

**R1 (top priority) - fast-forward the clone so #1304 actually takes effect.** Must be done with
the watcher STOPPED, in this order:
1. `New-Item -ItemType File C:\po-watcher\STOP-WATCHER` (stop the loop cleanly)
2. wait for node pid to exit, then verify `Get-CimInstance Win32_Process -Filter "Name='node.exe'"
   | ? CommandLine -match 'pr-watcher[\\/]index\.mjs'` returns nothing
3. `cd C:\po-watcher\ProjectOperations; git fetch origin +refs/heads/main:refs/remotes/origin/main;
   git merge --ff-only origin/main`
   (the 34 `D docs/pr-reviews/...` deletions are untracked-of-interest only to the sweep; ff-only
   will refuse if it cannot proceed - do NOT force, report instead)
4. `Remove-Item C:\po-watcher\STOP-WATCHER`
5. relaunch DETACHED: `Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments
   @{CommandLine='powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File
   "C:\po-watcher\watcher-launcher-singlelane.ps1"'}`
6. verify WHOLE ancestry up to `WmiPrvSE.exe`, not just the wrapper's ppid.
Touches: clone working tree + HEAD, the STOP sentinel, the watcher process.
Rollback: `git reset --hard 81b1c56f` in the clone (loses only the ff), remove STOP sentinel,
relaunch as in step 5.

**R2 - register the keepalive so nothing depends on pid 21244 surviving.** Per
`docs/runbooks/watcher-restarter-scheduled-task.md`: register Scheduled Task `PO Watcher Keepalive`
running `ensure-watcher.ps1` (which does not exist on disk - it must be created from the runbook
first). Touches: Task Scheduler + a new script in C:\po-watcher.
Rollback: `Unregister-ScheduledTask -TaskName "PO Watcher Keepalive" -Confirm:$false`.

**R3 - remove the dead `/tmp/po-scan-0CwZSs` worktree.** NEEDS A DECISION, NOT A REFLEX; its gitdir
points into a destroyed VM and `prune` will not touch it while locked.
`cd C:\ProjectOperations2; git worktree unlock /tmp/po-scan-0CwZSs; git worktree remove --force
/tmp/po-scan-0CwZSs; git worktree prune`
Touches: `.git/worktrees/po-scan-0CwZSs` (incl. its two 0-byte locks) and the worktree registry.
Rollback: none needed - the target directory does not exist; re-create with `git worktree add` if
ever wanted. Re-check liveness AT THE MOMENT of removal.

**R4 - delete the stale maintenance lock.**
`Remove-Item C:\ProjectOperations2\.git\objects\maintenance.lock`
Justification: 0 bytes, 143.1 h old, 0 git processes on the box at 05:14:23Z and 05:18:51Z.
Touches: one 0-byte file. Rollback: `New-Item -ItemType File <same path>`.

**R5 - trim the clone stash (142 entries).** `git stash drop stash@{N}` repeatedly, oldest first,
NEVER `pop` - popping re-applies queue deletions and resurrects dead prompts. Low priority.
Rollback: entries are recoverable via `git fsck --unreachable` only briefly; treat as one-way.

## HANDOFF TO STATION 00

Board is quiet for a correct reason (0 armed, 0 open PRs) - **not** a stall. But **do not arm
anything until R1 lands.** Arming into the 134-minute-stale heartbeat with the pre-#1304 code in
the clone reproduces the 04:12Z kill deterministically.
