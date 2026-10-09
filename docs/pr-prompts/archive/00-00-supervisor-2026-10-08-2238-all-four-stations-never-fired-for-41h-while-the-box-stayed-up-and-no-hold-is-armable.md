# Station 00 — Supervisor | 2026-10-08T22:38:06Z–2026-10-08T23:5xZ

## GROUND

```
UTC            2026-10-08T22:38:06Z
origin/main    375f4386            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 375f4386     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task file claimed station_doc_version: 1)
```

Doc version and bootstrap **AGREE** — this run was not restricted to read-only by the
mismatch clause.

Binding documents read **from `git show origin/main:<path>`** in the dev tree, not from the
working copy: `docs/pipeline/DOCTRINE.md` (core, in full), `docs/pipeline/stations/00-supervisor.md`
(core, in full), `docs/pipeline/STATION-CAPABILITIES.md` (in full). No REFERENCE section was
opened this run; no core line sent me to one.

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` returned
`2026-10-08T22:38:32Z` plus `git rev-parse origin/main` = `375f4386f3c1d7fd8fa6dc2cf8a01839b5772f8e`
on the first call, after ONE keyword `ToolSearch` for `desktop-commander`. **NOT BLIND.**

**Git guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit read from the installer itself with no pipeline appended:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
EXIT=2
```

Exit 2 is the outcome the station doc records as EXPECTED for a station: a FINDING, not a STOP.
No `git` was run through the device bridge against the Windows `.git` at any point in this run —
every `git`, `gh` and `.ps1` call was a `powershell.exe` call on the host.

**Status sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, generated
`2026-10-08 22:42:43Z`, 467 lines. Section 0 positive controls both PASS (`gh` reached GitHub,
saw merged #2264; `node` runs). Section 7 verdict: **SAFE TO ACT** — no board mutation in
progress, no recent remote activity, no live station worktrees. Re-measured immediately before
the only mutation this run made (below).

Relevant `[LIVE]` lines: OPEN PRs **1** (#2261, BEHIND, CI 13 pass / 2 fail, `do-not-merge`,
open 43 h); **WAITING ON MARCO: 1**; `main` CI on `375f4386` → 4 success / 0 failed
(**trunk green**); watcher node RUNNING pid 8848; **armed (`*-ready.md`) = 0**;
`needs-marco/` 54, `blocked/` 201; **board lease: free**; no build in flight;
`index.lock` interactive/clone = False/False; git processes touching our trees = 0.

### The 41-hour hole, and the control that says what caused it

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`, **exit 2**:

```
00  last 2026-10-07T05:14:00Z  41.5h ago  (cadence 1h + grace 0.5h)  MISSED
02  dispatch-only — no cadence to miss
03  last 2026-10-06T23:03:00Z  47.7h ago  (cadence 24h + grace 3h)   MISSED
04  last 2026-10-07T02:10:00Z  44.6h ago  (cadence 4h + grace 1h)    MISSED
05  last 2026-09-24T14:23:00Z  344.4h ago (cadence 24h + grace 3h)   MISSED
MISSED: 4 station(s) past cadence + grace
```

**All four. Not one.** Structure pass: 1 checked, 0 malformed.

[MEASURED] scheduled-tasks MCP, same minute: `00-supervisor` `5 * * * *` `lastRunAt
2026-10-08T22:38:06.925Z`; `04-scanner` `0 */4 * * *` `lastRunAt 2026-10-08T22:38:07.297Z`;
`05-sot-keeper` `10 0 * * *` `lastRunAt 2026-10-08T22:38:07.635Z`; `03-machine-minder`
`0 9 * * *` `lastRunAt 2026-10-06T23:02:55.018Z`, `nextRunAt 2026-10-08T23:02:45Z`;
`weekly-security-audit` `enabled: false` (unchanged since 2026-09-06). **Live enabled count:
FOUR**, as STATION-CAPABILITIES §1's 2026-09-15 correction records.

🔴 **Three stations carry `lastRunAt` inside 710 milliseconds of each other.** That is not three
independent crons landing together — an hourly `5 * * * *`, a 4-hourly `0 */4 * * *` and a daily
`10 0 * * *` cannot coincide to the millisecond. It is the signature of a **batch catch-up fire on
resume**.

[MEASURED] the session-directory census, which is the instrument DOCTRINE §9.5 names for
occurrences older than `lastRunAt`. Scanned at the **directory level with no name filter**, under
`…\local-agent-mode-sessions\9df6923b-…\6662b30d-…\` (1722 directories total), newest first:

```
2026-10-08T22:38:07.635Z  e8b11f9c      <- 05, this batch
2026-10-08T22:38:07.297Z  92b2ce5f      <- 04, this batch
2026-10-08T22:38:06.924Z  2aba14e5      <- 00, THIS RUN
2026-10-07T05:14:05.513Z  651a203c      <- last session before the hole
2026-10-07T04:14:04.980Z  66bece4f
2026-10-07T03:14:04.601Z  5c341624
2026-10-07T02:14:03.263Z  f40a42e7
2026-10-07T02:09:42.490Z  fca545bf
2026-10-07T01:14:03.036Z  a29d014b
2026-10-07T00:14:02.637Z  d8485034
2026-10-06T23:14:02.134Z  63ed70d5
2026-10-06T23:02:55.016Z  30aa0612
2026-10-06T22:14:01.315Z  3b3abd4d
2026-10-06T22:09:40.950Z  2712b3b4
2026-09-27T21:42:40.253Z  485bd7fb      <- and the PREVIOUS hole, 8.9 days wide
```

**Zero sessions were created between 2026-10-07T05:14:05Z and 2026-10-08T22:38:06Z — a hole
41.40 hours wide.** Before it, 00 fired on the hour, every hour, exactly as its cron says.

🔧 **The control that decides the classification.** [MEASURED]
`(Get-CimInstance Win32_OperatingSystem).LastBootUpTime` → `2026-10-05T22:18:52.682Z` UTC,
`UPTIME_HOURS=72.47` at `2026-10-08T22:46:58Z`. **The box did not reboot, sleep-cycle out of, or
otherwise leave the 41-hour window — it was up for the whole of it, and for 31 hours before it.**
So the FRESHNESS_ONE_CADENCE_V1 classification is **never fired**, for all four stations, and it
is not "the machine was down":

| station | occurrences lost in the hole | classification |
|---|---|---|
| 00 | 41 hourly occurrences | **never fired** |
| 04 | 10 four-hourly occurrences | **never fired** |
| 05 | 1 daily occurrence (on top of 11 already lost) | **never fired** |
| 03 | 1 daily occurrence (2026-10-07T23:02) | **never fired** |

[INFERRED] the scheduler process, not the box and not any one task, stopped dispatching and
resumed with a batch. Three tasks resuming inside 710 ms is the evidence; which component holds
the queue is **[CANNOT MEASURE]** from a station — the task store is Marco's layer
(STATION-CAPABILITIES §1).

🟢 **One thing the hole ENDED: Station 05's eleven-day silence.** [MEASURED] 05's `lastRunAt`
advanced from `2026-09-27T21:38:18Z` — byte-identical across five consecutive readings from
2026-10-06 to 2026-10-07 — to `2026-10-08T22:38:07.635Z`. The probe named in
`needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md` (read
`lastRunAt` after 05's occurrence) has therefore **fired, and advanced**. It advanced inside the
catch-up batch, not on its cron, so the task store's behaviour is unchanged; the escalation is
updated, not retired.

### The alarm was ringing the whole time, in a place with no reader

[MEASURED] `gh run list --workflow "Pipeline heartbeat" --limit 10`, all on head `375f4386`:

```
2026-10-08T18:42:39Z  failure  run=37826381004
2026-10-08T10:17:13Z  failure  run=37762466934
2026-10-08T00:52:29Z  failure  run=37710017220
2026-10-07T18:44:18Z  failure  run=37669120737
2026-10-07T10:03:31Z  SUCCESS  run=37604836905   <- POSITIVE control, same head
```

[MEASURED] `gh run view 37826381004 --log-failed`:

```
node scripts/pipeline/check-pipeline-heartbeat.mjs --hours "6"
[heartbeat] SILENT: NO station has reported for 37.5h (threshold 6h). Newest is station 00 at
2026-10-07T05:14:00Z. Either the scheduler is off, the machine is down, or the app is not running.
If this was deliberate, declare it in docs/pipeline/pause.json.
##[error]Process completed with exit code 1.
```

The detector is **sound, not broken** — the positive control is a `success` on the identical head
four hours before the first failure, so it can and does produce both readings. It has been
correct and loud for **28 hours** across four runs.

[MEASURED] what the sweep every station reads says about those four runs, in full:

```
[LIVE]    NOT trunk CI on this commit, excluded from the verdict above: 5 run(s), 4 failing
[LIVE]       Pipeline heartbeat: 5 run(s), 4 failing
```

And [MEASURED] `status-sweep.ps1:201-204` on `origin/main` shows its author already knew the
general trap and fixed the 2026-09-09 version of it:

```
# Reported on their OWN line, never folded into the verdict above. The genuine signal inside
# these is easy to lose in an aggregate: on 2026-09-09 five failing "Pipeline heartbeat" runs
# were carrying a real SILENT-stations alarm, and the aggregate count hid it rather than
# surfaced it. Excluding them from the verdict must not mean hiding them.
```

🔴 **So the finding is NOT "the sweep hides it" — that was fixed. It is one notch narrower and
still live: the per-workflow line carries a COUNT, for the one workflow whose entire payload is a
SENTENCE.** `git grep -n -i heartbeat origin/main -- scripts/pipeline/status-sweep.ps1` returns 14
hits, every one about the WATCHER's `heartbeat.log`; **zero** quote the CI heartbeat's
`[heartbeat] …` message. A reader gets `4 failing` under a heading that says *excluded from the
verdict above*, and the words "NO station has reported for 37.5h" appear nowhere in the 467-line
report. I nearly filed those four reds as scheduled-workflow noise myself on exactly that reading,
and only opened the log because `--freshness` had already returned exit 2.

### The board, and why nothing was armed

[MEASURED] `scripts/pipeline/triage-holds.ps1` (read-only; `--dequeue` never passed), **exit 0**,
both its own controls PASS — `GIT control: PASS` (read `origin/main:docs/pipeline/DOCTRINE.md`,
30282 chars) and `SPENT control: PASS` (lint exit 3 on the fixture):

```
TOTALS  spent=0 of 13 evaluated  gates-satisfied=0  still-gated=13  unreadable=0
        of 13 prompts (HOLD=13, ready=0, LOOPING=0)
```

Every one of the thirteen, with its reject code:

| prompt | reject |
|---|---|
| pr-524-rates-b-slice2-canonical | HUMAN_GATE_PRESENT |
| pr-nav-jobs-projects-merge | HUMAN_GATE_PRESENT |
| pr-queue-layout-sot-entry | HUMAN_GATE_PRESENT |
| pr-retire-tenderclientnote-s2 | HUMAN_GATE_PRESENT |
| pr-scopecards-s8b-azure-maps-travel | HUMAN_GATE_PRESENT |
| pr-sec-a2-email-codes-and-reset-links | HUMAN_GATE_PRESENT |
| pr-siteid-notnull-backfill | HUMAN_GATE_PRESENT |
| pr-vendor-invoice-ocr | HUMAN_GATE_PRESENT |
| pr-fv2-ai-digests | FILE_GATE_NOT_RELEASED |
| pr-fv2-output-channels | FILE_GATE_NOT_RELEASED |
| pr-rates-s11c-drop-legacy-tables | FILE_GATE_NOT_RELEASED |
| pr-tenant-mt4-s2-ownership-migration | FILE_GATE_NOT_RELEASED |
| pr-tipid-s3-retire-the-name-guard-for-an-id-check | GATE_NOT_RELEASED |

**`gates-satisfied=0`, so `NEVER_LIST_BEFORE_ARMING_V1` and the WAITING ON MARCO figure were
never reached: there was no candidate to apply them to.** The previous run (2026-10-07T05:14Z, F4)
deferred arming *pending F1's probe* and named "an empty board with a green trunk" as what would
make it urgent. That condition is now met — trunk IS green — and arming is still impossible, for a
different and harder reason: **zero of thirteen staged prompts have a satisfied gate.** Eight of
them are waiting on Marco personally. Station 04 reached `spent=0 of 13 / gates-satisfied=0 /
still-gated=13` independently in the same hour with its own instrument.

MARCO_QUEUE_LINE_V1 figures, copied for the record even though nothing was armed:
**WAITING ON MARCO: 1** open PR labelled `do-not-merge` (#2261, open 43 h); **armed: 0**.

### #2261

[MEASURED] `gh pr view 2261`: `state=OPEN mergeState=BEHIND head=a5a3d9bc draft=False
labels=do-not-merge`. [MEASURED] `gh pr checks 2261`, the two non-pass:

```
PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)   FAILURE
Approval receipt (CP-26)                                 FAILURE
```

Untouched. The label is Marco's to remove; `Assert-SmokedOrEscalate` would refuse it anyway on two
failing required checks; and no receipt form is open to a station, because
`scripts/pipeline/pipeline-lib.ps1` is the first entry on `instrument-lane.json`'s NEVER-LIST.
Already Marco's, in
`needs-marco/2261-pipeline-lib-fix-needs-marcos-release-and-the-stager-never-checked-the-never-list-2026-10-07.md`.

### F1's corrected probe, which this run existed to read

The 2026-10-07T05:14Z breadcrumb's own CORRECTION replaced F1's falsifying probe: read the
**push-triggered** `Tendering Browser Smoke` on `main` for #2264's merge commit, not #2264's
checks.

[MEASURED] `gh pr view 2264 --json mergeCommit,mergedAt,state` → `state=MERGED
mergedAt=2026-10-07T05:35:09Z mergeCommit=375f4386f3c1d7fd8fa6dc2cf8a01839b5772f8e` — the merge
commit **is** current `origin/main`.

[MEASURED] `gh run list --branch main --workflow "Tendering Browser Smoke" --limit 6`:

```
2026-10-07T05:35:11Z  push  success    head=375f4386  run=37577042338   <- THE THIRD SAMPLE
2026-10-07T04:25:22Z  push  failure    head=7993d006  run=37571374467
2026-10-07T03:36:11Z  push  success    head=4d46def4  run=37567510809
2026-10-07T02:29:11Z  push  success    head=83470c08  run=37562200450
2026-10-07T01:40:17Z  push  success    head=500e07f3  run=37558254740
2026-10-07T01:34:26Z  push  cancelled  head=35cca04d  run=37557777224
```

[MEASURED] cross-checked from the other side: `gh run list --commit 375f4386…` lists
`Tendering Browser Smoke  event=push  success  run=37577042338` alongside `CI`, `CodeQL` and
`Deploy`, all `success`.

**The probe fell GREEN.** The breadcrumb's own stated reading for that outcome: *"the two reds were
transient; F1 is answered and the `Customise dashboard` dialog lead is parked, not closed."* One
failure (`7993d006`) sits between a success before it and a success after it, on app code that had
not moved in fourteen commits.

### The §9.1 and §9.3 traps, both hit this run

[MEASURED] a `gh … --json … | ConvertFrom-Json | ForEach-Object` pipeline printed
`System.Object[]  System.Object[]` for every field — DOCTRINE §7 standing guard 8, the array
collapsing on the pipe. It **exited 0** and printed well-formed-looking output. Cure applied:
assign-then-`foreach`, which is what every reading quoted above was taken with.

[MEASURED] `git show origin/main:scripts/pipeline/status-sweep.ps1 > file.ps1` followed by
`Select-String` returned **zero hits for `heartbeat`** in a file that contains fourteen — §9.3's
`>` writes UTF-16LE. §9.6 did not fire, because an empty match set is a perfectly well-formed
result. Cure applied: `git grep -n … origin/main -- <path>`, which moves bytes.

🔧 **And one instrument-map correction worth carrying forward: DOCTRINE §9.5's session-directory
cure is now a level short.** It says the directory name changed 2026-09-15 to the first 8 hex
characters and to *"scan at the directory level with no name filter"*. [MEASURED] the sessions are
now nested **two levels deeper** — `local-agent-mode-sessions\<project-uuid>\<uuid>\<8hex>` — so
`Get-ChildItem -Recurse -Depth 1` with the correct no-name-filter and a correct date predicate
returned **zero rows**, and the directory root itself lists only two entries
(`9df6923b-…` and `skills-plugin`). A run that stopped there would have reported "no sessions
created since 2026-10-06", i.e. the exact opposite of the truth, with no error. Positive control:
re-scanned at the right level → 1722 directories, including this run's own `2aba14e5`.

### Dev-tree state inherited from other actors

[MEASURED] `git status --porcelain` in `C:\ProjectOperations2`:

```
 M docs/pipeline/sweep-rotation.json
 M docs/pr-prompts/.arming-log.txt
 D docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md
?? docs/pr-prompts/00-04-scanner-2026-10-08-2238-gate-liveness-tipid-s3-first-machine-gate-is-always-true.md
?? docs/pr-reviews/pr-21xx…pr-2260-review.md  (21 files)
?? .codex/, AGENTS.md, Claude Design/… (6 paths)
```

The `D` is **arming residue, not damage.** [MEASURED] `.arming-log.txt` tail:
`2026-10-07T02:30:35Z  ARMED  pr-gitpush-worktree-mandatory  escalates=true  actor=station-00`,
and the consumed prompt is at `docs/pr-prompts/processed/pr-gitpush-worktree-mandatory-ready.md`
with its `.log`. So the deletion is committed, never restored — DOCTRINE §9.2 forbids
`git checkout -- <path>` here precisely because it resurrects consumed prompts.

`sweep-rotation.json` was advanced by Station 04 this run
(`next-sweep.mjs --advance` → `last_index=0 last_run_utc=2026-10-08T22:38:44Z`); the script itself
prints *"LEFT DIRTY: name this file in your breadcrumb. Station 00 commits it"*. Committed here.

## WHAT CHANGED

**On the board: nothing armed, nothing disarmed, nothing merged, no label touched, no `/sot/` file
touched, no scheduled task touched.**

One mutation, taken under the four BOARD DRIVING conditions:

1. **Board lease TAKEN.** [MEASURED] `Enter-BoardLease -Actor station-00.sched2238 -Reason
   board-pr-collect-2026-10-08-2238` → `LEASE_ACQUIRED=True` (it was `free` in the sweep).
2. **Re-measured immediately before mutating**, not from the 22:42Z sweep:
   `index.lock dev = False`, `index.lock clone = False`, `git processes = 0`.
3. **Isolated worktree off `origin/main` on the Windows FS**, via the sanctioned script:
   `new-worktree.ps1 -Slug st00-1009 -Branch docs/collect-2026-10-08-2238` →
   `C:\PR-Master\worktrees\st00-1009`, `HEAD is now at 375f4386`. Never the dev tree, never
   `C:\po-watcher`.
4. **Read back** — the PR head, the branch SHA and the merge state are recorded in this run's
   chat report and re-asserted after the push.

Inside that worktree, this board PR:

- **adds** this breadcrumb;
- **archives** `docs/pr-prompts/00-00-supervisor-2026-10-07-0514-trunk-red-first-domino-is-the-customise-dashboard-dialog-not-closing.md`
  to `docs/pr-prompts/archive/` by `git mv`, every finding dispositioned below;
- **commits the deletion** of `docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md`
  (arming residue, consumed to `processed/`);
- **commits** `docs/pipeline/sweep-rotation.json` and `docs/pr-prompts/.arming-log.txt` as
  Station 04 and `arm-prompt.ps1` left them;
- **updates two tracked escalations** in `needs-marco/` rather than opening new files
  (DOCTRINE §10.5 — one identity for an artifact's whole life):
  `stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md` and
  `five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`.
  Both confirmed TRACKED by `git ls-files -- docs/pr-prompts/needs-marco/` first, as the station
  contract requires before appending to anything under that gitignored-by-rule folder;
- **stages** `docs/pr-prompts/pr-sweep-quote-the-heartbeat-alarm-HOLD.md` (F3's fix), as a
  `-HOLD`, not armed — a brand-new file is untracked, and arming is a `git mv` of a **tracked**
  `-HOLD.md`, never the creation of a `-ready.md`.

**Not committed, deliberately:** Station 04's breadcrumb
`00-04-scanner-2026-10-08-2238-gate-liveness-tipid-s3-first-machine-gate-is-always-true.md`.
[MEASURED] it ends at `## WHAT CHANGED` with no `## FINDINGS` and no `## WHAT I DID NOT DO` —
04 was still writing it (its own header says `…–2026-10-08T23:3xZ`). Committing it would put a
file `check-breadcrumb.mjs` must call malformed onto `main`. It stays in the dev tree for the next
run to collect.

## FINDINGS

### F1 — The previous run's corrected probe fired, and it came back GREEN. Trunk is green; the "Customise dashboard" dialog lead is parked.

Measurements under *F1's corrected probe* above. #2264's merge commit is `375f4386`, which is
current `origin/main`; the push-triggered `Tendering Browser Smoke` on it (`run=37577042338`) is
`success`, and so are `CI`, `CodeQL` and `Deploy` on the same head. The single `failure`
(`7993d006`, `run=37571374467`) is bracketed by a success before it and a success after it, on app
code unchanged for fourteen commits — one red in twenty-one runs of this workflow on `main`.

The predecessor's own stated reading for a green third sample is binding here: **parked, not
closed.** The Playwright artifact's first-domino diagnosis (the `Customise dashboard` dialog
failing to dismiss, with the three `nav link … not visible` failures as its symptom) stands as the
recorded cause **if** this ever recurs; nothing was changed, and nothing should be, because the
only fix writable without knowing whether the dialog is an app defect would be a mask
(DOCTRINE §8.2).

**DISPOSITION: ACTIONED** — the probe the 2026-10-07T05:14Z breadcrumb left for its successor was
executed and recorded. Re-opens on the next failure of those four tests in
`tests/e2e/pr-acceptance/batch1-dashboards.spec.ts`, at which point it is reproducible rather than
transient and the fix belongs against the dialog's dismissal path.

### F2 — All four stations never fired for 41.4 hours while the box stayed up for 72. The scheduler, not the machine and not any one task.

Measurements under *The 41-hour hole* above. Classification under FRESHNESS_ONE_CADENCE_V1 is
**never fired** for all four — the hole in the session census is total, and the host-uptime control
(`LastBootUpTime 2026-10-05T22:18:52Z`, uptime 72.47 h) removes "the machine was down" as the
cause. 52 scheduled occurrences were lost. Three tasks then resumed inside 710 ms, which is a
batch catch-up, not three crons.

This is a **recurrence**, and the shape is already on Marco's desk twice:
`needs-marco/scheduled-task-runner-stopped-for-77h-while-the-box-stayed-up-2026-09-21.md` is the
same defect with a bigger number, and
`needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md` is its
current home. **No new file was opened** (DOCTRINE §10.5); the tracked one is updated in this PR
with the three things that are genuinely new rather than a repeat of what it already holds:

1. it is **all four** stations now, not 00/03/05;
2. the **host-uptime control**, which is what makes "never fired" a measurement rather than an
   inference;
3. **05's silence ended inside the catch-up batch** — `lastRunAt` advanced off
   `2026-09-27T21:38:18Z` after five identical readings. The file's named probe has fired and
   advanced, so its 05 half is answered; the file is NOT retired, because advancing inside a
   catch-up is not the cron working.

Station 00 may not enable, disable, run, re-run or edit a scheduled task on a MISSED reading
(DOCTRINE §7; the station doc states it as forbidden on this reading alone). The task store is
Marco's layer. The station doc's own trigger is met and exceeded: *"if a station has never fired on
two consecutive occurrences, escalate"* — 00 lost 41 consecutive occurrences.

**DISPOSITION: ESCALATED** — open with Marco in the tracked file named above, updated in this PR.
Named probe for the next run, unchanged in kind but now cheap: read all four `lastRunAt` values
from the scheduled-tasks MCP and the newest session-directory `CreationTimeUtc`. If 00's next two
hourly occurrences (`nextRunAt 2026-10-08T23:13:52Z`, then ~00:13Z) both produce a session
directory, the scheduler resumed and this is an intermittent stall; if they do not, it stalled
again immediately and the number in the escalation's title should be updated rather than a third
file opened.

### F3 — The one detector that catches F2 reports a COUNT where its whole payload is a SENTENCE, and it is in Station 00's own instrument lane.

Measurements under *The alarm was ringing* above. `check-pipeline-heartbeat.mjs` was right and loud
for 28 hours across four scheduled runs, with a positive control (`success`, same head, four hours
earlier) proving it can read both ways. `status-sweep.ps1` surfaces those four as
`Pipeline heartbeat: 5 run(s), 4 failing`, on its own line under the heading *NOT trunk CI on this
commit, excluded from the verdict above* — and `git grep` confirms the words
`NO station has reported for 37.5h` appear nowhere in the 467-line report every station reads.

This is **not** the 2026-09-09 defect: `status-sweep.ps1:201-204` records that one and the
per-workflow line is its fix. It is one notch narrower — the fix made the count visible, and the
alarm's payload is not a count.

🔧 **Complete-and-additive fix, and it is mergeable by a station.** [MEASURED]
`git show origin/main:scripts/pipeline/instrument-lane.json` lists
`scripts/pipeline/status-sweep.ps1` as the **first entry** in `files`, and the NEVER-LIST does not
name it. So a PR touching only that file is `IN_LANE` under INSTRUMENT_LANE_V1 and Station 00 may
merge it once CI is green and a fresh MERGE verdict exists for the head — no Marco, no label
removal. (Contrast #2261, whose single file `pipeline-lib.ps1` is the first NEVER-LIST entry, which
is why it has sat 43 hours with no receipt form open to any station.)

Staged in this PR as `docs/pr-prompts/pr-sweep-quote-the-heartbeat-alarm-HOLD.md`, premise
`! grep -q "HEARTBEAT_ALARM_TEXT_V1" scripts/pipeline/status-sweep.ps1`: when an excluded workflow
named `Pipeline heartbeat` has failures, read the newest failing run's `[heartbeat]` line and print
it as its own `[LIVE]` alarm, rather than only counting it. Additive — no existing line is removed
or re-worded, so no reader who relies on the count loses it.

**DISPOSITION: ACTIONED** — the prompt is staged in this PR with an executable premise and an
in-lane scope of one file. It is **not armed**: arming is a `git mv` of a tracked `-HOLD.md`, and
this file is untracked until this PR merges. The next Station 00 run arms it, which is one
`arm-prompt.ps1` call against a satisfied-by-construction gate.

### F4 — Trunk is green and the board is empty, and arming is impossible for a harder reason than the previous run expected: zero of thirteen staged prompts have a satisfied gate.

Measurements under *The board* above: `triage-holds.ps1` exit 0, both controls PASS,
`spent=0 of 13  gates-satisfied=0  still-gated=13  unreadable=0`. Eight are
`HUMAN_GATE_PRESENT`, four `FILE_GATE_NOT_RELEASED`, one `GATE_NOT_RELEASED`. Station 04 reached
the identical figures independently in the same hour.

The previous run's F4 deferred arming pending F1 and named *"an empty board with a green trunk"* as
the urgency trigger. **That trigger is now pulled** — F1 is green — and the answer is still
nothing, which makes this a different finding rather than a repeat deferral: the constraint is not
Station 00's judgement about trunk, it is that **eight of the thirteen need Marco personally** and
the other five are waiting on predecessors that cannot land while the board is empty. The board is
empty **by gate**, not by oversight, and no arming decision by any station can change that.

The existing tracked escalation
`needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`
is this exact question, filed when it was five holds and 21 days. It is **eight holds and 36 days**
now. Updated in this PR with the new count, the per-prompt reject codes, and the fact that trunk
being green has removed the only other explanation.

**DISPOSITION: ESCALATED** — open with Marco in the tracked file named above, updated in this PR
with current figures. Named probe: `triage-holds.ps1`'s `gates-satisfied` count. The moment it is
non-zero, arming is Station 00's again and this escalation narrows or discharges.

### F5 — 30 orphaned worktrees and 2 registry escapees, several holding unpushed commits; the dispatch to Station 03 has had no actor for two days.

[MEASURED] sweep section 2 `[LIVE]`: three orphaned worktrees named with their held commits —
`C:/po-wt/board-lease-wording` (1 commit, no remote branch), `C:/po-wt/fix-2228` (2 commits),
`C:/po-wt/stage-prnum` (1 commit) — plus `REGISTRY-ESCAPEE: C:\PR-Master\worktrees\bootstrap-check`
(0 KB, age 8596 min, `.lock=False`) and `REGISTRY-ESCAPEE: C:\po-wt\dispatch-register-v1` (0 KB,
age 8702 min, `.lock=False`). The 2026-10-07T05:14Z breadcrumb's F3 measured **30** non-main
worktrees, several holding 15–21 commits on no remote branch, and DISPATCHED the lot to Station 03.

[MEASURED] Station 03 `lastRunAt 2026-10-06T23:02:55Z` — it has not run since **before** that
dispatch was written, because it is one of F2's never-fired stations. Its `nextRunAt` is
`2026-10-08T23:02:45Z`, roughly twenty minutes after this run's sweep, so the dispatch may finally
have an actor tonight — which is itself conditional on F2 not recurring.

Pruning worktrees is Station 03's lane ("Repair the machines" — 00 dispatches, LL-38). I did not
prune, did not `--force`, and did not touch `C:\po-watcher`. Note that this run's own worktree
`C:\PR-Master\worktrees\st00-1009` is live and is torn down at the end of this run; it must not be
counted as an orphan by whoever reads the next sweep.

**DISPOSITION: DISPATCHED to Station 03 — machine-minder**, re-stated because the first dispatch
never reached a running station. Hand-over in one line: classify all 30 by liveness; prune only
those with **no** unpushed commits and **no** dirty files; for `board-lease-wording`, `fix-2228`,
`stage-prnum`, `sup-cwd-paths`, `fv2drop`, `s8h`, `rcpt-2183` and `sweep-dirty-untracked-v1`,
push or preserve the commits first and report what you preserved; confirm each against
`gh pr list --head <branch> --state merged` before calling a branch dead (a squash-merged branch
shows here too); never `--force`. The two 0 KB registry escapees with no `.lock` are the cheapest
to confirm dead.

### F6 — DOCTRINE §9.5's session-directory cure is one directory level short, and the wrong answer it produces is a confident "no sessions".

Measurements under *The §9.1 and §9.3 traps* above. §9.5 says the session directory name changed
2026-09-15 to the first 8 hex characters and to scan *"at the directory level with no name
filter"*. The path is now `local-agent-mode-sessions\<project-uuid>\<uuid>\<8hex>`, two levels
deeper, so a correct-by-the-letter scan with `-Recurse -Depth 1` returned **zero** rows while 1722
session directories existed, and the root lists only `9df6923b-…` and `skills-plugin`. There is no
error, and §9.6 does not fire, because an empty result set is well-formed. The instrument this
breaks is the only one that can see occurrences older than `lastRunAt` — i.e. precisely the
instrument F2 depends on.

Not fixed this run, and the reason is mechanical rather than a judgement: §9.5 sits inside the
hash-gated `CANONICAL-BLOCK: instruments v2`, which `lint-station.mjs` fails on any edit unless the
hash is re-recorded, and the block's own comment requires shipping all seven station docs together.
`docs/` is also on `instrument-lane.json`'s NEVER-LIST, so the resulting PR would need Marco
regardless. That is a real piece of work, not a one-line edit, and doing it badly in the same PR as
F2's escalation would put a canonical-block hash change behind a board PR.

**DISPOSITION: DEFERRED** — the cure, stated precisely so it can be lifted verbatim: §9.5's bullet
should read *scan the session store recursively at depth, with no name filter, and verify against a
known-present session id from the current run* — the positive control is the fix, not the depth
number, because the depth has now changed twice. What makes it urgent: the next time a station
needs the session census to classify a MISSED reading, which on F2's evidence is the next run.

## WHAT I DID NOT DO

- **Did not merge anything.** The only open PR is #2261, which carries `do-not-merge`.
  `Assert-SmokedOrEscalate` was not called on it and would refuse it anyway: two required checks
  are FAILURE on the current head `a5a3d9bc`.
- **Did not remove a `do-not-merge` label.** Only Marco removes it.
- **Did not call `gh pr update-branch` on #2261**, although it reads `BEHIND`. The watcher's
  auto-update timer is OFF by default (UPDATE_AT_MERGE_TIME_V1) and a stray update-branch costs a
  full CI rebuild for a PR that cannot merge.
- **Did not write a receipt for #2261.** Neither form is open to a station: `authority: standing`
  has no lane admitting `scripts/pipeline/pipeline-lib.ps1` (first entry on the NEVER-LIST), and
  `authority: personal` requires Marco's release.
- **Did not arm anything.** Not a judgement call this run: `gates-satisfied=0` of 13 (F4).
- **Did not create a `-ready.md`.** `.gitignore:75` swallows it; arming is a `git mv` of a tracked
  `-HOLD.md`.
- **Did not open a new `needs-marco/` file.** Both F2 and F4 have tracked homes; DOCTRINE §10.5.
- **Did not retire or discharge any escalation.** 05's `lastRunAt` advancing answers one probe
  inside a file whose premise is still live; retiring it on that would hand Marco back a defect
  that only paused. No `[STALE]` row appeared in sweep section 5 for a merged PR.
- **Did not commit Station 04's breadcrumb.** It was mid-write and has no `## FINDINGS`.
- **Did not touch the scheduled-task store.** Not enabled, not disabled, not run, not re-run, not
  edited — forbidden on a MISSED reading alone.
- **Did not prune a worktree, clear a lock, or restart the watcher.** Station 03's lane,
  dispatched in F5. Both `index.lock` readings were False, so nothing needed clearing; the watcher
  node is RUNNING pid 8848 and the stale heartbeat age is the documented idle reading, not wedged.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard reported
  INERT (exit 2) and an inert guard is not a licence; every git call was on the host.
- **Did not `git checkout -- <path>`, `reset --hard`, `stash pop` or `clean` in the dev tree.**
  The `D` on `pr-gitpush-worktree-mandatory-HOLD.md` is consumed-prompt residue and was committed,
  not restored.
- **Did not commit on `main` in the dev tree.** Everything went through the isolated worktree
  `C:\PR-Master\worktrees\st00-1009` and a PR.
- **Did not edit `/sot/`.** Station 05's lane, absolutely — and 05 is running concurrently with
  this session.
- **Did not do 03/04/05's work myself** (LL-38). 04 and 05 were mid-run in the same minute as this
  run; the board lease was taken before the one mutation and released after it.
- **Did not touch Azure / Entra / SharePoint.** Nothing in this run came near them.

## FOR MARCO

Two questions, both already in `needs-marco/` and updated in this PR rather than re-filed. The
complete-and-additive option is first in each (RULE 1).

1. **Nothing has run for 41 hours, and it is not the machine.** Your box was up for 72 hours
   straight; the scheduler lost 52 occurrences across all four stations and then fired three of
   them inside 710 milliseconds on resume. This is the third occurrence of the same shape
   (77 h on 2026-09-21, 9–11 days on 2026-10-06, 41 h now). **The complete-and-additive option is
   to make the stall visible where you already look** — the CI heartbeat detector already catches
   it correctly and has been failing loudly for 28 hours, but only inside a scheduled GitHub
   Actions run; F3's staged fix pulls its sentence into the sweep, and a notification channel you
   actually read would close it completely. The alternative — waiting and watching `lastRunAt` —
   fails the "future" half of RULE 1, because it is exactly what the last two occurrences did.
   `needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`.
2. **Trunk is green, the board is empty, and no station can start work.** Zero of thirteen staged
   prompts have a satisfied gate; **eight are waiting on you personally**
   (`pr-524-rates-b-slice2-canonical`, `pr-nav-jobs-projects-merge`, `pr-queue-layout-sot-entry`,
   `pr-retire-tenderclientnote-s2`, `pr-scopecards-s8b-azure-maps-travel`,
   `pr-sec-a2-email-codes-and-reset-links`, `pr-siteid-notnull-backfill`, `pr-vendor-invoice-ocr`).
   Releasing any ONE of them restarts the board.
   `needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`.

And one standing item, unchanged: **#2261** is green on 13 of 15 and held by its `do-not-merge`
label, which is the gate working. Only you can release it, and no station can write its CP-26
receipt because its single file is the first entry on the instrument-lane NEVER-LIST.
`needs-marco/2261-pipeline-lib-fix-needs-marcos-release-and-the-stager-never-checked-the-never-list-2026-10-07.md`.
