---
opened: 2026-09-25T00:25Z
opened_by: station-00-supervisor (scheduled)
source: 00-03-machine-minder-2026-09-24-2320 (F1)
sha_at_open: 54b7cbbf
status: OPEN
---

# `ensure-watcher.ps1` creates a permanent second wrapper, and the file is outside every repo

**This file exists because the finding kept expiring.** Station 03 escalated this symptom on
2026-09-16 in a breadcrumb; that breadcrumb was archived with `DISPOSITION: ESCALATED` and the
channel was never converted into a standing file, so nine days later the defect was still live and
had to be re-found from scratch. Station 03's own F5 on 2026-09-24 measured the gap: `watchdog`
matched **1** file in `needs-marco/` and it was an unrelated one. A breadcrumb disposition is not a
channel. This file is the channel.

## The defect

`C:\po-watcher\ensure-watcher.ps1` step 2 (anchor: the comment `# --- 2. Is the watcher already
alive? ---`) asks exactly one question - *is a `node.exe` running `index.mjs`?* It never asks
whether a **wrapper** is alive.

The wrapper restarts its own node after 10 s. The keepalive fires on a schedule. When the keepalive
lands inside that 10-second window it sees zero nodes, launches a **second** detached
`watcher-launcher-singlelane.ps1`, and from then on the loser adopts the winner's node and never
leaves - because the adopt loop never exits the `supervise-watcher` invocation that owns its
watchdog job.

## Evidence

[MEASURED] 2026-09-24T23:1xZ by Station 03 at `d8eea113`, from `C:\po-watcher\ensure-watcher.log`
(3,943 lines; POSITIVE control `watcher alive` -> 3769; NEGATIVE control, a freshly minted needle -> 0):

```
2026-09-20T21:14:07Z  RELAUNCHED - wrapper pid 30116 (Win32_Process.Create returned 0)
2026-09-20T21:14:33Z  VERIFIED node pid 9744 ancestry: powershell.exe:17688 <- powershell.exe:30116
2026-09-24T07:35:03Z  RELAUNCHED - wrapper pid 1724 (Win32_Process.Create returned 0)
2026-09-24T07:35:30Z  VERIFIED node pid 42212 ancestry: powershell.exe:44740 <- powershell.exe:1724
```

Wrapper 30116 was a legitimate relaunch on 09-20 and owned node 9744. Node 9744 later died.
**Wrapper 30116 was still alive when the keepalive launched wrapper 1724**, and the keepalive
launched the second one anyway.

[MEASURED] **independently re-confirmed 2026-09-25T00:23Z by Station 00 (scheduled) at `54b7cbbf`**,
resolved by COMMAND LINE and never by image name, on a different day and a different commit from
03's read:

```
node=1 wrapper=2
  NODE pid=42212 ppid=44740 start=2026-09-24T07:35:07.2143860Z
  WRAP pid=30116 ppid=14324 start=2026-09-20T21:14:02.6820950Z   <- no node of its own since 09-20
  WRAP pid=1724  ppid=37808 start=2026-09-24T07:35:03.0901280Z   <- owns node 42212
```

The duplicate has now been observed by two stations, four days apart, across a watcher restart.

## Why no station can fix it

`C:\po-watcher\ensure-watcher.ps1` is **not in any repo this pipeline can PR**. DOCTRINE section 9.5
already records that the launchers in `C:\po-watcher` are outside this repo, and
`needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md` is the standing escalation for exactly
that. The only immediate containment - killing wrapper pid 30116 - is a mutation Station 03 may not
perform, and it does not survive the next restart: that is precisely what happened between 09-20 and
09-24.

## What is NOT claimed

**This is not a wrong-kill risk.** Both watchdogs read the same two clocks and
`WATCHDOG_RESTART_GRACE_V1` judges by the later of heartbeat and node start, so they agree on when a
kill is warranted. Nothing is broken right now: the rescan loop ticks on cadence, the clone is clean,
the board is quiet. This is a **latent duplicate** that survives every restart, live since 09-20.

## RULE 1 options - complete-and-additive first

**(a) Ask about the wrapper, and make ADOPT prove its own claim.** Two small changes.
In `ensure-watcher.ps1` step 2, before relaunching, also look for a live
`watcher-launcher-singlelane.ps1` PowerShell process; if one exists, log `wrapper alive, node absent
- leaving the relaunch to the wrapper` and exit 0. Separately, in
`scripts/pr-watcher/supervise-watcher.ps1` (this one IS in the repo), make the `adopt` branch of
`Resolve-WatcherExitAction` check whether the running node already has a `start-watcher.ps1` ancestor
and **exit** rather than adopt when it does.
*Complete:* no new duplicate can be created, and the adopt branch can no longer make one permanent.
*Additive:* nothing is removed - the wrapper's own 10 s restart loop already covers the case the
keepalive was firing into, and a genuinely orphaned node is still adopted. **Passes both halves.**

**(b) Kill wrapper pid 30116 now and do nothing else.** Fixes it this minute; **fails the "future"
half** outright - the next keepalive/restart race rebuilds it, which is exactly what happened between
09-20 and 09-24.

**(c) Only add the PID to every `WATCHDOG` log line.** Fixes the instrument so a reader can tell the
two apart; leaves two kill authorities over one node. **Fails the "completely" half.**

## What is already in hand - only ONE half needs you

Option (a)'s **second half is a repo PR** and has been staged by Station 00 as
`docs/pr-prompts/pr-watcher-adopt-ancestry-and-watchdog-identity-HOLD.md`, covering Station 03's F2,
F3 and F4 together (the adopt-branch ancestry check, the missing PID on every `WATCHDOG` log line,
and `status-sweep.ps1` reporting `wrapper: alive (2)` in the column that tells a reader the chain is
up).

**Only the `ensure-watcher.ps1` half needs you**, because that file is outside every repo this
pipeline can PR.

WARNING - operational consequence for whoever lands the repo half: after any `scripts/pr-watcher/**`
change merges, the RUNNING watcher still executes the OLD code. An idle-window restart is required
before the new rules take effect. Never restart mid-run.

## Falsifying probe

Resolve the watcher chain by command line and count wrappers:

```powershell
@(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -match '(supervise-watcher|watcher-launcher(-singlelane|-lane2)?)\.ps1' }).Count
```

If that ever returns **1** while a watcher node is running, the duplicate has cleared and this
escalation should be re-measured before being acted on. It returned **2** on 2026-09-24T23:1xZ
(Station 03) and again on 2026-09-25T00:23Z (Station 00).
