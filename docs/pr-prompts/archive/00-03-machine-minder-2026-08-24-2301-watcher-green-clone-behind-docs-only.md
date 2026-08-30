# Station 03 — Machine Minder | 2026-08-24T23:01:42Z–2026-08-24T23:07:51Z

## GROUND

```
UTC            2026-08-24T23:01:42Z
origin/main    5ec99150            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       docs/station-contract-v1 @ 630a0741  C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                   (C:\Users\Marco\Claude\Scheduled\03-machine-minder\SKILL.md)
```

Versions AGREE — full run, not read-only-degraded.

**Reachability: NOT BLIND.** `start_process` shell `powershell.exe` returned host clock
`2026-08-25 09:01:20 +10:00` and `Test-Path C:\ProjectOperations2 = True`. Desktop Commander present,
`allowedDirectories = []`. Every claim below is a host measurement, not a GitHub substitute.

## WHAT I MEASURED

### 1. Watcher process chain — HEALTHY [MEASURED]

Resolved by **command line**, never by image name (DOCTRINE §9.5). 20 `node.exe` were running; exactly
one is the watcher.

```
SHELL pid=10364 ppid=26276  start 2026-08-24 15:35:01 local
      powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden
      -File "C:\po-watcher\watcher-launcher-singlelane.ps1"
 └─ SHELL pid=3552  start 2026-08-24 15:35:03 local
      -File C:\po-watcher\ProjectOperations\scripts\pr-watcher\start-watcher.ps1
    └─ NODE  pid=29024
      node.exe --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
```

- Launcher is `watcher-launcher-singlelane.ps1` — the correct one.
- ppid 26276 no longer exists: the chain is correctly **detached / reparented**, not broken.
- All three PIDs **re-confirmed ALIVE at 23:07:51Z**, 6 minutes after first measurement (§7 re-measure rule).

### 2. Watcher is mid-run, not idle [MEASURED]

`scripts/pr-watcher/heartbeat.log`, 60-second ticks, no gaps:

```
[2026-08-24T23:03:21.653Z] pr-crm-triage-archive-entry-ready.md elapsed=180s
[2026-08-24T23:05:21.669Z] pr-crm-triage-archive-entry-ready.md elapsed=300s
[2026-08-24T23:07:21.680Z] pr-crm-triage-archive-entry-ready.md elapsed=420s
```

`watcher-launch.log` (1.48 MB, mtime 1 min) shows a productive last hour: opened #1310 and #1311,
labelled #1310 `do-not-merge` for `escalates:true`, mirrored the rev-1310 verdict, reclaimed two
orphan worktrees. **This is a working machine, not a quiet one.**

⚠️ Station 04's 2026-08-24 2216 snapshot states "`watcher-launch.log` is dead." **That is now false**
— mtime 1 minute, actively appended. Re-read rule applied; the claim has expired.

### 3. Locks and mid-flight git state — ALL CLEAR [MEASURED]

`index.lock` checked by **byte size and age** across six repos/worktrees
(`C:\ProjectOperations2`, `C:\po-watcher\ProjectOperations`, `po-worktrees\sot-d-register`,
`po-worktrees\sot-readme-fetch`, `po-worktrees\sotk-03-ledger`, `C:\po-wt-h`):

```
index.lock absent in all six
MERGE_HEAD / REBASE_HEAD / CHERRY_PICK_HEAD / rebase-merge / rebase-apply / sequencer : none
git.exe processes running: 0
git worktree locked-files with dead PIDs: none
```

No stale-lock condition. Nothing to clear.

### 4. Watcher clone drift — 5 behind, **docs-only** [MEASURED]

```
C:\po-watcher\ProjectOperations   branch=main  head=74066ae9  (2026-08-24T04:51:56Z)
behind/ahead vs origin/main: 5 / 0
missing: 5ec99150 #1309 · 1a0415d2 #1308 · 8fca1f6f #1307 · 00d082d6 #1306 · cae22168 #1305
git diff --name-only HEAD origin/main -- scripts/pr-watcher  ->  (empty)
head contains #1304 (heartbeat merge-wait fix) and #1302 (bounded auto-restage): YES
```

**This defuses the usual alarm.** "A restart adopts nothing" (§9.5) only bites when the missing
commits touch `scripts/pr-watcher/**`. They do not — all five are docs/pipeline/sot. The running
watcher is executing current behaviour. **No restart is required, and proposing one would be churn.**

### 5. Clone working tree dirty=35, stash 39 and growing [MEASURED]

```
34 × " D docs/pr-reviews/pr-*.md"      (deleted, uncommitted — the verdict-archive sweep)
 1 × "?? docs/pr-reviews/pr-1310-review.md"
git stash list: 39 entries
  stash@{0} watcher-preflight-autostash 2026-08-24T15:35:04+10:00
  stash@{1} watcher-preflight-autostash 2026-08-24T15:24:07+10:00
  stash@{2} watcher-preflight-autostash 2026-08-24T14:23:39+10:00
  stash@{3} watcher-preflight-autostash 2026-08-24T12:36:01+10:00
  stash@{4} machine-minder-2026-08-21-clone
  stash@{38} WIP on feat/sharepoint-folder-mappings (oldest)
```

The closed loop is confirmed and measured (§9.2): the launcher preflight stashes on every start and
nothing ever pops. **+4 entries on 2026-08-24 alone.** The dirty tree guarantees the next restart adds
a 40th.

### 6. Dev-tree shared index carries another chat's staged work [MEASURED]

`C:\ProjectOperations2`, `git diff --cached --name-status` — 5 staged entries, **none of them mine**:

```
R100  pr-crm-direction-richer-surface-reconcile-HOLD.md -> ...-ready.md
R100  pr-crm-leads-page-title-HOLD.md                   -> ...-ready.md
R100  pr-crm-triage-archive-entry-HOLD.md               -> ...-ready.md
R100  pr-lessons-folder-s1-restore-HOLD.md              -> ...-ready.md
R100  pr-pipeline-fold-s1-any-permission-HOLD.md        -> ...-ready.md
```

`git status --porcelain` shows **four of these as `RD`** — staged rename, file already gone from the
worktree because the watcher consumed it into `processed/`. A pathspec-less commit in this tree right
now would land already-consumed `*-ready.md` files on `main`, where `queue-sync` can re-arm them.
This is DOCTRINE §9.2's shared-index hazard, live.

### 7. Queue — measured at TOP LEVEL ONLY [MEASURED]

```
armed (top level):     3   pr-crm-triage-archive-entry-ready.md   (mtime 2026-08-24T11:13:11)
                           pr-pipeline-fold-s1-any-permission-ready.md
                           rev-1311-ready.md                      (mtime 2026-08-25T09:00:34 local)
control, recursive: 1873   <- inert retirement files. NOT the queue. Never glob this way.
failed/ 20 (newest 2026-08-13) · no-pr-opened/ 107 · needs-marco/ 9 · blocked/ 0
```

Nothing new in `failed/` since 2026-08-13 — no triage backlog.

### 8. Restarter — PRESENT and firing [MEASURED]

```
Scheduled task "PO Watcher Keepalive"  state=Ready  last=2026-08-24T22:58:15Z  rc=0  next=+7 min
C:\po-watcher\ensure-watcher.ps1                       5266 B  mtime 2026-08-24T10:01:25
C:\po-watcher\watcher-launcher-singlelane.ps1          2367 B  mtime 2026-08-18T12:41:02
C:\ProjectOperations2\scripts\restart-watcher-if-wedged.ps1  15968 B  mtime 2026-08-18T16:04:57
```

**This discharges the prior Station 03 breadcrumb** `00-machine-minder-2026-08-24-0123-GREEN-watcher-live-no-restarter.md`.
Its "no restarter" claim is no longer true. Do not carry it forward.

### 9. The box enters connected standby roughly hourly [MEASURED]

```
Kernel-Power id-507 in last 24 h: 16
  08-25 08:07:59 · 06:08:19 · 04:08:14 · 03:26:05 · 02:08:14 · 00:08:14   (local)
  08-24 23:08:15 · 22:08:14 · 20:08:21 · 20:05:25 · 18:08:14 · 17:08:19 · 16:08:13 · 15:39:32
uptime 175.06 h, last boot 2026-08-18 01:59:56 — no reboot involved
```

`ensure-watcher.log` shows the matching dropped fires — 10-minute ticks with two holes:
`18:58:17Z → 20:08:55Z` (**70 min**) and `21:08:16Z → 22:10:38Z` (**62 min**).

**The watcher node SURVIVES standby** — pid 29024 has been continuous for ~17.5 h across every one of
those events, and the heartbeat never gapped. What is lost is **scheduled-task fires**, and the
`~HH:08` resume signature is a cron *waking* the box rather than the box waking on its own.
Station 04's 2026-08-24 reading is **corroborated**, and this is the mechanism.

### 10. Instrument lie caught in this run — report it, per §7 [MEASURED]

My first power probe filtered `Power-Troubleshooter id-1` and `id-42` over 24 h and returned **zero
rows**. Read naively that says "the box never sleeps," which would have contradicted Station 04 and
sent someone to unpick a correct finding.

The positive control (§7 guard 1) killed it: the same providers with **no time filter** return
`Power-Troubleshooter id-1` on 08-22, 08-13, 08-11 — the query path works — and `Kernel-Power id-507`
returns 16 rows in the same 24 h the first query called empty. **This box uses Modern Standby, which
does not emit id-42 or Power-Troubleshooter id-1.** The right probe is `Kernel-Power 507/566`.

### 11. Non-findings, stated so the next reader stops looking [MEASURED]

- `C:\po-watcher\STOP-WATCHER-LANE2` is **PRESENT**. Per DOCTRINE §9.5 it has been present **by design
  since 2026-08-15**. Not drift, not a stop signal. `STOP-WATCHER` is absent in all four locations.
- Clone agent worktrees: **60 directories on disk, only 2 registered** with git, total **0.05 GB**.
  `git worktree prune --dry-run -v` outputs nothing — the registry is already clean. Cosmetic, not bloat.
- `status-sweep.ps1` lists `C:/ProjectOperations2` under "orphaned worktrees". It is the **primary**
  worktree, merely on a feature branch. Not an orphan.
- Of the four genuine side worktrees, `docs/station-contract-v1` **diffs to zero files against
  origin/main** (squash-merged, #1309). `git branch --contains` reported `in-main=False` for it — the
  squash blindspot. The other three still hold divergent content (147 / 130 / 14 files) and must not
  be pruned on a `--contains` reading alone.

## WHAT CHANGED

**Nothing.** This station is report-only. No process started or stopped, no lock cleared, no stash
dropped, no branch or worktree pruned, no prompt armed, no label or PR touched. Writes this run were
confined to scratch `.ps1` probes under `C:\po-sup-fix-scripts\` and this breadcrumb.

## FINDINGS

### F1 — Watcher clone is 5 behind `origin/main`; the gap is docs-only

`74066ae9` vs `5ec99150`; `git diff --name-only HEAD origin/main -- scripts/pr-watcher` is empty.
Behaviour is current. The only cost of the gap is that a future `scripts/pr-watcher/**` merge will
need a fast-forward before it means anything.

Proposed repair, **not performed** — for Station 00 to dispatch, in an idle window:

```powershell
# preconditions: heartbeat.log shows no in-flight prompt; git.exe count = 0
git -C C:\po-watcher\ProjectOperations fetch origin +refs/heads/main:refs/remotes/origin/main
git -C C:\po-watcher\ProjectOperations merge --ff-only origin/main
# rollback: git -C C:\po-watcher\ProjectOperations reset --hard 74066ae9
```

**DEFERRED** — becomes urgent the moment any PR touching `scripts/pr-watcher/**` merges to `main`;
until then a fast-forward changes nothing that is running.

### F2 — Stash closed loop at 39 entries, +4 in one day, and the tree is dirty

The launcher preflight stashes on every start and nothing pops (§9.2). 34 uncommitted deletions under
`docs/pr-reviews/` guarantee the next start creates a 40th entry.

Proposed repair, **not performed** — `drop`, **never `pop`**:

```powershell
# inspect first — stash@{4} is a machine-minder entry and stash@{36..38} are foreign WIP
git -C C:\po-watcher\ProjectOperations stash list
git -C C:\po-watcher\ProjectOperations stash drop "stash@{0}"   # repeat for confirmed autostashes only
# no rollback for a drop: verify each entry is a watcher-preflight-autostash BEFORE dropping.
```

**DISPATCHED — Station 00.** 03 is report-only; 00 dispatches the repair. Recommend it be scoped to
`watcher-preflight-autostash` entries only and stop at `stash@{4}`, which is not one.

### F3 — Dev-tree shared index holds another chat's staged renames, four of them `RD`

Five `R100` HOLD→ready renames sit staged in `C:\ProjectOperations2`; the watcher has since consumed
four of the targets into `processed/`, leaving staged renames pointing at files absent from the
worktree. Any pathspec-less `git commit` in this tree lands consumed `*-ready.md` on `main`, where
`queue-sync` can re-arm them. `git checkout .` / `reset --hard` / `stash pop` / `git clean` are all
forbidden here (§9.2) and would re-arm the backlog outright.

**DISPATCHED — Station 00.** Every station committing in `C:\ProjectOperations2` must use a pathspec
commit until this index is drained by whoever staged it. This is a live hazard, not a cleanup task.

### F4 — The box enters connected standby ~hourly and silently drops scheduled-task fires

16 × `Kernel-Power id-507` in 24 h; `ensure-watcher.log` gaps of 70 and 62 minutes; resume clustered
at `~HH:08` with jitter, i.e. a cron waking the machine. The watcher node itself survives — this costs
**scheduled fires**, not the queue.

Per RULE 1, complete-and-additive first:

1. **Complete + additive — exempt the box from sleep, and set the keepalive task to wake it.**
   Solves it now and in future, touches no data. `powercfg /change standby-timeout-ac 0` plus
   `-WakeToRun` on "PO Watcher Keepalive". Cost: the machine stays awake. Passes both halves.
2. **Additive but incomplete — `-WakeToRun` only.** The box still sleeps; each task wakes it late,
   and non-waking tasks keep missing. Fails the *complete* half.
3. **Neither — accept the misses.** Fails the *complete* half and leaves station cadence unreliable.

**ESCALATED — Marco.** This is a power-configuration change on Marco's physical machine, outside a
report-only station's lane, and option 1 has a real cost (a machine that never sleeps) that is his
call, not mine. Question for Marco: **do you want this box exempted from standby (option 1), or is a
missed hourly cron acceptable?**

### F5 — `STATION-CAPABILITIES.md` §2's blindness diagnostic is falsified by this run

§2 and the bootstrap both state: *"if a station appears in the scheduled-task listing, it is
cloud-fired and will be blind."* Today `03-machine-minder` **is** in `list_scheduled_tasks`
(`cron 0 9 * * *`, last run 2026-08-24T23:00:51Z) **and** reached the box on the first probe. The
heuristic as written would have made this run STOP and report blindness on a healthy machine — the
exact §7 failure mode of a broken instrument producing a confident wrong verdict.

**DISPATCHED — Station 00**, for a docs PR to §2: replace the listing-based inference with the direct
test that actually worked (`start_process` succeeds → not blind; fails → blind and STOP). The listing
is not evidence either way.

### F6 — The prior Station 03 breadcrumb's "no restarter" claim is dead

`00-machine-minder-2026-08-24-0123-GREEN-watcher-live-no-restarter.md` is contradicted by measurement:
"PO Watcher Keepalive" ran at 22:58:15Z with `rc=0` and `ensure-watcher.ps1` was modified 2026-08-24.

**ACTIONED** — discharged here by re-measurement (§7.1 re-read rule). Verified by
`Get-ScheduledTask | Get-ScheduledTaskInfo` and the file's own mtime. Station 00 should not carry it
forward as pending.

### F7 — Stale-lock and orphan-worktree checks came back clean

No `index.lock` anywhere, no rebase/merge/cherry-pick markers, 0 `git.exe`, no dead-PID worktree locks,
`git worktree prune --dry-run` empty, 60 leftover agent directories totalling 0.05 GB.

**DEFERRED** — nothing to repair. Revisit only if the agent-worktree directory count starts costing
real disk; at 0.05 GB it does not.

## WHAT I DID NOT DO

- **Did not restart the watcher.** It is mid-run (`pr-crm-triage-archive-entry-ready.md`, elapsed 420 s,
  heartbeat clean) and the clone gap is docs-only, so a restart would adopt nothing and kill live work.
- **Did not fast-forward the clone, drop a stash, prune a worktree, or clean either tree.** Station 03
  is report-only (STATION-CAPABILITIES §5); Station 00 dispatches repairs. Every proposal above carries
  its exact command and rollback so 00 can dispatch without re-deriving it.
- **Did not touch the board.** No PR read beyond `status-sweep.ps1`'s own output; no label, no merge,
  no comment. #1310 (`do-not-merge`, `escalates:true`) and #1311 are Marco's and Station 00's.
- **Did not arm, disarm, rename, or move any prompt**, and did not resolve the `RD` staged renames in
  F3 — draining another chat's index is not my lane and the safe git verbs for it are forbidden here.
- **Did not touch `/sot/`** (Station 05 only), Azure/Entra/SharePoint (absolute hard stop, all
  stations), or any power setting (F4 is Marco's to decide and run).
- **Did not triage `failed/`.** 20 entries, newest 2026-08-13, nothing new since the last triage state.

---

*Provenance: every line above is `[MEASURED]` on the Windows host via Desktop Commander PowerShell
between 2026-08-24T23:01:42Z and 2026-08-24T23:07:51Z, true at `origin/main = 5ec99150`, watcher clone
`74066ae9`, dev tree `630a0741`. Probe scripts retained at `C:\po-sup-fix-scripts\mm-probe*-2026-08-25.ps1`.
This breadcrumb is untracked until a board PR commits it — Station 00, sweep it up.*
