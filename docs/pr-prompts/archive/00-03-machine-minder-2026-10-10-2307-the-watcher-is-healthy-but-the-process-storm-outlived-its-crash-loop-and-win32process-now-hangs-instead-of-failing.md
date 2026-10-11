# Station 03 — Machine Minder | 2026-10-10T23:07Z–2026-10-10T23:33Z

## GROUND

```
UTC            2026-10-10T23:07:44Z
origin/main    eff8b4b5            (fetch first, then rev-parse)
dev tree       main @ eff8b4b5     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`), so this run was not forced read-only by a version
mismatch. It is read-only because Station 03 is report-only by authority (STATION-CAPABILITIES §5).

**NOT BLIND.** `start_process` shell `powershell.exe` returned a live prompt on the Windows host
after one keyword `ToolSearch` for `desktop-commander`. Recorded explicitly because six of
2026-10-10's Station 00 runs were blind and a blind run and a healthy quiet run produce the same
"no news".

## WHAT I MEASURED

### Preflight — the git guard

[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`.
**Exit code of the INSTALLER: `2`** (read from `${PIPESTATUS[0]}`, not from the `tail` I piped it
into — DOCTRINE's warning about reading a pipeline's last stage). Last line:

```
   PATH="/sessions/dazzling-peaceful-darwin/.local/bin:$PATH" git <args>
```

Headline line: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your
shell.` Its own controls, quoted: `bash -lc 'command -v git'` →
`/sessions/dazzling-peaceful-darwin/.local/bin/git`; `bash -c 'command -v git'` → `/usr/bin/git`.
This is the EXPECTED station outcome and a finding, not a stop.

**Consequence, and it changed how this run read its own instructions.** The guard being inert
means the device-bridge git ban is remembered, not mechanical. PREFLIGHT step 2 prescribes
`git show origin/main:<path>` in the dev tree; the guard's own last paragraph says *"Do NOT run git
against a mounted folder. Use a shell on the Windows host, or the GitHub API."* I used **the GitHub
API** (`get_file_contents`, `ref: refs/heads/main`) for the three binding documents and **git on
the Windows host** for every ref and diff. Both are sanctioned routes; neither is git-against-the-mount.
The `?plain=1` caveat does not apply — the contents API returns the blob, not a rendered page.

### The three binding documents

[MEASURED] all three read from `refs/heads/main` via the GitHub contents API, each returning the
resource URI `repo://GH-Mantova/ProjectOperations/sha/eff8b4b5342824f1b452fdea863f83350f0b71a2/...`
— i.e. all three were served from the same commit as `origin/main`, which is the freshness
property PREFLIGHT step 2 exists to guarantee:

| file | blob SHA |
|---|---|
| `docs/pipeline/stations/03-machine-minder.md` | `b41799fd60c42dc6f16f8a95b15004f7fe3f1b02` |
| `docs/pipeline/DOCTRINE.md` | `5b71fe520c7deda5133a87c14a0efad627f05638` |
| `docs/pipeline/STATION-CAPABILITIES.md` | `0aec675010254e72bbfb38ebeed6e78a7122e512` |

### Dev tree — the four readings

[MEASURED] `git -C C:\ProjectOperations2`, after
`fetch origin +refs/heads/main:refs/remotes/origin/main`:

```
rev-list --left-right --count HEAD...origin/main   ->  0	0
diff --numstat                                     ->  1 line
diff --cached --name-status                        ->  0 lines
status --porcelain (tracked)                       ->  2 lines
status --porcelain (untracked)                     ->  9 lines
```

Tracked-modified, which is the reading that matters (see F4):

```
 M docs/data-model/metadata-catalog.json
 M docs/pipeline/sweep-rotation.json
```

`git` also emitted `warning: in the working copy of 'docs/data-model/metadata-catalog.json', LF
will be replaced by CRLF the next time Git touches it`.

### Locks and in-progress markers — clean

[MEASURED], both repos:

```
LOCK_ABSENT C:\ProjectOperations2\.git\index.lock
LOCK_ABSENT C:\po-watcher\ProjectOperations\.git\index.lock
```

No `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` /
`sequencer` in either. `GITPROC none` (`Get-Process -Name git`). **No stale lock to report, and
nothing to clear.**

At `C:\po-watcher` top level: `ACTIVATION.lock` (58 bytes, mtimeUtc 2026-08-12T08:19:02) and
`STOP-WATCHER-LANE2` (1090 bytes, mtimeUtc 2026-08-18T04:44:50) — **the latter is present BY
DESIGN** (DOCTRINE §9.5) and is not a stray lock. `STOP-WATCHER` and `STOP-WATCHER-LANE1` absent.

### The watcher — ALIVE and doing real work

[MEASURED] from log CONTENT, never from a mount `stat`:

`C:\po-watcher\ensure-watcher.log`, last two lines:

```
2026-10-10T21:01:52Z  RELAUNCHED - wrapper pid 86924 (Win32_Process.Create returned 0)
2026-10-10T23:20:38Z  watcher alive, pid(s) 97560
```

`…\scripts\pr-watcher\heartbeat.log`, last line `[2026-10-10T23:24:20.845Z] rev-2310-ready.md
elapsed=722s last:` — ticking on a 60 s cadence.

Today's daily log `…\logs\2026-10-11.log` (mtimeUtc 2026-10-10T23:28:35) shows a **completed
review cycle** inside this run's window:

```
[2026-10-10T23:25:14.905Z] [review] verdict mirrored to PR #2310 as a comment
[2026-10-10T23:25:14.958Z] [ok] rev-2310-ready.md  processed/
[2026-10-10T23:29:39.117Z] [review] verdict-archive sweep: archived=0 kept=1 skipped=0 tracked=185
```

`Get-Process -Name node` → pid 97560 present, `startUtc=2026-10-10T22:02:39`. **One watcher, the
single-instance guard holding, processing prompts and writing verdicts.** `ARMED_COUNT 0` at top
level — the queue is empty, so quiet is correct and is not a wedge.

### Process census — the storm, extended

[MEASURED] `Get-Process` only, deliberately not CIM:

| | 23:19:22Z | 23:29:32Z | delta / 10 min |
|---|---|---|---|
| total processes | 2262 | **2288** | +26 |
| `powershell` | 954 | **962** | +8 |
| `conhost` | 956 | **964** | +8 |
| `node` | 11 | 11 | 0 |

Age distribution of the 954, all `StartTime` readable: `min=0 max=73.85 avg=16.11` hours;
**935 older than 1 h**, 2 older than 24 h.

Command lines, grouped (via `Get-WmiObject`, which still answered at 23:19):

```
WMI_PS_COUNT 953
932x :: "…\powershell.exe" -Version 5.1 -s -NoLogo -NoProfile -EncodedCommand
  9x :: powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\po-watcher\watcher-launcher-si…
  6x :: "…\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File C:\po-wat…
  1x :: "powershell.exe" … -File "C:\po-watcher\ensure-watcher.ps…
```

**932 of 953 carry the `-s … -EncodedCommand` MCP-stdio signature** — Desktop Commander shells, one
per `start_process`, never reaped. The watcher launcher accounts for ~15, not for the storm.

### The instrument probes, with controls

[MEASURED] bounded via `Start-Job` / `Wait-Job -Timeout 25`:

```
CIM_WIN32PROCESS   TIMEOUT_AFTER_25s
CIM_OS_POSCTRL     OK   -> "Microsoft Windows 11 Home"      <- POSITIVE control
WMI_WIN32PROCESS   OK   -> 11                               (at 23:17:56Z)
```

Unbounded, the same call ran **>5 minutes with no output and no error** before I terminated it.
Then at **23:24:19Z the `Get-WmiObject Win32_Process` name-filtered query ALSO hung** — the same
call that had returned in under 25 s at 23:17:56Z. `Get-ScheduledTask` (CIM-backed) hung likewise
at 23:31Z and never printed.

Negative control on the log probe: `SINGLE_INSTANCE_COUNT_TODAY 170` against
`NEGATIVE_CONTROL_COUNT 0` for a needle minted this run (`ZZQQ-nonexistent-needle-20261011`).

### Clone drift

[MEASURED] `git -C C:\po-watcher\ProjectOperations`:

```
CLONE_BRANCH main
CLONE_HEAD   65e7c22c
CLONE_BEHIND_DEV_HEAD 57            (rev-list --count HEAD..eff8b4b5)
TOTAL_FILES_IN_DRIFT 190
WATCHER_CODE_FILES_IN_DRIFT  0      (-- scripts/pr-watcher/)
PIPELINE_CODE_FILES_IN_DRIFT 4      (-- scripts/pipeline/)
  scripts/pipeline/__tests__/marco-queue.test.mjs
  scripts/pipeline/marco-queue.mjs
  scripts/pipeline/pipeline-lib.ps1
  scripts/pipeline/status-sweep.ps1
```

### failed/ triage

[MEASURED] `FAILED_TOTAL_FILES 80`; newest entry **2026-10-06T05:47:39**
(`pr-sweep-marco-queue-line-ready.md.report.md`). `FAILED_NEWER_THAN_7D 11`, all dated 2026-10-02
to 2026-10-06. My own prior breadcrumbs run to `00-03-machine-minder-2026-10-09-2303-…`, which
post-dates every entry. **No NEW failure to triage this run.** `no-pr-opened/` total 111, newest
2026-09-22T17:25:40 — also nothing new.

### GitHub reachability from the box

[MEASURED] today's daily log, at 23:24:18Z and 23:28:31Z:

```
[review] poll failed: gh pr list … exited 1: Post "https://api.github.com/graphql":
         net/http: TLS handshake timeout - will retry next tick
[review] poll failed: gh pr list … exited 1: error connecting to api.github.com
```

Self-retrying; a verdict was written successfully at 23:25:14Z between the two.

## WHAT CHANGED

**Nothing on the board, nothing on the machines.** Station 03 is report-only. I started no watcher,
killed no process, cleared no lock, armed nothing, merged nothing, and edited no file outside this
breadcrumb. The only writes this run made anywhere were five throwaway probe scripts under
`C:\po-sup-fix-scripts\` (the sanctioned scratch location) and this file.

## FINDINGS

### F1 — The process storm outlived the crash loop that was blamed for it, and is still growing

The open escalation
`needs-marco/system-thread-exhaustion-2116-processes-and-cim-is-dead-so-the-safe-to-act-gate-cannot-answer-2026-10-10.md`
(raised 2026-10-10T16:45Z at SHA `70991313`) carries a **stale SHA**, so per DOCTRINE §7.1 it
arrived as a lead. I re-verified its central claim against the live system: **it holds, and it is
worse.** The series now reads:

| | 04 @ 14:34Z | 00 @ 16:4xZ | **03 @ 23:29Z** |
|---|---|---|---|
| total processes | 2019 | 2116 | **2288** |
| `powershell` | 834 | 883 | **962** |
| `conhost` | 838 | 887 | **964** |

**But the mechanism in that file no longer fits the measurements, and the difference changes the
remedy.** Its steps 3–4 describe a wrapper exiting 1, a supervisor logging `Restarting in 60 s`,
and each restart spawning more wrappers. That loop is **not running now**: `ensure-watcher.log`
averages **~1 line per hour** across the last ten hours, the watcher is a single healthy instance
(pid 97560), and the single-instance guard is visibly refusing duplicates. Growth has roughly
halved — ~0.73 processes/min between 14:34Z and 16:4xZ, ~0.35/min over the 7 h since — but it has
**not stopped**, and the resident population is **932 Desktop Commander `-EncodedCommand` stdio
shells, not watcher wrappers**.

So the dominant source is now the **agent sessions themselves**: every station run, this one
included, leaves its `start_process` shells behind. I added roughly eight. Killing the watcher
wrappers — the remedy that file proposes — would reclaim ~15 of 962.

**DISPOSITION: ESCALATED** — to the existing `needs-marco/` file, which already claims this
question and must not be duplicated (DOCTRINE §10.5, one identity per artifact). What I am adding
is the fresh datapoint and the mechanism correction above; the destructive remedy remains Marco's
and I did not touch it. **Under RULE 1, for whoever updates that file:** the complete-and-additive
option is to reap the MCP stdio shells on session end (or cap their lifetime) **and** keep the
watcher-wrapper cleanup — that fixes the immediate count and the future accumulation, and destroys
no data. A one-off mass kill of the 1,926 `powershell`/`conhost` processes is the immediate half
only: it fails the *future* test, because the next few station runs begin re-accumulating
immediately. Killing only the watcher wrappers fails *both* halves at this point, since they are no
longer the driver.

### F2 — `Win32_Process` has changed failure mode from fast-fail to indefinite HANG, and that is worse for every station

Earlier runs recorded `Get-CimInstance Win32_Process` failing **loudly and fast**:
`The remote procedure call failed. … HRESULT 0x800706be` (Station 00, breadcrumb
`00-00-supervisor-2026-10-10-1814-…`). **That is not what it does now.** This run it **hung**:
>5 min unbounded, `TIMEOUT_AFTER_25s` bounded, no error, no output. `Win32_OperatingSystem` through
the identical cmdlet returned `Microsoft Windows 11 Home` — so the positive control passes and the
subsystem is not simply dead; it is `Win32_Process` enumeration specifically, which is the one
class that must walk all 2288 processes and materialise their command lines.

And the fallback degraded **inside this run**: `Get-WmiObject Win32_Process` answered in under 25 s
at 23:17:56Z and hung at 23:24:19Z, six minutes later. `Get-ScheduledTask` hung at 23:31Z.

**Why this matters more than the fast-fail did.** A fast failure is survivable — a station sees an
error and reports `[CANNOT MEASURE]`. An indefinite hang silently consumes the run clock, and a
caller that does not bound it never reports anything at all. DOCTRINE §9.5 requires *"never count
or kill by image name — resolve PIDs and verify command lines"*, and command-line resolution is
exactly the operation that now hangs. `status-sweep.ps1` reads the watcher through CIM at line 263
and the safe-to-act gate at line 541; the open escalation already measured it stalling >20 min
there. **So the sweep's `watcher not running` line is a failed call, not a reading** — which is
precisely what the 2026-10-10-2208 supervisor breadcrumb reported, and this run names the
mechanism and the shape.

**A working substitute exists and cost nothing this run:** `Get-Process` for counts, PIDs, paths
and `StartTime` (no WMI, instant, never hung across eight calls), plus log CONTENT for watcher
liveness. That combination answered every machine-health question in this report.

**DISPOSITION: DISPATCHED** — to **Station 00**, as a bounded, additive instrument fix inside its
own lane: wrap every `Get-CimInstance` / `Get-WmiObject` call in `scripts/pipeline/status-sweep.ps1`
and `scripts/restart-watcher-if-wedged.ps1` in a `Start-Job` + `Wait-Job -Timeout`, and on timeout
emit an explicit `[CANNOT MEASURE]` rather than a falsy value that reads as "not running". Under
RULE 1 that is the complete-and-additive option: it fixes the immediate false-DOWN *and* every
future one, it changes no data, and it leaves the `Get-Process` path as the fast answer. The
alternative of simply raising the timeout fails the immediate half — no timeout is long enough on a
box in this state. ⚠️ **`restart-watcher-if-wedged.ps1` with `-Fix` is the dangerous caller**: a
false DOWN on a live watcher during a hang would kill pid 97560, which is currently healthy and
working.

### F3 — 57 commits of clone drift, and for the third consecutive 03 run it carries no watcher code

`CLONE_HEAD 65e7c22c`, **57 behind** dev `eff8b4b5`, 190 files. The series across my own prior
breadcrumbs: **13** (2026-10-08-2251) → **48** (2026-10-09-2303) → **57** (now). Monotonic, and the
21:01:52Z relaunch did not reduce it.

[MEASURED] `WATCHER_CODE_FILES_IN_DRIFT 0` — nothing under `scripts/pr-watcher/`. **So the running
watcher is NOT executing stale watcher code, and no restart is owed on that ground.** This is the
third 03 run in a row to measure exactly that, which is worth saying plainly: the drift is real,
has been growing for three days, and has been benign for watcher behaviour every time it was
checked. The check is still required each run — the moment one `scripts/pr-watcher/**` commit
lands in that gap, a restart becomes mandatory (DOCTRINE §9.5) and the count alone cannot tell you.

The 4 files under `scripts/pipeline/` are the live edge: `pipeline-lib.ps1` and `status-sweep.ps1`
are both stale **in the clone**. Stations dot-source them from `C:\ProjectOperations2`, which is
current, so nothing is broken today — but F2's fix will touch `status-sweep.ps1`, and if it is ever
invoked from the clone the fix will appear not to have landed.

**DISPOSITION: DEFERRED** — real, not urgent, and not mine to act on (Station 03 does not restart
or update the clone). **What would make it urgent:** any commit touching `scripts/pr-watcher/**`
entering the gap, or any actor invoking `status-sweep.ps1` / `pipeline-lib.ps1` from the clone
rather than the dev tree. Station 00 brings the clone forward on its next idle window.

### F4 — Two tracked files left modified in the dev tree will block the next fast-forward

```
 M docs/data-model/metadata-catalog.json
 M docs/pipeline/sweep-rotation.json
```

`HEAD...origin/main` is `0 0` right now, so nothing is pending and nothing is broken **this
minute**. But the station contract is explicit that a tracked file left modified in the dev tree
makes `git merge --ff-only` refuse, **while `diff --numstat` and `diff --cached` both read the
documented PASS value** — and `--cached` did read `0 lines` here. Only `status --porcelain` caught
it. The next merge to land will hit this.

⚠️ **The cure is booby-trapped and I am flagging it rather than attempting it.**
`metadata-catalog.json` carries a live `LF will be replaced by CRLF` warning, and the contract
records that reaching for an EOL conversion on that reading is **measured to CORRUPT a mixed-EOL
blob**. The prescribed restore is a raw-Buffer node write
(`fs.writeFileSync(abs, execFileSync('git', ['show', 'HEAD:' + rel]))`), never
`git checkout -- <path>`, never `git clean`. Also unresolved by me: `sweep-rotation.json` is
rotation **state**, and a prior breadcrumb
(`00-00-supervisor-2026-10-10-1814-…`) is titled *"the rotation state survives only as an
uncommitted dev-tree edit"* — so discarding it may destroy the only copy. Restoring it from `HEAD`
would fail RULE 1's second test.

**DISPOSITION: DISPATCHED** — to **Station 00**, which owns the dev tree and the fast-forward, with
the warning above attached. Not ACTIONED by me: Station 03 is report-only, and this specific cure
can corrupt a blob and can discard live rotation state.

### F5 — The vm-git-guard is INERT, as expected

Exit `2`, quoted in full under WHAT I MEASURED. The shim is byte-correct and not on this shell's
`PATH`, because a station's shell is non-interactive and non-login. **The device-bridge git ban was
remembered, not enforced, for the whole of this run** — and it was kept: every `git` call went to a
PowerShell shell on the Windows host, and the three binding documents came from the GitHub API.

**DISPOSITION: DEFERRED** — this is the documented expected outcome for a station, recorded because
the contract requires it to be visible in the report, not because anything needs doing. It becomes
a finding worth acting on only if the exit code changes to non-zero (shim not written at all).

## WHAT I DID NOT DO

- **I killed nothing.** Not one of the 962 `powershell`, 964 `conhost`, 11 `node` or 15 watcher-wrapper
  processes. The remedy for F1 is destructive and is Marco's; Station 03 is report-only and does not
  repair even when it has diagnosed.
- **I did not restart the watcher, and it did not need restarting** — single instance, heartbeat
  ticking, a review cycle completed mid-run, and zero watcher code in the clone drift.
- **I did not clear `STOP-WATCHER-LANE2`.** Present by design since 2026-08-15.
- **I did not clear any `index.lock`** — there were none. Had there been, clearing is Station 03's
  only on dispatch from Station 00, and none was given.
- **I did not update the clone** (F3) or restore the two dev-tree files (F4). Both are Station 00's
  lane, and F4's cure can corrupt a mixed-EOL blob and can discard the only copy of the rotation
  state.
- **I did not run `status-sweep.ps1`.** PREFLIGHT step 4 asks for it, and I deliberately skipped it:
  the open escalation measured it stalling >20 min inside the `Get-CimInstance` call, and F2 shows
  that call now hangs indefinitely rather than failing. Running it would have consumed the run
  without producing a verdict. **So this run carries NO SAFE / CAUTION / DO-NOT-ACT verdict, and
  nothing here should be read as one** — which is consistent with report-only, since I took no
  action a safe-to-act gate would have governed.
- **I did not run `check-breadcrumb.mjs`** against this file, so I am **not** writing
  `breadcrumb-clean`. It shells `git` and `gh`, and `gh` was intermittently failing to reach
  `api.github.com` from this box during the run.
- **I did not open a PR.** The GitHub MCP token is write-403 and Station 03 may not create PRs
  (STATION-CAPABILITIES §5). **This breadcrumb is therefore UNTRACKED in the dev tree** at
  `docs/pr-prompts/` and needs Station 00 to sweep it up. ⚠️ It is itself now an untracked file at a
  path a future fast-forward must create — the same hazard as F4, one it was not possible to avoid
  from this station.
- **I did not touch `/sot/`, Azure, Entra, SharePoint, or any production data.**
- **I did not triage any `failed/` entry**, because none is new since my 2026-10-09 run.

## FOR MARCO

**One thing, and it is the open S1.** The box is still accumulating processes — **2288 now, up from
2116 when Station 00 escalated it at 16:45Z**. The watcher is fine; the restart loop that was
blamed has stopped. **What is still growing is Desktop Commander's own shells: 932 of the 962
`powershell` processes are MCP stdio shells left behind by station runs, including ~8 from this
one.** So the cleanup described in the open escalation would reclaim about 15 of 962, and the count
would keep climbing afterwards. The complete fix has to reap or cap the MCP shells as well as kill
the wrappers; the mass kill is safe but buys only time. Details and the RULE 1 options are in F1,
and the escalation file itself is unchanged and still yours.

Second, smaller: `Win32_Process` now **hangs** where it used to fail fast (F2). That is why
`status-sweep.ps1` cannot return a verdict, and it means **`restart-watcher-if-wedged.ps1 -Fix`
would currently kill a healthy watcher** on a false DOWN. I have dispatched the bounded-timeout fix
to Station 00; until it lands, nobody should run that script with `-Fix`.

<run-summary>Sighted run: the watcher is healthy and processing, locks and failed/ are clean, but the process storm has grown to 2288 with its crash loop stopped and Desktop Commander's own leaked shells now the driver, while Win32_Process has shifted from fast-fail to indefinite hang — F1 escalated to the open needs-marco file, F2 and F4 dispatched to Station 00, F3 and F5 deferred.</run-summary>
