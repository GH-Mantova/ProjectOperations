# Station 03 — Machine Minder | 2026-09-16T23:02:04Z–2026-09-16T23:11:54Z

## For Marco

**The machines are HEALTHY. The reporting chain is not, and that is the whole of this run.**

1. **`00-supervisor` is `enabled: false` and last ran 2026-09-15T05:08:34Z — 42.0 h ago.** It is the
   only ✅ on "Arm a prompt", the primary ✅ on "Merge a PR", and the sole collector. **14 station
   breadcrumbs have been written since it stopped and 11 of them are untracked**, so they are
   invisible from a clone, from CI and from you. This one makes 12. See F2 — options there.
2. **The `needs-marco/` file whose title names this exact outage opens with a banner saying it is
   REFUTED.** The banner was true on 2026-09-10 and is false now; this is the outage's **second**
   occurrence. A reader who opens the right file today is told the problem is not real. See F3.
3. **Two heartbeat watchdogs are running against one watcher node**, both holding
   `Stop-Process -Force` over it, and `status-sweep.ps1` reports the duplicate as
   `auto-restart wrapper: alive (2)` — i.e. as health. It is harmless **only** because the armed
   queue is 0. See F1 — this is the self-sustaining kill loop the single-lane launcher was written
   to remove, re-created by the keepalive's own recovery from the incident I reported last run.

Nothing was repaired. Station 03 is report-only, and the station that dispatches repair is the one
that is switched off.

## GROUND

```
UTC            2026-09-16T23:02:04Z
origin/main    bdc5d05b            (fetched, then rev-parse)
dev tree       main @ bdc5d05b     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`), so this run was not read-only-restricted.
This was a **SIGHTED** run: Desktop Commander reached the box on the first call.
All three binding documents were read **in full** from the dev tree, and proved identical to
`origin/main` rather than assumed so — see WHAT I MEASURED, claim 2.

## WHAT I MEASURED

**1. Reachability — [MEASURED].** `start_process` shell `powershell.exe`, then
`interact_with_process` PID 12724: `Get-Date` → `2026-09-17 09:01:42` (host local, Brisbane),
`Test-Path docs\pipeline\stations\03-machine-minder.md` → `True`. Sighted, not blind.

**2. The three binding documents are current — [MEASURED], and NOT by a version match.** Run in the
**dev tree** (§ PREFLIGHT: never the watcher clone, whose `origin/main` pins to launch time):
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/03-machine-minder.md` → **EMPTY output**, which is the real answer per §9.1.
No piped `hash-object` form was used or quoted. DOCTRINE.md read in full (2545 lines),
STATION-CAPABILITIES.md in full (544 lines), station doc in full (349 lines).

**3. Device-bridge git guard installed — [MEASURED], last line quoted as the contract requires.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

```
vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd,
allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

PASS. No VM-side `git` was run against the Windows `.git` at any point in this run.

**4. Sweep — [MEASURED].** `scripts\pipeline\status-sweep.ps1 *> <file>`; `SWEEP_EXIT=10`.
Capture confirmed **UTF-16LE** (`BYTES=150368 BOM=fffe`) and decoded `utf16le` in node before
reading — §9.3's `*>` trap, met and handled. 896 lines, 10 sections.
**§7 VERDICT: `SAFE TO ACT: no board mutation in progress, no recent remote activity, no live
station worktrees.`**

**5. Locks — [MEASURED], and there are none.** Sweep §3: `git index.lock interactive/clone:
False / False`, `git processes touching our trees (scoped): 0`. Independently in the clone:
`MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply`, `sequencer`,
`index.lock` → **all False**. No byte-size/age cross-check was needed because no lock exists.

**6. The watcher chain is alive, three deep — [MEASURED] by command line, never by image name.**
10 `node.exe` were running and exactly one is the watcher:

| | value |
|---|---|
| watcher node | **pid 30248**, `StartTime 2026-09-16T00:35:18Z` (22.5 h), `...\pr-watcher\index.mjs` |
| its parent | **14704** `start-watcher.ps1` |
| its grandparent | **14836** `watcher-launcher-singlelane.ps1`, relaunched `2026-09-15T22:21:22Z` |
| clone | `branch=main`, `0 0` vs `origin/main` (`rev-list --left-right --count`) |

**7. The rescan loop is NOT frozen and NOT paused — [MEASURED] with the authoritative probe.**
`.queue-state.json` `ts` sampled **twice, 5 min apart**: `2026-09-16T23:05:25.094Z` →
`2026-09-16T23:10:25.075Z`, a delta of exactly one `RESCAN_INTERVAL_MS`. Corroborated by the live
daily log, found by **name shape then mtime** and never by constructing a date (§9.5):
`...\pr-watcher\logs\2026-09-16.log`, mtime `2026-09-16T23:05:25Z`, 83,868 B — two minutes old at
reading. Heartbeat is `2026-09-16T14:32:27Z`, **517.9 min** stale, and that is **legitimate idle**,
not wedged: armed = 0, and the watchdog's own gate is
`if ($armed.Count -eq 0) { continue }   # empty queue: a stale heartbeat is legitimate idle`.

**8. Armed queue = 0 — [MEASURED] at TOP LEVEL ONLY**, per this station's own rule that
`-maxdepth 2` returns 1600+ inert retirement files. `Get-ChildItem docs\pr-prompts -Filter
'*-ready.md' -File` → **0**. No kill sentinel exists in the watcher directory.

**9. The sweep's clone-dirty warning is the DOCUMENTED FALSE POSITIVE — re-derived, NOT re-filed.**
Sweep: `[LIVE] watcher clone: branch=main dirty=3  <-- NOT clean-on-main; the watcher may refuse to
start`. Both forms run against the clone in the same minute, which is §9.5's own falsifying probe:

| form | result |
|---|---|
| `git status --short` (what the sweep counts) | **3** |
| `git status --porcelain --untracked-files=no` (what `start-watcher.ps1` counts) | **0** |

The three are `?? docs/pr-reviews/pr-1986-review.md`, `?? docs/pr-reviews/pr-1987-review.md`,
`?? scripts/pr-watcher/.conflict-notified-prs.json` — two of them review verdicts the `rev-<N>` job
writes into the clone **by design**. The clone is genuinely clean and the watcher would auto-stash
even if it were not. DOCTRINE §9.5 already records this defect **and** records that archived runs
have mis-routed it to Station 03 as clone hygiene. **I am therefore not filing it as a finding** —
it is a known instrument defect whose cure is a `scripts/` change, and re-filing it is the measured
failure mode.

**10. failed/ holds NOTHING new since my last run — [MEASURED].** Entries newer than my previous
breadcrumb (`2026-09-15T23:13Z`): **0**. Newest three are `09-15 01:15Z`
`pr-fv2-import-s2-review-route-c-ready.md.report.md`, `09-15 01:15Z` `...-ready.md.log`
(`WATCHER: agent exited 0 but opened no PR`) and `09-14 08:32Z` `rev-1923-ready.md.log` — all three
predate my 09-15 run and were triaged then. `failed/` total 52. **No triage was performed this run
and none was due**; nothing is limit-parked, so no `## Parked` section is present.

**11. Two §9 traps re-confirmed live, both with the cure working — [MEASURED].** Offered because §9
asks for its falsifying probes to be re-run, and both fired on real work rather than on a fixture:

- **§9.1 nested-`-Command` expansion.** My first call passed
  `powershell -NoProfile -Command "Write-Output ('HOST=' + $env:COMPUTERNAME); ..."` through
  `start_process`. It arrived as `Write-Output ('HOST=' + );` and died
  `ParserError: You must provide a value expression following the '+' operator` — `$env:COMPUTERNAME`
  **consumed before the child parsed**. The identical statement sent **direct** to the shell via
  `interact_with_process` returned its value. This is exactly the 2026-09-14 correction's two-row
  table (`ROW_B_nested_Command` never printed `42`); the bullet stands and is not a regression.
- **§9.1 early return reported as completion.** `read_process_output` on PID 12724 returned
  `MARKER_SWEEP_DONE` while **omitting the preceding `SWEEP_EXIT=10`**. Re-reading the same buffer
  with an explicit `offset: -8` returned **both** lines. Output was pending, not absent — the
  2026-09-14T20:3xZ correction ("READ ITS BUFFER") is what recovered the exit code, and a run that
  had trusted the first read would have reported a sweep with no exit status.

**12. Scheduled state, read ONLY from the scheduled-tasks MCP — [MEASURED].** Never from a folder
or a state file, per sweep §4C:

| task | cron | enabled | lastRunAt |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | **false** | **2026-09-15T05:08:34Z** |
| `03-machine-minder` | `0 9 * * *` | true | 2026-09-16T23:01:15Z (this run) |
| `04-scanner` | `0 */4 * * *` | true | 2026-09-16T22:10:01Z |
| `05-sot-keeper` | `10 0 * * *` | true | 2026-09-16T14:11:02Z |
| `weekly-security-audit` | `30 7 * * 1` | false | 2026-09-06T21:32:44Z |

Live enabled count is **three stations plus nothing else** — 03, 04, 05. My own cadence reads
DAILY (`0 9 * * *`) against a bootstrap that says "every 4 hours"; that disagreement is **already
open with Marco** per STATION-CAPABILITIES §5 and is not re-filed here.

## WHAT CHANGED

**Nothing on the board, in either git tree, or in any scheduled task.** No prompt armed or disarmed,
no PR opened or merged, no label touched, no worktree pruned, no process started or killed, no
`/sot/` edit, no Azure / Entra / SharePoint contact.

Three writes, all outside the board and all verified:

1. `vm-git-guard` shim installed at `/sessions/<id>/.local/bin/git` inside the Linux VM — idempotent,
   re-verified byte-identical on re-run, and it constrains this run rather than enabling it.
2. Two scratch captures in `C:\po-sup-fix-scripts\` (`sweep-0903.txt`, `sweep-0903.utf8.txt`).
3. This breadcrumb, in the **dev tree** at `docs/pr-prompts/` — a tracked directory, not one of the
   five gitignored sinks at `.gitignore`'s `# Overnight-QA scheduled task` block, and not a
   disposable worktree. ⚠️ **It is UNTRACKED until a board PR commits it, and per F2 no station is
   currently opening board PRs**, so it will not reach a clone or CI on its own.

## FINDINGS

### F1 — Two heartbeat watchdogs hold kill authority over one node; the keepalive cannot see a wrapper, only a node; and the sweep reports the duplicate as health

**[MEASURED]** 2026-09-16T23:0xZ at `bdc5d05b`. Two `watcher-launcher-singlelane.ps1` instances are
running, and only one supervises the node:

| wrapper | relaunched (`ensure-watcher.log`) | children | CPU seconds | owns node 30248? |
|---|---|---|---|---|
| **14836** | `2026-09-15T22:21:22Z` | 3, incl. `14704` start-watcher | **4.2** | YES |
| **25260** | `2026-09-15T23:15:02Z` | 2, incl. **`30216`** | **127.6** | **NO** |

**The discriminating measurement is the CPU time and the child's payload, not the process count.**
PIDs `13140` (under the live wrapper) and `30216` (under the orphan) carry **byte-identical
`-EncodedCommand` payloads**, which decode to `function Resolve-WatchdogJudgedAgeMinutes(... $HungMin)`
— they are both the **heartbeat watchdog** child of `supervise-watcher.ps1`. So the orphan is not a
parked process that happens to linger: it is a second live supervisor loop that has burned **30× the
live wrapper's CPU while supervising nothing**, and it holds the watchdog's
`foreach ($p in $node) { Stop-Process -Id $p.ProcessId -Force }` authority over the one real node.

**Mechanism, read from source — the guard tests the wrong object.** `ensure-watcher.ps1` §2 is:

```powershell
$alive = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
           Where-Object { $_.CommandLine -match 'pr-watcher[\\/]index\.mjs' })
if ($alive.Count -ge 1) { Write-Log (...); exit 0 }
```

It stands down when a **node** is alive. It never asks whether a **wrapper** is already looping. And
`watcher-launcher-singlelane.ps1` is a bare `while (-not (Test-Path $stopSentinel))` loop with
`Start-Sleep -Seconds 10` between restarts and **no mutex, PID file or singleton check**. So during
any node-down window — including the launcher's own deliberate 10-second restart sleep — the
keepalive spawns an **additional detached launcher**, which then loops forever alongside the first.
That is not a one-off: the two RELAUNCHED events above are **53 minutes apart**, both inside the
recovery from the incident my previous run reported
(`00-03-machine-minder-2026-09-15-2303-a-plain-logoff-killed-the-watcher-for-nine-hours...`), i.e.
**the duplicate was manufactured by the keepalive's own recovery.** `ensure-watcher.log` holds 35
RELAUNCHED events in total. The crash-loop guard cannot catch this: it counts RELAUNCHED lines
inside a rolling window, so duplicates that accrue one per widely-spaced incident are invisible to it.

**Why nothing has broken in 24 hours, stated exactly so this is not over-read.** The watchdog's own
gate is `if ($armed.Count -eq 0) { continue }   # empty queue: a stale heartbeat is legitimate idle`,
and armed is **0**. `$wdHungMin = 15`. No kill sentinel exists. **The hazard is latent, not active:**
it arms the moment a prompt is armed while the judged heartbeat age exceeds 15 min, at which point
**both** watchdogs evaluate the same condition against the same node and both may kill it, and each
supervisor's exit handler then relaunches. That is precisely the self-sustaining kill loop
`watcher-launcher-singlelane.ps1`'s own header comment was written to eliminate ("two lane-1 prompts
made it kill a perfectly healthy lane-0 node every ~4.5 minutes … The heartbeat only ticks while a
prompt is RUNNING, so the node could never clear the staleness it was being killed for"). The
`ADOPT` path at `supervise-watcher.ps1` L308 bounds it to one *node*; it does not bound the number of
*killers*.

**And the instrument reports it as health.** `status-sweep.ps1` prints
`[LIVE] auto-restart wrapper: alive (2)`. It counts wrappers and presents the count as aliveness, so
the one line that would surface this condition reads **better** the worse the condition gets. Nothing
is empty and nothing warns, so §9.6 does not fire — this is §7's shape, a derived verdict over live
data, and §9.5's rule that a `[LIVE]` line must be re-derived from its own source before being acted
on is what exposed it.

**RULE 1 options.** This would normally be **DISPATCHED to Station 00**, which owns repair dispatch;
00 is switched off (F2), so it is put to Marco as the only available actor.

- **(a) COMPLETE AND ADDITIVE — give `ensure-watcher.ps1` a wrapper-level singleton guard, and have
  `status-sweep.ps1` report a wrapper count > 1 as a DEFECT rather than as aliveness.** Test §2 for
  an existing `watcher-launcher*.ps1` process as well as for a node, and stand down if either is
  present. *Complete*: it fixes today's duplicate **and** every future node-down window, and it
  fixes the blindness that let this sit for 24 hours unremarked. *Additive*: it starts nothing, kills
  nothing, and removes no existing instruction — a guard that stands down can only ever launch fewer
  watchers, never fewer than one, because the node-alive test still runs first. **Passes both halves.**
  Both files are outside this repo (`C:\po-watcher\`), so the code is Marco's to place; the
  `status-sweep.ps1` half is a `scripts/` change and therefore a PR another station must open.
- **(b) Kill wrapper 25260 now and leave both scripts unchanged.** *Additive* — it removes a killer,
  and the live chain is untouched. **Fails *complete*:** the next node-down window re-creates it, and
  the sweep will keep reporting the recurrence as health.
- **(c) Leave it; armed is 0 so nothing fires.** *Additive*. **Fails *complete*:** it holds only
  while the queue stays empty, and the whole purpose of 00 being re-enabled (F2) is to arm prompts —
  so (c) is specifically unsafe in combination with fixing F2, which is the change most likely to
  happen next.

⚠️ **Falsifying probe:** re-read the two wrappers' child `-EncodedCommand` payloads and their CPU
seconds. If `25260`'s payload is not the watchdog, or its CPU time is ~0, this finding is wrong and
must be re-measured. If `ensure-watcher.ps1` §2 ever tests for a wrapper process, option (a) has
landed.

**DISPOSITION: ESCALATED** — needs Marco, because the normal recipient (Station 00) is provably
absent, and because two of the three files involved live outside this repo.

### F2 — `00-supervisor` has been disabled for 42 hours; 11 of the 14 breadcrumbs written since are untracked, so the collect channel is not merely stopped, it is invisible

**[MEASURED]** from the scheduled-tasks MCP at 2026-09-16T23:0xZ: `00-supervisor`
**`enabled: false`**, **no `nextRunAt`**, `lastRunAt 2026-09-15T05:08:34.065Z`, cron `5 * * * *`
(hourly). Elapsed **42.0 h** ⇒ roughly 42 missed occurrences.

Breadcrumbs written to `docs/pr-prompts/` since that timestamp, each tested individually with
`git ls-files --error-unmatch`:

| written (UTC) | tracked | file |
|---|---|---|
| 09-15 05:10 | **NO** | `00-00-supervisor-2026-09-15-blind-no-shell.md` |
| 09-15 06:11 | **NO** | `00-04-scanner-2026-09-15-0000-blind-run-no-windows-shell.md` |
| 09-15 07:05 | YES | `00-00-supervisor-2026-09-15-0640-the-escapee-scan-could-not-see-a-tree...` |
| 09-15 10:46 | **NO** | `00-04-scanner-2026-09-15-1010-a-file-gate-outlived-the-prompt...` |
| 09-15 22:35 | **NO** | `00-04-scanner-2026-09-15-2222-every-section-9-trap-probed-still-reproduces...` |
| 09-15 23:13 | **NO** | `00-03-machine-minder-2026-09-15-2303-a-plain-logoff-killed-the-watcher...` |
| 09-16 02:21 | **NO** | `00-04-scanner-2026-09-16-0219-the-sweeps-preserve-warning-parked-an-orphan...` |
| 09-16 03:48 | YES | `00-05-sot-keeper-2026-09-15-2222-the-heartbeat-alarms-on-a-station-that...` |
| 09-16 06:18 | **NO** | `00-04-scanner-2026-09-16-0610-station-00-is-disabled-and-the-bootstrap...` |
| 09-16 09:47 | YES | `00-06-pr-master-2026-09-16-0456-a-prompt-that-held-was-resolved-to-another...` |
| 09-16 10:16 | **NO** | `00-04-scanner-2026-09-16-1011-blind-run-and-the-watcher-reset-destroys...` |
| 09-16 14:12 | **NO** | `00-04-scanner-2026-09-16-1410-blind-again-and-the-dev-tree-has-not-fetched...` |
| 09-16 18:20 | **NO** | `00-04-scanner-2026-09-16-1810-the-escalation-that-names-the-live-station-00...` |
| 09-16 22:15 | **NO** | `00-04-scanner-2026-09-16-2211-blind-again-but-the-mount-lived...` |

**14 breadcrumbs, 11 untracked.** The three that are tracked were swept in by PRs that 05 and 06
opened for their own work — i.e. collection is happening only by luck, for the stations that happen
to open PRs. **Station 03 opens none** (STATION-CAPABILITIES §5: "Create a PR ❌"), so my last
report and this one both sit untracked.

**This is worse than a stopped collect, and the difference is the half worth escalating.** The
station contract's fallback — "the breadcrumb is untracked until the next board PR commits it — say
so in your chat report so Station 00 sweeps it up" — names Station 00 as the sweeper. With 00 off,
the fallback's recipient is the thing that is missing, so the reports are not queued for later: they
are accumulating in a tree that a clone, CI and any cloud-fired station cannot see. `sot/`-adjacent
consequences follow from the same cause: nothing arms, `docs/pipeline/sweep-rotation.json` is left
dirty by design for 00 to commit and is still dirty, and every open DISPATCH to 00 — including F1
and F4 of this run — has no recipient.

**This is the SECOND occurrence**, not a new condition: the same outage ran 2026-09-08T05:08Z →
2026-09-10 (re-enabled), and resumed 2026-09-15T05:08Z. **Station 04 independently found and filed
the current instance at 2026-09-16T06:18Z**, 17 hours before this run, and its breadcrumb is one of
the 11 untracked. I am corroborating rather than re-diagnosing, per this station's own
known-pattern-first rule.

**RULE 1 options** (unchanged in substance from the standing escalation, restated because the
standing escalation is currently annotated REFUTED — see F3):

- **(a) COMPLETE AND ADDITIVE — tell us it is off on purpose and name who COLLECTS meanwhile, in a
  file the next run reads.** *Complete*: it ends the condition **and** the recurring re-derivation,
  because the answer becomes a written fact instead of something five consecutive runs rebuild from
  first principles — the exact cost DOCTRINE §10.2.1 records. *Additive*: nothing is enabled or
  merged by an agent on a guess and no in-flight work is discarded. **Passes both halves.**
- **(b) Re-enable `00-supervisor` now.** Passes *complete*. **Fails *additive*:** it returns an
  arming-and-merging actor to a board you may be driving by hand, and re-enabling a scheduled task
  is an authorization grant no station may make (DOCTRINE §5.3). ⚠️ **If (b) is chosen, F1 must be
  fixed first or in the same change** — arming a prompt is the precise trigger that takes F1's
  duplicate watchdog from latent to active.
- **(c) Leave it; the next 03/04/05 run will notice.** *Additive*. **Fails *complete*:** three runs
  have now noticed and filed, and noticing is not collecting.

⚠️ **Falsifying probe:** read `enabled` and `nextRunAt` for `00-supervisor` from the scheduled-tasks
MCP. If `enabled` is `true`, this finding is spent.

**I did not re-enable the task** and did not commit `sweep-rotation.json`.

**DISPOSITION: ESCALATED** — the switch is in the scheduled-tasks layer, which is Marco's, and
granting arm-and-merge authority back to an automated actor on a guess is a hard stop.

### F3 — The one `needs-marco/` file whose title names this outage opens with a banner declaring it REFUTED, and the banner is now false

**[MEASURED]** 2026-09-16T23:0xZ.
`docs/pr-prompts/needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md` (mtime
2026-09-10T05:21Z) begins:

> 🔴 **SPLIT 2026-09-10 — THIS FILE BUNDLES A DEAD FINDING WITH A LIVE ONE, AND THE TITLE IS THE
> DEAD ONE.** … **F1 (Station 00 is DISABLED) is REFUTED.** [MEASURED] 2026-09-10T06:1xZ from the
> scheduled-tasks MCP: `00-supervisor` `enabled: true` … **Read that file for F2. Do not close it on
> the strength of this one's title.**

That annotation was **correct on 2026-09-10**. It is **false now**: the MCP reads `enabled: false`
with `lastRunAt 2026-09-15T05:08:34Z` (F2). The file's own stated falsifying probe — *"read
`enabled` for `00-supervisor`; if it is `true`, this addendum is spent"* — has flipped back, and
nothing re-opened the file.

**The consequence is specifically directional.** `needs-marco/` is the channel that reaches Marco.
The file whose *title* names the live condition now tells any reader, in its first line, that the
condition is refuted — so the more precisely someone searches for this outage, the more confidently
they are told it is not real. This is DOCTRINE §9.5's closing lesson exactly: *"a hash-gated
canonical block is protected against being EDITED, not against going STALE"*, and a claim that
outlives its SHA sends its reader to the wrong conclusion. It is aggravated by the annotation having
been written **by Station 00 itself**, the station that is now off and cannot revisit it.

**Station 04 reported this at 2026-09-16T18:20Z**
(`00-04-scanner-2026-09-16-1810-the-escalation-that-names-the-live-station-00-outage-is-annotated-refuted.md`,
untracked per F2). This run re-verified its central claim against the live system rather than
carrying it forward, per DOCTRINE §7.1's re-read rule, and it holds.

**The remedy is one annotation**: re-open F1 in that file with today's measurement, noting it is the
second occurrence and that the 2026-09-10 REFUTED block stays as written (it was a true measurement
of its day, and deleting it would cost the next reader the pair). Station 03 may not edit
`docs/pr-prompts/` beyond its own breadcrumb and may not open a PR, so I have not touched the file.

⚠️ **Falsifying probe:** the file's own — read `enabled` from the MCP. If it reads `true`, the
banner is correct again and this finding dies.

**DISPOSITION: DISPATCHED** — to **Station 00**, which authored the REFUTED banner and owns
`needs-marco/` annotation. ⚠️ **The recipient is the subject: 00 is the station that is off.** F2's
resolution is the precondition for this dispatch being deliverable, which is why F2 is escalated
separately rather than folded in here.

### F4 — The `po-vg` orphan worktree has been preserved for 12.6 days over a file that is an EARLIER DRAFT of work already on main

**[MEASURED]** 2026-09-16T23:0xZ. Sweep §2 reports four orphaned worktrees and two
registry-escapees; the only one carrying the blocking warning is:

```
[LIVE] orphaned worktree (aborted run leftover -- investigate/prune): C:/PR-Master/worktrees/po-vg
[LIVE]    dirty=1 files  age=18190 min
[LIVE]    <-- HOLDS UNCOMMITTED WORK (1 file(s)). PRESERVE OR COMMIT BEFORE PRUNING
```

18,190 min = **12.6 days**. The one file is
`?? scripts/pipeline/check-pipeline-heartbeat.mjs` (untracked in that worktree). Measured against
`origin/main`, with both controls:

| probe | result |
|---|---|
| `git cat-file -e origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` | **exit 0 — the path IS on main** |
| POSITIVE control, same form on `docs/pipeline/DOCTRINE.md` | exit 0 |
| NEGATIVE control, freshly minted needle `scripts/pipeline/zzQq03Needle20260916T2310.mjs` | exit 128, `does not exist in 'origin/main'` |
| `git rev-parse origin/main:<path>` | `84ec92d4720241431ca9e5d4ed53da5961e9a2fc` |
| `git hash-object <worktree copy>` | `9c4587fbf4e906fca096941f014de8ef4671ebee` |

**The blobs DIFFER, so "the file is already rescued" is not sufficient on its own** — and that
matters, because a station that stops at the path-exists reading would prune a worktree holding
content nobody has. The direction was settled by measuring content and dates, not size alone:

| | main | worktree |
|---|---|---|
| bytes / lines | 6,746 / 138 | 6,144 / 130 |
| differing lines | — | **95** |
| dated | last commit `2026-09-04T21:38:04Z` (`992b2479`) | file mtime `2026-09-04T07:55:32Z` |

Main's copy was committed **13.7 hours after** the worktree copy was last written, is larger, and
contains a block the worktree copy lacks entirely — the pause-ceiling reasoning (*"An UNBOUNDED
pause is an off switch … `\"until\": \"2099-01-01\"` would silence this check forever"*), where the
worktree is still at a bare `const DIR = "docs/pr-prompts";`. **The worktree holds an earlier draft
of work that subsequently landed.** Nothing is lost by pruning it.

This is the same condition Station 04 filed at 2026-09-16T02:21Z
(`...-0219-the-sweeps-preserve-warning-parked-an-orphan-for-twelve-days-over-a-file-already-rescued.md`).
⚠️ **I am narrowing its claim, not merely confirming it:** the file is **not** byte-identical to
main, so "already rescued" is the right conclusion reached through a probe that does not establish
it. The sound discharge is the supersession above — same work, main's commit later, main strictly
larger — and that is what a future run should re-check rather than a hash equality that will never
hold.

⚠️ **Falsifying probe:** re-run the two blob reads and the date pair. If the worktree copy ever
proves **newer** than main's last commit for that path, or contains a symbol absent from main, it
holds real work and must be preserved.

**DISPOSITION: DISPATCHED** — to **Station 00**, for the prune. Station 03 is report-only and does
not prune worktrees even when the sweep addresses the line to it; and ⚠️ the same channel caveat as
F3 applies. The two registry-escapees (`C:\PR-Master\worktrees\s2afix`, `...\s3hex`, both
`size=0KB`, `.lock=False`, ages 1104 and 1176 min) are reported here for the same dispatch but were
**not** independently verified this run — they are leads, not findings, and are recorded under this
disposition only as scope for whoever prunes.

## WHAT I DID NOT DO

- **Did not repair anything.** Station 03 is report-only (STATION-CAPABILITIES §5:
  "Repair the machines — ⚠️ report-only"). Specifically: did not kill wrapper 25260 or its watchdog
  child 30216, did not restart or relaunch the watcher, did not prune any worktree, and did not
  clear a lock (there was none to clear).
- **Did not re-enable `00-supervisor`** or change any scheduled task. That is an authorization grant
  in a layer only Marco controls (DOCTRINE §5.3), and it is the subject of F2's question rather than
  something to settle by acting.
- **Did not edit `needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md`** despite
  its banner being false (F3). Board mutation is ❌ for this station; the correction is dispatched.
- **Did not touch the board**: no arm, disarm, merge, label change, PR, or `docs/pr-prompts/` write
  other than this breadcrumb. `armed` was 0 and stayed 0.
- **Did not touch `/sot/`** — Station 05's, CP-24.
- **Did not touch Azure, Entra or SharePoint**, and ran no `az` or `Connect-MgGraph`. Absolute.
- **Did not write production data.**
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard was installed
  first and every git command in this run ran in PowerShell on the host.
- **Did not run `git checkout .`, `reset --hard`, `stash pop` or `git clean`** in the dev tree.
- **Did not commit** anything, so the shared dev-tree index was not touched. ⚠️ Noted for whoever
  does: `git status --porcelain` shows pre-existing staged/modified entries from other actors
  (` M docs/data-model/metadata-catalog.json`, ` M docs/pipeline/sweep-rotation.json`,
  ` M docs/pr-prompts/.arming-log.txt`, ` D docs/pr-prompts/pr-crmvis-register-residual-HOLD.md`) —
  **commit this breadcrumb with an explicit pathspec**, never `git add -A`.
- **Did not re-file the sweep's clone `dirty=3` warning** as clone hygiene. It is the documented
  §9.5 false positive, re-derived to 0, and re-filing it is the recorded mis-route.
- **Did not triage `failed/`** — measured 0 new entries since my last run, so there was nothing due.
- **Did not verify** the two worktree registry-escapees beyond quoting the sweep's `[LIVE]` line, and
  did not open the other three orphaned worktrees. Recorded as scope under F4, not as findings.
- **Did not act on any `[LIVE]` line without re-deriving it** from its own source, per §9.5.
