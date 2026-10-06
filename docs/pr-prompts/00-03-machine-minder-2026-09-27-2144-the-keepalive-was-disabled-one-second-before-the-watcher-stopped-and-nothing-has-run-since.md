# Station 03 — Machine Minder | 2026-09-27T21:44:14Z–2026-09-27T22:00Z

## GROUND

```
UTC            2026-09-27T21:44:14Z
origin/main    99036e3d              (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ ce62d135       C:\ProjectOperations2   (0 ahead / 3 behind origin/main)
doc version    1                     (station_doc_version, docs/pipeline/stations/03-machine-minder.md)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

**Version check: MATCH.** Doc version 1 == bootstrap 1, so this run was NOT read-only-restricted.

**Tree I read the binding documents in: `C:\ProjectOperations2` (the dev tree).** The dev tree is 3
behind `origin/main`, so PREFLIGHT step 2's staleness warning was live and I discharged it by
measurement rather than by assumption — see WHAT I MEASURED row 3. All three documents are
byte-identical to `origin/main`, so the working-copy read is authoritative for this run.

**This was a SIGHTED run.** Desktop Commander reached the Windows host on the first call after the
schema load. Not blind.

---

## WHAT I MEASURED

**1. Host reachability — [MEASURED].** `start_process` shell `powershell.exe` → PID 27444, live
interactive shell; second shell PID 38428. Positive control that this is the real host and not a
sandbox: the first probe expanded `$env:USERNAME` to `Marco` and `-File` against a non-existent
`.ps1` returned the real argument-validation error naming the path. **Not blind.**

**2. Device-bridge git guard — [MEASURED], and the contract requires both lines quoted.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`

- last line: `   PATH="/sessions/elegant-trusting-pascal/.local/bin:$PATH" git <args>`
- headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
- **EXIT CODE: `2`** — read from `echo "GUARD_EXIT=$?"` on the line after the installer, not from a
  pipeline I appended to it.

Exit 2 is the EXPECTED station outcome (the shell is non-interactive and non-login, so neither
`~/.bashrc` nor `~/.profile` is sourced). **A FINDING, not a STOP.** I ran no `git` through the
device bridge this run; every `git` call below ran in `powershell.exe` on the Windows host.

**3. The three binding documents, against `origin/main` — [MEASURED].** Sound forms only, per §9.1
(no piped `hash-object`):

| path | `git diff --numstat origin/main --` | `rev-parse origin/main:` | `hash-object` (working copy) |
|---|---|---|---|
| `docs/pipeline/stations/03-machine-minder.md` | **EMPTY = SAME** | `a4540c9e` | `a4540c9e…` |
| `docs/pipeline/DOCTRINE.md` | **EMPTY = SAME** | `f3955870` | `f3955870…` |
| `docs/pipeline/STATION-CAPABILITIES.md` | **EMPTY = SAME** | `0ef4daba` | `0ef4daba…` |

All three read in full: station doc 401 lines, DOCTRINE **3,001** lines (see F8),
STATION-CAPABILITIES 592 lines.

The 3 commits the dev tree is behind: `99036e3d` (tendering traffic index), **`4cc59499` — `feat(watcher):
adopt proves ancestry, WATCHDOG carries PID, sweep flags 2+ wrappers (#2189)`**, `73d0c85b` (FormRule
columns). The middle one is `scripts/pr-watcher/**` and is load-bearing for F2.

**4. Watcher liveness — [MEASURED], resolved by PID and never by silence (§9.5).**
`Get-CimInstance Win32_Process` over `node.exe` / `powershell.exe` / `pwsh.exe`:

| probe | result |
|---|---|
| processes matched | 27, **all 27 with a populated `CommandLine`** |
| matching `pr-watcher\|watcher-launcher\|ensure-watcher\|start-watcher` | **0** |
| POSITIVE control `NoProfile` over the same set | **5** |
| POSITIVE control `node.exe` count | **21** |
| NEGATIVE control, freshly minted needle `zzQq03Needle20260927T2150` | **0** |

All 21 `node.exe` are MCP servers started by **this** Cowork session between 21:41:40Z and 21:49:33Z;
I listed every command line and none is the watcher. Re-checked at 21:56:10Z: still **0**.
**The watcher node is DEAD, and so is its wrapper.**

Independent corroboration from `status-sweep.ps1` (section 2, `[LIVE]` lines, captured to a file
because the script returns early otherwise; the capture is UTF-16LE per §9.3 and was decoded
`utf16le` in node, 144,408 bytes / 859 lines):

```
[LIVE] watcher node: NOT RUNNING  <-- the queue will not drain
[LIVE] auto-restart wrapper: NOT RUNNING -- watcher will not self-restart
[LIVE] heartbeat age: 3889 min  (ticks only mid-run; stale + empty queue = idle, NOT wedged)
```

3,889 min = **64.8 h**, which matches the timeline below to the minute. Sweep section 0 positive
controls both passed (`gh CAN reach GitHub (saw merged PR #2191)`, `node runs`).

**5. `.queue-state.json` — [MEASURED], sampled four times.** Authoritative freeze probe at
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json` (beside the SCRIPT, not beside
the queue — §9.5):

| sample | wall clock | `ts` |
|---|---|---|
| 1 | 21:49:23Z | `2026-09-25T04:55:13.042Z` |
| 2 | 21:52:18Z | `2026-09-25T04:55:13.042Z` |
| 3 | 21:53:43Z | `2026-09-25T04:55:13.042Z` |
| 4 | 21:56:10Z | `2026-09-25T04:55:13.042Z` |

Unchanged across **6 min 47 s**, satisfying §9.5's ">5 minutes apart" requirement. §9.5 says a frozen
`ts` is *paused or dead* and must be resolved by PID — row 4 resolves it: **dead, not paused, not a
frozen rescan loop.** ⚠️ My own delta arithmetic printed `-593.2` minutes because PowerShell parsed
the `…Z` literal as LOCAL time; the wall-clock stamps above are the sound reading and the delta line
is discarded.

**6. The timeline — [MEASURED], and it converges on one second.**

| when (UTC) | what | source |
|---|---|---|
| `2026-09-25T04:54:58.524Z` | `[merge] …: opened PR #2194, policy=tests-docs, waiting.` | newest daily clone log |
| `2026-09-25T04:55:09Z` | `watcher alive, pid(s) 42212` — **last ever keepalive ping** | `ensure-watcher.log` tail |
| `2026-09-25T04:55:13.042Z` | last `[review] verdict-archive sweep` line; **`.queue-state.json` `ts` stops here** | clone log + queue state |
| **`2026-09-25T04:57:21Z`** | **`C:\Windows\System32\Tasks\PO Watcher Keepalive` XML last written** | `(Get-Item).LastWriteTimeUtc` |
| `2026-09-25T04:57:22.209Z` | `[update] PR #2193 branch updated (was BEHIND)` — **last line the watcher ever wrote** | newest daily clone log |
| 2026-09-25T05:16:04Z → 05:16:10Z | system entering sleep → resumed, **6 seconds** | `Get-WinEvent` System log, ids 42/107 |
| 2026-09-27T21:38–21:42Z | all four enabled Claude tasks fire within 4 min | scheduled-tasks MCP `lastRunAt` |

The keepalive task definition was rewritten **one second before the watcher's final log line.**

**7. `PO Watcher Keepalive` is DISABLED — [MEASURED], three independent instruments.**

| instrument | reading |
|---|---|
| `Get-ScheduledTask` → `.State` | **`Disabled`** |
| `Get-ScheduledTask` → `.Settings.Enabled` | **`False`** |
| the task XML on disk, `<Enabled>` element | **`<Enabled>false</Enabled>`** |
| its action | `powershell.exe … -File "C:\po-watcher\ensure-watcher.ps1"` |
| its triggers | `MSFT_TaskLogonTrigger` + `MSFT_TaskDailyTrigger@2026-08-24T00:05:00+10:00`, `rep=PT10M` |
| `Get-ScheduledTaskInfo` → `LastRunTime` / `LastTaskResult` | `09/25/2026 14:55:01` local (= `04:55:01Z`) / **`0`** |
| XML `CreationTimeUtc` | `2026-08-24T05:28:32Z` (unchanged; only the definition was rewritten) |

`lastResult=0` means the keepalive's final run **exited cleanly** — it did not crash. And it is the
**only** watcher-related task on the box: I enumerated every scheduled task matching
`atcher|Keepalive|po` and there is exactly one.

**Who disabled it, and why: [CANNOT MEASURE].**
`(Get-WinEvent -ListLog 'Microsoft-Windows-TaskScheduler/Operational').IsEnabled` → **`False`**, so
no audit record of the change exists on this box. The 04:57:21Z XML mtime is the only evidence, and
it dates the change without attributing it. I am not inferring an actor.

**8. The box was UP the whole time — [MEASURED], and this REFUTES the obvious prior pattern.**
`Win32_OperatingSystem.LastBootUpTime` = **`2026-09-15T13:32:45Z`**, uptime **296.38 h**. The only
power events in four days are the 6-second sleep/resume at 05:16Z on 09-25. So the 65.9 h of station
silence was **not** the box being powered off. ⚠️ My own predecessor breadcrumb
`00-03-machine-minder-2026-09-21-0021-sixty-three-of-the-seventy-six-hour-outage-was-the-box-powered-off-and-lastbootuptime-cannot-see-it.md`
records exactly that pattern for a previous outage; **it does not apply here and I checked rather
than assumed.** That the Claude desktop app was not running is **[INFERRED]** from station silence
plus a box that never rebooted — I have no direct probe of the app's uptime.

**9. Locks, merge state, drift, stashes — [MEASURED].**

| probe | dev tree `C:\ProjectOperations2` | clone `C:\po-watcher\ProjectOperations` |
|---|---|---|
| `.git/index.lock` | **ABSENT** | **ABSENT** |
| `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` / `sequencer` | none present | none present |
| running `git` processes | **0** | — |
| branch @ HEAD | `main` @ `ce62d135` | `main` @ **`5045e81d`** |
| `git status --porcelain --untracked-files=no` | — | **1** → ` M docs/data-model/metadata-catalog.json` |
| `git status --short` (untracked-inclusive) | — | 1 |
| `git stash list` | — | **77** |
| behind real `origin/main` | 3 | **5** (`rev-list --left-right --count 5045e81d...origin/main` → `0 5`, run in the dev tree, which has a FRESH `origin/main`) |

**No stale lock this run** — the condition that has frozen every station three times in two days is
absent in both trees. The clone's own `origin/main` ref reads `5045e81d`, identical to its HEAD,
because a clone fetches only at launcher start (§9.5) — which is why the behind-count was measured
from the dev tree and not from the clone.

**10. Queue — [MEASURED], globbed at TOP LEVEL ONLY.**
`Get-ChildItem 'docs\pr-prompts\*' -Filter '*-ready.md' -File` (depth-1 wildcard-in-path form, no
`-Recurse` — the form §9.3 blesses for depth 1):

| probe | result |
|---|---|
| armed `*-ready.md` at depth 1 | **2** — `rev-2192-ready.md` (mtime `2026-09-25T04:48:50Z`), `rev-2193-ready.md` (`04:54:49Z`) |
| POSITIVE control `*-HOLD.md` at depth 1 | **17** |
| NEGATIVE control, minted needle | **0** |

Sweep section 4 agrees exactly (`armed (*-ready.md): 2`, same two names), plus
`needs-marco/ 48 · no-pr-opened/ 111 · failed/ 61 · blocked/ 153`. Both armed files are
auto-generated `rev-` REVIEW JOBS, not prompts (§9.5), and both have been armed and unconsumed for
**65 h**. ⚠️ Per §9.5 I did **not** read arm age from these mtimes; `.arming-log.txt`'s last row is
`2026-09-25T04:39:10Z ARMED pr-e2e-batch1-dashboards-isolate-the-four-flaky-slices … actor=station-00.interactive-0004`,
consistent with the timeline. `failed/` holds 31 `.md`, newest `rev-2186-ready.md` at
`2026-09-25T00:41:17Z` — **nothing new since my last breadcrumb**, so there is no new failure to
triage this run.

**11. Board — [MEASURED] from sweep section 1 (`[LIVE]`, GitHub-side).** 6 open PRs; trunk on
`99036e3d` is **5 success / 0 failed (green)**.

| PR | mergeable | CI |
|---|---|---|
| #2195 | BLOCKED | 13 pass / 2 fail |
| #2194 | BEHIND | 14 / 1 |
| #2193 | BLOCKED | 8 / 2 |
| **#2192** | **CLEAN** | **10 / 0 (green)** |
| #2183 | BEHIND | 13 / 2 |
| **#2167** | BEHIND | **15 / 0 (green)** |

⚠️ I did **not** derive a lane or a merge verdict for any of these — that is 00's, and §10.1 step 1's
probe plus the label read are its instruments, not mine. The list is impact evidence for F1 only.

**12. The CI silence detector has been firing correctly for 65.9 h — [MEASURED].** Sweep section 1
reported `Pipeline heartbeat: 12 run(s), 12 failing`, correctly excluded from the trunk verdict by
the `event -eq schedule` denylist. `gh run list --workflow 'Pipeline heartbeat' --limit 5` → the last
five scheduled runs are **all `failure`** (21:10:46Z, 16:45:39Z, 11:47:19Z, 04:47:56Z on 09-27, and
23:27:38Z on 09-26). Job log read by **splitting on the tab and taking the last column** (§9.1),
POSITIVE control `Run ` → 4, NEGATIVE control minted needle → 0:

```
[heartbeat] SILENT: NO station has reported for 65.9h (threshold 6h). Newest is station 00 at
2026-09-25T03:15:00Z. Either the scheduler is off, the machine is down, or the app is not running.
If this was deliberate, declare it in docs/pipeline/pause.json.
##[error]Process completed with exit code 1.
```

`docs/pipeline/pause.json` → `Test-Path` **False**. The outage was never declared deliberate.

**13. Station silence, corroborated from the queue — [MEASURED].** Depth-1 breadcrumbs number 4 and
the newest two are `00-04-scanner-2026-09-25-0211-blind-no-windows-shell-desktop-commander-absent.md`
and `00-00-supervisor-2026-09-25-0415-blind-no-windows-shell-desktop-commander-connect-timeout.md`.
My own last report is `00-03-machine-minder-2026-09-24-2320-…` (24 `00-03-` breadcrumbs in total,
depth 1 + `archive/`). **The last two station runs before the silence were both BLIND**, and then
nothing at all.

**14. The scheduler is alive, and this run is a catch-up — [MEASURED] from the scheduled-tasks MCP**
(the prescribed source for cadence; never this file or a station doc):

| task | cron | enabled | lastRunAt | nextRunAt |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` | true | **2026-09-27T21:38:18.174Z** | 22:13:52Z |
| `04-scanner` | `0 */4 * * *` | true | **2026-09-27T21:38:18.573Z** | 22:09:31Z |
| `05-sot-keeper` | `10 0 * * *` | true | **2026-09-27T21:38:18.894Z** | 2026-09-28T14:22:37Z |
| `03-machine-minder` | `0 9 * * *` | true | **2026-09-27T21:42:40.254Z** (this run) | 23:02:45Z |
| `weekly-security-audit` | `30 7 * * 1` | **false** | 2026-09-06T21:32:44Z | — |

All four enabled tasks fired inside **4 minutes**, including `05` whose slot is 00:10 local and `03`
whose slot is 09:00 local — neither is due now. That is a **mass catch-up fire on app restart**, and
it is why a station is running at all. ⚠️ Live enabled count is **FOUR**, matching §1's 2026-09-15
correction. ⚠️ **Another `03` run fires at 23:02:45Z, ~1 h from now** — it will re-measure all of this.

**15. Worktrees — [MEASURED] from sweep section 2 `[LIVE]`.** 6 non-main worktrees, all classified
orphaned; `worktree-registry-escapees: none found under known roots`; guard hook
`.claude/hooks/guard.mjs` present.

| worktree | branch | dirty | age |
|---|---|---|---|
| `C:/po-worktrees/sup-cwd-paths` `66ac4dcd` | `fix/pipeline-scripts-resolve-state-paths-from-module` | **2 files** | 5,171 min (86 h) |
| `C:/po-wt/fv2drop` `d77e3316` | `wt-fv2-formrule-contract-drop` | 0 | 5,106 min |
| `C:/po-wt/s8h` `0a890a49` | `wt-s8h` | 0 | 4,407 min |
| `C:/po-wt/s8i-fixforward` `b92a54aa` | `fix/s8i-travel-index-reset-and-tip-dailykm` | 0 | 4,210 min |
| `C:/po-wt/sec-a1` `041e2035` | `wt-sec-a1` | 0 | 4,227 min |
| `C:/po-wt/stage-formrule-web` `041fad08` | `docs/stage-formrule-legacy-payload-retire` | 0 | 4,461 min |

**16. Sweep verdict — [MEASURED].** `[LIVE] SAFE TO ACT: no board mutation in progress, no recent
remote activity, no live station worktrees.` `SWEEP COMPLETE 2026-09-27 21:46:06Z`. ⚠️ Recorded, not
acted on: I am report-only, and §7's `[LIVE]` rule means this verdict expired the moment it printed.

**17. Breadcrumb validated, and its freshness pass independently corroborates F1/F5 — [MEASURED].**
`scripts/pipeline/check-breadcrumb.mjs` is the ONLY validator for a breadcrumb; `lint-prompt.mjs`
gates `docs/pr-prompts/` as *prompts*, never returns a passing verdict on a breadcrumb, and was NOT
run here. Exit codes read from `$LASTEXITCODE` on the FOLLOWING line, with output redirected to a file
rather than piped, so the status is the command's and not a pipeline stage's (§9.1):

- `node scripts\pipeline\check-breadcrumb.mjs` → `structure: 5 checked, 0 malformed, 0 skipped`,
  `ADMIT` for this file, **`CLEAN`**, **exit `0`**. So `breadcrumb-clean` is earned, not asserted.
- `node scripts\pipeline\check-breadcrumb.mjs --freshness` → **exit `2`**, `SILENT: 3 station(s) past
  cadence`. I am sighted, so I may claim a `--freshness` verdict (a blind run may not — it shells
  `git` and `gh`).

```
  00  last 2026-09-25T04:15:00Z  65.8h ago  (cadence 1h)   SILENT
  02  dispatch-only — no cadence to miss
  03  last 2026-09-27T21:44:00Z   0.3h ago  (cadence 24h)  ok
  04  last 2026-09-25T02:11:00Z  67.8h ago  (cadence 4h)   SILENT
  05  last 2026-09-24T14:23:00Z  79.6h ago  (cadence 24h)  SILENT
```

A **third independent instrument** — after the CI heartbeat detector and the frozen `.queue-state.json`
— puts the silence at the same moment. It also reports `NOTE … is UNTRACKED — it reaches nobody until
a board PR commits it` for this file, which is the expected state given Station 03 cannot open a PR,
and is why Station 00 must sweep it. ⚠️ `03` reads `ok` **only because this breadcrumb just landed**;
before it, all four enabled stations were silent. ⚠️ The exit-2 freshness verdict is 00's to
disposition, not mine — and 00's own silence is one of its three rows, which is the structural problem
F5 names.

---

## WHAT CHANGED

**Nothing.** This run mutated no machine, no tree, no queue entry, no label, no PR and no scheduled
task. It read, and it wrote exactly one file: this breadcrumb.

Specifically, and deliberately: I did **not** re-enable `PO Watcher Keepalive`, did **not** relaunch
the watcher, did **not** fast-forward the clone, did **not** clear the clone's dirty file or its 77
stashes, did **not** prune a worktree, and did **not** touch the two armed `rev-` files. Station 03
is REPORT-ONLY and Station 00 dispatches the repair.

The only side effects on disk are one scratch capture,
`C:\po-sup-fix-scripts\sweep-03-20260927T2144Z.txt` (144,408 B, the sweep's own output, in the
sanctioned scratch folder), and the `vm-git-guard` shim plus its `PATH` export in the VM's
`~/.bashrc` / `~/.profile`, written by the installer the contract requires me to run.

---

## FINDINGS

### F1 — `PO Watcher Keepalive` IS DISABLED, AND THAT IS WHY 65 HOURS OF BOARD TIME IS GONE. The task XML was rewritten ONE SECOND before the watcher's last log line, and nothing on this box records who did it.

The watcher node is dead (measurement 4, PID-resolved, controlled, corroborated by the sweep and by a
`ts` frozen across 6m47s). It is dead *and stayed dead* for a single reason: the only thing that
restarts it is a Windows scheduled task whose `<Enabled>` is `false` on disk, in
`Get-ScheduledTask.State`, and in `.Settings.Enabled` (measurement 7). Its last run exited **0** — it
did not crash, it was switched off. `STOP-WATCHER` is **absent**, so the documented sentinel is not
the cause; `STOP-WATCHER-LANE2` is present and is by design (§9.5), 1,090 B, and is not a stop signal.

The disable is dated `2026-09-25T04:57:21Z` by the task XML's mtime, and the watcher's final log line
is `2026-09-25T04:57:22.209Z`. **One second apart.** The box never rebooted (uptime 296 h), so this
was not a power event, and no `pause.json` declares it.

Cost, measured: two green PRs (**#2192** CLEAN 10/0, **#2167** 15/0) have sat unmerged for 65 h on a
green trunk; two armed `rev-` review jobs have sat unconsumed since 04:48Z and 04:54Z; and the queue
has not been rescanned since `2026-09-25T04:55:13Z`.

⚠️ **Why this is ESCALATED and not DISPATCHED.** Re-enabling it is one command, and I am deliberately
not proposing that 00 run it blind. `Microsoft-Windows-TaskScheduler/Operational` is **disabled**
(`IsEnabled: False`), so **who disabled this task, and whether Marco did it on purpose, is
[CANNOT MEASURE]**. A station that re-enables a task Marco switched off has overridden him with no
way to know it did. The keepalive also relaunches a watcher that will merge things.

**RULE 1 options — complete-and-additive FIRST:**

- **(a) Marco confirms the disable was not his, then 00 fast-forwards the clone (F2) and re-enables
  the task, and the same PR lands a `docs/pipeline/` note recording the 04:57:21Z XML-mtime probe and
  turning the TaskScheduler Operational log ON (F7) so the next occurrence has an actor.** Solves it
  immediately (the watcher comes back on the correct code) and in future (the next disable is
  attributable, and the XML-mtime probe is written down). Damages no existing or future data entry:
  enabling the log is additive, and the clone fast-forward is the documented prerequisite.
  **Passes both halves of RULE 1.**
- **(b) 00 re-enables the task now without asking.** Fails the *future* half: it leaves the audit gap
  intact, so this recurs unattributably, and it risks silently reversing a deliberate act of Marco's.
- **(c) Leave it off pending Marco.** Fails the *immediate* half outright — the board stays frozen and
  the two green PRs keep aging — and it fails the future half too, since nothing is learned.

**DISPOSITION: ESCALATED** — Marco: did you disable `PO Watcher Keepalive` at 2026-09-25T04:57:21Z?
If not, option (a). Either way, may we turn on the TaskScheduler Operational log (F7)?

### F2 — THE CLONE IS 5 COMMITS BEHIND `origin/main` AND #2189 CHANGED THE WATCHER, SO RE-ENABLING THE KEEPALIVE FIRST RELAUNCHES THE OLD CODE.

The clone is `main @ 5045e81d`; real `origin/main` is `99036e3d`; `rev-list --left-right --count
5045e81d...origin/main` → `0 5`. In that gap sits **`4cc59499` — `feat(watcher): adopt proves
ancestry, WATCHDOG carries PID, sweep flags 2+ wrappers (#2189)`**, merged 2026-09-25T04:36Z, i.e.
21 minutes before the watcher stopped. §9.5 is explicit: *"A restart adopts nothing. The watcher runs
`index.mjs` from the clone, so the clone must be fast-forwarded before a restart changes any
behaviour."*

So the ordering is load-bearing and it is the reverse of the intuitive one: **fast-forward the clone,
then enable the task.** Enabling first gives a watcher running code that predates its own repair, and
the 10-minute `PT10M` repetition means it would be running within ten minutes of the flip.

⚠️ Sequencing note for whoever does it: §4 forbids `git checkout` / `commit` / `push` in the clone,
and the clone carries one tracked-dirty file (F3). A `git -C <clone> merge --ff-only origin/main`
after an explicit `git -C <clone> fetch origin +refs/heads/main:refs/remotes/origin/main` is the
in-lane form — the clone's own `origin/main` ref currently equals its HEAD and will not update
without that explicit refspec.

**DISPOSITION: DISPATCHED** — to Station 00, as the ordered prerequisite of F1 option (a): fetch with
the explicit refspec, `merge --ff-only`, read back 0-behind, **then** the keepalive.

### F3 — THE SWEEP SAYS THE CLONE "MAY REFUSE TO START" AND IT WILL NOT. This is DOCTRINE §9.5's known-false warning, and the stash count is the receipt.

Sweep section 2: `[LIVE] watcher clone: branch=main dirty=1 <-- NOT clean-on-main; the watcher may
refuse to start`. **That second clause is false and is already recorded as false.** §9.5's
`status-sweep` bullet measures both conjuncts: the flag counts untracked files where
`start-watcher.ps1` does not, *and* a tracked-dirty clone **auto-stashes** rather than refusing —
anchor `# --- Self-heal: AUTO-STASH a dirty tree instead of exiting 1 ---`.

Here the file is genuinely TRACKED (` M docs/data-model/metadata-catalog.json`; both `git status`
forms return 1, so this run is **not** a fresh instance of the untracked-inclusive half). It will be
stashed on next launch, not refused. **Stash count is 77**, against 71 recorded on 2026-09-10 — the
closed loop §9.2 names (the launcher stashes on every start, nothing ever pops) is still growing at
roughly the rate that bullet predicts, and the growth is itself the evidence that the auto-stash path
is the live one.

I am flagging this so nobody spends F1's repair window on the clone's dirty file. ⚠️ If it is ever
cleared, `git stash drop`, **never `pop`** (§9.2).

**DISPOSITION: DEFERRED** — not now, and not a blocker to F1/F2. It becomes urgent if the stash list
starts holding work someone wants back, or if a launch ever genuinely exits 1 on the preflight, which
would mean the stash itself failed. The `metadata-catalog.json` modification wants an owner
eventually; it is not mine and not this outage's cause.

### F4 — `Get-ScheduledTaskInfo.NextRunTime` RETURNS A PLAUSIBLE FUTURE TIMESTAMP FOR A **DISABLED** TASK, SO THE OBVIOUS KEEPALIVE-HEALTH PROBE READS HEALTHY ON THE EXACT FAULT THAT FROZE THE BOARD.

[MEASURED] this run, on `PO Watcher Keepalive` while it was `Disabled` in three places:

| probe | reading | reads as |
|---|---|---|
| `Get-ScheduledTaskInfo … .NextRunTime` | **`09/28/2026 07:55:00`** — a future time | *"it is scheduled and will fire"* — **wrong** |
| `Get-ScheduledTaskInfo … .LastTaskResult` | **`0`** | *"last run was clean"* — true, and irrelevant |
| `Get-ScheduledTask … .State` | `Disabled` | right |
| `Get-ScheduledTask … .Settings.Enabled` | `False` | right |
| the XML `<Enabled>` element — POSITIVE control on disk | `false` | right |

Nothing is empty, nothing warns, and every call exits 0, so §9.6 cannot fire: the cmdlet answered
exactly the question it was asked, about a **different quantity** from the one the property name
implies. The natural one-line health check — *"is the keepalive going to run again?"* → read
`NextRunTime` → a timestamp tomorrow morning → **healthy** — is available, wrong, and lands on the
single fault that cost 65 hours. `LastTaskResult: 0` reinforces the wrong reading, because a task
switched off after a clean run looks exactly like a task in good health.

🔧 **Never read a task's health from `NextRunTime` or `LastTaskResult`. Read `.State`, or
`.Settings.Enabled`, and control it against the `<Enabled>` element in
`C:\Windows\System32\Tasks\<name>`.** And date any suspected change from that file's
`LastWriteTimeUtc` — that probe is what pinned 04:57:21Z in F1 and it is the only reason this outage
has a cause rather than a symptom.

⚠️ **Falsifying probe: the five rows above.** Re-run them against a task that is genuinely
`Disabled`. If `NextRunTime` is ever empty or absent on a disabled task, this finding is wrong and
must be re-measured.

**DISPOSITION: DISPATCHED** — to Station 00, for DOCTRINE §9.5 (the pipeline's own instruments),
alongside the XML-mtime dating probe. Both are general, both are cheap, and neither is in §9 today.

### F5 — THE CI SILENCE DETECTOR WORKED PERFECTLY FOR 65.9 HOURS AND REACHED NOBODY. Detection is not the gap; the gap is that a failing scheduled workflow has no reader.

`Pipeline heartbeat` has failed **12 consecutive scheduled runs**, and its verdict line is exactly
right:

```
[heartbeat] SILENT: NO station has reported for 65.9h (threshold 6h). Newest is station 00 at
2026-09-25T03:15:00Z. … If this was deliberate, declare it in docs/pipeline/pause.json.
```

No `pause.json` exists, so the outage was never declared. **The instrument is not broken — it is
unread.** And the reason it is structurally unread is recorded in this pipeline's own doctrine: the
`status-sweep.ps1` trunk verdict *correctly* excludes `event -eq schedule` runs from the trunk
rollup (`TRUNK_VERDICT_SCOPED_V1`, #1852). That denylist is right — it stops a Dependabot run
flipping the headline to `TRUNK IS RED` — but its side effect is that the one workflow whose whole
job is to shout about silence is filed under `NOT trunk CI on this commit, excluded from the verdict
above`, where nothing acts on it. The sweep printed `Pipeline heartbeat: 12 run(s), 12 failing` in
section 1 of this very run, three lines under `(trunk green)`.

This is the nine-day `qa-findings.md` failure in a third costume: a true finding written to a place
no reader is obliged to look. It is also, precisely, why an outage that a scheduled job detected
within six hours was still running 65.9 hours later.

**RULE 1 options — complete-and-additive FIRST:**

- **(a) Give the heartbeat a channel that reaches a human, and keep the trunk denylist exactly as it
  is: on `failure`, have the workflow open-or-update a single pinned GitHub issue (and/or fail a
  required check on nothing but itself), so the signal has an addressee independent of any station
  being alive to read it.** Solves it immediately and in future, survives the very outage it detects —
  the detector runs in GitHub Actions, which kept working while every station was down — and damages
  no data entry. **Passes both halves.**
- **(b) Have `status-sweep.ps1` surface excluded-but-failing scheduled workflows in section 7's
  verdict.** Additive and cheap, but fails the *immediate/robustness* half: it only helps when a
  station is alive to run the sweep, and the whole failure class is "no station is alive".
- **(c) Raise the 6 h threshold or treat the red as expected.** Fails both halves; it removes the only
  instrument that was right.

⚠️ Option (a) touches `.github/workflows/**` and opens issues, which is outside my lane entirely.

**DISPOSITION: ESCALATED** — Marco: the detector works; may it have an addressee? Option (a).

### F6 — SIX ORPHANED WORKTREES, ONE HOLDING 2 UNCOMMITTED FILES FOR 86 HOURS.

`C:/po-worktrees/sup-cwd-paths` @ `66ac4dcd` on
`fix/pipeline-scripts-resolve-state-paths-from-module`, **dirty=2 files**, age 5,171 min. The sweep's
own guidance is quoted verbatim: *"HOLDS UNCOMMITTED WORK (2 file(s)). PRESERVE OR COMMIT BEFORE
PRUNING; 'git worktree remove' will refuse, and --force would discard it."* The other five are clean
(ages 4,210–5,106 min). `worktree-registry-escapees: none found under known roots`.

This is recurring rather than new — my 2026-09-21T23:04Z breadcrumb already records a worktree pinned
for eighteen days by a merged PR's draft. Pruning is **irreversible** for the dirty one and therefore
a §5 hard stop for me; the five clean ones are ordinary housekeeping and not urgent.

**DISPOSITION: DEFERRED** — real, not now, and explicitly not during F1/F2, which need the box quiet.
It becomes urgent if `sup-cwd-paths`' 2 files are work someone still wants (they should be listed
with `git -C C:/po-worktrees/sup-cwd-paths status --porcelain` before anything touches them), or if
the count keeps climbing. The dirty one must never be `--force`d away.

### F7 — `Microsoft-Windows-TaskScheduler/Operational` IS DISABLED, SO SCHEDULED-TASK CHANGES ON THIS BOX ARE UNATTRIBUTABLE — WHICH IS EXACTLY WHY F1 HAS NO ACTOR.

`(Get-WinEvent -ListLog 'Microsoft-Windows-TaskScheduler/Operational').IsEnabled` → **`False`**, and a
four-day query filtered to `PO Watcher` returned **0 events**. The single most consequential change on
this machine in three days — the switch that governs whether the board moves at all — happened with
no audit record. All I could recover was a file mtime.

Enabling that log is purely additive, costs a bounded amount of disk, and would have turned F1's
`[CANNOT MEASURE]` into a name and a timestamp. It is a change to OS logging configuration, which is
not mine to make.

**DISPOSITION: ESCALATED** — folded into F1 option (a) as the future-proofing half; recorded
separately because it stands on its own even if F1 turns out to have been deliberate.

### F8 — `read_file` REPORTED `DOCTRINE.md` AS "1,002 LINES" WHEN IT HAS 3,001, AND A STATION THAT BELIEVES THAT NUMBER READS 33% OF ITS BINDING LAW WHILE BELIEVING IT READ ALL OF IT — INCLUDING ALL OF §10 AND MOST OF §9.

[MEASURED] this run, 2026-09-27, at `origin/main` `99036e3d`. Desktop Commander `read_file` on
`C:\ProjectOperations2\docs\pipeline\DOCTRINE.md` returned an error naming the size:

```
Error: result (74,224 characters across 1,002 lines) exceeds maximum allowed tokens.
```

The truth, from node (`readFileSync`, Buffer length — never `String.length`, §9.3):

| probe | result |
|---|---|
| `read_file`'s reported extent | **74,224 chars / 1,002 lines** |
| `Buffer.length` | **236,082 bytes** |
| CRLF count = real line count | **3,001** |
| chars in the first 1,002 lines — POSITIVE control that the figure is a TRUNCATION | **75,351** (≈74,224 + the 1,002 `\r`) |
| `wc -l` over the mount, independent transport | **3,001** |
| line 1,002's text | `  control, matching \`git hash-object\`). Same family as the \`` — **mid-sentence, mid-bullet** |

**The reported numbers describe the slice the tool tried to return, not the file** — and they are
presented as the file's dimensions. Nothing says "truncated to". So the available reading is *"this
document is 1,002 lines; I will read it in two 500-line halves"* — and a run that does exactly that
stops at line 1,002, **mid-sentence inside §9.3**, having read **33%**, with no error, no empty
result and no warning. §9.6 cannot fire: nothing was empty and no query failed.

🔴 **What sits past line 1,002 is not filler.** The rest of §9.3, all of **§9.4 (GitHub)** — including
the `merged`-field trap, the `gh` CWD trap and the `--json number` fabricated-row trap — all of
**§9.5**, all of **§9.6**, and the whole of **§10 SECOND LANES**, which `CLAUDE.md` singles out by
name: *"§10 governs second lanes … §10.1 is a safety rule."* A station that stopped at 1,002 would
have every RULE-2 instrument, the lane-classification rule and the merge gates entirely unread, while
honestly reporting that it had read DOCTRINE in full. On a board where 00 may merge, that is §9.6's
shape with a merge button attached, reached through a **line count** rather than through a corpus.

🔴 **I walked into the first half of it.** My own chunking (`sed -n '1,500p'`, then `'501,1002p'`) was
sized from that error message. I caught it only because I ran `wc -l` before trusting the number, and
the second chunk ended mid-sentence.

🔧 **Never take a line or character count from a tool that just refused to return the file. Measure
the extent with a second instrument before chunking** — `wc -l`, or node's CRLF count — and control
the read by asserting the last line you got is the file's actual last line. The cheap version: after
any chunked read, check that the final chunk ends where the document ends.

⚠️ **Falsifying probe: the table above.** Re-run `read_file` on `DOCTRINE.md` and compare its reported
line count against `wc -l`. If they ever agree, this finding is spent and must be re-measured.
⚠️ The 401-line station doc and the 592-line STATION-CAPABILITIES were **under** the cap and returned
whole, so the trap is invisible on every binding document except the largest one — the one it matters
most on, and the one that grows every time a station lands a correction.

**DISPOSITION: DISPATCHED** — to Station 00, for DOCTRINE §9 (§9.3, files and encoding, or §9.5 as an
instrument). This is a general trap for every station and every run, not a fact about today.

### F9 — `vm-git-guard` INSTALLED BUT INERT, exit 2. Recorded because the contract requires it, not because it is new.

Quoted in full in measurement 2. Exit **2**, the expected station outcome: the shim is byte-correct
and off `PATH`, because a station's shell is non-interactive and non-login. **The device-bridge git
ban was REMEMBERED, not mechanical, for this entire run — and I kept it:** every `git` invocation
above ran in `powershell.exe` on the Windows host, and both `index.lock` probes came back ABSENT, so
this run added no lock. Nothing is proposed; §9.2 records this as having failed seven times, and the
one-call `PATH=…` form is the only in-shell protection available.

**DISPOSITION: DEFERRED** — no action available to me. It becomes urgent only if a run ever reports
exit **0** here while a bare `bash -c 'command -v git'` still resolves `/usr/bin/git`, which would
mean the installer had started certifying protection it does not provide.

---

## WHAT I DID NOT DO

- **Did not repair anything.** No keepalive re-enable, no watcher relaunch, no clone fast-forward, no
  `git checkout`/`commit`/`push` in the clone, no stash drop, no worktree prune, no lock clear (there
  was no lock to clear). Station 03 is **REPORT-ONLY** by its own contract and by
  `STATION-CAPABILITIES.md` §5, and **Station 00 dispatches the repair**. Where the older brief below
  the contract says *"Default is DO IT … diagnose, fix, push, verify CI, merge"*, the contract wins by
  its own terms, and the contract says report.
- **Did not touch the board.** No merge, no label, no `do-not-merge` removal, no PR, no branch. I read
  6 open PRs as impact evidence for F1 and deliberately derived **no lane and no merge verdict** for
  any of them — §10.1's probes are 00's instruments. I did not run the `marco:true` probe at all,
  because nothing I dispositioned turns on it.
- **Did not arm, disarm, rename or move anything in `docs/pr-prompts/`.** The two armed `rev-` files
  are 65 h stale and I left them exactly as they are; they are auto-generated review jobs and will be
  picked up when the watcher returns. I did not rename either to `*-LOOPING.md` — nothing is looping,
  because nothing is running.
- **Did not triage `failed/`.** Newest entry is `rev-2186-ready.md` at `2026-09-25T00:41:17Z`, which
  predates my last breadcrumb, so there is no NEW failure this run. No restage, no fresh-letter copy,
  no `rev-` fix prompt. Nothing is limit-parked, so there is no `## Parked` section.
- **Did not open a PR for this breadcrumb.** `STATION-CAPABILITIES.md` §5 gives Station 03 ❌ on
  "Create a PR", so the in-PR home the contract prefers is not available to me. This file is written
  to the **dev tree** at `C:\ProjectOperations2\docs\pr-prompts\` — depth 1, per the REPORT CONTRACT
  and per §8.5's `REPORTS_DIR_NOT_BUILT_V1` correction (`docs/pr-prompts/reports/` does not exist and
  is not the live destination). It is **untracked until Station 00's next board PR commits it**, and
  it is not in any of the five gitignored sinks. ⚠️ **00: once a PR lands this exact path on `main`,
  this untracked file will block the dev tree's next `--ff-only`** — the documented cure is a
  raw-Buffer restore from `HEAD`, never `git checkout --` and never `git clean` (§9.2).
- **Did not write to the session `outputs` folder**, which is disposable and where a blind run's
  entire report died on 2026-09-22.
- **Did not touch Azure, Entra or SharePoint**, and did not run `az` or `Connect-MgGraph`. Absolute.
- **Did not write production data**, and ran no migration or seed.
- **Did not edit `/sot/`** — Station 05's, CP-24.
- **Did not diagnose the 6 open PRs' red CI.** #2195, #2194, #2193 and #2183 are red; root-causing a
  red is 00's and 02's lane, and on a frozen board it is also premature.
- **Did not determine who disabled the keepalive, and did not guess.** `[CANNOT MEASURE]` — the audit
  log that would answer it is itself disabled (F7).
- **Did not verify the app's uptime directly.** That the Claude desktop app was down for 65.9 h is
  `[INFERRED]` from total station silence plus a box that never rebooted, not measured.
- **Did not re-run `restart-watcher-if-wedged.ps1`**, which DOCTRINE §3 names as the sanctioned
  liveness check, because it **restarts** — a repair. I used `status-sweep.ps1` (read-only) plus
  PID-resolved process measurement with positive and negative controls instead, and said so.

---

## FOR MARCO — two questions, in priority order

1. **Did you disable `PO Watcher Keepalive` at 2026-09-25T04:57:21Z?** Nothing on the box records who
   did, because the TaskScheduler audit log is off. It is why the watcher has been dead for 65 hours
   and two green PRs (#2192, #2167) have not merged on a green trunk. If it was not you: **F1 option
   (a)** — fast-forward the clone *first* (#2189 changed the watcher, F2), then re-enable.
2. **May the `Pipeline heartbeat` detector have an addressee?** It correctly reported the outage
   within six hours and then failed 12 times into a channel nobody reads. **F5 option (a)** — a pinned
   GitHub issue on failure — is the only cure that survives the outage it detects, because it runs in
   Actions rather than on the box.

<run-summary>Sighted run: the watcher has been dead 65 hours because `PO Watcher Keepalive` is DISABLED — its task XML was rewritten one second before the watcher's last log line, the box never rebooted, no `pause.json` declares it, and who disabled it is unmeasurable since the TaskScheduler audit log is itself off; nine findings, nothing repaired, F1/F2 dispatched-and-escalated to Station 00 and Marco, plus a new §9 trap in which `read_file` reports DOCTRINE.md as 1,002 lines against a true 3,001.</run-summary>
