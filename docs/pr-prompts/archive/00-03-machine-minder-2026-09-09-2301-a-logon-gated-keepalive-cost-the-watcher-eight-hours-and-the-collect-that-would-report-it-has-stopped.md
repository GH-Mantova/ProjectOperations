# Station 03 - Machine Minder | 2026-09-09T23:01:42Z-2026-09-09T23:20Z

## GROUND

```
UTC            2026-09-09T23:01:42Z
origin/main    f482d1a5              (git fetch origin +refs/heads/main:refs/remotes/origin/main, then git rev-parse --short origin/main)
dev tree       main @ f482d1a5       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. This run was NOT read-only.

Sighted run. `start_process` shell `powershell.exe` succeeded; PID 31144. All three binding
documents were read IN FULL from the dev tree, and `git diff --numstat origin/main --
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/03-machine-minder.md` returned EMPTY, so the working copies are
byte-identical to `origin/main` (the sound probe per the PREFLIGHT block; no piped hash was taken).

## WHAT I MEASURED

**vm-git-guard install: FAILED, and no VM-side call was made.** [MEASURED] The device-bridge
workspace would not start at all:
`bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount ... under
Plan9 share "c" which is not mounted; create: RPC error -1: ensure user: ... already exists
unexpectedly`. There is no installer last line to quote because the installer never ran. Per the
PREFLIGHT block a failed install is a FINDING, not a STOP. The risk it guards did not arise: every
`git` call this run was PowerShell on the Windows host through Desktop Commander, zero through the
bridge, and both `index.lock` probes read False at the end of the run.

**status-sweep.ps1 ran, and its section 0 controls PASSED** - `gh CAN reach GitHub (saw merged PR
#1822)`, `node runs`. No `[BROKEN]` in section 0, so the report is usable.

**Host clocks.** [MEASURED] boot `2026-09-09T13:34:08Z`; now `2026-09-09T23:07:06Z`. Host is
Brisbane, UTC+10, so the local date led the UTC date all run.

**The watcher is alive NOW.** [MEASURED] node pid 13352, `CreationDate 2026-09-09T22:01:02Z`,
cmdline `node.exe --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`.
Resolved by command line, never by image name: 13 `node.exe` were running and exactly one was the
watcher. Wrapper alive (1). `ensure-watcher.log` tail `2026-09-09T23:05:05Z watcher alive, pid(s)
13352`. Rescan loop is ticking - the live daily log carries `verdict-archive sweep` at 22:56:05Z,
23:01:05Z and 23:06:05Z, five minutes apart, so this is not a frozen rescan.

**The live daily clone log was FOUND by name shape then mtime, never constructed.**
[MEASURED] `Get-ChildItem "$logDir\*" -Filter '*.log' | Where-Object { $_.BaseName -match
'^\d{4}-\d{2}-\d{2}$' } | Sort-Object LastWriteTimeUtc -Descending` -> `2026-09-10.log`, mtime
`2026-09-09T23:06:05Z`, 11894 B, 126 lines. The directory holds 45 `*.log`, five of which are NOT
daily-shaped (`supervisor.log`, two `supervisor.rot-*`, two `supervisor.crashed-*`) - the collision
DOCTRINE 9.5 records, avoided by filtering the shape first. The file is named for TOMORROW in UTC
terms, exactly as the 2026-09-06T23:0xZ correction predicts. `2026-09-08.log` and `2026-09-09.log`
do not exist (`Test-Path` -> False on both): the name is pinned at launch and never rolls.

**The reboot, and the gap.** [MEASURED] Last line of the previous log `2026-09-07.log`:
`[2026-09-09T13:29:29.572Z] [review] poll failed: gh pr list ... exited 3221226091 - will retry
next tick`. `3221226091` = `0xC000026B` (`STATUS_DLL_INIT_FAILED_LOGOFF`) - that is the shutdown
killing `gh`, not a `gh` defect. First line of the live log:
`[2026-09-10T08:01:00.5288289+10:00] PRE-FLIGHT: ...` = `2026-09-09T22:01:00Z`.

| | [MEASURED] |
|---|---|
| last watcher log line before the reboot | `2026-09-09T13:29:29Z` |
| `LastBootUpTime` | `2026-09-09T13:34:08Z` |
| `ensure-watcher.log` rows between 13:34:08Z and 22:00:45Z | **0** |
| keepalive `RELAUNCHED - wrapper pid 7536` | `2026-09-09T22:00:45Z` |
| watcher node pid 13352 `CreationDate` | `2026-09-09T22:01:02Z` |
| **watcher absent** | **8 h 26 m 54 s** |

POSITIVE control that the log is not merely quiet: the same file carries
`2026-09-09T13:05:03Z`, `13:15:03Z` and `13:25:03Z watcher alive, pid(s) 31660` immediately before
the gap, on the same 10-minute cadence it resumes at 22:07:09Z after it. The gap is an absence of
runs, not an absence of writing.

**Why nothing restarted it.** [MEASURED] `Get-ScheduledTask -TaskName 'PO Watcher Keepalive'`:
state `Ready`, `LastTaskResult 0`, action
`powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File
"C:\po-watcher\ensure-watcher.ps1"`. Two triggers and no boot trigger among them:
`MSFT_TaskLogonTrigger` (enabled, no repetition) and `MSFT_TaskDailyTrigger`
(`StartBoundary 2026-08-24T00:05:00+10:00`, `Repetition.Interval PT10M`, `Duration P1D`).
Principal: `UserId Marco`, **`LogonType Interactive`**, `RunLevel Limited`. `StartWhenAvailable
True`.

An `Interactive` principal cannot run without an interactive session, so after an unattended
reboot neither trigger can fire and the 10-minute repetition never starts. The relaunch timestamp
is the discriminator: `22:00:45Z` is a logon time, not `00:05` local and not a multiple of ten
minutes from it.

**Clone state.** [MEASURED] `git -C C:\po-watcher\ProjectOperations rev-parse --short HEAD` =
`f482d1a5` = its own `origin/main`; `rev-list --left-right --count origin/main...HEAD` = `0  0`.
No clone drift this run. The sweep's `dirty=4` resolves to `M docs/data-model/metadata-catalog.json`
plus three UNTRACKED review-lane outputs `docs/pr-reviews/pr-1824-review.md`, `pr-1825`, `pr-1826` -
i.e. the review lane's own product, not drift.

**Stash, the closed loop.** [MEASURED] clone `(git stash list).Count` = **70**; dev tree = **0**.
This launch's preflight added one: `PRE-FLIGHT: uncommitted TRACKED changes on branch 'main'.
Self-healing by stashing them`, over `apps/api/src/modules/admin-imports/admin-imports.module.ts`,
`sharepoint-legacy-copy.service.spec.ts`, `sharepoint-legacy-copy.service.ts` and
`docs/data-model/metadata-catalog.json`. Nothing pops.

**Board-busy gate, re-measured at the END of the run** (the verdict expires when it prints):
dev-tree `index.lock` False, clone `index.lock` False, `git` processes **0**, no `MERGE_HEAD` /
`rebase-merge` / `rebase-apply`. No stale-lock finding this run.

**Worktrees: 6 non-main.** Two are LIVE station worktrees (`docs-vmg-track` 27 min,
`sot-reconcile-20260909` 23 min) - not touched. Four classify orphaned; only one holds work:
`C:/po-vg`, age 8110 min (5.6 d), `git -C C:/po-vg status --porcelain` -> `?? scripts/pipeline/
check-pipeline-heartbeat.mjs`, branch `fix/no-rebase-while-checks-run` @ `23c91ba9`, and
`git ls-remote --heads origin fix/no-rebase-while-checks-run` returns EMPTY (never pushed).

**`failed/` has nothing new.** [MEASURED] 43 files, newest `rev-1746-ready.md` at
`2026-09-07T00:26:08Z`, which predates my last run (`00-03-machine-minder-2026-09-08-2303-...`).
Nothing to triage, no known-pattern hit, nothing parked, no usage-limit entry.

**Trunk: the sweep's `TRUNK IS RED` is true but misleading, and the short-SHA trap reproduced.**
[MEASURED] `gh run list --commit $(git rev-parse origin/main)` with the FULL 40-char sha
`f482d1a59323a9195e4a95b2bf701bca73e9bc99` returned **19** runs; the same query with the short
`f482d1a5` returned **0** - DOCTRINE 9.4's trap, live, this run. Of the 19: `CI` **success**,
`Deploy` **success**, `Tendering Browser Smoke` **success**, `CodeQL` **success**. Every failure is
`Pipeline heartbeat` (5) plus `Dependabot Updates` (1). **The product trunk is green; what is red is
the pipeline's own alarm.**

**The alarm's own words**, read from column 3 of `gh run view 34415408249 --log` per DOCTRINE 9.1:

> `[heartbeat] SILENT: NO station has reported for 40.1h (threshold 6h). Newest is station 00 at
> 2026-09-08T07:00:00Z. Either the scheduler is off, the machine is down, or the app is not
> running. If this was deliberate, declare it in docs/pipeline/pause.json.`

Failing on all 5 heartbeat runs since `2026-09-09T04:09:37Z`. `docs/pipeline/pause.json` does not
exist on `origin/main` or on disk, so this is not a declared pause.

**But the stations are NOT silent - the COLLECT is.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` lists breadcrumbs from 04 at 09-08 0210,
0610, 1011, 1411, 1811, 2210 and 09-09 0220, and from 03 at 09-08 2303 - and tags every one from
09-08 1011 onward `UNTRACKED - it reaches nobody until a board PR commits it`. My own last
breadcrumb is among them: `git ls-tree -r --name-only origin/main -- docs/pr-prompts` finds no
`00-03-machine-minder-2026-09-08` (POSITIVE control: the 09-07 one IS tracked, in `archive/`;
NEGATIVE control, a freshly minted needle, **0**).

**Station 00 is enabled and firing, and producing nothing.** [MEASURED] from the scheduled-tasks
MCP: `00-supervisor`, `enabled true`, cron `5 * * * *`, `lastRunAt 2026-09-09T23:08:49Z` - seven
minutes before this line was written. Yet its newest breadcrumb, tracked or on disk, is
`00-00-supervisor-2026-09-08-0700-...`, about **40 hours** old against an hourly cadence.
**[CANNOT MEASURE] why** - I can see that 00 fires and that it leaves no artifact; I cannot see
inside its runs from here, and guessing is exactly what DOCTRINE 7.1 forbids.

⚠️ Station 04 reached this same conclusion first, from the other side, and its report is one of the
untracked ones: `00-04-scanner-2026-09-08-2210-the-one-alarm-that-fires-blames-the-stations-when-
it-is-the-collect-that-stopped.md`. Its earlier `00-04-scanner-2026-09-08-0610-station-00-is-
disabled-so-no-breadcrumb-collects.md` is now partly SUPERSEDED: the task is enabled today.

**Station 03 cadence, re-measured.** MCP: `0 9 * * *`, daily, `lastRunAt 2026-09-09T23:01:42Z`,
`nextRunAt 2026-09-10T23:00:45Z`. The bootstrap still says "every 4 hours". The disagreement is the
open escalation `station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`, unchanged.

## WHAT CHANGED

**Nothing on the board, nothing on the machines.** This station is REPORT-ONLY and this run
repaired nothing, armed nothing, merged nothing, pruned nothing and killed nothing. The only write
was this breadcrumb.

## FINDINGS

### F1 - The keepalive is gated on an interactive logon, so an unattended reboot leaves the watcher dead until a human signs in. It cost 8 h 27 m today.

`PO Watcher Keepalive` has a logon trigger and a daily trigger, no boot trigger, and a principal of
`LogonType Interactive`. After the `2026-09-09T13:34:08Z` reboot the task could not run at all -
zero `ensure-watcher.log` rows for 8 h 27 m, against a 10-minute cadence that is dense on both
sides of the gap - and the watcher returned only when the logon trigger fired at `22:00:45Z`. The
queue was frozen for that entire window and nothing anywhere reported it; the one alarm that did
fire (F2) blamed the wrong thing.

This is not a one-off. Any unattended restart - Windows Update, a power event, a crash - reproduces
it exactly, and the downtime is however long it takes Marco to log in.

**Options, RULE 1 applied. This is the scheduled-task layer, which is Marco's; a station cannot
change it.**

**(a) COMPLETE AND ADDITIVE - add a boot trigger AND change the principal to run whether or not
the user is logged on.** In Task Scheduler: add `At startup` (with a 1-2 min delay so the network
and the disk are up), and set the principal to "Run whether user is logged on or not" with
"Run with highest privileges" if `ensure-watcher.ps1` needs it. Passes both halves: it fixes the
occurrence immediately AND every future unattended restart, and it damages no data - the keepalive
is idempotent (`MultipleInstances IgnoreNew`, and `ensure-watcher.ps1` already no-ops when the
watcher is alive, as its 10-minute "watcher alive" rows show). ⚠️ Two things to confirm before
committing: a non-interactive principal needs the stored password, and the watcher must not depend
on anything only an interactive desktop provides. That is a question for Marco, not an assumption
for me.

**(b) Add the boot trigger only, leave the principal Interactive.** Fails the FUTURE half: the task
still cannot run before a logon, so the boot trigger changes nothing on an unattended reboot. It
looks like a fix and is not one.

**(c) Leave it, and rely on a human noticing.** Fails the FUTURE half outright, and today shows the
noticing does not happen - the gap ran its full 8.5 hours unremarked.

**DISPOSITION: ESCALATED.** Marco owns the scheduled-task layer and option (a) turns on a
credential question only he can answer.

### F2 - The heartbeat alarm says the stations are silent. They are not; the collect stopped, and the alarm cannot tell the difference.

`Pipeline heartbeat` has failed on all 5 runs since `2026-09-09T04:09:37Z` with
`NO station has reported for 40.1h`. Measured against the actual disk, 03 reported at 09-08 2303
and 04 reported seven times between 09-08 0210 and 09-09 0220. Every one of those from 09-08 1011
onward is UNTRACKED, and the gate reads `origin/main`, so it cannot see them.

The gate is not wrong by its own contract - an uncommitted breadcrumb reaches nobody, which is
precisely why the station contract says so. It is wrong in its **attribution**, and the attribution
is what a reader acts on. Its three named suspects are "the scheduler is off, the machine is down,
or the app is not running"; all three are false right now (00 `enabled`, `lastRunAt`
`2026-09-09T23:08:49Z`; the machine is up; this run is proof the app runs). The true cause -
**00 fires hourly and commits nothing** - is not on its list, so the alarm sends its reader to look
at the stations that are working.

This is DOCTRINE 9.6 with a rota attached: an empty *tracked* set read as an empty world. It has
already cost something measurable. [MEASURED] the same `--freshness` run tags **11** breadcrumbs
UNTRACKED, across all three reporting stations - 03 (09-08 2303 and this one), 04 (09-08 1011,
1411, 1811, 2210 and 09-09 0220, 0612, 1010, 2202) and 05 (09-08 1411). Every station that reports
has been reporting into a channel that does not close, for 37 hours, and the newest of them
(04 at `2026-09-09T22:02Z`) is an hour old. The stations are not the failure; they are the evidence
that the collect is.

**DISPOSITION: ESCALATED.** Two things need Marco, and they are different:
1. **Why does 00 fire and leave nothing?** [CANNOT MEASURE] from here. Until it is answered, no
   station's report reaches anyone, which makes this the highest-value question on the board -
   including for F1, which otherwise sits in this file unread.
2. **The alarm's message should name the collect as a candidate cause** and distinguish "no
   breadcrumb was written" from "breadcrumbs were written and not committed" - it already has both
   facts available, since `check-breadcrumb.mjs --freshness` prints the `UNTRACKED` note. That is a
   `scripts/` change, outside 03's lane and outside 00's merge lane.

⚠️ Escalation only. I did NOT create `docs/pipeline/pause.json` to quiet the alarm: nothing here is
a deliberate pause, and declaring one would silence a true signal about a real gap.

### F3 - The clone's stash is at 70 and this launch fed it three `apps/api` source files.

DOCTRINE 9.2 records the launcher preflight stash as a closed loop; the instruction is to report
the count and its growth. Count is **70** (dev tree 0). What is worth saying beyond the number is
*what* went in this time: `admin-imports.module.ts`, `sharepoint-legacy-copy.service.ts` and its
spec - real API source, from the TFM-S11 area that merged as #1822 the day before. Nothing is lost
(stashes are never dropped) but nothing is examined either, and a stash of 70 is not a thing anyone
reads.

**DISPOSITION: DEFERRED.** Real, not now, and not mine - 03 may not `git` in the clone beyond
reading. It becomes URGENT if a stash entry is ever the only copy of work, which is the same shape
as F4. What would settle it cheaply: have the preflight log the stash SHA and file list to the
daily log so the loop is at least legible.

### F4 - `C:/po-vg` still holds one unpushed file, 5.6 days on.

`?? scripts/pipeline/check-pipeline-heartbeat.mjs` on branch `fix/no-rebase-while-checks-run`
@ `23c91ba9`, and `git ls-remote --heads origin` shows that branch was never pushed. Unchanged
since the open escalation `po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`.

⚠️ I checked whether this file is the cause of F2's failing workflow. **It is not** -
`check-pipeline-heartbeat.mjs`, its test, and `.github/workflows/pipeline-heartbeat.yml` are all
tracked on `origin/main` (POSITIVE control `status-sweep.ps1` found in the same query). The po-vg
copy is a stranded draft, not a missing dependency. Recording the negative because the coincidence
of names is exactly the kind of thing a later run would "discover" and act on.

**DISPOSITION: DEFERRED.** Already escalated and still true; nothing new this run, and pruning it
would discard the only copy - `git worktree remove` will refuse and `--force` would destroy it.

### F5 - The device-bridge git guard could not be installed, because the bridge itself would not start.

The Linux workspace failed to mount (`Plan9 share "c" which is not mounted`), so
`scripts/pipeline/vm-git-guard.sh` never ran and there is no installer output to quote. The script
is present in the repo (`Test-Path` -> True), so this is an environment failure, not a missing file.

**DISPOSITION: DEFERRED.** The guard exists to stop a VM-side `git` call orphaning a 0-byte
`index.lock`; with the bridge down, no VM-side call was possible, so the exposure this run was
**zero** and both `index.lock` probes read False at the end. It matters on the next run where the
bridge IS up and the guard is skipped for a different reason - which is why it is recorded rather
than dismissed. It is not a STOP, per the PREFLIGHT block's own instruction.

## WHAT I DID NOT DO

- **Did not restart, kill or relaunch anything.** The watcher is alive, its rescan loop is ticking
  on schedule, and 03 is report-only in any case. F1 is a configuration defect, not a wedged
  process, and restarting a healthy watcher would have measured nothing.
- **Did not touch the two LIVE station worktrees** (`docs-vmg-track`, `sot-reconcile-20260909`),
  nor prune the four orphaned ones. Pruning is a mutation and `C:/po-vg` holds uncommitted work.
- **Did not change the `PO Watcher Keepalive` task.** It lives in the scheduled-task layer, which
  no station may edit, and option (a) needs a credential decision from Marco.
- **Did not clear, drop or pop any stash**, and did not run any branch-changing `git` in the clone.
  Reads only.
- **Did not create `docs/pipeline/pause.json`.** See F2.
- **Did not clear any `[STALE]`-tagged `needs-marco/` file** that section 5 of the sweep flagged.
  Discharging escalations is not 03's lane.
- **Did not open a PR.** 03 has no PR authority. **This breadcrumb is UNTRACKED in the dev tree at
  `C:\ProjectOperations2\docs\pr-prompts\` and reaches nobody until a board PR commits it** - which
  is precisely the failure F2 describes, so it is likely to sit unread. That is stated here rather
  than assumed away.
- **Did not diagnose why Station 00 produces no breadcrumb.** [CANNOT MEASURE] from this station.
