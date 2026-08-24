# 00-supervisor · 2026-08-22 02:13Z · watcher relaunched DETACHED via WMI

**What changed on this machine:** the PR watcher chain was relaunched. No queue file, no prompt, no
git ref and no PR was touched. `sot/` untouched.

## Why

`bring-up-to-speed.ps1` reported `[LIVE] watcher node: RUNNING pid 42112` at **02:08:51Z**.
At **02:11:32Z** — 161 seconds later — the entire chain was gone:

```
watcher_node=0  wrapper=0  supervise-watcher=0
C:\po-watcher\.watcher.lock  ABSENT
```

`watcher-launch.log` mtime **02:10:53Z**, tail = `PS>TerminatingError(): "The pipeline has been
stopped."` ×3 then `$global:?  True` — `Start-Transcript` artifacts, i.e. the wrapper's pipeline was
stopped **externally**.

**Ruled out:** `C:\po-watcher\STOP-WATCHER` ABSENT and its exit line
(`[launcher-single] STOP-WATCHER sentinel present - not restarting.`) absent · no crash-loop lines ·
`LastBootUpTime = 2026-08-18 01:59:54` so no reboot · lock was **removed**, not left stale with a
dead pid (the opposite of the 08-21 death).

`[INFERRED]` the 08-21 22:20Z relaunch was parented inside the launching station/Desktop-Commander
process tree and was **reaped with it** by a **job object**.

## The relaunch

```powershell
$cmd = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File C:\po-watcher\watcher-launcher-singlelane.ps1'
Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
```

A WMI-created process is parented to **WmiPrvSE**, escaping the caller's job object.
`Start-Process` does not. **[MEASURED]** `ReturnValue=0` · wrapper **pid 31132 ppid 8432 (WmiPrvSE)** ·
node **pid 32252** · clean startup through preflight, verdict-archive (archived=34), reviewed-set
seeded (829 PRs), to the terminal banner `[review] poll-every: 90 s, min-age: 2 min` at **02:13:13Z**.

⚠️ **Cannot prove it survives this session's end** — structurally unverifiable from inside the
session. The `ppid` is the evidence.

## Still open — NEEDS MARCO

`Get-ScheduledTask` references **no** watcher launcher. Every start is manual or station-driven.
**Two silent deaths in 28 h** (hibernate 08-21, job-object reap 08-22) with **no supervisor of last
resort**. Recommendation: a Windows Scheduled Task at logon + every N minutes that launches only when
the chain is absent AND `STOP-WATCHER` is missing — additive (honours the sentinel, touches no data)
and complete (covers hibernate, reap and crash).

## Left alone deliberately

`armed=0 / HOLD=72` (Marco's arming hold, re-verified in force) · 0 open PRs · 3 orphaned worktrees ·
136 clone stashes · `settings-restructure-sot-nav-reconcile` (Station 05's lane).

⚠️ **This file is UNTRACKED on `origin/main`, like all 00-* breadcrumbs. Writing it is not reporting.**
