# Station 00 — Supervisor | 2026-09-22T14:14Z–2026-09-22T14:30Z

## GROUND

```
UTC            2026-09-22T14:14:18Z
origin/main    58a53a11
dev tree       main @ 58a53a11  C:\ProjectOperations2   (0 behind, 0 ahead)
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE** — this run had full authority, not read-only.

**This was a SIGHTED run.** Desktop Commander loaded by keyword `ToolSearch` (never by hard-coded
id), `start_process` shell `powershell.exe` returned PID 14464, and every measurement below was
taken on the Windows box. The preceding Station 04 run at 14:11Z was **blind** — see F4.

## WHAT I MEASURED

**[MEASURED] The device-bridge git guard is INSTALLED BUT INERT — exit 2, the expected station
outcome.** Run at the top of the run, before any VM-side call, exit code read off the installer and
not off an appended pipeline:

```
bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"; echo "GUARD_EXIT=$?"

vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
   PATH="/sessions/awesome-keen-albattani/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

Per the PREFLIGHT table this is a FINDING, not a STOP. The device-bridge git ban was **remembered,
not mechanical**, for this run. No VM-side `git` was run against any mount at any point; every git
command below was issued from PID 14464 on the Windows host.

**[MEASURED] All three binding documents are byte-identical to `origin/main` in the dev tree**, so
reading the working copy was sound. Non-piped forms only, per PREFLIGHT step 2 (`git show | git
hash-object --stdin` is unsound in `powershell.exe`):

```
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
                                  docs/pipeline/DOCTRINE.md
                                  docs/pipeline/STATION-CAPABILITIES.md   -> EMPTY
git rev-list --left-right --count HEAD...origin/main                      -> 0	0
```

All three were then read **in full** from that working copy.

**[MEASURED] `status-sweep.ps1` verdict: SAFE TO ACT**, generated 2026-09-22T14:15:35Z. Both
instrument positive controls passed (`gh` reached GitHub, saw merged #2086; `node` runs). No
`index.lock` in either tree, **0** scoped git processes, no PR touched on GitHub in the last 2 min,
no live station worktrees. Captured with `*>` and decoded **utf16le** (§9.3 — `*>` writes UTF-16LE
and a utf8 read turns a structured report into a structureless one at exit 0).

**[MEASURED] The board is EMPTY and the trunk is green.**

```
[LIVE] OPEN PRs: 0
[LIVE] main CI on 58a53a11: 4 success / 0 failed / 0 running  (trunk green)
[LIVE] armed (*-ready.md): 0
```

Q1 of the MANDATORY ANSWER SHEET answers itself: **zero open PRs, therefore zero DIRTY**. There was
no PR to drive, no red to root-cause, no conflict to resolve and no merge to make. Note the sweep's
`TRUNK IS RED` headline — the subject of the 13:25Z run's F1 — did **not** fire this cycle, because
no cancelled smoke is attributed to `58a53a11`. That defect is latent, not fixed.

**[MEASURED] The watcher is healthy and correctly idle.** `watcher node: RUNNING pid 9744`,
auto-restart wrapper alive (1), heartbeat 100 min, `non-main worktrees: none`. An idle watcher with
**0** armed prompts is CORRECT, not wedged — `restart-watcher-if-wedged.ps1` was not needed and no
restart was considered. Heartbeat age is meaningless here: it ticks only mid-run.

**[MEASURED] Breadcrumb freshness CLEAN, exit 0, and it collected two breadcrumbs.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness`:

```
ADMIT   00-00-supervisor-2026-09-22-1325-trunk-is-red-is-a-cancelled-smoke-...md
NOTE    00-04-scanner-2026-09-22-1411-BLIND-desktop-commander-connect-timeout.md is UNTRACKED
ADMIT   00-04-scanner-2026-09-22-1411-BLIND-desktop-commander-connect-timeout.md
structure: 2 checked, 0 malformed
  00  last 2026-09-22T13:25:00Z   0.9h ago  (cadence 2h)   ok
  02  dispatch-only — no cadence to miss
  03  last 2026-09-21T23:04:00Z  15.3h ago  (cadence 24h)  ok
  04  last 2026-09-22T14:11:00Z   0.2h ago  (cadence 4h)   ok
  05  last 2026-09-21T14:11:00Z  24.2h ago  (cadence 24h)  ok
CLEAN    FRESHNESS_EXIT=0
```

The `00` row still reads `cadence 2h` against a live cron of `5 * * * *` — the known
`const CADENCE =` defect in `check-breadcrumb.mjs`, unchanged, and the reason the `lastRunAt`
cross-check below is mandatory rather than optional.

**[MEASURED] `lastRunAt` from the scheduled-tasks MCP, crossed against the freshness table.**
Four ENABLED tasks (`weekly-security-audit` is `enabled: false`, unchanged):

| task | cron | lastRunAt | reading |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 2026-09-22T14:14:18Z | this run |
| `04-scanner` | `0 */4 * * *` | 2026-09-22T14:09:57Z | fired, **blind** (F4) |
| `03-machine-minder` | `0 9 * * *` | 2026-09-21T23:02:53Z | on cadence, next 23:02Z |
| `05-sot-keeper` | `10 0 * * *` | 2026-09-21T14:10:40Z | **see F1 — nearly filed as a missed occurrence, and it was not** |

**[MEASURED] Section 5 of the sweep produced ZERO `[STALE]` escalation rows** — every row was
`[FILE]`. There was nothing to discharge into `needs-marco/discharged/` this run, which is the same
answer the 13:25Z run got and a different one from the eleven dead rows of 2026-09-10.

**[MEASURED] The queue holds 16 prompts at depth 1, exactly ONE of which lint ADMITs.**
`triage-holds.ps1`, read-only, both controls passing (GIT control PASS — `git` read 214,264 chars of
`origin/main:DOCTRINE.md`, so the gate probes can run; SPENT control PASS — exit 3 on the fixture, so
the SPENT bucket is measurable):

```
HOLD=16, ready=0, LOOPING=0
SPENT                     : (none)
GATES SATISFIED (ADMIT)   : pr-scopecards-s7-one-cutting-total-HOLD.md
POSSIBLE DUPLICATES       : (none) — the open board is EMPTY, so nothing can be a duplicate OF
STILL GATED (exit 1)      : 15  — 11 [HUMAN_GATE_PRESENT], 4 [FILE_GATE_NOT_RELEASED]
SPENT BEHIND A REJECT     : (none)
TOTALS  spent=0 of 16  gates-satisfied=1  still-gated=15  unreadable=0
```

**[MEASURED] That one ADMIT carries a PROSE human gate, and all three of the linter's literal
markers are absent from it.** Node, reading the file directly — this is the case §9.5 records as
invisible to both `lint-prompt.mjs` and to a RULE-4 union grep:

| probe | result |
|---|---|
| `DO_NOT_ARM_COMMENT` `/watcher:\s*do-not-arm/i` | **absent** |
| `DO_NOT_ARM_CAPS` `/DO NOT ARM/` (case-sensitive) | **absent** |
| `ARM_ONLY` `/Arm ONLY/i` | **absent** |
| POSITIVE control `/escalates:\s*true/` | **PRESENT** |
| NEGATIVE control, a freshly minted needle | absent |
| the prose line itself | ``…`CUTTING_ONE_SURFACE_V1` (S6) is on `main` - it is, as of `eb3086fa`. **Arming is Marco's.**`` |

The body says it twice over: front matter `escalates: true`, the Guardrails section reads *"three
migrations (one a backfill, one a NOT NULL) across five modules' money paths. **Marco merges, not
automation.**"*, and the STATUS section ends **"Arming is Marco's."**

**[MEASURED] The watcher clone is unchanged from the 13:25Z reading: 22 behind, one tracked-dirty
file.** Read-only git only — no checkout, no merge, no commit, no stash in `C:\po-watcher\ProjectOperations`:

```
HEAD                                                 a31e86d5
git rev-list --left-right --count HEAD...origin/main  0	22
git status --porcelain --untracked-files=no           M docs/data-model/metadata-catalog.json
git status --short                                    the same, plus ?? .codex/  ?? AGENTS.md
                                                      ?? scripts/pr-watcher/.conflict-notified-prs.json
```

**NOT corrupt** — on `main`, no `MERGE_HEAD`, no rebase, no unmerged paths. The sweep's `dirty=4` is
the untracked-inclusive count §9.5 records; the number `start-watcher.ps1` actually gates on is
**1**, and a tracked-dirty clone auto-stashes rather than refusing. `pr-2080-review.md` has left the
untracked list since 13:25Z, so the verdict mirror caught up.

**[MEASURED] There is a three-day hole in the scheduled-run record, and a two-day one before it.**
Scanning `…\local-agent-mode-sessions\<a>\<b>\<dir>` for a directory of **any** name and reading
`birthtime` (the `local_*` filter has been blind since the 2026-09-15 rename), **1621** directories
retained:

```
2026-09-09 = 7   2026-09-10 = 30  2026-09-11 = 8   2026-09-12 = 0   2026-09-13 = 0
2026-09-14 = 28  2026-09-15 = 13  2026-09-16 = 8   2026-09-17 = 19
2026-09-18 = 0   2026-09-19 = 0   2026-09-20 = 0
2026-09-21 = 36  2026-09-22 = 19
```

POSITIVE control that an absence is real and not retention: 09-09 through 09-11 and 09-14 through
09-17 are all still on disk either side of the holes, and 05's 09-21 directory (`306a8e85`,
14:10:40Z) survives two days later. **Zero directories on 09-12, 09-13, 09-18, 09-19 and 09-20** is
therefore five days on which no scheduled station fired at all.

## WHAT CHANGED

**1. Nothing was armed.** 0 prompts armed, 0 `-HOLD.md` renamed, `.arming-log.txt` untouched. The
single ADMIT is gated to Marco in prose — F2.

**2. Nothing was merged.** The board was empty when this run opened and empty when it closed. No
`gh pr merge`, no `Merge-Pr`, no auto-merge armed.

**3. Nothing was discharged from `needs-marco/`.** The sweep produced no `[STALE]` rows.

**4. The watcher was not touched.** Not restarted, not killed, not probed with `-Fix`.

**5. This breadcrumb, plus Station 04's blind-run breadcrumb, swept into one board PR** — the only
mutation this run made. See F4.

## FINDINGS

### F1 — `--freshness` `ok`, a 24-hour-stale `lastRunAt` and a `nextRunAt` already rolled to tomorrow compose into a confident "05 missed its occurrence". It had not. The jitter window had not closed.

Three instruments agreed, and the available conclusion was wrong:

| instrument | reading at 14:20Z | the conclusion it invites |
|---|---|---|
| `check-breadcrumb.mjs --freshness` | `05 … 24.2h ago (cadence 24h) ok` | the station doc's own warning: twice a 24 h cadence makes exactly one missed run **invisible**, so `ok` is not an all-clear |
| scheduled-tasks MCP | `lastRunAt 2026-09-21T14:10:40Z`, **`nextRunAt 2026-09-23T14:22:37Z`** | the 09-22 occurrence is behind us and never recorded — row 1 of the station doc's `lastRunAt` table, *"the occurrence never fired"* |
| session-directory scan | newest dirs `14:09:57Z` (04) and `14:14:18Z` (00). **Nothing for 05.** | the third instrument, the one the station doc calls decisive, agrees |

**The refutation cost one `Start-Sleep 100` and nothing else.** [MEASURED] at 14:24:17Z a new
session directory `20a28d37` exists with `birthtime` **2026-09-22T14:23:04Z** — Station 05, fired
**27 seconds after** its predicted jittered slot and **173 seconds after** the reading above. 05's
`jitterSeconds` is **757**, so its true window runs to ~14:22:37Z and every reading taken before
that is inside it.

🔴 **The general rule, because this will recur on every station and the jitter is large:** a task's
occurrence is not missed until `cron + jitterSeconds` has elapsed. `nextRunAt` rolls when the *cron*
time passes, **not** when the jittered fire happens, so it reads "already resolved" for up to
`jitterSeconds` while the run is still pending. For 05 that is a **12.6-minute** window in which all
three instruments say *missed* and the truth is *pending*. This is §7's shape with a clock: a
correct reading of the wrong quantity, from three sources that appear to corroborate each other.

⚠️ **Falsifying probe:** at any station's `nextRunAt` boundary, record `lastRunAt` and the newest
session directory, wait `jitterSeconds`, and read both again. If a directory ever appears **after**
`cron + jitterSeconds`, this bound is wrong and must be re-measured.

**DISPOSITION: ACTIONED** — the finding is the near-miss itself and the bound it yields, both
recorded here. 05 is confirmed fired and is running concurrently with this report; nothing was
escalated, nothing was re-triggered, and no "05 is silent" claim was made.

### F2 — The board is empty, the watcher is idle, and the queue's ONE armable prompt is gated to Marco in prose that no instrument can see. That is the single thing blocking progress.

Q6 of the MANDATORY ANSWER SHEET, answered properly rather than as "all healthy": 16 prompts are
staged, 15 are correctly gated, and the sixteenth — `pr-scopecards-s7-one-cutting-total-HOLD.md` —
is `ADMIT`, has no duplicate on an empty board, and **cannot be armed by any station**, because its
STATUS section says *"Arming is Marco's."* The measurement is in WHAT I MEASURED: all three of the
linter's literal markers are absent, so `lint-prompt.mjs` exits 0 and a RULE-4 union grep reads
clear. Only reading the body catches it — which is exactly the failure that burned an arm on
2026-08-28T14:09Z.

The gate is substantively right, not an oversight: three migrations, one of them a backfill and one
a `NOT NULL`, across five modules' money paths, with `escalates: true` and *"Marco merges, not
automation."* This is DOCTRINE §5 item 4 territory and §8.3's destructive-migration row. **Arming it
would have been wrong even though every automated gate cleared it.**

So the honest state of the pipeline is: **not stalled, and not working.** Nothing is broken, nothing
is dirty, nothing is wedged — and no work can start until Marco arms something.

**The question for Marco, RULE 1 applied — complete-and-additive first:**

- **(a) Arm S7 yourself when you are ready, and give the never-arm class a machine-readable marker.**
  Add the literal `<!-- watcher: do-not-arm -->` comment to any prompt whose body reserves arming to
  you, so `lint-prompt.mjs` REJECTs it `[HUMAN_GATE_PRESENT]` instead of ADMITting it. **Passes both
  halves**: it unblocks the board now (you arm S7), and permanently removes the class where a
  station must read prose to avoid arming your work. It is purely additive — it adds a comment to
  prompt bodies and changes no existing gate, no data and no code.
- **(b) Delegate arming of S7 to Station 00 in writing.** Unblocks the board now, but **fails the
  "future" half**: the next prose-gated prompt is indistinguishable from this one to every
  instrument, so the same read-the-body-or-mis-arm risk returns on the next cycle.
- **(c) Leave it.** **Fails the "immediately" half** outright — the board stays empty and the
  watcher stays idle for as long as it takes, and an idle pipeline looks identical to a healthy one
  in every report.

**DISPOSITION: ESCALATED** — it needs Marco and only Marco: arming his own destructive-migration
slice is item 1 and item 4 of DOCTRINE §5, and guessing his intent is forbidden.

### F3 — Five days in fourteen produced no scheduled run at all, and the record of that lives nowhere but the session directory

09-12, 09-13, 09-18, 09-19 and 09-20 hold **zero** session directories, against 7–36 on every
neighbouring day, with the positive control above proving retention is not the cause. On an hourly
Station 00 that is ~120 lost occurrences; on 05 it is five lost `/sot/` reconciles.

**Nothing in the pipeline's own instruments can see this.** `check-breadcrumb.mjs --freshness`
compares breadcrumb dates and reads `CLEAN` today; `lastRunAt` holds only the most recent run and
can never answer *"did an earlier occurrence fire?"*; and a station that did not run leaves no
breadcrumb to be missing from anywhere. The class is already on file as
`needs-marco/all-stations-disabled-16h-and-the-only-detector-was-disabled-too-2026-09-03.md` — that
file names a 16-hour outage; this is **three consecutive days**, an order of magnitude larger, and
the detector is still the one that was disabled.

I did not identify the cause. The obvious candidate is the desktop app being down or the machine
off, which is not a defect at all — and that is precisely why it needs measuring rather than
assuming: an outage that is *expected* and an outage that is a *fault* are byte-identical in this
record.

**DISPOSITION: DISPATCHED to Station 04 (Scanner)** — "is anything rotting?" over a longer window
than one supervisor cycle is 04's lane, and this is a read-only audit. **Station 04: group every
session directory by `CreationTimeUtc` day over 30 days, with no name filter** (the `local_*` glob
has been blind since the 2026-09-15 rename and returns an empty answer, not an error), **count the
occurrences each enabled cron should have produced per day, and report the shortfall as a rate.**
The falsifying probe is the day table in WHAT I MEASURED — if any of the five zero days returns a
directory, this finding is wrong. If the shortfall is chronic rather than episodic, it belongs to
Marco as an availability question, not to a station as a defect.

### F4 — Station 04's 14:11Z slot was BLIND, not quiet, and its breadcrumb reached nobody until this run committed it

04 dispatched two things to 00 in its F3, and both are discharged here:

1. **Commit its breadcrumb.** `00-04-scanner-2026-09-22-1411-BLIND-desktop-commander-connect-timeout.md`
   was written to the dev tree untracked — 04 may not commit there. It is in this run's board PR.
2. **Record that the slot was blind rather than quiet.** Stated here so it survives: **the
   2026-09-22T14:11Z Station 04 cycle took no sweep of any kind** — no gate liveness, no instrument
   honesty, no repo hygiene, no instruction drift, no HOLD critique, no GitHub reconciliation. The
   rotation was correctly **not** advanced, so `sweep-rotation.json` still points at the sweep that
   was due and the next 04 run will serve it. What is lost is one cycle of coverage, and anyone who
   later asks why a sweep's findings look stale should read this line, not a defect report.

04's own F1 (the Desktop Commander `CONNECT_TIMEOUT` itself) it marked **ESCALATED** with three
options. I am not re-escalating it — it is 04's escalation and its options are sound. I note only
that this run, 4 minutes later, loaded Desktop Commander on the first attempt, which is consistent
with STATION-CAPABILITIES §2's *intermittent, cause unknown, ~40% of runs* and refutes nothing.

**DISPOSITION: ACTIONED** — both handovers performed, the second of them in this paragraph.

### F5 — Two dispatches from the 13:25Z run are still open, and neither has had a chance to run yet

Carried forward so they are not lost and not re-derived:

- **To Station 04** — partition every cancelled `Tendering Browser Smoke` run on main over 14 days
  by whether `jobs` is empty (`jobs: []` ⇒ pending eviction, expected, count the rate; `jobs`
  non-empty ⇒ killed mid-flight, worth a log). 04's 14:11Z run was blind and did not reach it. **It
  is still 04's, at 18:09Z.**
- **To Station 03** — the watcher clone at 22 behind with `docs/data-model/metadata-catalog.json`
  modified. Re-measured this run and **unchanged**. 03's next occurrence is 2026-09-22T23:02Z. The
  impact remains latent: `armed: 0`, so nothing is building from that stale base. **It stops being
  latent the moment a prompt is armed** — which, per F2, is Marco's next move, so this is the
  dispatch most likely to become urgent first.

The 13:25Z run's F1 (`status-sweep.ps1` counting `cancelled` as `failed`) stays **DEFERRED** on its
own terms: the headline did not fire this cycle, and the fix is a code change to the instrument
every station opens with.

**DISPOSITION: DEFERRED** — both are correctly owned by stations with their own cadences, both
cadences fall before my next collect, and re-dispatching work that has not yet had an occurrence to
run in is how a dispatch becomes noise.

## WHAT I DID NOT DO

- **Did not arm `pr-scopecards-s7-one-cutting-total-HOLD.md`**, though it is the board's only ADMIT
  and the queue is otherwise idle. Its body reserves arming to Marco in prose (F2), and ADMIT is
  necessary, not sufficient. Arming it would have put three migrations — a backfill and a `NOT
  NULL` across five modules' money paths — into a build on an authority nobody granted.
- **Did not stage the `rates-11c-blocked-consumers` backlog item**, which the sweep again tags READY
  TO STAGE. Its own note requires `pr-rates-11b2-c-parity-proof` to have RUN and come back clean;
  that proof has still not run. Unchanged from the 13:25Z run's reasoning, and unchanged for the
  same reason: staging it puts a destructive table-drop chain in front of an instrument that has
  never produced a verdict.
- **Did not restart, kill or probe the watcher with `-Fix`.** RUNNING pid 9744, wrapper alive, 0
  armed. That is HEALTHY-and-idle, and "never restart on idle" is the rule that once nearly killed a
  working queue.
- **Did not run `rescue-watcher-repo.ps1`.** The clone is on `main` with no `MERGE_HEAD`, no rebase
  and no unmerged paths — the "parked and harmless" reading, not `*** CORRUPT`.
- **Did not run any `git` write in the watcher clone**, and did not touch `.codex/`, `AGENTS.md` or
  `.conflict-notified-prs.json` there. They belong to a lane I did not identify; deleting another
  actor's untracked work is not recoverable.
- **Did not run VM-side `git` against any mount.** The guard reported INERT (exit 2), and an inert
  guard is never a licence — it is the reason to be careful, not the reason to proceed.
- **Did not archive either breadcrumb into `docs/pr-prompts/archive/`.** The rule exists because the
  queue root once held 159 breadcrumbs against 59 live prompts; today `check-breadcrumb.mjs` reports
  `structure: 2 checked` and `triage-holds.ps1` reports 16 prompts, so the root is legible by eye
  and archiving would add the untracked-root-copy hazard for no benefit. **DEFERRED — it becomes
  worth doing when the root breadcrumb count passes roughly the prompt count.**
- **Did not claim the sweep's `[LIVE]` lines without re-deriving the ones I acted on.** The clone's
  `dirty=4` was re-derived with `--untracked-files=no` (true tracked count: 1), and the trunk verdict
  was taken per-commit.
- **Did not touch Azure, Entra or SharePoint**, and did not write production data. Absolute, and not
  reasoned past.
