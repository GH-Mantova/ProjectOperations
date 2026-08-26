# Station 03 - Machine Minder | 2026-08-24T05:34-05:37Z | RUNBOOK STEP 5 EXECUTED AND PASSED

Marco asked for the destructive test the earlier run left outstanding: kill the watcher thoroughly
and prove the restarter brings it back. **It passed, and it fired on its own schedule.**
Third breadcrumb of this run; see the 0518Z (diagnosis) and 0531Z (repairs) files.

## The kill - by asserted PID, never by image name

Full inventory first, 05:34:01Z: **19 `node.exe`**, of which **exactly ONE** matched
`pr-watcher[\\/]index\.mjs` (pid 21908). The other 18 were MCP servers - 6 desktop-commander
(including this session's own bridge), 6 server-pdf, 6 prisma - all identified by command line and
put on an explicit DENY list (`desktop-commander|modelcontextprotocol|prisma|npx-cli|mm-r7k2q9`).
`claude.exe` count 15, untouched throughout.

Kill script asserted each target's command line against an ALLOW list
(`watcher-launcher-singlelane\.ps1`, `start-watcher\.ps1`, `supervise-watcher\.ps1`,
`index\.mjs`) **immediately before every `Stop-Process`** - the guard against PID reuse. Order was
the runbook's: **wrapper first**, else it relaunches the child instantly.

| Step | 05:34:40Z | Target |
|---|---|---|
| 1 | wrapper | pid **21244** `watcher-launcher-singlelane.ps1` |
| 2 | chain child | pid **15000** `start-watcher.ps1` |
| 3 | node | pid **21908** `index.mjs` |
| 4 | orphan runspace | 0 candidates - pid 22056 (`-Version 5.1 -s`) had already died with its parent |

**Post-kill 05:34:59Z:** watcher node **0**, watcher-chain powershell **0**,
`node.exe` total **19 -> 18** (exactly the one), `claude.exe` **15 -> 15**. Nothing collateral.

## The restart - UNFORCED, on the 10-minute schedule

I did **not** call `Start-ScheduledTask`. The Keepalive's own next run was due 15:35:00 local and it
fired there, **1 second after the kill finished**:

```
2026-08-24T05:35:01Z  RELAUNCHED - wrapper pid 10364 (Win32_Process.Create returned 0)
2026-08-24T05:35:22Z  VERIFIED node pid 29024 ancestry: powershell.exe:3552 <- powershell.exe:10364
                      <- WmiPrvSE.exe:26276  detached=True
```

**`detached=True`** - the exact signature the runbook demanded, and the thing the 2026-08-21
`Start-Process` relaunch could never produce. Node was up at **05:35:04.947Z**, i.e. **~4 s** after
the task fired and **~6 s** after the kill.

**Independently re-walked live at 05:37:10Z** (not trusting the script's own log):
`node 29024 <- powershell 3552 <- powershell 10364 <- WmiPrvSE.exe 26276` -> **DETACHED=True**.
Exactly **one** watcher; no double-start. Task info: `LastRunTime 15:35:00 · LastTaskResult 0 ·
NextRunTime 15:45:00`.

## Both halves of the restarter are now proven

- **Detector** (05:27:47Z and 05:28:52Z): `watcher alive, pid(s) 21908` while the watcher was up -
  started nothing. No false relaunch.
- **Relaunch** (05:35:01-05:35:22Z): `RELAUNCHED` + `VERIFIED ... detached=True` from a genuinely
  dead watcher, unforced, within one scheduling interval.
- **Crash-loop guard NOT exercised** - only 1 RELAUNCHED line in the window, well under the
  4-in-60-min stand-down. That branch remains untested by design.

**Worst-case detection gap is the 10-minute interval.** This kill happened to land 1 s before a
scheduled fire; a kill just after one would sit dead for ~10 min. That is the designed trade-off.

## State after the test, measured 05:37:10-05:37:12Z

Watcher **1** (pid 29024, detached) · node total 13 · claude.exe 14 · git procs **0** ·
Keepalive `Ready / result 0 / next 15:45` · clone `74066ae9` **0/0** · `index.mjs` merge-wait
matches **6** (the #1304 fix survived the restart - it is read from the clone each boot) ·
clone stash **39** (+1: the preflight autostash on this relaunch - the closed loop, exactly as
expected; baseline for next run is 39, of which 4 are autostashes) · all index/HEAD/maintenance
locks **absent** in both trees · armed prompts **0**.

## 🔴 UNCHANGED - the cold-start heartbeat trap

`heartbeat.log` mtime is **still `2026-08-24T03:03:26Z`, age 153.8 min**. A relaunch does not
refresh it; #1304 does not write one at boot. `supervise-watcher.ps1` L584-585 still kills on
file-mtime age > `$wdHungMin` (15) with no cold-start baseline.

**So the restarter now guarantees the watcher comes BACK - it does not stop it being killed in the
first place.** Arming a prompt right now still trips the watchdog inside ~30 s; the difference is
that the box will now relaunch within 10 min instead of staying dead. Fix options are in the 0531Z
breadcrumb (raise `PR_WATCHER_HUNG_MIN`, or baseline the watchdog to the node's `CreationDate` /
write a heartbeat at startup - the latter needs a PR).
