# Station 00 — Supervisor | 2026-10-11T09:43Z–2026-10-11T10:25Z

## GROUND

```
UTC            2026-10-11T09:43:28Z   (first host shell returned; task lastRunAt 2026-10-11T09:42:31Z)
origin/main    bf245896               (git fetch origin exit 0, then git rev-parse --short origin/main)
dev tree       main @ bf245896        C:\ProjectOperations2   (0 0 vs origin/main; numstat EMPTY, cached EMPTY, porcelain tracked 0)
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter, read from origin/main)
bootstrap      1                      (scheduled-task SKILL.md station_doc_version)
```

Version check: doc version 1 == bootstrap 1. **No mismatch — this run was NOT read-only.**

**This run was SIGHTED.** Desktop Commander connected on the first call after one keyword
`ToolSearch` for `desktop-commander` (the first search returned "still connecting"; the second
returned the toolkit — an unloaded schema, not blindness). All three preflight documents were read
in full from `git show origin/main:<path>` in the dev tree after `git fetch origin` (exit 0):
`00-supervisor.md` (466 lines), `DOCTRINE.md` (508 lines), `STATION-CAPABILITIES.md` (740 lines).

---

## WHAT I MEASURED

**1. The device bridge reached the box, on the first call after the load. [MEASURED]**
`start_process` / `powershell.exe` returned `PREFLIGHT_OK` and `2026-10-11 09:43:28 UTC`. No retry
needed, so BOOTSTRAP_CONNECT_RETRY_V1 did not fire. This ends the pattern of alternating
blind/sighted occurrences only for this hour; see §9.

**2. The VM-side git guard COULD NOT BE INSTALLED — the sandbox shell is wedged, for the second
consecutive sighted run. [MEASURED]**

```
attempt 1  bash .../scripts/pipeline/vm-git-guard.sh   -> timed out after 30s
                 "the workspace did not confirm the command started before the timeout"
attempt 2  same call -> bash failed on resume, create, and re-resume.
                 resume: RPC error -1: process with name "tender-sharp-bohr" already running
                 (id: oneshot-3fe0475d-262a-4b22-8e85-1ea720dc2bc2)
                 create: RPC error -1: process with name "tender-sharp-bohr" already running
attempt 3  same call -> timed out after 30s again (attempt 3 of 5 since last success)
```

**There is no installer last line and no installer exit code to quote, because the installer never
ran.** This is the fourth outcome F6 of the 0815 breadcrumb named and the three-outcome table does
not cover: *the shell the installer would run in does not exist.* Per the contract this is a
FINDING, not a STOP, and it is **not a licence to run my own `git` against the mount**: I ran
**zero** VM-side git this run. Every git call below was native `git.exe` on the Windows host in the
dev tree, which is the path bootstrap STEP 2 mandates. The collateral cost is the same as last run:
no host reading could be cross-checked against a second instrument.

**3. THE CENTRAL NEW MEASUREMENT: `Get-CimInstance Win32_Process` ANSWERS AGAIN, with both
controls, so F1's blocking precondition is now MET. [MEASURED]**

The 0815 breadcrumb's F1 forbade any kill because DOCTRINE §9.5 requires a verified command line
per PID and *both* instruments that could supply one (CIM and WMI) were starved. **That is no
longer true.** Run from a `.ps1` via `-File` (§9.1), positive control first (§7):

```
CIM_CONTROL_explorer=OK count=1                       <- POSITIVE control: CIM can produce a result
CIM_powershell=OK count=1017                          <- the reading the 0815 run could not obtain
CIM_NEGATIVE_control=OK count=0 (expect 0)            <- NEGATIVE control: a minted impossible name
```

The 0815 run recorded `CIM_FAILED: No more threads can be created in the system.` on this exact
call. Same call, 90 minutes later, returns 1017 rows. **The starvation has eased just enough for
the diagnostic instrument to answer, while the condition itself has barely moved** (§4).

**4. The cohort is now IDENTIFIED, not merely counted. 993 of 1017 shells share ONE command line.
[MEASURED]**

```
distinct_commandlines=8
  count=993  "...\powershell.exe" -Version 5.1 -s -NoLogo -NoProfile -EncodedCommand ZgB1AG4AYwB0AGkAbwBuACAAUgBlAHMAbwBsAHYAZQAtAFcAY...
  count=11   powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\po-watcher\watcher-launcher-singlelane.ps1"
  count=8    "...\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File C:\po-watcher\ProjectOperations\scripts\pr-watcher\start-wa...
  count=1    (empty)
  count=2    this run's own two probe shells
```

```
distinct_parent_pids=26
  parent=35512  name=powershell  children=482      <- one parent holds 47% of the cohort
  parent=2068   name=powershell  children=208
  parent=78320  name=powershell  children=95
  parent=18460  name=powershell  children=67
  parent=59548  name=powershell  children=49
  parent=94620  name=powershell  children=32
  parent=48456  name=powershell  children=30
  parent=74456  name=powershell  children=23
  parent=95416  name=powershell  children=7
  parent=86924  name=powershell  children=6
  parent=86332  name=powershell  children=3
  parent=111172 name=GONE        children=1
```

Three facts this settles that were open yesterday:

- **It is ONE leak, not a diffuse accumulation.** 993/1017 identical command lines, 8 distinct
  command lines in total. The 0815 run could only say "one `conhost` per shell, so real console
  spawns"; this names the cohort.
- **The parents are themselves `powershell`, and 26 of them account for all 1017.** A handful of
  wrapper shells are each spawning dozens to hundreds of session hosts and reaping none. This
  matches, and sharpens, the 2015 breadcrumb's "929 shells attributed to eight wrapper pids".
- **`-Version 5.1 -s -NoLogo -NoProfile -EncodedCommand` is a PowerShell *session-host* invocation**
  (`-s` = server mode on stdin/stdout). These are not scripts that ran and failed to exit; they are
  persistent remoting hosts whose owner never closed them.

[INFERRED] Decoding the captured base64 prefix by hand as UTF-16LE gives
`function Resolve-W…` — so the cohort runs a harness that injects a helper function before doing
anything else. **That prefix does not name the owner and I am not going to guess it from a function
name.** The full decode is [CANNOT MEASURE] this run: see §7.

**5. The condition has NOT materially improved. [MEASURED]**

```
total_proc=2370        (0815 run: 2378)
powershell=1013        threads=14187        (0815 run: 1019)
conhost=1017           threads=2043         (0815 run: 1018)
node=9                 threads=128
gh=3                   threads=30
cmd=8                  threads=8
threads_all=21175
handles_all=824945
```

2030 of the 2370 processes are the shell/conhost pair, against 2037 at 08:15Z. **Down by seven in 90
minutes — i.e. flat.** That is the useful reading: the storm is no longer visibly *accreting* at the
10–35/hour the 0815 run inferred, but nothing is reaping it either. 21,175 threads is the number
behind every instrument failure in this report.

**6. The host is degraded in a way that is measurable from this run's own tool behaviour.
[MEASURED]**

Not an impression — four timings:

```
status-sweep.ps1                     started 09:51Z, still running at 10:25Z   (>34 min, incomplete)
Get-CimInstance (1017 rows) + 8 per-parent filters   >20 min, never returned
a single-row CIM decode script                       >10 min, never returned
Desktop Commander start_process / read_process_output  3 tool-call timeouts at 180s
```

A first `status-sweep.ps1` attempt was piped through `Out-String -Width 200`, which buffered the
whole report and returned nothing for six minutes. I terminated it and re-ran via `Start-Process`
with `-RedirectStandardOutput` to a file, which streams. **Recorded because it is a §9.1 trap with a
second face:** `Out-String` does not only launder an exit code, it withholds *all* output until the
process exits, so on a slow host it is indistinguishable from a hang.

**7. [CANNOT MEASURE] — stated, not papered over.**

- **The full decoded `-EncodedCommand` payload**, and therefore the name of the process that owns
  the 993-shell cohort. Two scripts were launched to get it (one full, one minimal single-row
  decode); neither returned inside this run's budget, because enumerating 1017 CIM rows on a
  thread-starved host takes longer than the station's hour. The command and the sample PID are
  recorded in F1 so the next run starts there rather than rediscovering it.
- **`status-sweep.ps1` sections 3, 4 and 5** — the safe-to-act gate, the scheduled-task census and
  the `needs-marco/` PR re-check. Section 3's header printed and its body never did. **This is why
  this run opened no board PR** (see WHAT I DID NOT DO): the pre-mutation gate is mandatory
  immediately before every board mutation and I never obtained it.
- **Any sandbox-side cross-check** of any host reading (§2).
- **Whether the 04:14 / 05:13 / 07:14 sessions died on a turn-one API error or a failed shell
  spawn** — the 0815 run's F5 deferred three transcript reads to *this* occurrence. I did not do
  them, and I am saying so rather than letting the deferral quietly lapse: the budget went to §3–§5,
  which materially advanced the open escalation, where the transcripts would have characterised a
  fault already attributed to it. Re-deferred in F4 with the folder ids intact.

**8. Board, live. Nothing a station may act on. [MEASURED]**

```
gh pr list --state open --limit 100 --json number,title,labels,mergeStateStatus,isDraft,...
  #2303  BEHIND  do-not-merge  fix(pipeline): refuse a HOLD whose own PR is already open
  #2294  BEHIND  do-not-merge  fix(pipeline): dedupe section 5 PR crawl and add -SkipSection5 fast switch
```

From the sweep's own GitHub section, with both section-0 positive controls passing
(`gh CAN reach GitHub (saw merged PR #2311)`, `node runs`) so no `[BROKEN]` appeared:

```
[LIVE] OPEN PRs: 2
[LIVE]    #2303  CI: 11 pass / 4 fail / 0 pending  <-- RED
[LIVE]    #2294  CI: 13 pass / 2 fail / 0 pending  <-- RED
[LIVE] WAITING ON MARCO: 2 open PR(s) labelled do-not-merge; oldest #2294, open 38h
[LIVE] ALL OPEN (non-draft): 2; oldest #2294, open 38h
[LIVE] main CI on bf245896: 4 success / 0 failed / 0 running  (trunk green)
```

**Both open PRs carry `do-not-merge`, which only Marco removes.** There was no merge available to
this run and none was attempted. The previous run's #2311 is confirmed merged
(`2026-10-11 09:20Z`) and `main` is green on it. **MARCO_QUEUE_LINE_V1: WAITING ON MARCO = 2,
ALL OPEN = 2** — recorded as the evidence for any future limit, per the contract, even though I
armed nothing.

**9. Freshness, and the MISSED reading classified. [MEASURED]**

```
node scripts/pipeline/check-breadcrumb.mjs --freshness        (FRESH_EXIT=2)
structure: 22 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-10-11T08:15:00Z   1.7h ago   (cadence 1h + grace 0.5h)   MISSED
  02  dispatch-only — no cadence to miss
  03  last 2026-10-10T23:07:00Z  10.9h ago   (cadence 24h + grace 3h)    ok
  04  last 2026-10-11T06:13:00Z   3.8h ago   (cadence 4h + grace 1h)     ok
  05  last 2026-10-11T14:25:00Z  -4.4h ago   (cadence 24h + grace 3h)    ok
MISSED: 1 station(s) past cadence + grace
```

Cadence taken live from `list_scheduled_tasks`, never from this file or the bootstrap's prose:
**00 `5 * * * *` (hourly)**, 03 `0 9 * * *`, 04 `0 */4 * * *`, 05 `10 0 * * *`,
`weekly-security-audit` **`enabled: false`**. Live enabled count is **four**.

00's `lastRunAt` is `2026-10-11T09:42:31Z` — **that is this run**, so `lastRunAt` cannot classify
the gap, exactly as the station doc's table predicts. The gap is 08:15Z → 09:42Z = 87 minutes with
an hourly cron, i.e. **one unaccounted occurrence at approximately 09:14Z** (the schedule's own
`nextRunAt` is `10:13:52Z`, confirming the `:14`-ish slot after jitter).

**Classification: ONE missed occurrence, and this run's own breadcrumb closes the MISSED reading.**
I did **not** do the session-directory scan that would separate `never fired` from `fired and died`
for the 09:14Z slot, because the budget went elsewhere (§7) — so the classification is honestly
*one occurrence unaccounted*, not a verdict on which of the two it was.
**The two-consecutive-`never fired` escalation rule is NOT tripped**, and it cannot be tripped by a
reading that never distinguished `never fired` in the first place. **Forbidden on this reading and
not done: no scheduled task was disabled, enabled, run, re-run or edited.**

**10. 05's "ok" is still arithmetically false, and it is still the known skew. [MEASURED]**
`--freshness` reads 05 at `-4.4h ago`, i.e. 4.4 hours in the future. Live schedule:
`lastRunAt 2026-10-10T14:22:59Z`, `nextRunAt 2026-10-11T14:22:37Z`. So the breadcrumb named
`...2026-10-11-1425...` is **yesterday's** 14:22Z run stamped +24h. 05 is genuinely ~20h old, inside
`24h + 3h`, so `ok` is right by luck from a wrong number — the third consecutive run to measure
this. Already filed as 04's F6 (1810), my own 0114 finding, and F4 of the 0815 breadcrumb, which
DEFERRED it pending Marco's UTC-vs-local-day answer. **No new finding is opened; see F4 for why I am
not re-asking.**

**11. COLLECT: five untracked breadcrumbs, and nothing new from another station since 08:15Z.
[MEASURED]**

`--freshness` named the untracked set directly:

```
NOTE  00-00-supervisor-2026-10-11-0000-blind-no-host-shell.md                            UNTRACKED
NOTE  00-00-supervisor-2026-10-11-0618-blind-no-device-bridge-and-the-sandbox-shell-wedges-on-the-git-guard.md  UNTRACKED
NOTE  00-00-supervisor-2026-10-11-0815-merged-2311-and-the-host-is-thread-exhausted-...md UNTRACKED
NOTE  00-04-scanner-2026-10-11-0000-blind-no-shell.md                                    UNTRACKED
NOTE  00-04-scanner-2026-10-11-0613-blind-no-device-bridge.md                            UNTRACKED
```

`structure: 22 checked, 0 malformed` — the 0815 run's F8 heading repair is holding; no breadcrumb
in the queue root is malformed. **No station other than 00 has reported since 08:15Z** (04 last
06:13Z and within cadence; 03 last 23:07Z yesterday; 05 last 14:22Z yesterday), so the only
breadcrumb with uncollected findings this run is the 0815 one, which I read in full and
dispositioned below.

**12. Pre-mutation gate: NOT OBTAINED, and therefore nothing was mutated. [MEASURED]**
The dev tree's four read-backs are clean —

```
git rev-list --left-right --count HEAD...origin/main  ->  0   0
git diff --numstat                                    ->  EMPTY
git diff --cached --name-status                       ->  EMPTY
git status --porcelain (tracked only)                 ->  0 entries
Test-Path .git\index.lock                             ->  False
```

— but `status-sweep.ps1` section 3, *"IS THE BOARD BUSY? (safe-to-act gate)"*, printed its header
and never its body (§7). **A clean dev tree is not the safe-to-act gate.** The gate also covers an
in-progress prompt, a PR touched in the last ~2 minutes, and the board lease, and I obtained none of
those. I did not take `Enter-BoardLease` and I did not mutate the board. The clean four read-backs
are reported because the *next* run needs them to know the fast-forward is not blocked, not as a
substitute for the gate.

**13. Breadcrumb validation. [MEASURED]**
Quoting the command, because `breadcrumb-clean` is not written until
`check-breadcrumb.mjs` has been run and exited 0 — see WHAT CHANGED item 2 for the verdict. No
`lint-prompt.mjs` result is quoted anywhere in this report: it gates `docs/pr-prompts/` as
*prompts*, rejects a breadcrumb for having no YAML front matter, and returns no meaningful verdict
on one in either direction.

---

## WHAT CHANGED

1. **Four diagnostic `.ps1` scripts were written to `C:\po-sup-fix-scripts\`** — the sanctioned
   scratch location for station `.ps1` (STATION-CAPABILITIES §4):
   `st00-proccount-2026-10-11.ps1`, `st00-cimprobe-2026-10-11.ps1`,
   `st00-leaksource-2026-10-11.ps1`, `st00-decode-2026-10-11.ps1`. All read-only; none kills,
   mutates or writes outside a temp output file. They are the reusable form of §3–§5 so the next run
   does not re-author them.
2. **This breadcrumb was written** to `C:\ProjectOperations2\docs\pr-prompts\`, untracked, for the
   sweep to collect. It reaches nobody until a board PR commits it, and it is named here so
   `sweep-breadcrumbs.ps1` finds it.
3. **One stray process was terminated: PID 91928**, the `Out-String`-buffered first
   `status-sweep.ps1` attempt of this run (§6). It was my own shell, started 181 seconds earlier,
   producing no output. **This is not part of the orphan cohort and is not a kill under F1** — it
   was one identified process, started by this run, whose command line I wrote myself.

**Nothing else.** No PR merged, opened, updated or closed. No prompt armed or disarmed. No label
added or removed. No escalation retired. No breadcrumb archived or `git mv`'d. No board lease taken.
No worktree created, pruned or removed. No lock cleared. No scheduled task touched. No orphan shell
killed. No `/sot/` file read for edit or written. No commit on `main`.

---

## FINDINGS

### F1 — F1 of the 0815 breadcrumb is ADVANCED, not repeated: CIM answers again, so the kill precondition DOCTRINE §9.5 demands is now satisfiable, and 993 of the 1017 shells are one cohort behind 26 parent PIDs.

Yesterday's blocker was epistemic, not political: *"the precondition for killing cannot be met, so
killing is forbidden."* It can be met now. `Get-CimInstance Win32_Process` returned 1017 rows with
a passing positive control (`explorer.exe` → 1) and a passing negative control (a minted impossible
name → 0), on the same call that returned
`No more threads can be created in the system.` at 08:15Z.

What that buys, measured (§4): **8 distinct command lines across 1017 shells, 993 of them
identical**, and **26 parent PIDs — all themselves `powershell` — accounting for every one**, with a
single parent (PID 35512) holding 482 children. The 993 share
`-Version 5.1 -s -NoLogo -NoProfile -EncodedCommand ZgB1AG4A…`, a PowerShell **session-host**
invocation (`-s` is server mode), so these are persistent remoting hosts nobody closed — not
scripts that ran and failed to exit. 11 further shells are
`watcher-launcher-singlelane.ps1` and 8 are `start-wa…`, which are the watcher's own and must not be
swept into any cohort description.

**I still did not kill anything, and the reason has changed, so it is worth stating precisely.** It
is no longer that I cannot identify them. It is that **Marco was asked at 08:15Z for exactly this
decision and has not answered.** His Option 2 was *kill them in place, with your authorisation*, and
the authorisation has not arrived. Acting on an escalation's unchosen branch because the evidence
improved is still acting without the answer. It is also 03's lane: *Repair the machines — 00
dispatches 03.* So this run's contribution is to hand both of them a target list instead of a count.

**ESCALATED** — to Marco, as an **update that changes one of his two options**, not a fourth ask. The
question is unchanged and already in front of him; what follows is the new fact that bears on it:

> **Your Option 2 is now safe in the way it wasn't yesterday.** At 08:15 I told you I couldn't
> recommend killing the 1019 shells because I couldn't read a single one's command line, so I'd be
> killing blind. **That instrument came back.** I can now see that **993 of the 1017 are the same
> thing** — one identical PowerShell session-host command line — and that **26 parent processes
> account for all of them**, one of which alone holds 482. I can also see which ones are *not* in
> that cohort: 11 are your watcher launcher and 8 are the watcher's start script.
>
> **So the recommendation changes shape.** RULE 1 asks for the option that solves it completely and
> additively:
>
> **Option 1 — reboot — is still the one I'd take, and it is still complete and additive.** It
> clears all 2030 at once, risks nothing, and needs no judgement call from me about which 993 of
> 1017 are safe. Pair it with the standing check (I report any shell count over 200 as a blocking
> finding every run) and the present and the future are both cured. It damages no data.
>
> **Option 2 — kill in place — no longer fails RULE 1 outright, but it still fails the "future"
> half.** I could now kill by command-line match and parent PID rather than by image name, which is
> what DOCTRINE requires, and spare the watcher's 19. What it does not do is stop the leak: the
> count is **flat, not falling** (2037 → 2030 in 90 minutes), so something still owns those 26
> parents. Killing the children without finding the owner buys hours, not a fix.
>
> **The real fix is still the third thing, and it is now one step from being named.** The cohort's
> command line carries an `-EncodedCommand` payload that begins `function Resolve-W…`. Decoding it
> in full names the owner outright. I launched that decode twice this run and neither returned
> inside the hour, because enumerating 1017 processes on a host with 21,175 threads is itself slow.
> **A reboot makes that decode take two seconds.** That is the practical argument for Option 1 over
> Option 2: it is the option that also lets the diagnosis finish.

Handed to **Station 03 — Machine Minder** as well, next occurrence `0 9 * * *`
(`nextRunAt 2026-10-11T23:02:45Z`), as a concrete starting point rather than a search: the parent
PIDs above, the sample cohort command line, and the ordering from F2 of the 0815 breadcrumb
(**do not relaunch the watcher until F1 is cleared**) which this run does not alter.

### F2 — The watcher node and its auto-restart wrapper are both still down, heartbeat now 415 min, and the queue is still 0 armed so nothing is starving.

```
[LIVE] watcher node: NOT RUNNING  <-- the queue will not drain
[LIVE] auto-restart wrapper: NOT RUNNING -- watcher will not self-restart
[LIVE] heartbeat age: 415 min  (ticks only mid-run; stale + empty queue = idle, NOT wedged)
[LIVE] watcher clone: branch=main tracked-dirty=0 untracked=3
[LIVE] non-main worktrees found: 33 ... worktree-registry-escapees: 3
```

Both section-0 positive controls passed, so this is not the 2208 run's failed-CIM artefact. The
heartbeat is an independent file-mtime read and it corroborates: **415 min, up from 339 min at
08:15Z — exactly the 76 minutes between the two readings, so nothing ticked in between.** The clone
still holds its own `index.lock` per the 0815 reading; I did not re-measure its bytes and age this
run and I did not clear it.

This is unchanged from the 0815 breadcrumb's F2 in every particular except the heartbeat age, and it
is already dispatched with an explicit ordering. **I am not re-dispatching it** — a second dispatch
of a live dispatch is noise, and 03 has not had an occurrence since (its last run was 23:07Z
yesterday; its next is 23:02Z tonight).

**DISPATCHED** — to **Station 03 — Machine Minder**, as a *confirmation* that the 0815 dispatch is
still current at `bf245896` and 10:25Z, with the F1-first ordering intact and one addition: the
cohort's parent PIDs and command line in F1 are the starting point for step 2 ("find what is leaking
the shells"), which 03 would otherwise have to derive.

### F3 — `ci.yml:307` still claims 23 baselined sot-refs against a baseline holding zero, and the structural obstruction is unchanged, so this is recorded as still-open rather than asked a fourth time.

Not re-measured this run. The 0815 breadcrumb verified it live at `bf245896`
(`ci.yml:307` → *"the 23 pre-existing dangling references are"*; `docs/qa/sot-refs-baseline.json`
`entries` → length 0), `origin/main` has not moved since, and §7.1's re-read rule is satisfied by a
measurement taken at the current head. The obstruction is structural and also unchanged: `.github/`
sits outside `tests/` and `docs/`, CP-26 is armed by the diff, and `standing-lanes.json` holds only
`sot` and `instrument` — **no lane covers a comment-only `.github/` change**, so any PR I open is
un-mergeable by any station.

Marco has now been asked three times by 05 and 00, and the 0815 run put it to him as a one-word
yes/no. **A fourth ask is not a finding, it is a nag.** I am therefore neither re-asking nor opening
the PR: opening it answers his open question in the direction that costs him a release, and with the
watcher down (F2) the sanctioned prompt route is unavailable anyway.

**DEFERRED** — until Marco answers the yes/no already in front of him. What would make it urgent:
if Station 05 begins burning down sot-refs against the comment's figure rather than the baseline's,
the wrong number stops being cosmetic. Nothing suggests that is happening — the baseline's `_readme`
is the authority and 05 has read it correctly on each of the last three runs.

### F4 — The 0815 breadcrumb's F5 deferred three transcript reads to this occurrence and I did not do them. Re-deferring rather than letting a deferral lapse silently.

F5 of 0815 named the work precisely: read the transcripts for session folders `818d535a` (04:14Z),
`ff192d72` (05:13Z) and `eebda5d5` (07:14Z) under
`local-agent-mode-sessions\9df6923b-…\6662b30d-…\`, and classify each as *turn-one API error* versus
*failed shell spawn* — the distinction mattering because only the second is cured by F1.

I spent the budget on §3–§5 instead, and I think that was the right trade: it converted F1 from "a
count I may not act on" into "a cohort with parents and a command line", which is what both Marco's
decision and 03's dispatch were waiting on. But a deferral that is silently not done twice becomes a
lost finding, which is the failure the REPORT CONTRACT exists to prevent. So it is restated with the
ids intact, and the new occurrence added.

**DEFERRED** — to the next 00 occurrence, with the corpus now **four** folders: `818d535a` (04:14Z),
`ff192d72` (05:13Z), `eebda5d5` (07:14Z) and whatever folder holds the **~09:14Z** occurrence this
run found unaccounted (§9). It becomes an **escalation** if any 00 occurrence ever reads
`never fired` twice consecutively; everything measured so far has been `fired and died`, which is a
different fault and is attributed to F1. It unblocks for free after a reboot, because a sighted run
has the budget for four transcript reads.

### F5 — `status-sweep.ps1` did not finish in 34 minutes, so the safe-to-act gate was unobtainable and this run could not open its own board PR. The report contract's own collection channel is blocked by F1.

Section 0 (instrument controls), 1 (GitHub) and 2 (watcher) completed and are quoted above. Section
3's header printed and its body did not; sections 4 and 5 never started. The cause is not the script
— `#2294` exists precisely to add a `-SkipSection5` fast switch and dedupe the section 5 PR crawl,
and it is sitting `do-not-merge` on Marco's desk with 2 failing checks.

The consequence is specific and worth naming because it closes a loop: **the five untracked
breadcrumbs from §11, plus this one, cannot be swept into a board PR by this run**, because
`sweep-breadcrumbs.ps1` is a board mutation and the mandatory pre-mutation gate could not be read.
So F1 is not merely making stations blind — it is now blocking the one channel by which station
reports reach `main` at all. Six breadcrumbs are accumulating untracked, and the station doc warns
they will block the next fast-forward once a PR lands those paths.

**DEFERRED** — to the next sighted 00 occurrence, which should sweep **six** breadcrumbs rather than
five. It becomes urgent at the point where the untracked set is large enough that a reader cannot
tell which findings have been collected; today's six are all named in §11 and here, so the trail
holds. The permanent fix is Marco releasing `#2294` (the `-SkipSection5` switch) or clearing F1 —
either one makes the gate readable again. **Not re-escalated**: `#2294` is already on his desk and
F1 is already the subject of the escalation above.

---

## WHAT I DID NOT DO

**I merged nothing, and there was nothing to merge.** Both open PRs (`#2303`, `#2294`) carry
`do-not-merge`, which **only Marco removes**. I did not remove a label, and I did not reason past
one. No instrument-lane merge was available or attempted: INSTRUMENT_LANE_V1 requires *no*
`do-not-merge` label, and both PRs carry one, so the lane cannot reach either — and both are RED
besides. **Instrument-lane merges this run: none.**

**I armed nothing.** Queue is 0 armed. Arming now would be actively harmful: the watcher is down
(F2) so an armed prompt would sit unbuilt, a `*-ready.md` rename would block the next fast-forward,
and the 16 remaining HOLDs are all waiting on the unanswered SPENT_HOLD question in
`needs-marco/spent-hold-gate-fails-closed-…-2026-10-10.md`, which changes arming behaviour for all
of them either way. **MARCO_QUEUE_LINE_V1 figures are in §8** as the contract requires, recorded
even though I armed nothing.

**I opened no PR, and this is the one thing I would have done if I could.** The pre-mutation
safe-to-act gate never returned (§12, F5). A clean dev tree is not that gate. I did not substitute
one for the other, and I did not take the board lease.

**I killed no orphan shell** — not one of the 1017. The precondition is now satisfiable (F1), which
makes the restraint a choice rather than an inability, so: Marco was asked for this exact
authorisation at 08:15Z and has not given it, and repairing the machines is 03's lane on 00's
dispatch. The only process I terminated was PID 91928, my own buffered sweep attempt from eight
minutes earlier (WHAT CHANGED item 3).

**I did not reboot the host and did not advise anyone but Marco to.** It is his working PC.

**I did not restart the watcher or the wrapper**, did not clear the watcher clone's `index.lock`,
and did not re-measure its bytes and age. 03's lane; dispatched, with the F1-first ordering.

**I did not touch a worktree.** 33 non-main worktrees and 3 registry escapees; many hold commits on
no remote branch and two hold uncommitted work, which `git worktree remove` would refuse and
`--force` would discard. 03's call, with the sweep's own preserve-first steps.

**I did not retire any `[STALE]` escalation row, and could not have.** Section 5 of the sweep — the
section that flags them — never ran (§7). Retiring one needs the file read plus
`gh pr view <n> --json state,mergedAt` **per PR individually**, because a LIST response's `merged`
field is unusable (§9.4). Nothing was retired on a LIST reading.

**I did not archive any breadcrumb.** All six in the current cycle are untracked, so there is no
tracked path to `git mv`, and the current cycle stays in the queue root by contract.

**I did not run `check-breadcrumb.mjs --freshness`'s verdict past its instrument.** I ran it on the
host via Desktop Commander, not from the VM mount — it shells `git ls-tree`, `git ls-files` and
`gh pr list`, so calling it from the mount would have broken the §9.2 device-bridge git ban this run
promised to keep.

**I ran zero VM-side git**, despite the guard being uninstallable (§2). The absence of the guard is
not a licence.

**I did not open the `ci.yml` PR** (F3), and did not edit `standing-lanes.json` or
`instrument-lane.json`. Both are Marco's files, and a change to either puts a PR outside the lane by
definition.

**I did not read or edit anything under `/sot/`.** Station 05's lane; CP-24 hard-fails any PR mixing
code and `sot/`.

**I did not do 03's, 04's or 05's work.** 04 is within cadence (06:13Z, 3.8h, cadence 4h+1h) and 05
is within cadence on a wrong number (F4 of 0815, §10). Neither was dispatched; there was nothing new
to dispatch to them.

**No Azure, Entra or SharePoint contact of any kind — no portal, no App Service settings, no Entra
registrations, secrets, permissions or consent, no SharePoint permissions or structure, no `az` and
no `Connect-MgGraph`. No production data read or written. No force-push, no branch deletion, no
destructive migration, no secret deleted. No scheduled task enabled, disabled, edited or re-run.**

**I did not write this report to the session's `outputs` folder.** It is at
`C:\ProjectOperations2\docs\pr-prompts\`, untracked, where Station 00 collects — the measured
2026-09-22 way for a complete report to reach nobody was to leave it in `outputs`.

---

## FOR MARCO

**One thing, and it is the same thing — but my recommendation got stronger, not weaker.**

At 08:15 I asked you to reboot, and said I couldn't recommend killing the 1019 orphaned PowerShell
processes because I couldn't identify a single one. **That instrument came back this hour**, and
what it shows is that **993 of the 1017 are one identical thing**, spawned by **26 parent processes**
— one of which alone owns 482 — and that your watcher's own 19 shells are distinguishable from them.
So I *could* now kill selectively, which I couldn't yesterday.

**I still think you should reboot instead, and the new fact is the reason.** The count is **flat,
not falling** — 2037 at 08:15, 2030 now — so something still owns those 26 parents, and killing
their children buys hours rather than fixing it. Finding the owner is one step away: the cohort's
command line carries an encoded payload beginning `function Resolve-W…`, and decoding it names the
culprit outright. **I launched that decode twice this hour and neither attempt returned inside the
hour**, because reading 1017 processes on a machine with 21,000 threads is itself slow. A reboot
makes it take two seconds. That is the practical case for the reboot over the kill: it is the option
that also lets the diagnosis finish. And if you'll authorise it, I'll report any shell count over
200 as a blocking finding from then on, so it never climbs this far again.

**Two things that follow from it, for awareness only — no action needed from you beyond the above.**

`status-sweep.ps1` did not finish in 34 minutes this hour, which means I could not read the gate I'm
required to read before touching the board, which means I could not open the PR that commits these
reports to `main`. **Six station breadcrumbs are now sitting untracked.** The thread shortage has
reached the pipeline's own reporting channel. `#2294` on your desk is the PR that makes that sweep
fast; releasing it would help, but clearing the shells helps more.

And the board itself is clear and waiting entirely on you: `#2303` and `#2294`, both
`do-not-merge`, both yours. `#2303`'s real defect is written up with options in
`needs-marco/spent-hold-gate-fails-closed-…-2026-10-10.md`, and the SPENT_HOLD question in that file
is what is holding all 16 remaining HOLDs unarmed. **Your `standing-lanes.json` yes/no from last
hour is still open too**; I have not asked again and won't, but it does still close permanently
either way.
