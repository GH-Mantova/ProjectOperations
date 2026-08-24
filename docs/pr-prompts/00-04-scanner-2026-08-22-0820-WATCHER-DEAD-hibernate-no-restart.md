# 00 · STATION 04 SCANNER · 2026-08-22 08:20 (+10:00) / 2026-08-21 22:20Z

**SHA all findings are true at: `c17373121b7330dc48c3cbf114faa3ffa019576d`**
(dev tree = watcher clone = `origin/main` = GitHub main, all four equal.)

Read-only run. Nothing armed, disarmed, renamed, moved, merged, pushed or labelled.

---

## 🔴 1. THE WATCHER IS DEAD, AND NOTHING WILL RESTART IT — for Station 03, dispatched by 00

`[MEASURED @ c1737312, 2026-08-21T22:11:59Z–22:15:17Z]`

**Command:** `Get-CimInstance Win32_Process | ? { $_.CommandLine -match 'pr-watcher[\\/]index\.mjs' }` → **0 hits.**
Broadened to `-match 'watcher'` → 4 hits, all `claude.exe`/`msedgewebview2.exe` (this session + the desktop app).
Broadened to `-match 'ProjectOperations'` → 2 hits, both `claude.exe` (this session).

**Positive control:** the same one-pass scan over the same 435 processes matched `'node'` **25 times**.
The matcher works. There is no watcher process, no wrapper, and no child.

**Corroborating state** (`C:\po-watcher\ProjectOperations\scripts\pr-watcher\`):

| artefact | value |
|---|---|
| `.watcher.lock` | contains `13372` — the PID memory recorded as the live watcher on 2026-08-21T03:48Z |
| PID 13372 | **DEAD** (`Get-Process -Id 13372` → nothing) |
| positive control | the same probe on my own PID 21520 returns `ALIVE powershell` |
| `.watcher-children.json` | `{"pids": []}` |
| `.queue-state.json` | last write **2026-08-21T21:53:28.473Z**, `armed:0 owned:0 runnable:0 deferred:[]` |
| `watcher-launch.log` | last line **2026-08-21T21:53:33.498Z**, then nothing |

### It was not a clean stop, and it was not a crash-with-handlers

`index.mjs:2577` `shutdown()` logs `shutting down (<signal>)` then calls `releaseLock()`.
`index.mjs:2597` `process.on("exit")` **also** calls `releaseLock()` whenever `shuttingDown` is false.
`releaseLock()` (`index.mjs:1718`) `unlinkSync`s the lock.

**The lock file still exists.** Therefore *neither* path ran. Node fires `exit` on
`process.exit()`, on a normal drain, and after an uncaught exception — so this was an
**abrupt, handler-skipping termination**, not a graceful stop and not a JS-level crash.
The single alternative I cannot exclude: `unlinkSync` threw and was swallowed by the
best-effort `catch`. `[INFERRED]`

### Root cause: the machine hibernated for 5h13m and the watcher did not come back

`[MEASURED — Windows System event log]`

```
Kernel-Power id=42   2026-08-21T16:40:29Z  "The system is entering sleep.
                                            Sleep Reason: Hibernate from Sleep -
                                            Standby Battery Budget Exceeded"
Kernel-Power id=507  2026-08-21T21:53:27Z  "The system is exiting Modern Standby.
                                            Reason: Lid."
Power-Troubleshooter id=1  2026-08-21T21:53:29Z
      Sleep Time: 2026-08-21T16:40:22Z   Wake Time: 2026-08-21T21:53:27Z
```

**Positive control:** 431 System events were returned for the same 24 h window, so the query is not blind.
**Discriminator run and PASSED:** `Win32_OperatingSystem.LastBootUpTime` = **2026-08-17T15:59:54Z,
uptime 102.3 h.** There was **no reboot** — so "the box restarted" is *refuted*, and the
hibernate/resume is the only power transition in the window.

Timeline, all within 7 seconds:

```
21:53:27.146Z  wake (lid)
21:53:28.473Z  watcher writes .queue-state.json   ← last thing it ever did
21:53:29.825Z  "returned from a low power state"
21:53:33.161Z  [update] gh poll failed: error connecting to api.github.com
21:53:33.498Z  [review] gh poll failed: error connecting to api.github.com
   …silence…
22:11:59Z      first measurement: process absent, lock orphaned
```

Death window: **≤ 18.5 minutes**, starting at resume.

### Nothing is going to bring it back

`[MEASURED]` `Get-ScheduledTask` → **no task references `watcher-launcher-singlelane.ps1`,
`supervise-watcher.ps1`, `pr-watcher` or `index.mjs`.** The only ProjectOperations task on the
box is `GH Branch Prune`. The launcher history in `watcher-launch.log` (`Host Application:
… -File C:\po-watcher\watcher-launcher-singlelane.ps1`, launches on 08-20 ×3 and 08-21 ×1)
shows every start is **manual or station-driven**. There is no supervisor of last resort.

**Consequence:** the pipeline currently has **no executor**. With the standing arming hold in
force and `armed = 0`, nothing is blocked *right now* — but the next prompt anyone arms will
sit there forever, silently, and the board will look healthy while doing nothing.

**This is Station 03 work. Station 04 repairs nothing.** Handing it over.

---

## 🟠 2. The heartbeat watchdog and the standing arming hold are mutually incompatible

`[MEASURED]` `heartbeat.log` last line **2026-08-20T18:23:02Z** — ~28 h stale at time of writing.
Every line in that file has the shape `<prompt>-ready.md elapsed=<n>s`, i.e. **the heartbeat is only
written while a prompt is executing.** With `armed = 0` since the hold, an idle-but-healthy watcher
writes **no heartbeat at all**.

`watcher-launch.log` proves the watchdog acts on heartbeat *age*:

```
[2026-08-20T05:44:46+10:00] Watcher exited via watchdog kill (exit 1).
                            Heartbeat was stale; relaunching.
                            Flag: pid=25296 armed=12 runnable=13 ageMin=500
[2026-08-20T05:45:11+10:00] …same, pid=16548, ageMin=513
```

So while the hold holds, **any running watcher is a guaranteed watchdog-kill target** — the hold
manufactures the very "wedged" signal the watchdog fires on.

**This did NOT cause today's death** — a watchdog kill writes that log line and then *relaunches*,
and neither happened. Stated so the two are not conflated. But the hazard is live and fires the
moment the launcher wrapper is running again.

**The fix is the one already written down:** a liveness proxy needs a disambiguator. Heartbeat
*age* cannot separate idle from wedged; the heartbeat's **last job name** (or an idle tick) can.

---

## 🟠 3. `index.mjs` has no `uncaughtException` / `unhandledRejection` handler

`[MEASURED]` A single regex pass over `index.mjs` for
`LOCK_FILE|isPastStopTime|process\.exit|STOP_AT|shutdown|SIGINT|SIGTERM|uncaughtException|unhandledRejection`
returned 35 matches. `SIGINT`, `SIGTERM`, `process.exit` and `shutdown` all hit;
**`uncaughtException` and `unhandledRejection` hit zero times.**
(That the same pass found the others *is* the positive control.)

Not the cause here — those paths still fire `exit` and would have released the lock, which is
precisely how I ruled the crash hypothesis out. But it is a standing
**never-exit-silently** gap: an unhandled rejection would take the daemon down with a bare
stack trace and no `[watcher]` line.

---

## ✅ 4. REFUTED — three alarms that are not defects

1. **"`gh` is broken / GitHub is down."** `watcher-launch.log` carries 7 `poll failed:
   error connecting to api.github.com` lines (07:15Z, 16:40Z, 21:53Z ×2 …). They are
   **hibernate/resume artefacts** — 16:40:27Z is two seconds before the sleep event, 21:53:33Z
   is six seconds after the wake. Live check at 22:11Z: `gh auth status` → logged in as
   GH-Mantova, scopes `gist, read:org, repo, workflow`; `gh api rate_limit` → **4999**;
   `gh pr list --state open` → `[]`; `git ls-remote` → `c1737312`. **`gh` is healthy.**

2. **"The orphaned `.watcher.lock` will block the relaunch."** It will not. `acquireLock()`
   (`index.mjs:1687-1715`) reads the PID, probes it with `process.kill(pid, 0)`, and on `ESRCH`
   logs `stale lockfile (PID <n> not found) — overwriting` and continues. Verified **in code**,
   not from the README — and corroborated by four historical `stale lockfile … overwriting`
   lines in `watcher-launch.log`. A relaunch is safe with the lock left in place.

3. **"`sot/04` is ~35 entities behind."** That number came from my own crude proxy
   (`^###` header count 323 vs 292 models + 66 enums = 358) and is **wrong** — see §5.

---

## 🟡 5. `sot/04` drift — re-measured with a real instrument, for Station 05

**Counting rule (published beside the count):** schema entity = a line matching `^model (\w+)`
or `^enum (\w+)` in `apps/api/prisma/schema.prisma`; "present in sot/04" = whole-word regex
`\b<Name>\b` anywhere in `sot/04-data-model.md`.

- schema: **292 models, 66 enums**
- **models absent from `sot/04`: 8** — `AllocationWeightConfig`, `AllocatorDelegate`,
  `ClientShare`, `ContactShare`, `EstimatorCapacity`, `TenderAllocationCandidate`,
  `TenderAllocationRejection`, `WorkerShare`
- **enums absent: 0**

**Positive control:** `User`, `Project`, `Tender` — in schema, and found in sot/04.
**Negative control:** `ZzzNotAModel` → not found.

The eight names cluster into exactly two themes — **record sharing** (`ClientShare`,
`ContactShare`, `WorkerShare`) and **tender allocation** (`AllocationWeightConfig`,
`AllocatorDelegate`, `EstimatorCapacity`, `TenderAllocationCandidate`,
`TenderAllocationRejection`) — so this is two missing sections, not eight scattered omissions.

`sot/03` still stops at **`#495`** (max `#NNN` reference across 850 references). Unchanged.

---

## 🟡 6. The breadcrumb channel is still broken — and it is worse than reported

`[MEASURED]` **14** `docs/pr-prompts/00-*.md` on disk (13 yesterday; **this file makes 15**).

- on `origin/main`: **0**
- tracked in the index: **0**
- gitignored: **0**

**Positive controls both passed:** `git check-ignore -v docs/pr-prompts/zz-fake-ready.md` →
`.gitignore:75`, exit 0; `git ls-files --error-unmatch docs/pr-prompts/PROMPT-SCHEMA.md` → found.

They are plain **untracked** files. **No clean worktree can read any of them** — including
`00-supervisor-2026-08-21-0115-THREE-FAILURE-MODES-for-06.md`, which the standing arming hold
cites as its own justification. **Writing a breadcrumb is not reporting.** Landing them needs a
docs PR, which is not Station 04's lane.

---

## 🟡 7. CORRECTION to the 2026-08-21 scanner: the two suffix-less prompts are *not* invisible

Yesterday's run recorded `pr-smoke-share-worker-tokens.md` as "ARMABLE and invisible". That is
half right and the wrong half is load-bearing. `[MEASURED]` — **both** suffix-less prompts:

| | `pr-permission-role-reconciler.md` | `pr-smoke-share-worker-tokens.md` |
|---|---|---|
| tracked in index | **yes** | **yes** |
| on `origin/main` | **yes** (`cat-file -e` exit 0) | yes |
| gitignored | **no** | **no** |
| `-HOLD` twin | **none** | **none** |
| `-ready` twin | none | none |
| mtime | 2026-08-17T04:52:11Z | 2026-08-17T04:52:11Z |

They are perfectly visible to git. What they are invisible to is the **watcher glob**
(`*-ready.md`) and **HOLD triage** (`*-HOLD.md`). They occupy a third state the state machine
does not model: *tracked on main, matching neither queue selector, with no twin to `git mv`
from.* That is a **naming / state-machine defect, not a gitignore defect** — and the distinction
matters, because the gitignore framing points at the wrong fix.

`pr-permission-role-reconciler.md` carries a well-formed executable premise
(`! grep -rq "syncRolePermissions" apps/api/src`), `size: 8`, `escalates: false`.
**Not staged, not armed, not touched** — flagged only.

---

## ⚪ 8. Board and trunk state, for the record

- `origin/main` = dev tree = watcher clone = **`c1737312`**.
- CI on that commit, read **per-commit** (never `--branch`): **10 success, 1 skipped, 0 failure.** Trunk green.
- Open PRs: **0** (`gh pr list`, the deciding tool).
- **Armed = 0.** *Counting rule:* `*-ready.md` **at depth 1 only** under `docs/pr-prompts/`.
  The same glob **recursive** returns **1848** — those are retirement subdirectories and are
  inert. Do not quote the recursive number as an armed count.
- `*-HOLD.md` at depth 1: **72**. All `.md` at depth 1: **95**.
- Dev tree dirty: 32 entries — 9 ` D` deletions of `*-ready.md` (**the board trap: do not restore
  these**), 2 staged-but-uncommitted `R` disarm renames of the QA prompts, 14 untracked
  breadcrumbs, plus `.pr-drafts/`, `no-pr-opened/`, `docs/data-model/sweeps/`, ledger files.
- `.git/index.lock`: **ABSENT** on the dev tree. All git in this run went through Desktop
  Commander on Windows; no VM-side git touched `C:\ProjectOperations2\.git`.
- `C:\po-watcher\ProjectOperations` clone: on `main` at `c1737312`, dirty with the archived
  `docs/pr-reviews/*` deletions, **134 stashes** (`stash@{0}` = `machine-minder-2026-08-21-clone`,
  still not popped — correct, leave it).

---

## Still open, re-measured not re-discovered

`sot/03` @ `#495` · `sot/04` 8 models behind (now named) · `LL-` namespace collides, next free
**LL-59**, cite the rule not the number · `check-backlog.mjs` has no DISCHARGED bucket ·
`pr-deps-clear-high-advisories` premise cannot die (`extract-zip@2.0.1`, unowned accepted HIGH
advisory — **Marco's call**) · `settings-restructure-sot-nav-reconcile` **Station 05 only**,
released and unactioned for 7 days · `rates-11c-blocked-consumers` permanent false READY ·
`po-scan-0CwZSs` worktree fossil under `.git/worktrees/` (not blocking) ·
`allocations.service.ts:389` hard-delete cascade — **needs Marco**.
