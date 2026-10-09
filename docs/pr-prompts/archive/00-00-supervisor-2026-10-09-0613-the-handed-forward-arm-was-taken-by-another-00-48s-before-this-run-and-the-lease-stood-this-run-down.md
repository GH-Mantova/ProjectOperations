# Station 00 - Supervisor | 2026-10-09T06:13Z-2026-10-09T06:2xZ

## GROUND

```
UTC            2026-10-09T06:14:10Z
origin/main    42c09453            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 42c09453      C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter, read from origin/main)
bootstrap      1                   (station_doc_version: 1)
```

Doc version and bootstrap AGREE, so this run is not read-only on that count. It is nevertheless
**COLLECT-ONLY**, on a measurement: the board lease is held by another actor (F27/F28 below) and
`status-sweep.ps1` section 7 returned **CAUTION ... Stand down; COLLECT only**.

**NOT BLIND.** Desktop Commander loaded on ONE keyword `ToolSearch` for `desktop-commander`
(BOOTSTRAP_PREFLIGHT_V1 - ids taken from what the search reported, never assumed). `start_process`
with shell `powershell.exe` returned on the first call:
`2026-10-09T16:14:10.5570767+10:00` / `2026-10-09T06:14:10.5590825Z` / `LAPTOP-E6NHU4E4`.
No BOOTSTRAP_CONNECT_RETRY_V1 retry was needed.

**Git guard, quoted as the contract requires.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`. Last line:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/hopeful-beautiful-mayer/.local/bin:$PATH" git <args>
```

**EXIT CODE 2** - `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your
shell.` This is the EXPECTED station outcome per the preflight table: a FINDING, not a STOP. The
exit code read is the INSTALLER's own, not a pipeline's (no `tail`/`Select-Object` was appended).
The device-bridge git ban was therefore REMEMBERED, not mechanical, for this whole run, and it was
kept: no `git` ran through the Linux bridge against any mount. Every `git` and `gh` call below ran
in a `powershell.exe` shell on the Windows host.

## WHAT I MEASURED

### The three binding reads, from `origin/main`, in the dev tree

[MEASURED] `git fetch origin` then `git show origin/main:<path>` in `C:\ProjectOperations2` (never
the watcher clone, never the working copy at those paths) for
`docs/pipeline/stations/00-supervisor.md` (31785 bytes), `docs/pipeline/DOCTRINE.md` (30719) and
`docs/pipeline/STATION-CAPABILITIES.md` (48498), all three read in full. No piped
`hash-object --stdin` comparison was made anywhere in this run (DOCTRINE 9.2).

### Freshness - CLEAN, and 04 is mid-run rather than late

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` -> `CLEAN`, exit **0**.
Structure pass: 1 checked, 0 malformed; the single root breadcrumb `...-0515-...` ADMITs.

```
00  last 2026-10-09T05:15:00Z  1.0h ago  (cadence 1h + grace 0.5h)   ok
02  dispatch-only - no cadence to miss
03  last 2026-10-08T23:06:00Z  7.2h ago  (cadence 24h + grace 3h)    ok
04  last 2026-10-09T02:10:00Z  4.1h ago  (cadence 4h + grace 1h)     ok
05  last 2026-10-08T22:38:00Z  7.6h ago  (cadence 24h + grace 3h)    ok
```

[MEASURED] `list_scheduled_tasks` (scheduled-tasks MCP), the only live schedule - four ENABLED
tasks, never "the five":

| task | cron | lastRunAt | nextRunAt | enabled |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 2026-10-09T06:13:53Z (this run) | 07:13:52Z | true |
| `03-machine-minder` | `0 9 * * *` | 2026-10-08T23:06:07Z | 2026-10-09T23:02:45Z | true |
| `04-scanner` | `0 */4 * * *` | 2026-10-09T06:09:32Z | 10:09:31Z | true |
| `05-sot-keeper` | `10 0 * * *` | 2026-10-08T22:38:07Z | 14:22:37Z | true |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32:44Z | - | **false** |

Crossing the freshness table against `lastRunAt`: **04's `lastRunAt` is 06:09:32Z and its newest
breadcrumb is 02:10Z**, i.e. `lastRunAt` fresh, no breadcrumb yet. That is the table's
*"mid-run - NOT a defect"* row, and it is corroborated independently by F29's measurement that 04
has already written its rotation advance into the dev tree in the last nine minutes. No station is
MISSED this run, so no MISSED classification is owed and no scheduled task was touched.

### The board, from `scripts/pipeline/status-sweep.ps1` (read streamed, to completion)

[MEASURED] section 0 positive controls both PASS - `gh CAN reach GitHub (saw merged PR #2277)`,
`node runs`. No `[BROKEN]`. `SWEEP COMPLETE 2026-10-09 06:14:47Z`, `exit code 0 (runtime: 209.80s)`,
**470 lines, all seven sections**. Read streamed with repeated `read_process_output` calls using
explicit offsets until the process reported complete - F25's narrowing of F19 holds for a second
consecutive run, and a single read reporting `0 remaining` was again not a finished sweep.

[MEASURED] **section 7 VERDICT: `CAUTION: station-00.interactive holds the board
(arm:pr-sweep-quote-the-heartbeat-alarm, 2 min old, expires in 25 min). Stand down; COLLECT only.`**

[MEASURED] section 1: **OPEN PRs: 1** - `#2261` BLOCKED, `CI: 13 pass / 0 fail / 2 pending`.
**WAITING ON MARCO: 0** open PRs labelled `do-not-merge`. Oldest open PR #2261, open **51h**.
`main` CI on `42c09453`: 4 success / 0 failed / 0 running (trunk green). Merged since the last
cycle: **#2276** (05:33Z) and **#2277** (05:39Z), the 0515 cycle's board PR and its correction.

[MEASURED] section 3 safe-to-act inputs: `git index.lock interactive/clone: False / False`; git
processes touching our trees **0**; watcher `node` RUNNING pid 8848 with the auto-restart wrapper
alive; headless claude-code sessions **2** (includes this chat - informational, not a blocker);
**watcher build: BUILD IN FLIGHT: `pr-sweep-quote-the-heartbeat-alarm-ready.md` (tick 0.2 min
old)**; **board lease: `station-00.interactive` reason=`arm:pr-sweep-quote-the-heartbeat-alarm`,
2 min old, expires 2026-10-09T06:43:05Z**; no PR touched on GitHub in the last 2 min.

[MEASURED] section 4 queue: **armed (`*-ready.md`): 1 - `pr-sweep-quote-the-heartbeat-alarm-ready.md`**.
`needs-marco/` 53, `no-pr-opened/` 111, `failed/` 80, `blocked/` 204. Section 6 backlog gates:
`ready=1 needs-marco=2 blocked=4 broken=0`. Section 5 produced 53 `needs-marco/` rows and
**not one `[STALE]` line** - every PR it cross-checked was cited as evidence rather than as a
premise, which the sweep's own text says clears nothing; 36 rows say section 5 CANNOT decide
staleness. One `[CANNOT MEASURE]`: no station summary younger than 3 days (freshest
`queue-watch-state.md`, 09-23, 16 days old; body deliberately not quoted).

**MARCO_QUEUE_LINE_V1, both figures:** armed = **1** (a real prompt, not a `rev-<n>` review job),
WAITING ON MARCO = **0 open PRs labelled `do-not-merge`**. No arm was made by this run, so these are
recorded as the state this run inherited, not as the consequence of a decision it took.

### The arm the 0515 breadcrumb handed forward - already taken, by someone else

[MEASURED] `docs/pr-prompts/.arming-log.txt`, newest line, as a `git diff` hunk (it is locally
modified, not yet committed):

```
+2026-10-09T06:13:05Z  ARMED  pr-sweep-quote-the-heartbeat-alarm  escalates=false
   actor=station-00.interactive  by=Marco@LAPTOP-E6NHU4E4  pid=35936  caller=node.exe:40912
```

[MEASURED] `C:\ProjectOperations2\.git\po-board-lease.json`, read directly:

```json
{"actor":"station-00.interactive","reason":"arm:pr-sweep-quote-the-heartbeat-alarm","pid":35936,
 "acquiredAt":"2026-10-09T06:13:05Z","expiresAt":"2026-10-09T06:43:05Z"}
```

[MEASURED] `(Get-ChildItem docs\pr-prompts -Filter '*-ready.md').Name` ->
`pr-sweep-quote-the-heartbeat-alarm-ready.md`, one entry, and it is **not** a `rev-<n>` review job.

[MEASURED] watcher heartbeat, last lines - the tick only happens mid-run:

```
[2026-10-09T06:14:06.059Z] pr-sweep-quote-the-heartbeat-alarm-ready.md elapsed=60s  last:
[2026-10-09T06:18:06.089Z] pr-sweep-quote-the-heartbeat-alarm-ready.md elapsed=300s last:
```

This run's `lastRunAt` is **06:13:53Z**. The arm is stamped **06:13:05Z** - **48 seconds before this
session existed**. So the handed-forward item was not missed and is not mine to take.

### Residual state in the shared dev tree

[MEASURED] all four readings the report contract names, taken at 06:18Z:

```
git rev-list --left-right --count HEAD...origin/main  -> 0  0
git diff --cached --name-status                       -> EMPTY
git diff --numstat                                    -> NOT empty (3 files, below)
git status --porcelain --untracked-files=no           -> NOT empty
```

```
2  2   docs/pipeline/sweep-rotation.json
1  0   docs/pr-prompts/.arming-log.txt
0  129 docs/pr-prompts/pr-sweep-quote-the-heartbeat-alarm-HOLD.md   (deleted in worktree)
```

[MEASURED] the rotation diff: `last_index 1 -> 2`, `last_run_utc 2026-10-09T02:10:14Z ->
2026-10-09T06:09:53Z`, `last_station` unchanged at `04-scanner`. [MEASURED] `git rev-parse
origin/main` and `git rev-parse HEAD` both `42c09453`, so no fast-forward was due this run.

[MEASURED] 32 non-main worktrees; **one is LIVE** - `C:/po-wt/rel-2261`, age 4 min, `do NOT prune`;
the rest classified orphaned, plus 2 registry escapees (`C:\PR-Master\worktrees\bootstrap-check`,
`C:\po-wt\dispatch-register-v1`, both 0KB, no `.lock`). Two orphans hold uncommitted work
(`C:/po-worktrees/sup-cwd-paths`, `C:/PR-Master/worktrees/sweep-dirty-untracked-v1`). 03's lane.

[MEASURED] `#2261` asked individually, never from a LIST response's `merged` field (DOCTRINE 9.4):
`gh pr view 2261 --json number,state,mergedAt,mergeStateStatus,headRefOid,labels` ->
`state OPEN`, `mergedAt null`, `mergeStateStatus BLOCKED`, `headRefOid d8aad07c`, `labels []`.

## WHAT CHANGED

**Nothing on the board, and nothing in git.** No arm, no merge, no branch update, no label write, no
`gh pr update-branch`, no prune, no retire, no archive, no `/sot/` edit, no scheduled-task change,
no PR opened.

The only thing this run wrote is **this breadcrumb**, placed in the dev tree at the tracked path
`docs/pr-prompts/` through the Cowork native file tools (NATIVE_FILE_TOOLS_READ_TRANSPORT_V1), where
it is **UNTRACKED until a later board PR commits it**. That is the second of the two sanctioned
homes, chosen because cure 1 - writing it inside this run's own PR worktree - would have required a
branch and a push while another actor holds the board lease and the watcher is mid-build. It is
named here so the next cycle or `sweep-breadcrumbs.ps1` collects it. See F29 for the ff-only
consequence of leaving it there, which is already live for three other paths.

## FINDINGS

### F27 - the arm the 0515 cycle handed forward was executed by another Station 00 actor 48 seconds before this run started, and there was nothing left for this run to do with it

The 0515 breadcrumb's correction section ends: *"Next run: re-measure the heartbeat, confirm no build
is in flight, take the lease, then `arm-prompt.ps1`."* That instruction is discharged, by someone
else. The arming log stamps `pr-sweep-quote-the-heartbeat-alarm` ARMED at **06:13:05Z**, actor
`station-00.interactive`, `caller=node.exe:40912` - a node caller, i.e. an agent session rather than
a hand-run `powershell.exe`, which is how every previous interactive arm in that log is stamped. This
run's `lastRunAt` is 06:13:53Z.

The arm itself reads correct on every check the 0515 run specified: the prompt is the one it repaired,
the `*-ready.md` is present and is not a `rev-<n>` review job, the watcher picked it up immediately,
and the heartbeat has ticked every 60 s since (`elapsed=300s` at 06:18Z) with no failure line. The
lease was taken for the arm and deliberately **left held** - which is exactly what `arm-prompt.ps1`
is documented to do, so the gap between the arm and the watcher's heartbeat stays covered. The
0515 run's own falsifying probe fires in the other direction here and says so cleanly: *"if ... any
`*-ready.md` other than a `rev-<n>` review job is present, the gate is still closed"*. It is present,
so the gate is closed to me.

**DISPOSITION: ACTIONED** - verified, with the arming-log line, the lease file, the `*-ready.md`
census and the heartbeat, that the handed-forward arm is done and healthy; nothing was mutated and
nothing is owed. **What the next run must not do is re-derive it**: `armed = 1` is now a real prompt,
and the next cycle's job on it is to confirm the watcher's PR appeared, drive it, and - because the
prompt's scope is `files[0]` of the instrument lane with an `instrument` key in
`standing-lanes.json` - sign it with a **standing** receipt, never a personal one.

### F28 - two Station 00 actors were on one board inside 48 seconds, and BOARD_LEASE_V1 caught it where the old safe-to-act gate would have read SAFE

This is the scenario of the open escalation
`needs-marco/two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`,
reproduced live: a scheduled 00 firing on its cron while an interactive 00 is mid-mutation. The
difference is the outcome. The pre-lease gate measured locks, git processes and recent PR activity -
all three of which read clean here (`index.lock False/False`, scoped git processes `0`, no PR touched
in 2 min) - so it would have returned SAFE in the window **between** the other actor's `git mv` and
the watcher's first heartbeat tick, which is the precise false reading that escalation is named for.

What actually happened: the lease file carried the other actor's name, reason, pid and expiry, the
sweep surfaced it in section 3 and converted it into section 7's `CAUTION ... Stand down; COLLECT
only`, and this run stood down on a measurement rather than on judgement. Condition 3 of BOARD
DRIVING is the load-bearing one and it did the work it was added to do.

**DISPOSITION: DEFERRED** - real, and nothing to ask. The remedy for this finding has already landed
and has now been observed working end to end, so no second artefact is opened and nothing is appended
to the 2026-09-14 escalation (DOCTRINE 10.5 - one artefact keeps one identity; re-appending an
unchanged question is churn). What would make it urgent again: a lease that is held while the sweep
still reports `board lease: free`, or an expired lease (30 min) left behind by a dead actor with the
watcher idle - neither is true here, and the expiry at 06:43:05Z is within one cadence, so the
**07:1xZ run should find it released and must re-measure rather than assume either way**.

### F29 - three tracked files are locally modified in the shared dev tree by two other live actors, and this breadcrumb will be the fourth - the next fast-forward is the thing that pays for it

`git diff --cached` is EMPTY and `rev-list --left-right` is `0 0`, which are two of the four readings
the report contract calls a PASS. `git diff --numstat` and `git status --porcelain
--untracked-files=no` are **not** empty: `docs/pipeline/sweep-rotation.json` (04's rotation advance
to `last_index 2` at 06:09:53Z, uncommitted), `docs/pr-prompts/.arming-log.txt` (the other 00's arm
line), and `docs/pr-prompts/pr-sweep-quote-the-heartbeat-alarm-HOLD.md` deleted in the worktree by
that same `git mv`. All three belong to runs that are still in flight, and **none of them is mine to
restore, commit or clean** - DOCTRINE 9.2, and `git checkout .` / `clean` against the queue
resurrects dead prompts.

The consequence is the one the report contract spells out: a tracked file left modified or deleted at
a path a fast-forward must change makes `git merge --ff-only` refuse. HEAD equals `origin/main` right
now, so nothing refused this run. It will matter the moment the watcher's PR for
`pr-sweep-quote-the-heartbeat-alarm` lands, because that PR carries the HOLD deletion and the arming
log line - i.e. two of these three paths. The narrower half of the contract's warning does **not**
apply here and should not be quoted as if it did: it warns about the case where `--numstat` and
`--cached` *both* read EMPTY and hide the blocker. Here `--numstat` names all three, so the blocker
is visible to anyone who takes all four readings rather than two.

**DISPOSITION: DISPATCHED to the next Station 00 cycle**, which is the station whose lane the
fast-forward and the dev-tree census sit in. What it must do, in this order: (1) take the four
readings, not two; (2) if the arm's PR has merged, expect `sweep-rotation.json` to be the only
survivor and restore any blocking path **byte-exactly from `HEAD` with a raw-Buffer node write**
(`fs.writeFileSync(abs, execFileSync('git', ['show', 'HEAD:' + rel]))`) then `git update-index
--refresh` - never `git checkout -- <path>`, never `git clean`; (3) sweep this breadcrumb up so it
stops being the fourth untracked path. The worktree census is separately 03's: **32** non-main
worktrees, one LIVE (`C:/po-wt/rel-2261`, 4 min), 2 registry escapees, two orphans holding
uncommitted work that `--force` would destroy.

### F30 - #2261 is unchanged at 51h: released, unlabelled, BLOCKED, and still nobody's to sign

[MEASURED] individually: `OPEN`, `mergedAt null`, `BLOCKED`, head `d8aad07c`, `labels []`. CI is
`13 pass / 0 fail / 2 pending` - better than the 0515 reading of `13 pass / 2 fail`, but pending is
not pass and the two pending checks are the ones that decide. Its single file is
`scripts/pipeline/pipeline-lib.ps1`, the **first entry on the instrument lane's NEVER-LIST**, so no
station may merge it and no station may author its receipt: a standing receipt is not permitted on a
PR that was labelled `do-not-merge`, and a personal receipt requires Marco's release word in the same
turn, which a headless run cannot have. The sweep cross-checked the escalation file this run as
*"references #2261 = OPEN -- genuinely open"*.

Nothing has changed since the 0314 run put the question to Marco, so **nothing is appended to the
escalation file this cycle** (DOCTRINE 10.5). The file is
`docs/pr-prompts/needs-marco/2261-pipeline-lib-fix-needs-marcos-release-and-the-stager-never-checked-the-never-list-2026-10-07.md`.

**DISPOSITION: ESCALATED** - unchanged and already with Marco. RULE 1, complete-and-additive option
FIRST: **leave the release word where a headless run can read it** - commit
`docs/decisions/merge-approvals/2261.md` with `authority: personal`, which solves it immediately and
permanently, damages no existing or future data entry, and also discharges the 2026-09-24
three-PRs-released escalation. Alternative (b), a one-line `released: 2261` comment on the PR,
solves it immediately but **fails the future half** - it leaves the next released PR in the same
position, because nothing reads comments as authority. Alternative (c), inferring `approved_by:
marco` from the `unlabeled` event, **fails both halves** and is what CP-26 exists to prevent.

## WHAT I DID NOT DO

- **I did not arm anything.** The one armable prompt was armed by another actor at 06:13:05Z, 48 s
  before this session started, and the watcher has been building it since (F27). Arming anything into
  a live watcher build is the LL-38 collision the section-3 gate exists to prevent.
- **I did not take the board lease, and I did not break, clear, shorten or release the one that is
  held.** It belongs to `station-00.interactive` until 06:43:05Z and `arm-prompt.ps1` holds it on
  purpose. Clearing another actor's lease is precisely the mutation BOARD_LEASE_V1 was added to stop.
- **I did not merge, update, re-label or re-park #2261**, and I wrote no receipt of any kind for it.
  Re-applying `do-not-merge` would undo a release that is probably Marco's.
- **I did not run `gh pr update-branch` on anything.** The watcher's auto-update timer is OFF and a
  stray update-branch costs a full CI rebuild.
- **I did not open a PR.** A docs-only board PR is inside this station's lane, but the only mutations
  it would carry - this breadcrumb and the archive of the 0515 breadcrumb - are not worth a branch
  and a push taken while another actor holds the board and a build is in flight.
- **I did not archive the 0515 breadcrumb.** Its findings are collected and dispositioned above
  (F22 carried forward as DEFERRED by its own terms, F23 discharged by F27, F24/F25 spent, F26
  continued as F30), so it is archive-ready; the `git mv` needs a board PR, which this run did not
  open. **Handed to the next cycle together with F29's sweep.**
- **I did not touch the three locally modified tracked files** in the dev tree, and I did not
  `git checkout`, `reset --hard`, `stash pop` or `clean` anything.
- **I did not retire an escalation or clear a `[STALE]` row.** Section 5 produced 53 rows and not one
  `[STALE]` line, so there was nothing retire-able to measure. 36 rows say section 5 cannot decide
  staleness; reading all 53 by hand is a triage pass, not a COLLECT-only run's lane.
- **I did not prune a worktree.** 32 non-main worktrees, one LIVE, 2 registry escapees, two orphans
  holding uncommitted work. 03's lane, and irreversible besides.
- **I did not dispatch 03, 04 or 05, and I did not re-run or edit any scheduled task.** All three
  measured `ok`; 04 is mid-run on its 06:09:32Z occurrence, which the station doc's table calls *not
  a defect*. FRESHNESS_ONE_CADENCE_V1 permits nothing on a healthy reading, and no station was MISSED.
- **I did not substitute a GitHub-side read for host coverage.** This run was sighted; the question
  did not arise.
- **I did not run `git` through the Linux device bridge** against any mount, although the guard
  reported itself INERT (exit 2) and the ban was therefore remembered rather than mechanical.
- **I did not compare a piped `git show | git hash-object --stdin` hash against anything.**
- **I did not run `lint-station.mjs --write-canonical`**, and I did not edit `scripts/**`,
  `instrument-lane.json`, `standing-lanes.json`, `/sot/`, Azure, Entra or SharePoint, and wrote no
  production data.

---

## ADDENDUM 2026-10-09T06:2xZ - COLLECT: Station 04's 0610 breadcrumb landed mid-run, and the watcher opened #2278

Appended to this file rather than filed separately (DOCTRINE 10.5, one artefact keeps one identity).
Both facts below postdate this run's own census and were caught by re-measuring rather than by
assuming the earlier reading still held - DOCTRINE 7's `[LIVE]` means "true when measured".

### Two measurements taken after the census above

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` at 06:23Z -> `CLEAN`, **exit 0**,
`structure: 3 checked, 0 malformed`. Three breadcrumbs, two of them UNTRACKED with the validator's
own `NOTE ... it reaches nobody until a board PR commits it`:

```
ADMIT  00-00-supervisor-2026-10-09-0515-...   (tracked on origin/main)
ADMIT  00-00-supervisor-2026-10-09-0613-...   (this file, UNTRACKED)
ADMIT  00-04-scanner-2026-10-09-0610-repo-hygiene-...   (UNTRACKED)
```

So 04's 06:09:32Z occurrence is no longer mid-run: it filed, its breadcrumb ADMITs, and the
"mid-run - NOT a defect" classification recorded above is now a completed run. **This is the whole
reason COLLECT is 00's duty and nobody else's** - that file reached nobody until this run read it.

[MEASURED] `gh pr list --state open --json number,title` at 06:23Z -> **two** open PRs, where the
census at 06:14Z had one:

```
#2278  feat(pipeline): quote the heartbeat alarm sentence in the sweep (HEARTBEAT_ALARM_TEXT_V1)
#2261  fix(pipeline): make Invoke-GitPush -WorkTree mandatory and fail loud
```

**#2278 is the watcher's PR for the arm in F27** - the prompt the 0515 cycle repaired, armed by
`station-00.interactive` at 06:13:05Z. The lease was still held at 06:23:22Z
(`expiresAt 2026-10-09T06:43:05Z`) and the heartbeat still ticking (`elapsed=600s`), so #2278 was
**not** read, classified, reviewed, labelled or merged by this run. It is the lease-holder's to
drive. The next cycle must classify it before anything else: it is **watcher-opened**, so DOCTRINE
10.1 case 1 or 2 applies and RULE 2 binds as written - and its scope is `files[0]` of the instrument
lane with an `instrument` key in `standing-lanes.json`, so if it is unlabelled, green,
`INSTRUMENT_LANE: IN_LANE` for the current head, and carries a MERGE verdict whose `REVIEWED-SHA`
equals that head, it is signable with a **standing** receipt. Never a personal one.

### 04's six findings, each given one of the four dispositions

04's own `## FOR STATION 00` asks for three dispatches plus the rotation commit. **Every one of them
needs a board PR, and this run may not open one** (F28: lease held by another actor, sweep verdict
`Stand down; COLLECT only`). So each is dispositioned honestly as handed on, with the work specified
precisely enough that the next cycle executes rather than re-derives it. **Collected is not the same
as actioned, and this section does not pretend otherwise.**

- **04-F1 - 24 of 57 remote-tracking refs belong to namespaces with no configured remote**
  (`pr` 14, `staleprobe` 9, `pr1273` 1; `git branch -r --merged origin/main` offered
  `staleprobe/main` as a merged remote branch). **DISPOSITION: DISPATCHED to the next Station 00
  cycle.** Carry 04's constraint verbatim: **do not open a fourth filing** - fold the three readings
  into `needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md` as a measured
  addendum and restate its question over the **33** real `origin` refs, because that file's own
  history says in those words that a fourth filing is the failure mode rather than the remedy. The
  ref-deletion decision itself stays Marco's: a remote-tracking ref whose remote no longer exists is
  not recoverable by `git fetch`, so deleting it is irreversible (DOCTRINE 5.4).

- **04-F2 - a seventh instruction layer (Codex: root `AGENTS.md` + `.codex/agents/*.toml`, 9 defs,
  untracked and not gitignored) has sat in the dev tree for 17 days, in no map and in no linter.**
  **DISPOSITION: DISPATCHED to the next Station 00 cycle for half (a), ESCALATED for half (b)** -
  and the split is 04's, correctly drawn. (a) adding the Codex row to `STATION-CAPABILITIES.md` 1's
  layer table is pure docs, inside this station's lane, complete and additive, and is the cheapest
  item on the whole board; 1's own rule is *"when a layer is added, add it here first"*. (b) whether
  `.codex/agents/*.toml` joins `lint-station.mjs`'s encoding sweep and whether either path should be
  tracked or gitignored is a design question about a lane nobody here has identified, so RULE 1
  forbids guessing it - **the question to put to Marco is the single one 04 named: *who runs Codex
  against this repo?*, because that one answer settles both halves.** Worth carrying forward
  explicitly: 04 checked for the PR #1465 damage pattern and it is **NOT** there (all 9 `.toml` and
  `AGENTS.md` read as bytes with `node`: `U+FFFD=0 cp1252sig=0`, against a synthetic positive
  control scoring 1). **This is a map gap, not a damage incident**, and the next run must not inflate
  it into one.

- **04-F3 - 31 of 32 non-main worktrees are orphaned, holding ~130 commits that exist nowhere else,
  and `git worktree prune --dry-run -v` is EMPTY because git's prune test only asks whether the
  directory still exists.** **DISPOSITION: DISPATCHED to Station 03**, which the sweep itself names
  and which is the only station with a repair lane; 00 routes it, 00 does not do it (LL-38). Carry
  both hard constraints, RULE 1 in order: the complete-and-additive move is to **push or patch out
  the ~130 commits and the two dirty worktrees BEFORE any removal** - that solves it now and keeps
  every future recovery possible; a `git worktree remove --force` sweep is faster and **fails the
  no-data-loss half outright**, discarding work that exists in exactly one place on one disk. The
  removal is irreversible, so it stays Marco's until preservation is done and read back. Also carry
  04's flag rather than its classification: `C:/po-worktrees/st05-sot-2026-10-09` is listed as an
  orphan by the sweep but is plausibly a live Station 05 artefact, and that call is 05's.

- **04-F4 - 25 untracked `docs/pr-reviews/pr-<N>-review.md` verdicts (#2183-#2276) pre-load the
  fast-forward blocker that already fired once on eighteen such files; none collides with
  `origin/main` today.** **DISPOSITION: DEFERRED**, as 04 had it, and **merged into this run's F29**,
  which is the same mechanism measured from the other side: F29's three *tracked* modifications are
  live blockers-in-waiting, 04's 25 *untracked* files are loaded ones, and this breadcrumb plus 04's
  are two more. What would make it urgent is unchanged: any PR adding a file under `docs/pr-reviews/`
  matching one of the 25 names, or an ff refusal whose `--numstat` reads EMPTY.

- **04-F5 - the watcher clone holds 86 stashes spanning 87 days, the oldest three hand-made WIP from
  July rather than autostashes.** **DISPOSITION: DEFERRED.** The mechanism is already doctrine
  (DOCTRINE 9.2, the launcher stashes on every start and never pops), so nothing is filed; what 04
  adds is magnitude, which is state and belongs in a breadcrumb. No harm accrues today - the clone
  is `tracked-dirty=0` and the watcher ignores them - and `stash drop` is irreversible with no
  evidence anyone needs them. What would make it urgent: the launcher failing to stash (which would
  dirty the clone and block its own update), or a station needing a specific pre-2026-07-14 state.
  If the July WIP entries are judged worth keeping, the additive move is to **export them as patches
  before anything is dropped** - not to drop and hope.

- **04-F6 - three of 04's own instruments lied inside its run and all three were caught by a
  control**, the worst being `Get-Content` showing textbook CP1252 mojibake on a byte-clean
  `AGENTS.md` - DOCTRINE 9.3's named lie, in the direction of a *more* alarming result, which is the
  direction that gets acted on. **DISPOSITION: ACTIONED** - corrected inside 04's own run before
  anything was published, controls quoted, and the discarded claim named rather than quietly dropped.
  Collected here with no further action because that is what a self-caught instrument lie should cost:
  nothing but the write-up. It is also the one finding on this board that needed no second actor.

### 04's rotation advance - still uncommitted, and the one item with a deadline

[MEASURED] `docs/pipeline/sweep-rotation.json` is modified in the dev tree:
`last_index 1 -> 2`, `last_run_utc 2026-10-09T02:10:14Z -> 2026-10-09T06:09:53Z`, `last_station`
unchanged at `04-scanner`; next sweep key **`instruction-drift`**. 04 may not commit it and says so
in its own WHAT I DID NOT DO: *"If Station 00 does not commit it, the next run repeats `repo-hygiene`
and the rotation silently stops"* - which has already happened twice (04's F6 on 2026-09-02, and
again on 2026-10-09 per #2272).

**DISPOSITION: DISPATCHED to the next Station 00 cycle, as the first board-PR item**, with 04's own
warning carried verbatim because it is the part most easily lost: **use a pathspec commit naming
`docs/pipeline/sweep-rotation.json` ALONE.** A bare `git commit -a` in the shared dev tree would
sweep the in-flight arm (`.arming-log.txt`, the deleted
`pr-sweep-quote-the-heartbeat-alarm-HOLD.md`) into a board PR that is supposed to carry only
breadcrumbs and the advance - DOCTRINE 9.2, the dev tree's index is SHARED between concurrent chats,
and the contract's pathspec-commit rule exists for exactly this. The values above are recorded here
so the advance can be reconstructed byte-for-byte if the dev-tree copy is lost before it is
committed.

### The next cycle's board-PR payload, in the order it costs least

Every item below is docs-only and inside this station's lane. None of it was done this run, for the
one reason recorded in F28.

1. `docs/pipeline/sweep-rotation.json`, **pathspec-committed alone** (04's advance, deadline-bearing).
2. This breadcrumb and `00-04-scanner-2026-10-09-0610-repo-hygiene-...`, both currently untracked.
3. `git mv` of `00-00-supervisor-2026-10-09-0515-...` to `docs/pr-prompts/archive/` - its findings
   are collected and dispositioned in this file's FINDINGS section, so it is archive-ready.
4. 04-F2(a): the Codex row in `STATION-CAPABILITIES.md` 1.
5. 04-F1: the measured addendum folded into the existing CONSOLIDATED stale-remote-heads escalation,
   **not a fourth filing**.

And **before any of it**: re-measure the lease (expiry 06:43:05Z), the heartbeat, and #2278's state,
because every reading in this file expires the moment it prints.

## FOR MARCO

Two questions, neither new, neither answerable by any headless run:

1. **#2261** - 51h open, released (unlabelled), BLOCKED, one file
   `scripts/pipeline/pipeline-lib.ps1` which is the first entry on the instrument lane's NEVER-LIST.
   Complete-and-additive option FIRST: **commit `docs/decisions/merge-approvals/2261.md` with
   `authority: personal`** - it solves this PR immediately, leaves the release word where every
   future headless run can read it, damages no existing or future data entry, and also discharges the
   2026-09-24 three-PRs-released escalation. A one-line `released: 2261` PR comment solves it now but
   **fails the future half** (nothing reads comments as authority). Inferring approval from the
   `unlabeled` event **fails both halves** and is what CP-26 exists to prevent.
2. **Who runs Codex against this repo?** (04-F2). Root `AGENTS.md` and `.codex/agents/` have been in
   the dev tree untracked and unmapped for 17 days. They are byte-clean, so nothing is broken - but
   the answer decides whether `.codex/agents/*.toml` joins the encoding linter and whether either
   path should be tracked or gitignored, and neither is guessable.
