# Station 03 - Machine Minder | 2026-08-28T23:02Z-2026-08-28T23:12Z

## GROUND

```
UTC            2026-08-28 23:02:04
origin/main    873b3ef6            (fetched, then rev-parse)
dev tree       main @ 1501d09c     C:\ProjectOperations2   (1 behind origin/main)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. Full authority run (report-only lane).
Host reachable: `start_process` powershell.exe on LAPTOP-E6NHU4E4 succeeded. This was NOT a blind run.

## WHAT I MEASURED

**Ground / reachability**

- `[MEASURED]` `powershell -NoProfile -Command "hostname; Get-Date"` -> `LAPTOP-E6NHU4E4`, `2026-08-29 09:01:45` local. Desktop Commander present, box reachable.
- `[MEASURED]` `git rev-parse --short origin/main` -> `873b3ef6`; dev tree `main @ 1501d09c`; `git rev-list --left-right --count origin/main...HEAD` -> `1  0` (dev tree 1 behind, 0 ahead).

**The authentication failure (primary finding)**

- `[MEASURED]` `C:\Users\Marco\.claude\.credentials.json`, expiry field only, no secret read or printed:
  `subscriptionType=max`, `expiresAt(UTC)=2026-08-28 16:13:35`, `now(UTC)=2026-08-28 23:03:09`,
  `EXPIRED=True`, `minutesSinceExp=410`. File `lastWrite(local)=2026-08-29 02:13:26` (= 16:13:26Z),
  i.e. the last refresh attempt happened 9 seconds before expiry and did not extend the token.
  Re-measured 23:04:23Z: still `EXPIRED=True`, cred file unchanged.
- `[MEASURED]` 7 logs in `docs/pr-prompts/failed/` contain `OAuth access token has expired`. Six of them
  are consecutive and all post-date the expiry (times are Brisbane local, UTC+10):
  ```
  401  2026-08-29 02:13  204B  rev-1382-ready.md.log
  401  2026-08-29 02:14  204B  rev-1383-ready.md.log
  401  2026-08-29 02:20  204B  rev-1384-ready.md.log
  401  2026-08-29 06:17  204B  rev-1385-ready.md.log
  401  2026-08-29 06:52  204B  rev-1386-ready.md.log
  401  2026-08-29 07:03  230B  pr-crm-s3-account-on-client-create-ready.md.log
  ```
  (the 7th, `pr-ops-m2-tip-finder-ready.md.log` at 2026-07-31, is an unrelated historical hit.)
  Full text of each: `Failed to authenticate. API Error: 401 OAuth access token has expired.
  Re-authenticate to continue.`
- `[MEASURED]` First 401 at 02:13 local = 16:13Z. Token expiry 16:13:35Z. The two coincide to the minute.
- `[MEASURED]` Armed `*-ready.md` at TOP LEVEL of `docs/pr-prompts/`: **0** (re-measured 23:04:23Z).
  `failed/` file count: **41**.
- `[INFERRED]` The queue is empty because the 401 consumed and quarantined everything armed, not because
  there was no work. Five `rev-*` review jobs plus one real feature prompt
  (`pr-crm-s3-account-on-client-create-ready.md`, 5092B) were destroyed in ~5 hours.

**Watcher process chain**

- `[MEASURED]` Resolved by command line, never by image name (DOCTRINE 9.5). Live chain:
  `pid 2984 watcher-launcher-singlelane.ps1 (started 2026-08-28 15:05, ppid=WmiPrvSE.exe)`
  -> `pid 30388 start-watcher.ps1 (00:33)` -> `pid 26364 node index.mjs (00:33)`.
- `[MEASURED]` Two ADDITIONAL `watcher-launcher-singlelane.ps1` wrappers are alive with dead parents:
  `pid 10364` started 2026-08-24 15:35 (ppid 26276 gone), `pid 23100` started 2026-08-27 10:15
  (ppid 25072 gone). Neither owns the running node. Re-measured 23:04:23Z: both still alive.
- `[MEASURED]` Scheduled task `PO Watcher Keepalive`: state=Ready, lastRun=2026-08-29 08:55:02 local,
  lastResult=0. `scripts/restart-watcher-if-wedged.ps1` present.
- `[MEASURED]` Watcher node pid 26364 alive at both 23:02Z and 23:04:23Z.
- `[MEASURED]` heartbeat age 409 min (status-sweep). DOCTRINE 9.5: ticks only mid-run, so age alone
  does not separate idle from wedged. With armed=0 this is idle, not wedged.
- `[MEASURED]` `STOP-WATCHER` absent. `STOP-WATCHER-LANE2` PRESENT, lastWrite 2026-08-18 14:44, 1090B -
  by design since 2026-08-15 (DOCTRINE 9.5), NOT drift and NOT a stop signal.

**Watcher clone `C:\po-watcher\ProjectOperations`**

- `[MEASURED]` branch=main, HEAD=`181817aa`, `git rev-list --left-right --count origin/main...HEAD`
  -> `11  0`. The clone is **11 commits behind origin/main**.
- `[MEASURED]` `git status --porcelain` -> 35 entries, ALL code ` D`, ALL under `docs/pr-reviews/`
  (`pr-739-review.md` .. `pr-1339-review.md`). No modifications, no untracked, nothing outside that dir.
- `[MEASURED]` `git stash list` -> **51 entries**. Newest three are
  `watcher-preflight-autostash on 'main' at 2026-08-29T00:32:27 / 00:33:33` and
  `on 'docs/station-contract-breadcrumb-validator' at 2026-08-29T00:42:55`. Oldest is
  `stash@{50}: WIP on feat/sharepoint-folder-mappings`. This is the closed loop of DOCTRINE 9.2:
  the launcher preflight stashes on every start and nothing ever pops.

**Locks, index, disk**

- `[MEASURED]` `C:\ProjectOperations2\.git\index.lock` - ABSENT. `C:\po-watcher\ProjectOperations\.git\index.lock` - ABSENT.
- `[MEASURED]` Dev tree `git diff --cached --name-status` -> **0 staged**. No cross-chat index collision
  (DOCTRINE 9.2). Working tree 27 dirty (5 ` M` under docs/ and sot/, 22 `??` including
  `docs/pipeline/sweep-rotation.json` M and the untracked `docs/data-model/sweeps/*` set).
- `[MEASURED]` `status-sweep.ps1` section 3: in-progress prompts 0, git processes 0, no PR touched in
  last 2 min. Section 0 positive controls both PASS (`gh` reached GitHub, `node` runs).
- `[MEASURED]` Disk C: freeGB=196.3 (usedGB=756). Not a constraint.
- `[MEASURED]` Orphaned worktrees: 4 - `C:/po-worktrees/sot-d-register`, `sot-readme-fetch`,
  `sotk-03-ledger`, `C:/po-wt-h`.
- `[MEASURED]` GitHub: 0 open PRs; main CI last 3 runs 3 success / 0 not-success (trunk green).

**My own lane: cadence, listing, and the missing breadcrumbs (Station 00 dispatched these to me)**

- `[MEASURED]` `list_scheduled_tasks` returns 5 live tasks. `03-machine-minder` IS among them:
  `cronExpression="0 9 * * *"`, `schedule="At 09:01 AM, every day"`, `enabled=true`,
  `lastRunAt=2026-08-28T23:01:29Z` (this run), `nextRunAt=2026-08-29T23:00:45Z`.
- `[MEASURED]` `02-board-driver` is NOT in the listing (its folder exists on disk; the folder is not a task).
- `[MEASURED]` Prior `00-03-machine-minder-*` breadcrumbs on disk: `2026-08-26-2301`, `2026-08-25-2301`,
  `2026-08-24-2301`. Nothing for 2026-08-27. Exactly one run produced no breadcrumb.
- `[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs docs/pr-prompts/00-03-machine-minder-2026-08-28-2302-oauth-401-burns-armed-prompts.md`
  -> `structure: 88 checked, 0 malformed, 7 skipped as pre-contract`, `CLEAN`, `EXITCODE=0`.
  This breadcrumb is **breadcrumb-clean** on the real validator, not on `lint-prompt.mjs`.
- `[MEASURED]` `git ls-files --error-unmatch` on this breadcrumb -> `did not match any file(s) known to git`.
  It is UNTRACKED and reaches nobody until a board PR commits it.
- `[CANNOT MEASURE]` Why the 2026-08-27T23:01Z run wrote nothing. That run's transcript is not on the
  box and I have no probe that reaches it. I will not infer a cause and dress it as a measurement.

## WHAT CHANGED

**Nothing.** This station is report-only. I mutated no repo file, no board object, no process, no
worktree, no stash. The only writes this run were three scratch probe scripts under
`C:\po-sup-fix-scripts\` (`mm-03-probe-2026-08-28.ps1`, `mm-03-probe2-...`, `mm-03-probe3-...`,
`mm-03-remeasure-...`) and this breadcrumb.

## FINDINGS

### F1 - The Claude Code OAuth token expired 410 minutes ago and the watcher is eating armed prompts alive

`[MEASURED]` Token `expiresAt` = 2026-08-28 16:13:35Z; now 23:03Z; expired. Six consecutive watcher runs
between 16:13Z and 21:03Z each failed instantly with `401 OAuth access token has expired` and each
consumed its prompt into `failed/`. Casualties: `rev-1382`, `rev-1383`, `rev-1384`, `rev-1385`,
`rev-1386`, and the feature prompt `pr-crm-s3-account-on-client-create-ready.md`.

This is worse than a stopped watcher. A stopped watcher leaves the queue intact. **This one is running
(pid 26364 confirmed alive twice), the keepalive task is healthy (lastResult=0, last ran 08:55 local),
and both will happily restart into the same 401.** The armed count reads 0 right now, which looks like
a quiet board and is actually a burned one. **Anything Station 00 arms next will be destroyed within
minutes**, and the 401 failure log carries no diagnostic value, so the next triage pass will see six
identical zero-content quarantines.

Re-authentication requires a real human identity at the keyboard. DOCTRINE section 5, hard stop 3.
No agent can do it and no agent should try.

**This is NOT a new discovery and I am not claiming it as one.** Station 00 has already escalated it
three times today - `00-00-supervisor-2026-08-28-1809-execution-lane-down-on-expired-oauth.md`,
`...-2009-oauth-expiry-measured-directly-and-03-ran-without-reporting.md`, and
`...-2209-oauth-still-dead-and-it-burned-a-real-feature-prompt.md` (the last two still UNTRACKED).
What this run adds is the machine-side measurement 00 could not take from its lane: the exact
`expiresAt` timestamp, the coincidence of that timestamp with the first 401 to the minute, the full
casualty list of six prompts, and the fact that **the keepalive task is healthy and will keep
restarting the node into the same 401** (lastRun 08:55 local, lastResult=0). Four independent
escalations in eleven hours with no re-auth is itself the signal: the escalation channel to Marco is
working and the answer has not arrived yet.

**Marco - the question, with RULE 1 applied:**

- **OPTION A (complete + additive, recommended).** Re-authenticate Claude Code on the box
  (`claude` -> `/login`, or `claude setup-token`), THEN have Station 00 restage the six burned prompts
  by copy-with-fresh-letter (`rev-1382-ready.md` -> `rev-1382b-ready.md`, etc. - copy, never move).
  Solves it now, restores the lost work, and damages no data. Additionally: the six 401 quarantines
  prove the watcher has no auth preflight, so the permanent half is a check in the launcher that
  refuses to consume a prompt when the credential is expired, and parks it instead of burning it.
  That is a follow-up PR, not a blocker on the re-auth.
- **OPTION B (immediate only).** Re-authenticate and leave it. Fails the "future" half of RULE 1 - the
  token will expire again and burn the queue again, with no guard added.
- **OPTION C (containment only).** Drop a `STOP-WATCHER` sentinel to stop the lane until Marco can
  re-auth. Fails the "complete" half - it protects the queue but does no work, and it is a board
  mutation outside my lane, so I have not done it. Station 00 can, if Marco is hours away.

**DISPOSITION: ESCALATED** - needs Marco at the keyboard; no agent has an identity.

### F2 - The watcher clone is 11 commits behind origin/main, so a restart would adopt nothing

`[MEASURED]` `C:\po-watcher\ProjectOperations` HEAD `181817aa`, origin/main `873b3ef6`, 11 behind.
The watcher executes `index.mjs` **from the clone** (DOCTRINE 9.5: "a restart adopts nothing"). Any
`scripts/pr-watcher/**` change in those 11 commits is not running. Whoever performs the F1 restart must
fast-forward the clone FIRST or the restart is cosmetic.

Note the ordering trap: the clone also carries 35 unstaged deletions and 51 stashes (F3), so a naive
`git pull` there will not be clean.

**DISPOSITION: DISPATCHED** to Station 00 - fast-forward `C:\po-watcher\ProjectOperations` to
origin/main as part of the F1 recovery, before relaunching. Not mine to perform (report-only, and
DOCTRINE section 4 forbids me git-writing in the watcher's shared tree).

### F3 - The preflight autostash loop has reached 51 stashes and the clone carries 35 unstaged deletions

`[MEASURED]` `git stash list` = 51. Three of them were created today at 00:32, 00:33 and 00:42 by
`watcher-preflight-autostash`. DOCTRINE 9.2 names this as a closed loop: the launcher stashes on every
start, nothing ever pops. Growth is confirmed, not suspected.

`[MEASURED]` Separately, all 35 dirty entries in the clone are ` D` deletions confined to
`docs/pr-reviews/` (pr-739 through pr-1339). Nothing else is touched. This is what makes
`status-sweep.ps1` print `dirty=35 <-- NOT clean-on-main; the watcher may refuse to start`.

`[INFERRED]` The deletions are almost certainly what the next preflight will stash as stash 52. The
mechanism is self-sustaining and the disposal is `git stash drop`, **never `pop`** (DOCTRINE 9.2).

**DISPOSITION: DEFERRED** - real, not now. It costs disk and noise, not correctness, and today it is
downstream of F1. It becomes urgent if the stash list starts failing the preflight outright, or if
anyone tries to `pop` one. Cleanup belongs in the same window as the F2 fast-forward.

### F4 - Two orphaned launcher wrappers are alive with dead parents

`[MEASURED]` `pid 10364` (started 2026-08-24 15:35, ppid 26276 gone) and `pid 23100` (2026-08-27 10:15,
ppid 25072 gone) both run `watcher-launcher-singlelane.ps1`. The live chain is a third,
`pid 2984` (2026-08-28 15:05) -> `30388` -> node `26364`. All three re-confirmed alive at 23:04:23Z.

The launcher is an auto-restart wrapper. Two orphans that each believe they own the lane are a
second-node risk the moment the current node exits - and the current node exits on every 401. That two
did not race today is luck, not design.

**DISPOSITION: DISPATCHED** to Station 00 - kill `10364` and `23100` by PID (never by image name,
DOCTRINE 9.5) during the F1 restart window, keeping the `2984 -> 30388 -> 26364` chain. I did not kill
them: process repair is 00's dispatch, not my lane, and killing a wrapper mid-401-loop without the
re-auth in hand just moves the failure.

### F5 - Four orphaned worktrees remain from aborted runs

`[MEASURED]` `C:/po-worktrees/sot-d-register` [docs/sot-05-d-register], `sot-readme-fetch`
[docs/sot-readme-fetch-plain1], `sotk-03-ledger` [docs/sot-03-merged-pr-ledger-2026-08-24],
`C:/po-wt-h` [hygiene]. All four are named in the sweep as aborted-run leftovers.

**DISPOSITION: DEFERRED** - unchanged from prior sweeps, no growth measured this run, and pruning a
worktree is an irreversible-adjacent action outside a report-only lane. Becomes urgent if the count
grows or if one of those branches is needed.

### F6 - The "in the listing means blind" diagnostic is FALSE, and this run is the counter-example

`[MEASURED]` `list_scheduled_tasks` returns `03-machine-minder` with `enabled=true`,
`lastRunAt=2026-08-28T23:01:29Z` - this run. And this run **reached the box**: Desktop Commander
started PowerShell on LAPTOP-E6NHU4E4, read the credential file, ran `git`, `gh` and
`status-sweep.ps1`. Both facts are true simultaneously.

My bootstrap says: *"If this station appears in the scheduled-task listing, it is cloud-fired and
structurally cannot reach the box."* `STATION-CAPABILITIES.md` section 2 says the same in a table:
appears in the listing -> cloud -> **NO** box access. **That is refuted.** A station appearing in the
listing tells you nothing about reachability.

This is a DOCTRINE section 7 instrument lie of the most dangerous kind, because it fails toward
inaction: a healthy station that trusts it would read the listing, conclude it is structurally blind,
and stop - producing "no news" that is indistinguishable from a quiet board. The only trustworthy
reachability test is the one the contract already mandates as step 1: **try the shell.** The listing
check should be deleted, not corrected.

Exact edits, so 00's PR is transcription and not re-diagnosis:
- `docs/pipeline/STATION-CAPABILITIES.md` section 2 - the table row `Device task ... NO` / `Cloud task
  ... YES` and the sentence *"The diagnostic: if a station appears in `list_triggers`, it is
  cloud-fired and will be blind"* must be replaced with: *"Presence in `list_scheduled_tasks` says
  NOTHING about reachability - measured 2026-08-28T23:01Z, `03-machine-minder` was in the listing and
  reached the box in the same run. The only reachability test is step 1: start the shell."*
- `docs/pipeline/stations/03-machine-minder.md` PREFLIGHT step 1 - the paragraph beginning *"The
  diagnostic for why: if this station appears in the scheduled-task listing..."* must be deleted.
- The same paragraph exists in the scheduled-task file `C:\Users\Marco\Claude\Scheduled\03-machine-minder\SKILL.md`,
  which is the layer that actually governs a scheduled run and which **no agent can edit** - so this
  one needs Marco to paste.

**DISPOSITION: DISPATCHED** to Station 00 for the two repo files, **+ ESCALATED** to Marco for the
scheduled-task file. I did not edit the repo docs myself: landing them means a branch and a push in
the shared dev tree the watcher globs, which my lane forbids.

### F7 - My cadence is DAILY in the live schedule and "every 4 hours" in all three instruction layers

`[MEASURED]` Live: `cronExpression="0 9 * * *"` = once a day at 09:01 local (23:01Z). Meanwhile my
bootstrap says *"Cadence: every 4 hours, or manually after any crash or reboot"*, and
`STATION-CAPABILITIES.md` section 6 says *"4 h or manual"*. All three instruction layers say 4h; the
machine says 24h. A 6x discrepancy in how often the machines get looked at.

`[MEASURED]` Worse, `STATION-CAPABILITIES.md` section 5 asserts *"Stations 02 and 03 have NO schedule
of their own - they run only when 00 dispatches them."* For 02 that is true (not in the listing). For
03 it is **false**: I have a live enabled daily cron. A reader trusting that line would not expect me
to run at all.

`[INFERRED]` This is also part of the answer to 00's "03 is 1.97x its cadence" arithmetic - 00 computed
against 24h and got the right shape, but any station computing against the documented 4h would have
declared me 12 runs overdue and gone looking for a wedge that does not exist.

Which layer is right is a decision, not a measurement, and it is Marco's: 4h of machine-minding costs
6x the tokens and the machines changed materially only once in the last three days.

**DISPOSITION: ESCALATED** to Marco, with RULE 1 applied:
- **OPTION A (complete + additive).** Decide the real cadence, then make all four layers say it. If
  the answer is 4h, Marco edits the cron (`0 */4 * * *`); if the answer is daily, 00 lands a docs PR
  correcting the bootstrap wording, section 6 and section 5 of STATION-CAPABILITIES. Either way the
  layers agree afterwards, which is the "future" half.
- **OPTION B (immediate only).** Correct the docs to say "daily" and leave the cron alone. Cheap, and
  it fails the "complete" half only if 24h is genuinely too slow - which today's 7-hour undetected
  401 burn is weak evidence for.

### F8 - A blind run cannot file a breadcrumb, so blindness is structurally self-concealing

This is the honest answer to 00's dispatched question *"say plainly why two runs produced none."*

`[MEASURED]` Exactly one run is missing, not two: breadcrumbs exist for 08-24, 08-25 and 08-26 at
2301; none for 08-27; this one for 08-28. `[CANNOT MEASURE]` the 08-27T23:01Z transcript - it is not
on the box and I have no probe that reaches it, so I will not name its cause.

But the structural fact needs no transcript. **Writing a breadcrumb requires Desktop Commander**, and
a blind run is blind precisely because Desktop Commander is absent. The contract tells a blind run to
*"write one paragraph saying you are blind... and report blindness as loudly as you would report a
defect"* - but its only available channel is chat, which `STATION-CAPABILITIES.md` section 7 marks
`not durable; no other agent can read it`. **A blind run therefore cannot leave any durable trace of
its own blindness.** The artifact it produces is silence - the exact artifact 00 observed and had to
guess at. 00's own breadcrumbs record six blind runs of its own between 08-26 and 08-28, so this is
not hypothetical.

Consequence for the contract: the "STOP and report loudly" instruction is unexecutable for the one
station-state it exists to cover. The fix has to live somewhere a blind run can still reach - the
cheapest being that **00, which is not blind on every run, treats "no breadcrumb from station N since
its last scheduled fire" as a first-class finding** rather than inferring it. 00 already did exactly
that this cycle, unprompted, which is the behaviour worth writing down.

**DISPOSITION: DISPATCHED** to Station 00 - fold into the station-contract block: a blind run's
absence of a breadcrumb IS its report, and the collector must raise it. I have not drafted the
canonical-block edit because that block is byte-gated by `lint-station.mjs` across all six station
docs and changing it is a six-file coordinated ship, which is 00's call, not mine.

## WHAT I DID NOT DO

- **Did not re-authenticate, and did not attempt to.** Hard stop: requires a real human identity
  (DOCTRINE section 5.3). I read only the `expiresAt` and `subscriptionType` fields of the credential
  file and printed neither the token nor any secret.
- **Did not stop, kill, restart or relaunch any process** - including the two orphaned wrappers in F4
  and the 401-looping node. Report-only lane; Station 00 dispatches repair.
- **Did not drop a `STOP-WATCHER` sentinel** to stop the burn. It is a board mutation and my lane
  forbids it. Named as OPTION C in F1 so 00 can take it if Marco is hours away.
- **Did not touch the watcher clone's git** - no fetch-and-merge, no `stash drop`, no restoring the 35
  deletions. DOCTRINE section 4: never `checkout`/`commit`/`push` in `C:\po-watcher\ProjectOperations`.
  I ran `git fetch` (read-only, refspec form) and `status`/`stash list`/`rev-list` there and nothing else.
- **Did not restage any of the six burned prompts.** Restaging is arming; only Station 00 arms.
- **Did not prune the four orphaned worktrees.**
- **Did not edit `STATION-CAPABILITIES.md`, my own station doc, or the station-contract canonical
  block** for F6, F7 and F8, even though F6 and F7 are one-line docs corrections I could have written.
  Landing them means a branch and a push in the shared dev tree the watcher globs; the contract block
  is byte-gated across six files by `lint-station.mjs`. Exact before/after text is in each finding so
  00's PR is transcription, not re-diagnosis.
- **Did not edit `C:\Users\Marco\Claude\Scheduled\03-machine-minder\SKILL.md`** - the layer that
  actually governs a scheduled run. No agent can change it; it is on Marco's list in F6.
- **Did not touch the board, any PR, any `/sot/` file, or anything Azure / Entra / SharePoint.**
- **Did not run `git` through the device bridge.** All git in this run was Desktop Commander PowerShell
  on the Windows host (DOCTRINE 9.2, the 0-byte `index.lock` trap).
- **Did not quote a trunk colour from `status-sweep.ps1` as my own finding** - the CI line is reproduced
  under WHAT I MEASURED tagged to its source, not asserted.

---

**This breadcrumb is UNTRACKED until a board PR commits it. Station 00: sweep it up.** The urgent item
is F1 and it is for Marco personally; F2 and F4 are the two things that must happen in the same window
as the re-auth, in that order (fast-forward the clone, then kill the orphan wrappers, then relaunch
detached via `Invoke-CimMethod -ClassName Win32_Process -MethodName Create`).
