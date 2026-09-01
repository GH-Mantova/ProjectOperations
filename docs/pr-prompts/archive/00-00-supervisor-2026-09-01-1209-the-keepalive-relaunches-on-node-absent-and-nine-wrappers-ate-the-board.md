# Station 00 — Supervisor | 2026-09-01T12:09Z–2026-09-01T12:35Z

## GROUND

```
UTC            2026-09-01T12:09:24Z
origin/main    13e5397c            (fetched, then rev-parse)
dev tree       main @ 755255ab      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                    (scheduled-task SKILL.md)
```

Versions agree — this run was NOT read-only-by-mismatch.

**SIGHTED run.** `start_process` on `powershell.exe` returned a live shell on the Windows host on
the second attempt (the first attempt succeeded too; it died on my own quoting bug, not on the
bridge). Every claim below was measured on the box. This was not a blind run dressed as coverage.

Freshness of the three binding documents was proved, not assumed:
`git diff --stat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **empty**, so the working copies I read are
byte-identical to `main` despite the dev tree sitting five commits behind it.

## WHAT I MEASURED

**Locks, first, per the standing instruction.** `[MEASURED]` No `index.lock` anywhere:
`Get-ChildItem C:\ProjectOperations2\.git\index.lock` and a `-Recurse -Depth 3 -Filter index.lock`
over all of `C:\po-watcher\` both returned nothing. The sweep agrees —
`git index.lock interactive/clone: False / False`, `git processes running: 0`. The device-bridge
lock (six prior occurrences, three of them yesterday) did **not** recur this cycle.

**Sweep verdict.** `[MEASURED]` `bring-up-to-speed.ps1` (776 lines, captured to file so section A
could be read, not just its tail) — §7 **`SAFE TO ACT: no board mutation in progress, no recent
remote activity, no live station worktrees`**, generated `2026-09-01 12:10:44Z`. Escalations
`open=0 resolved=3 broken=0`; lessons `holding=5 regressed=0 broken=0`.

**Trunk.** `[MEASURED]` `main CI on 13e5397c: 5 success / 0 failed / 0 running` — green. Yesterday's
red trunk is gone.

**Board.** `[MEASURED]` 3 open PRs. `#1494` CLEAN 9/0/0 green · `#1483` BLOCKED 11/3 red ·
`#1477` BLOCKED 12/2 red.

**Collection — `check-breadcrumb.mjs --freshness` exit 0, `CLEAN`.** `[MEASURED]` 17 breadcrumbs
checked, **0 malformed**, and every station inside cadence: `00` 2.0h (cadence 2h), `03` 13.2h
(24h), `04` 2.0h (4h), `05` 22.0h (24h), `02` dispatch-only. Two were flagged `UNTRACKED` — 00's own
10:10Z blind-run report and 04's 10:10Z scanner report. Both are collected by this run's PR.

**The 09:07Z arm was Marco's, explicitly — the standing "do not arm CP-26" line is discharged.**
`[MEASURED]` `.arming-log.txt` last line reads
`2026-09-01T09:07:42Z ARMED pr-gates-approval-receipt escalates=true by=Marco@`. On its own that
proves nothing: 04 measured this cycle that `by=` records the **OS user**, which every agent on this
box shares. The proof is elsewhere. `git diff` on the tracked, landed breadcrumb
`00-06-pr-master-2026-09-01-0525-…md` shows Station 06 **appended an F5 after the fact**:
*"At 09:07Z Marco instructed Station 06 to arm `pr-gates-approval-receipt` … He confirmed the
override in the same exchange … Scope of the override: this one prompt."* That is the answer the
standing escalation was waiting for. The 23-line local edit 04 flagged as "either a correction worth
keeping or a stray write worth understanding" is the former, and this PR commits it.

**`#1492` merged, and it was not the watcher that built it.** `[MEASURED]`
`gh pr view 1492` → created `09:26:35Z`, merged `11:14:34Z` by `GH-Mantova`, `autoMergeRequest:
null`, no labels, merge commit `13e5397c`, six files under `scripts/pr-gates/**`,
`.github/workflows/ci.yml` and `docs/decisions/merge-approvals/`. The watcher's heartbeat had last
ticked at 08:29Z and there is **no `processed/` entry** for the prompt, so a second lane authored and
merged it — DOCTRINE §10.1 territory, recorded here because no watcher verdict exists for it.

**The armed prompt was spent before it was ever armed.** `[MEASURED]` Its premise is
`! grep -q "approval-receipt" scripts/pr-gates/pr-gates.mjs`.
`git show origin/main:scripts/pr-gates/pr-gates.mjs | Select-String approval-receipt` returns
`import { wasEverEscalated, decideApprovalReceipt } from "./approval-receipt.mjs";` — the premise is
**FALSE on `main`**, i.e. dead. The prompt's own work is what `#1492` landed.

**Watcher — the sanctioned instrument, twice.** `[MEASURED]`
`scripts\restart-watcher-if-wedged.ps1` (report-only) at 12:13:48Z:

```
armed prompts waiting: 1
watcher process:       ALIVE (pid 2728)
restart churn:         90 cycle(s) in 20 min  (starts=16 exits=90, threshold 4)
VERDICT: CHURNING - 90 watcher restarts in the last 20 min. This is a crash loop, not a slow prompt.
```

**Nine launchers, alive at once.** `[MEASURED]` `Get-CimInstance Win32_Process` on `powershell.exe`
filtered to the launcher/supervisor/start names returned **eleven** rows — nine
`watcher-launcher-singlelane.ps1` created at 09:15, 09:25, 09:35, 09:46, 10:19, 10:38, 10:51, 11:00
and 12:02 Z, plus two `start-watcher.ps1` spawned at 12:13:10Z and 12:13:17Z *during this run*. Four
of the nine had `ppid=960`, the Task Scheduler service. I resolved the node's parent chain rather
than trusting a name list, per the `#1491` fix: node `27412` ← `start-watcher 18720` ←
`launcher 4136`.

**The crash, from the log — not from the diff.** `[MEASURED]` `C:\po-watcher\watcher-launch.log`:

```
[12:05:55.280Z] [queue] pr-gates-approval-receipt-ready.md (depth: 1, source: startup-scan)
[12:05:55.779Z] [start] pr-gates-approval-receipt-ready.md (max-turns=240)
[22:05:57.92+10:00] Watcher exited with code 1 (raw node exit: -1)
...
Add-Content : The process cannot access the file
'C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\2026-09-01.log' because it is being used
by another process.   ... start-watcher.ps1:43
[22:12:16.83+10:00] Watcher exited with failure (exit 1). REASON: + FullyQualifiedErrorId :
GetContentWriterIOError,Microsoft.PowerShell.Commands.AddContentCommand
[22:13:19.49+10:00] SINGLE-INSTANCE: watcher already running (PID 27412). Not starting another.
[22:13:20.45+10:00] ADOPT: a watcher node is already running and no wrapper was supervising it.
```

Two independent failure modes, both downstream of the same cause: nine wrappers writing one log file
turn an `Add-Content` IOException into a scored `exit 1`, and nine wrappers each ADOPT-poll the one
node, so a single node death is counted nine times. That is why `exits=90` against `starts=16`.

**The relaunch authority, and why it never stopped.** `[MEASURED]` `Get-ScheduledTask 'PO Watcher
Keepalive'` — `state=Ready`, `ExecutionTimeLimit PT10M`, `MultipleInstances=IgnoreNew`, last run
12:05:01Z, next 12:15:00Z, `LastTaskResult=267014` (`SCHED_S_TASK_TERMINATED`). Its action is
`powershell.exe -File "C:\po-watcher\ensure-watcher.ps1"`. `C:\po-watcher\ensure-watcher.log`:

```
10:05:13Z  CRASH LOOP SUSPECTED - 4 relaunches in the last 60 min. STANDING DOWN.
10:20:21Z  RELAUNCHED - wrapper pid 34100      10:24:56Z  VERIFY FAILED - no node index.mjs 20 s after relaunch
10:38:40Z  RELAUNCHED - wrapper pid 9868       10:40:10Z  VERIFY FAILED
10:51:59Z  RELAUNCHED - wrapper pid 18352      10:52:53Z  VERIFY FAILED
11:00:31Z  RELAUNCHED - wrapper pid 28084      12:02:57Z  RELAUNCHED - wrapper pid 31232
```

It stood down at 10:05Z and was relaunching again **fifteen minutes later**. Every relaunch is
conditioned on *"is a node absent"* and never on *"is a wrapper already present"*, so each 10-minute
tick during any node outage adds one more permanent wrapper. Nine ticks, nine wrappers.

**`ensure-watcher.ps1` is not in the repository.** `[MEASURED]`
`git ls-files --error-unmatch scripts/pr-watcher/ensure-watcher.ps1` → *"did not match any file(s)
known to git"*, exit 1. The file exists only at `C:\po-watcher\ensure-watcher.ps1` (5266 B, mtime
2026-08-24T00:01:25Z). The scheduled task that runs it is likewise machine-local.

**Worktrees and queue depth.** `[MEASURED]` from the sweep: 11 registry-escapee worktrees,
2 non-main worktrees (`stage-brandtheme-083750`, `stage-bt-084105`, both `locked`, both `dirty=0`),
`needs-marco/ 35`, `no-pr-opened/ 107`, `failed/ 41`, `blocked/ 54`, watcher clone
`branch=main dirty=1`.

## WHAT CHANGED

Three mutations, each read back.

**1. The spent prompt was disarmed.** `Move-Item docs/pr-prompts/pr-gates-approval-receipt-ready.md`
→ `docs/pr-prompts/superseded/pr-gates-approval-receipt-SPENT-2026-09-01-shipped-in-1492.md`.
Read-back: `Get-ChildItem -Filter *-ready.md` → **`ARMED NOW: 0`** (was 1). The new name matches no
watcher glob and `git check-ignore` exits 1 on it, so unlike the `-ready.md` it replaced it is a
**tracked** record. In this PR git resolves the pair as `R100` against the tracked
`pr-gates-approval-receipt-HOLD.md` that was sitting deleted-but-unstaged in the dev tree — so one
rename both closes the arm and clears the dangling deletion.

**2. The crash loop was halted with the sanctioned primitive, not by hand.**
`restart-watcher-if-wedged.ps1 -Fix` at 12:15:20Z → `Invoke-ChurnHalt`:

```
stopping wrapper pid 20832 / 3972 / 19212 / 4136 / 34100 / 9868 / 18352 / 28084 / 31232
stopping watcher pid 32824
after halt: wrappers=0 nodes=0
escalation written: docs\pr-prompts\needs-marco\WATCHER-CHURN-2026-09-01-221528.md
```

Read-back at 12:19:04Z: `node=0 launchers=0`. Every process is named above before it was stopped,
per YOUR LIMITS item 5. I did **not** restart afterwards: on a CHURNING verdict the script says in
terms that restarting is what is already failing, and the keepalive owns the next start regardless.

**3. This board PR.** 22 staged paths, all under `docs/` — no `sot/`, no code, so CP-24 cannot fire
and the `tests|docs` lane can take it. Contents: the two untracked 10:10Z breadcrumbs, this report,
Station 06's after-the-fact F5 on its landed 0525 breadcrumb, seven untracked `-HOLD.md` prompts
(each re-linted in the worktree: **7 of 7 `ADMIT`, exit 0**), five untracked `docs/pr-reviews/`
verdicts, `sweep-rotation.json` (without which 04 redraws `instruction-drift` and repeats a clean
sweep), the `R100` above, and four fully-dispositioned 08-31 breadcrumbs archived to
`docs/pr-prompts/archive/`.

Nothing else. No merge, no label, no arm, no `sot/` edit, no production data, no Azure/Entra/
SharePoint, no git write in `C:\po-watcher\ProjectOperations`.

## FINDINGS

### F1 — the keepalive relaunches on *node absent* and never checks *wrapper present*, so nine supervisors accumulated and ate the board

This is the whole outage. `ensure-watcher.ps1` fires every 10 minutes from the `PO Watcher
Keepalive` scheduled task. Its relaunch condition is *"no `node index.mjs`"*. It never asks whether a
wrapper is already supervising, so during any node outage every tick adds one more permanent
`watcher-launcher-singlelane.ps1`. Nine ticks between 09:15Z and 12:02Z produced nine live wrappers.

The wrappers then manufacture the crash they were sent to fix. They share one log file, so
`Add-Content` throws `GetContentWriterIOError`, which `start-watcher.ps1` scores as `exit 1` — a
logging collision counted as a watcher crash. And each of the nine ADOPT-polls the single node, so
one death is recorded nine times. Hence `exits=90` against `starts=16` in twenty minutes: the
churn number is mostly an artefact of the redundancy, and the redundancy is the fault.

Its own guard did not bound this. `CRASH LOOP SUSPECTED … STANDING DOWN` at 10:05:13Z, then
`RELAUNCHED` at 10:20:21Z — fifteen minutes of stand-down against a stated 60-minute window, and
four more relaunches after that. A guard that resets on the next tick is not a guard.

`restart-watcher-if-wedged.ps1` is not blind to this and got it right: it refused to restart, named
the loop, halted it, and escalated. The instrument worked; the thing it was watching did not.

**ACTIONED** — loop halted (mutation 2 above), verified `wrappers=0 nodes=0`, and the crash trigger
removed independently (mutation 1). The durable fix is F2, because the file that needs the
wrapper-presence check is not in this repository.

### F2 — the process that decides whether the board runs at all is not in the repository

`ensure-watcher.ps1` and the `PO Watcher Keepalive` task exist only on this machine.
`git ls-files --error-unmatch scripts/pr-watcher/ensure-watcher.ps1` exits 1. It is therefore
invisible to CI, to review, to every station reading `origin/main`, and to the prompt queue — no
prompt can be written to fix it, which is why F1's defect has survived since at least
2026-08-24 (the file's mtime) with no reviewer ever seeing it. Every other component of this
pipeline is versioned and gated; the one holding the restart authority is a loose file.

Under RULE 1, complete-and-additive first:

- **(A) Bring `ensure-watcher.ps1` into `scripts/pr-watcher/` and repoint the scheduled task at the
  repo copy, then land the wrapper-presence check as an ordinary PR.** Solves it immediately (the
  nine-wrapper bug becomes a reviewable diff) and in future (every later change to the restart
  authority is versioned, linted and CI-gated), and damages no data — the task keeps running, from a
  path one directory over. It needs Marco only because repointing a Windows scheduled task is
  machine configuration, not a repo change.
- **(B) Hand-patch `C:\po-watcher\ensure-watcher.ps1` in place** to check for a live wrapper before
  relaunching. Fixes today. **Fails the future half of RULE 1**: the file stays unversioned, so the
  next regression is again invisible to review, and no station can prove which version is on the box.
- **(C) Leave it and rely on the stand-down guard.** **Fails both halves.** The guard demonstrably
  did not hold today — it stood down at 10:05Z and relaunched at 10:20Z — and the board sat unable
  to drain for roughly three hours.

**ESCALATED** → Marco. Question, not a status update: *may I move `ensure-watcher.ps1` into the repo
and repoint the `PO Watcher Keepalive` task at it (A), or do you want the in-place patch (B)?*
I have deliberately not touched the scheduled task or the file: it is the machine's restart
authority, an interactive chat was demonstrably active on this box at 11:14–11:15Z, and disabling
the keepalive to stop the wrapper leak would leave the watcher with nothing to restart it at all —
a worse failure than the one it causes.

### F3 — a station could arm a prompt whose premise was already dead, and nothing stopped it

`pr-gates-approval-receipt` was armed at 09:07Z. Its premise —
`! grep -q "approval-receipt" scripts/pr-gates/pr-gates.mjs` — went false when `#1492` merged at
11:14Z, and from then until 12:15Z the file sat armed. The watcher picked it up on **every** start
(`source: startup-scan`) and died two seconds later, so the dead prompt was the thing the crash loop
kept reaching for.

The arm itself was correct and authorised (Marco, recorded in 06's F5). What is missing is the exit:
nothing re-checks a *live* `-ready.md` against its own premise after the work it describes lands by
another route. `lint-prompt.mjs` evaluates the premise at admission; the queue never asks again. On a
board where a second lane can merge the same work — `#1492` was not watcher-built — that gap is now
routine rather than exotic.

**DISPATCHED** → Station 04, whose lane is read-only audits and drift. The concrete ask: a check that
walks every `*-ready.md` still on disk, re-evaluates its `premise`, and reports any whose premise is
now false — the same evaluation `queue-inspect` already performs, run as a sweep rather than on
request. Not authored as a prompt here because 04 owns the sweep rotation and should place it.

### F4 — `#1494` is green, docs-only, and one minute younger than a human's merge

`#1494` (`docs/runbooks/watcher-identity-github-app.md`, single file, CLEAN, 9/0/0) was created
`11:15:43Z` — 69 seconds after `#1492` was merged by hand. No watcher opened it and no lane verdict
exists for it, so under DOCTRINE §10.1 I hand-classified: `docs/runbooks/…` matches
`^(tests|docs)/` and carries no `migrations/` path, so `classifyPolicyFiles` does **not** route it to
Marco, and RULE 2 does not bar it.

I still did not merge it, and the reason is not the classification. Its subject is *"option B — a
distinguishable identity for the watcher"*: it is one option in an open design question about who
the watcher signs as, authored inside the window in which a human was demonstrably driving this board
by hand. Merging another actor's live proposal 45 minutes into its life, while its author may still
be writing it, is the collision LL-38 records — and the RULE 2 probe cannot see a PR the watcher
never opened, so "no verdict" is not "cleared".

**DEFERRED** — merge it on the next cycle if it is still open, still green, and untouched for a full
cadence, or leave it to its author. What would make it urgent: nothing; it is a docs file and it
blocks no one. What would make it wrong to wait: an explicit word from Marco that it is finished.

### F5 — blindness is a property of the session, not the machine (04's F6, dispositioned)

Station 00's 10:05–10:12Z run was blind — `desktop-commander CONNECT_TIMEOUT` after 30000 ms, three
`ToolSearch` passes with a positive control, no PowerShell at all — and correctly stopped at
PREFLIGHT step 1 rather than substituting GitHub reads. Station 04 opened a shell on the **same host,
same account, at 10:10:55Z, inside that window**, on the first attempt. My own run reached the box
without difficulty at 12:09Z. Three sessions, one box, two outcomes.

That eliminates a family of causes — the host and the bridge were demonstrably reachable while 00
could not reach them — and points at a per-session MCP attachment failure. It does not identify the
cause and I am not claiming it does.

**ACTIONED** as a collection: 04's F6 is accepted, and the datum belongs in
`STATION-CAPABILITIES.md` §2 beside the already-refuted "in the listing ⇒ blind" rule. Not written
into that file this run — §2 is instruction, and a code-touching edit to `docs/pipeline/` routes to
Marco's queue, which F1 says is not where this cycle's spare capacity should go. It is recorded here
with its evidence so the next run can land it in one line.

### F6 — 04's F1/F2 arrived as prompts; both are now real queue entries, neither is armed

`pr-statussweep-local-time-timestamps-HOLD.md` (the sweep prints file mtimes in local time, unmarked,
inside a UTC report — every file timestamp reads ten hours fresher than it is) and
`pr-station04-qa-audit-marker-contradiction-HOLD.md` (04's own doc orders a tracked write on line 209
and forbids it on line 232) were staged untracked by 04 and are committed by this PR. Both relint
`ADMIT` exit 0 in a clean worktree off `origin/main`.

**ACTIONED** — collected and made real. Deliberately **not armed**: see WHAT I DID NOT DO. The
sweep-timestamp prompt touches `scripts/pipeline/**` and therefore routes to Marco, which is exactly
the queue F1 says is already the constraint.

### F7 — 04's F3 is a design question, and it is Marco's, not mine

Three state files are named by the station docs as if they exist. `triage-state.md` and
`AWAITING-MARCO-DECISION.md` exist nowhere — not on disk, not tracked, not ignored.
`queue-watch-state.md` exists on disk and is **neither tracked nor ignored**, which is two defects in
one filename: `status-sweep.ps1:302` advertises it as *"the freshest station summary"* while no
station reading `origin/main` can open it, and an untracked file inside a tracked directory is
precisely what makes a dev-tree fast-forward fail.

The fix requires deciding whether that summary is meant to be shared (track it) or scratch (ignore
it), and whether the two dangling names are live concepts or dead references. 04 declined to guess
and was right to.

**ESCALATED** → Marco, three questions, RULE 1 order. **(A) Track `queue-watch-state.md` and delete
the two dead references** — complete (stations can read it, the FF trap goes) and additive (nothing
is lost; the file keeps being appended to). **(B) Gitignore it** — ends the FF failure but keeps it
invisible, which is the failure `.gitignore:108` already produced for nine days; fails the future
half. **(C) Leave all three** — fails both; the sweep keeps quoting a file its readers cannot fetch.

## WHAT I DID NOT DO

- **Did not arm anything. Deliberately, and this is the run's main judgement call.** The board's
  constraint is not queue depth, it is that there is no drainer: the watcher has been crash-looping
  since ~09:15Z and I have just halted it pending Marco's answer on F2. Arming a prompt into a queue
  with no consumer produces a file, not a PR. `ARMED NOW: 0` is the correct state to leave behind,
  and the next run should re-read F1/F2 before changing it.
- **Did not restart the watcher.** `CHURNING` is the one verdict on which restarting is the failure
  mode. The keepalive owns the next start; if it comes back with exactly one wrapper and stays, the
  loop is broken by mutation 1 alone.
- **Did not touch `ensure-watcher.ps1` or the `PO Watcher Keepalive` scheduled task.** Machine
  configuration, and the safe-looking move (disable the keepalive to stop the leak) removes the only
  thing that restarts the watcher. F2 is the question.
- **Did not merge `#1494`** — see F4 — and did not merge, rebase, label or re-run anything on
  `#1483` or `#1477`, both BLOCKED and red. `#1477`'s reviewer BLOCK names its own fix at
  `estimate-export.service.spec.ts:288,309,326`; an `apps/api/**` spec is outside `tests/`, so both
  are Marco's under the path rule. Driving them green would lengthen his queue, not shorten it.
- **Did not clean the watcher clone** (`branch=main dirty=1`), **prune the 11 registry-escapee
  worktrees, or touch the two `locked` `stage-brandtheme` worktrees.** All Station 03's, and one is
  another lane's live work. 03 is inside cadence (13.2 h of 24 h) and already carries the
  clone-hygiene dispatch.
- **Did not run `git` from the sandbox against the Windows `.git`.** Every probe in this report ran
  in PowerShell on the box. The device-bridge `index.lock` has six prior occurrences; I added none.
- **Did not fast-forward the dev tree**, and it now holds untracked copies of files this PR commits.
  The documented cure is `git hash-object <disk>` against `git rev-parse origin/main:<path>`, delete
  only the byte-identical ones, then fast-forward — never `git clean`, `git checkout .` or
  `git restore`, which resurrect consumed prompts. Left for whoever fast-forwards next, stated so it
  is not rediscovered.
- **Did not retire the four measured-dead `needs-marco/` files** the previous run named as its first
  item. `needs-marco/` is gitignored, so that is a filesystem move with no PR and no reviewer, and
  the folder gained a new live entry this run (`WATCHER-CHURN-2026-09-01-221528.md`). It stays on the
  list; it was not this cycle's constraint.
- **Did not touch `/sot/`, Azure, Entra or SharePoint, and wrote no production data.**
