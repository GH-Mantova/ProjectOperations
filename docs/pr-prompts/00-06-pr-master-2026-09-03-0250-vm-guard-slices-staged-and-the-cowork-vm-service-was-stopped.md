# Station 06 — PR Master | 2026-09-03T02:25Z–02:52Z

Run by the **cloud/chat lane** following the Station 06 pathway at Marco's explicit instruction,
not by Station 06 on a schedule. `[NO LANE VERDICT — hand-classified]` per DOCTRINE §10.1.

## GROUND

```
UTC            2026-09-03T02:25:55Z
origin/main    f5c01415
dev tree       main @ 52f985e8   C:\ProjectOperations2   (1 behind origin/main)
doc version    1
bootstrap      n/a — invoked from chat, no scheduled-task bootstrap file
```

## WHAT I MEASURED

**[MEASURED] The guard the escalation asks for already exists on `origin/main`.**
`git ls-tree -r --name-only origin/main` → `scripts/pipeline/vm-git-guard.sh`, landed in PR **#1512**
(`d3b603e4`). Positive control run first: the same query found `scripts/pipeline/lint-prompt.mjs`, so
the FOUND is trustworthy. The escalation
`needs-marco/device-bridge-index-lock-guard-2026-09-01.md` (08:35Z, 1 Sep) asks for it as option (A)
and the shim merged the same day.

**[MEASURED] What shipped is broader than option (A) asked for.** The shim refuses on
`case "$a" in "$HOME"/mnt/*|*/mnt/ProjectOperations2*|mnt/*|/sessions/*/mnt/*)` — by *mounted path*,
not by two hard-coded trees. `get_device_info` lists `C:\po-watcher` among `connectedFolders`, so the
watcher clone is already covered, as is every future mount.

**[MEASURED] 🔴 The guard is installed on this VM and completely inert.**

```
$ ls -la "$HOME/.local/bin/git"
-rwxr-xr-x 1 ... 1062 Sep  2 04:15 /sessions/rcw-.../.local/bin/git
$ command -v git
/usr/bin/git
$ case ":$PATH:" in *":$HOME/.local/bin:"*) echo YES;; *) echo NO;; esac
NO
```

Someone ran the installer on 2 September at 04:15. `~/.local/bin` is not on `PATH`, so `git` has
resolved to the real binary ever since. **The guard has been installed and doing nothing for a day.**
The installer only *prints a note* when `PATH` is wrong — it does not fix it.

Both controls pass once `PATH` is corrected by hand:

```
$ PATH="$HOME/.local/bin:$PATH" git -C "$HOME/mnt/ProjectOperations2" --version
REFUSED: git against a mounted folder from the device-bridge VM.   exit=99
$ PATH="$HOME/.local/bin:$PATH" git --version
git version 2.34.1                                                 exit=0
```

So the shim is correct. Only its reach is broken.

**[MEASURED] `clear-stale-index-lock.ps1` still hard-codes one tree.**
`git show origin/main:scripts/clear-stale-index-lock.ps1` → `$lock = "C:\ProjectOperations2\.git\index.lock"`,
no `param()` block. The `-Repo` half of option (A) is genuinely not done.

**[MEASURED] The canonical block moved four hours ago.** `_canonical-blocks.json` on `origin/main`
records `station-contract` at **version 2 / `73ad6cc7ef1a2dd5`** (PR #1519). Any PREFLIGHT edit is
therefore **v2 → v3** across all seven docs plus a `--write-canonical` re-record.

**[MEASURED] The Cowork VM was down, and the cause was not the VM.**
`C:\Users\Marco\AppData\Local\Claude\Logs\cowork_vm_node.log`, 12:43:42 local:

```
[error] [VM:start] Startup failed: Error: VM service not running. The service failed to start.
[warn]  [VM:start] Skipping auto-reinstall (Windows VM service is not running;
                   a computer restart restores it), leaving VM offline
```

`Get-CimInstance Win32_Service` → **`CoworkVMService`**, StartMode `Auto`, State `Stopped`,
**ExitCode 0**, path `...\Claude_1.44121.2.0_x64__pzs8sxrjxfjjc\app\resources\cowork-svc.exe`.
Named pipe `\\.\pipe\cowork-vm-service` absent. **No** service-control errors (7000/7001/7009/7011/
7023/7024/7031/7034) in the System log for two days, so it did not crash — it stopped cleanly and was
never restarted. The running `claude.exe` came from package `1.44121.2.0`; the process list earlier in
this session showed `1.40609.1.0`. **The app self-updated mid-session and its packaged service did not
come back.** Uptime 77.8 h, disk 204 GB free, WSL healthy — none of those were the cause.

## WHAT CHANGED

- **Started `CoworkVMService`** with a plain, **non-elevated** `Start-Service`. It came up. The VM
  then booted itself: `[VM:steps] vm_boot completed (139ms)` … `[VM:start] Startup complete, total
  time: 5766ms` … `[VM] API reachability: REACHABLE`. `device_bash` works again.
  **No reboot was required**, despite the app's own message recommending one.
- **Placed two prompt drafts** in the dev tree queue root as `-HOLD` (they arm nothing — the watcher
  globs `-ready.md`, and `armed at queue root` read 0 after placement):
  - `pr-vmguard-s1-persist-and-repo-param-HOLD.md` — lint **ADMIT (size 2)**
  - `pr-vmguard-s2-preflight-installs-guard-HOLD.md` — lint **REJECT [GATE_NOT_RELEASED]**, which is
    correct: it is `cluster_order: 2` gated on
    `requires_on_main: scripts/pipeline/vm-git-guard.sh :: ensure_on_path`. Verified the needle is
    absent from `origin/main`, so it is a live gate and not a `CLUSTER_DEAD_GATE`.
- Nothing else. No arming, no `git mv`, no merge, no `sot/` edit, no code written.

## FINDINGS

**F1 — The index-lock guard is opt-in twice over, and is currently inert on this machine.**
Someone must run the installer, and then someone must fix `PATH` by hand. Measured above: installed
2 Sep, still not on `PATH` on 3 Sep, `git` resolving to `/usr/bin/git` the whole time. Three
documentation bullets did not prevent occurrence seven; an installer nobody is required to run, that
does not finish its own job, will not prevent occurrence eight.
**DISPOSITION: DISPATCHED** — to Station 00, as `pr-vmguard-s1` (make the installer persist itself)
and `pr-vmguard-s2` (PREFLIGHT runs it). Both are in the queue root as `-HOLD`. Marco has approved
the design ((a)+(b), 2026-09-03) and asked that **Station 00 stage them on its next run**.

**F2 — Option (A) as written in the escalation is half-obsolete.**
The shim half shipped in #1512 on the same day the escalation was filed, and shipped broader than
requested. Only the `-Repo` parameter remains, and it is folded into S1.
**DISPOSITION: ACTIONED** — the escalation
`needs-marco/device-bridge-index-lock-guard-2026-09-01.md` should be retired into a dated
`resolved-` folder by Station 00 once S1 and S2 merge, with a note that its (A) was partly already
built. It must **not** be discharged before then: its `-Repo` half is still live.

**F3 — A packaged-app update can silently leave `CoworkVMService` stopped.**
The app's own remediation text says "Restart your computer to restore it." That is more disruptive
than necessary and, on this machine, would have taken down the watcher, Docker and every station. A
non-elevated `Start-Service CoworkVMService` restored it in seconds.
**DISPOSITION: DEFERRED** — worth a `sot/05` incident entry so the next reader tries the service
before the reboot, but it is not a repo defect and nothing in this repo can fix it. It becomes urgent
if it recurs, because the VM going down is indistinguishable from the Station 00 blindness
(escalation #17) from inside a station run.

**F4 — The dev tree is one commit behind `origin/main`.**
`main @ 52f985e8` against `origin/main f5c01415` (#1519). Station 00 normally fast-forwards it.
**DISPOSITION: DISPATCHED** — Station 00, next run.

## WHAT I DID NOT DO

- **Did not arm anything.** The `git mv` to `-ready` is Station 00's alone, and Marco asked for that
  explicitly.
- **Did not hand-patch `PATH` in the VM.** It would have masked the very defect S1 exists to fix,
  and the fix belongs in the script where it is reviewable.
- **Did not touch `scripts/pipeline/vm-git-guard.sh` or `clear-stale-index-lock.ps1`.** S1 owns them.
- **Did not edit any station doc or `_canonical-blocks.json`.** S2 owns those, and it is gated.
- **Did not retire the source escalation** — its `-Repo` half is still live until S1 merges.
- **Did not touch `sot/`.** F3's incident entry is a recommendation to Station 05, not an edit.
