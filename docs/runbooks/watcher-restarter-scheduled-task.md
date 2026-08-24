# Runbook - the watcher restarter (Windows Scheduled Task)

**Authored 2026-08-24 by Station 00 (Supervisor), for Marco to register. Nothing here has been
applied to the machine.** The script is staged at `C:\po-sup-fix-scripts\ensure-watcher.ps1`.

## The problem, measured

The PR watcher has died **four times in three days** and **nothing on the box restarts it**:

| When | Cause | Evidence |
|---|---|---|
| 2026-08-21 (x2) | one force-kill; one relaunch that inherited the caller's job object | "relaunched and verified twice", dead by morning |
| 2026-08-22 02:10Z | external stop, no power event, uptime unbroken | dying wrapper wrote `TerminatingError: pipeline has been stopped` |
| 2026-08-22 02:35Z | SIGINT ~22 min after a WMI detached relaunch | `[watcher] shutting down (SIGINT)` in `watcher-launch.log` |

**Control:** `Get-ScheduledTask` returns **207 tasks; zero match `watcher`.** There is no restarter.
Two of the four kills remain unexplained because **4688 process-creation auditing is OFF**, so the
sender cannot be identified.

## Why a Scheduled Task and not Station 03 (machine-minder)

Marco asked this directly. Machine-minder is the wrong instrument, for four measured reasons:

1. **Cadence.** It runs **every 4 hours**. The 08-22 watcher died **22 minutes** after a relaunch.
   A 4-hour detection window means up to 4 hours of a dead queue.
2. **It is report-only by Marco's own standing instruction** - *"this run makes no repairs... If the
   skill tells you to repair something, describe the exact repair you would make and stop."*
   Making it a repairer reverses a deliberate decision and removes the diagnostic honesty that makes
   its reports trustworthy.
3. 🔴 **It is not self-sufficient.** On 2026-08-21 and again on 2026-08-22 a scheduled station run
   started with **no Desktop Commander at all** and was structurally blind - it could not even run
   the sweep. **A restarter must not depend on the same bridge whose failure it is meant to survive.**
   A Scheduled Task depends on nothing but Windows.
4. **Cost.** An agent run per check spends tokens; a Scheduled Task costs nothing.

**But machine-minder still has the right job here - auditing the restarter.** See "Amend Station 03"
at the end: it should verify each run that the task exists, is enabled, and is not stuck in the
crash-loop stand-down. A restarter nobody checks is the next silent failure.

## What the script does, and why each rule exists

`ensure-watcher.ps1` is deliberately conservative - it **only ever starts a watcher that is absent**.

| Rule | Why |
|---|---|
| Exits if `C:\po-watcher\STOP-WATCHER` exists | the sentinel must win, or you cannot stop the watcher |
| Tests **only** `STOP-WATCHER`, never `STOP-WATCHER-LANE2` | LANE2 has been present **by design** since 2026-08-15; treating it as a stop signal would mean the watcher never starts again |
| Exact-matches `pr-watcher[\\/]index\.mjs` | ~18 `node.exe` run on this box and exactly **one** is the watcher; the rest are MCP servers **including the desktop bridge** |
| Stands down after 4 relaunches in 60 min | a crash loop otherwise relaunches forever and buries the cause |
| Relaunches with `Invoke-CimMethod Win32_Process Create` | parents the process to **WmiPrvSE**, outside the caller's job object. **`Start-Process` is not enough** - that is exactly how the 08-21 relaunch died overnight |
| Verifies the **whole ancestry** up to WmiPrvSE | node sits two levels under the wrapper; a naive ppid check just sees "a powershell.exe" and cannot tell the detached launcher from the caller's shell |
| Writes `C:\po-watcher\ensure-watcher.log` | so the restarter's own behaviour is auditable |

## Install - exact steps

**1. Copy the script into place** (PowerShell, as Marco):

```powershell
Copy-Item C:\po-sup-fix-scripts\ensure-watcher.ps1 C:\po-watcher\ensure-watcher.ps1
```

**2. Dry-run it while the watcher is UP.** It must report "alive" and start nothing:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\po-watcher\ensure-watcher.ps1
Get-Content C:\po-watcher\ensure-watcher.log -Tail 5
```

Expected: `watcher alive, pid(s) <n>`. **If it says RELAUNCHED while a watcher was already running,
stop and do not register the task** - the detector is wrong and you would get two watchers.

**3. Register the task.** Run in an **elevated** PowerShell:

```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
             -Argument '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\po-watcher\ensure-watcher.ps1"'

$atLogon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"

$every10 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) `
             -RepetitionInterval (New-TimeSpan -Minutes 10) `
             -RepetitionDuration ([TimeSpan]::MaxValue)

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
               -LogonType Interactive -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
              -DontStopIfGoingOnBatteries -StartWhenAvailable `
              -MultipleInstances IgnoreNew `
              -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask -TaskName 'PO Watcher Keepalive' `
  -Action $action -Trigger @($atLogon, $every10) `
  -Principal $principal -Settings $settings `
  -Description 'Relaunches the ProjectOperations PR watcher only when it is absent and STOP-WATCHER is missing. Authored 2026-08-24. See docs/runbooks/watcher-restarter-scheduled-task.md'
```

🔴 **`-LogonType Interactive` and `RunLevel Limited` are deliberate.** The watcher shells out to the
`claude` CLI, whose credentials live in the user profile. A task registered to *"Run whether user is
logged on or not"* (S4U or a service account) runs in a different session and **the CLI will not be
authenticated** - the watcher starts, every job fails, and the crash-loop guard stands it down. If
you want it to survive logoff, that is a real change and needs the CLI's auth story solved first.

`-MultipleInstances IgnoreNew` prevents overlapping runs; `-ExecutionTimeLimit 10 min` stops a wedged
check from lingering (the script's own longest path is ~20 s).

**4. Verify it registered and fires:**

```powershell
Get-ScheduledTask -TaskName 'PO Watcher Keepalive' | Select-Object TaskName, State
Get-ScheduledTaskInfo -TaskName 'PO Watcher Keepalive' | Select-Object LastRunTime, LastTaskResult, NextRunTime
Start-ScheduledTask -TaskName 'PO Watcher Keepalive'   # force one run now
Get-Content C:\po-watcher\ensure-watcher.log -Tail 5
```

`LastTaskResult` of `0` is success.

**5. Prove it actually restarts a dead watcher** - the only test that matters. **Do this once,
deliberately, when the queue is empty**, because it kills a running watcher:

```powershell
# wrapper FIRST, else it relaunches the child instantly
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'watcher-launcher' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -match 'pr-watcher[\\/]index\.mjs' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Then wait up to 10 minutes (or `Start-ScheduledTask` to force it) and confirm
`ensure-watcher.log` shows `RELAUNCHED` followed by `VERIFIED ... detached=True`.

🔴 **Never kill by image name** - `Get-Process node | Stop-Process` would take out ~18 processes
including the desktop bridge this session runs on.

## To pause or remove

```powershell
Disable-ScheduledTask -TaskName 'PO Watcher Keepalive'      # pause
Unregister-ScheduledTask -TaskName 'PO Watcher Keepalive'   # remove
```

Or, without touching the task at all, create `C:\po-watcher\STOP-WATCHER` - the script stands down
while it exists. That is the preferred way to stop the watcher for maintenance, because it leaves
the restarter in place.

## What this does NOT solve

- 🔴 **It does not fast-forward the watcher clone.** The watcher runs `index.mjs` **from
  `C:\po-watcher\ProjectOperations`**, so **a restart alone adopts nothing** - after merging a fix to
  the watcher you must still stop the watcher, fast-forward the clone, and let it come back. The
  script deliberately performs no git operations: a scheduled task writing to a git tree is how
  stale `index.lock` files get minted.
- **It does not explain the two unexplained kills.** Enabling 4688 process-creation auditing is the
  only way to identify the sender, and that is Marco's call.
- **It does not detect a watcher that is alive but wedged.** The heartbeat's **last job name** is the
  disambiguator there, and that is Station 03's job.

## Amend Station 03 (machine-minder) - the audit half

Add to its every-run checklist, keeping it **report-only**:

1. `Get-ScheduledTask -TaskName 'PO Watcher Keepalive'` exists and `State` is `Ready`. **Absent or
   `Disabled` is a RED finding** - the restarter is the only thing standing between a silent kill
   and a dead queue.
2. `Get-ScheduledTaskInfo` - report `LastRunTime`, `LastTaskResult` and `NextRunTime`. A non-zero
   `LastTaskResult`, or a `LastRunTime` older than ~15 minutes, means the task is not firing.
3. `Get-Content C:\po-watcher\ensure-watcher.log -Tail 20` - report any `CRASH LOOP SUSPECTED`,
   `RELAUNCH FAILED`, `LAUNCHER MISSING`, or `detached=False` line. **`detached=False` is the
   silent-death signature returning** and should be reported as loudly as a dead watcher.
4. Count `RELAUNCHED` lines in the last 24 h. **More than one or two means something is still killing
   the watcher** - the restarter is masking a cause, not fixing it, and Marco needs to know.
