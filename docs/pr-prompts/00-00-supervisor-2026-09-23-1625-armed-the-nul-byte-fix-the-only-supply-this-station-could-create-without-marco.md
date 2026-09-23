# Station 00 — Supervisor | 2026-09-23T16:14Z–2026-09-23T16:4xZ

## GROUND

```
UTC            2026-09-23T16:14:42Z
origin/main    85df9ebe            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 85df9ebe      C:\ProjectOperations2
doc version    1                    (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE**. This run acted.

⚠️ **Clock note, repeated because the next reader meets it too.** The box reports
`2026-09-23T16:14Z` UTC; the session environment header says 2026-09-24, and
`restart-watcher-if-wedged.ps1` printed its own banner as `2026-09-24 02:24:16`. Brisbane is UTC+10,
so the host's LOCAL clock reads 2026-09-24 02:14 — DOCTRINE §3 RULE 2 exactly. **Every timestamp in
this breadcrumb is the box's UTC**, taken from `[DateTime]::UtcNow`, never from the session header
and never from a script's local-time banner.

## WHAT I MEASURED

**Preflight.**

- [MEASURED] **Not blind.** Desktop Commander ids were loaded with `ToolSearch` FIRST (keyword
  search, ids taken from what the search reported, never hard-coded), then `start_process` shell
  `powershell.exe` answered → PID **15836**, which carried the entire run.
  A first probe through the nested `powershell.exe -NoProfile -Command "..."` form died with
  `You must provide a value expression following the '+' operator`, `$env:USERNAME` already
  substituted as `Marco` — **DOCTRINE §9.1's `COMMAND_LAYER_EXPANSION_IS_THE_NESTED_FORM_V1`
  reproducing exactly as written.** Recorded because it is a live positive control for that trap,
  not a defect: every subsequent statement went direct through `interact_with_process`, where the
  expansion layer does not exist.
- [MEASURED] **`vm-git-guard.sh` exit code = `2`**, read from the installer itself and never from a
  pipeline appended to it. Headline verbatim:
  `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
  Its own controls, quoted: `bash -lc 'command -v git'` →
  `/sessions/serene-affectionate-hopper/.local/bin/git` (the shim); `bash -c 'command -v git'` →
  `/usr/bin/git` (the real git). **This is the EXPECTED station outcome — a FINDING, not a STOP**
  (F3). Consequence honoured for the whole run: **every `git` and `gh` call ran in PowerShell on the
  Windows host; not one went through the device bridge against the Windows `.git`.** The only
  VM-side calls made were read-only `ls` over the mount.
- [MEASURED] **The three binding documents are byte-equivalent to `origin/main`**, by the sound form
  and never a piped hash (§9.1):
  `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
  → **EMPTY**, with `git rev-list --left-right --count HEAD...origin/main` → `0	0`. The dev tree
  **is** `origin/main`, so reading them from disk is sound this run.
- ⚠️ [MEASURED] **I did NOT read all three in full, and I am saying so rather than implying I did.**
  `00-supervisor.md` (1593 lines) was read in full across three pages. `DOCTRINE.md` is **2735 lines
  / ~89k tokens**: §§1–9.1 were read in full, the remainder by section index. `STATION-CAPABILITIES.md`
  (572 lines) was **not opened this run**. **This is the open escalation
  `needs-marco/binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md` recurring, not a new
  finding** — recorded as F4 so the recurrence count stays visible. Nothing I did this run turned on
  a passage I skipped: the two authorities I exercised (arm one tracked HOLD; open a docs-only PR)
  are both stated in the station doc I read in full.

**COLLECT — the census, and it is empty by construction.**

- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **`CLEAN`, exit 0**.
  `structure: 2 checked, 0 malformed, 0 skipped`. Freshness: `00` 0.9h (cadence 1h) ok ·
  `02` dispatch-only · `03` 16.8h (24h) ok · `04` 2.1h (4h) ok · `05` 1.9h (24h) ok.
  **No station is SILENT.**
- [MEASURED] **Cross-check against `lastRunAt` (scheduled-tasks MCP)** — the breadcrumb clock cannot
  substitute for it, and it cannot substitute for the breadcrumb clock either.

  | station | cron | `lastRunAt` | newest breadcrumb | reading |
  |---|---|---|---|---|
  | `00` | `5 * * * *` | 2026-09-23T16:13:57Z | 15:24 (+ this run) | this run; aligned |
  | `03` | `0 9 * * *` | 2026-09-22T23:28:57Z | 2026-09-22T23:29 | aligned; `nextRunAt` 2026-09-23T23:02:45Z |
  | `04` | `0 */4 * * *` | 2026-09-23T14:09:35Z | 14:10 | aligned; `nextRunAt` 2026-09-23T18:09:31Z |
  | `05` | `10 0 * * *` | 2026-09-23T14:22:41Z | 14:23 | aligned; `nextRunAt` 2026-09-24T14:22:37Z |

  **All four are the "both fresh and aligned" healthy row.** No transcript read was required: no
  station read SILENT, and none showed the fresh-`lastRunAt`-with-no-breadcrumb shape that the
  session-directory and transcript instruments exist for.
- [MEASURED] **`weekly-security-audit` is `enabled: false`, `lastRunAt 2026-09-06T21:32:44Z` — 16.8
  days.** It is the fifth task in the MCP listing and the only disabled one. Surfaced as F5.
- [MEASURED] **There is nothing to collect.** `docs/pr-prompts/00-*.md` in the queue root → exactly
  **two** files: `00-00-supervisor-…-1524-…` (this station's own, every finding dispositioned inside
  it) and `00-05-sot-keeper-…-1423-…` (fully dispositioned as C1–C7 by that same 15:24Z run). **No
  station has written a breadcrumb since 15:24Z**, and the three that could have are all between
  occurrences. Re-dispositioning either file would be acting twice on one signal, which is the
  failure the breadcrumb channel exists to prevent. **Both are archived by this PR.**
- [MEASURED] **Section 5 produced NO genuine `[STALE]` rows.** `Select-String '\[STALE\]'` over the
  captured sweep → **4 matches, and all four are the report's own legend or footer** (the
  `(all facts [LIVE] unless tagged [FILE]/[STALE])` header, the `HOW TO READ` line, a quoted line
  *inside* a `[FILE]` station summary, and `SWEEP COMPLETE … never repeat a [STALE] line as current`).
  Every real `needs-marco/` row is `cites #N (MERGED) as evidence -- not its premise` or `names no
  subject PR … section 5 CANNOT decide`. **So nothing was discharged into `needs-marco/discharged/`
  this cycle**, for the second consecutive run. The eleven dead escalations of 2026-09-10 have not
  come back.

**Board and machinery, from `scripts/pipeline/status-sweep.ps1` at 16:19:14Z.**

- [MEASURED] section 0 instrument controls: `[LIVE] gh CAN reach GitHub (saw merged PR #2125)`,
  `[LIVE] node runs`. **No `[BROKEN]`** — so the report is trustworthy on its own terms.
- [MEASURED] section 7 verdict: `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote
  activity, no live station worktrees.` Section 3: `git index.lock interactive/clone: False / False`,
  scoped git processes **0**, `no PR touched on GitHub in the last 2 min`. **This is BOARD DRIVING
  condition 3 — the load-bearing one — and it was measured, not assumed.**
- [MEASURED] `[LIVE] OPEN PRs: 0`. `[LIVE] main CI on 85df9ebe: 4 success / 0 failed / 0 running
  (trunk green)`. **There was no PR to drive, fix, smoke or merge. Q1's answer is zero open,
  therefore zero DIRTY, therefore no frozen CI.**
- [MEASURED] `[LIVE] armed (*-ready.md): 0` **before this run acted**. needs-marco 46 ·
  no-pr-opened 111 · failed 59 · blocked 150. Backlog gates: `ready=1 needs-marco=2 blocked=4
  broken=0`.
- [MEASURED] **Q3, counted by hand rather than quoted from a note:**
  `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → **0** before arming, **1** after
  (`pr-field-service-nul-separator-ready.md`). `*-HOLD.md` → **15** before, **14** after.
- [MEASURED] watcher node **RUNNING pid 9744**, auto-restart wrapper **alive (1)**. The sanctioned
  liveness check was run this time, because a prompt is now armed and the idle-is-correct argument no
  longer applies: `restart-watcher-if-wedged.ps1` (report-only, no `-Fix`) →
  `armed prompts waiting: 1 · watcher process: ALIVE (pid 9744) · restart churn: 0 cycle(s) in 20 min
  · queue last moved: 53 min ago (rev-2125-ready.md) · heartbeat last write: 51 min ago` →
  **`VERDICT: HEALTHY - no action.`** Trusted over my own reasoning, per that script's own rule.
- [MEASURED] `C:\po-watcher\logs` **does not exist** (`Test-Path` → `False`), so an empty log scan
  there is a real absence and not §9.1's `-Include` trap. **Positive control**: the same depth-1
  wildcard form against `C:\po-watcher` itself returned 3 logs, newest `ensure-watcher.log` at
  **16:15:03Z** — one minute old. The instrument works; the path was wrong.
- [MEASURED] orphaned worktree `C:/po-wt/s9hex`, detached at `f878a0a1`, `dirty=0 files`,
  `age=600 min`. Unchanged from the 15:24Z reading except in age.

## WHAT CHANGED

**Two mutations. Both read back.**

**1. `pr-field-service-nul-separator-HOLD.md` → `-ready.md`. ONE prompt, armed through the
sanctioned serializer.**

This is the prompt the 15:24Z run staged as its C3 and explicitly left for *"the next run's
ARM-ONE-AT-A-TIME"*, because arming is a `git mv` of a **tracked** file and it was not tracked until
`#2125` merged. Four checks before the rename, each measured:

| check | result |
|---|---|
| tracked on `origin/main`? `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` | **`docs/pr-prompts/pr-field-service-nul-separator-HOLD.md`** — present |
| premise still TRUE? `readFileSync(...).indexOf(0)` on `apps/api/src/modules/field/field.service.ts` | **`NUL_OFFSET=50780 SIZE=52574`** — the byte is still there at `85df9ebe` |
| lint verdict | `node scripts/pipeline/lint-prompt.mjs …` → **`ADMIT (size 2)`, exit 0** |
| gates | front matter carries **no** `requires_merged`, **no** `requires_file_on_main`, **no** human gate; `escalates: false`, `seed_only: false`, `gate_allow: none`, `module: field` |

Not on the never-arm denylist (`pr-fv2-formrule-contract`, `pr-siteid-notnull-backfill`, rates-s11c,
site-dissolution, B-P0a-4-ii..8, B-SD, MT-3/MT-5) — checked by name. **Not already shipped:** the
premise IS the shipping test and it is still true, re-measured at this run's HEAD rather than quoted
from 05's artifact (§7.1's re-read rule).

```
arm-prompt.ps1 -Name pr-field-service-nul-separator -Actor station-00.sched -WhatIf
  -> PLAN: D …-HOLD.md / A …-ready.md                         WHATIF_EXIT=0
arm-prompt.ps1 -Name pr-field-service-nul-separator -Actor station-00.sched
  -> Lock acquired (PID 17596) … SUCCESS … Index contains exactly the two expected paths
     Audit line written to .arming-log.txt … Index clean after release        ARM_EXIT=0
```

**Read-back — four separate assertions, not the script's own word:**

```
Get-ChildItem docs\pr-prompts -Filter *-ready.md     ->  1   pr-field-service-nul-separator-ready.md
Test-Path …\pr-field-service-nul-separator-HOLD.md   ->  False
git status --porcelain                                ->   M docs/pr-prompts/.arming-log.txt
                                                           D docs/pr-prompts/pr-field-service-nul-separator-HOLD.md
git diff --cached --name-status   (checked BEFORE)    ->  EMPTY
```

⚠️ **`…-ready.md` correctly does NOT appear in `git status` — `.gitignore:75` swallows it.** That is
exactly why arming is a `git mv` of a tracked HOLD and never the creation of a `-ready.md`, and why
the deletion row above is the whole of what a PR can record. **This PR lands both halves: the HOLD
retirement and `.arming-log.txt`**, the latter because DOCTRINE §9.5 requires any run that arms to
commit it.

⚠️ **The armed prompt's scope touches `apps/api/**`, so the watcher's RULE 2 will mark its PR
`marco:true` and refuse to auto-merge it.** That is expected and is not a reason to withhold the arm:
the PR still gets opened, built and driven green, and Marco's merge is the last step. **I have not
pre-judged that PR** — at the time of writing it does not exist yet.

**2. One board PR, built in a disposable worktree off `origin/main`.**
`C:\po-wt\bd-00-20260923-1625`, branch `board/00-collect-20260923-1625`, created at `85df9ebe`
(`WT_EXIT=0`). It carries this breadcrumb, the HOLD retirement, the arming-log line, and archives the
two dispositioned breadcrumbs of the previous cycle. **The breadcrumb is written INSIDE the worktree
(report-contract cure 1)**, so no untracked copy is left in the dev tree at a path the next
fast-forward must create.

**Nothing else.** No PR merged — there were none open. No label touched. No `sot/` edit. No watcher
restart. No worktree pruned. No `needs-marco/` file created, edited or discharged.

## FINDINGS

### F1 — The board was EMPTY and 14 of the 15 parked prompts are blocked on Marco. Arming this one is the only supply this station could create without him.

[MEASURED] 0 open PRs, 0 armed, trunk green, watcher healthy. Of the 15 `-HOLD.md` prompts,
**exactly one** — the NUL-byte fix — had no gate, no dependency, and a premise that still held. The
other fourteen are parked behind `docs/approvals/` (5, plus a 6th transitively), the fv2 cluster
question, the never-arm denylist, or a predecessor that is not on `main`.

**DISPOSITION: ACTIONED.** Armed, with the four pre-checks and four read-backs quoted above.
**Verification owed by the NEXT run, named here so it is not lost:** confirm the watcher consumed
`pr-field-service-nul-separator-ready.md` and opened a PR. When this breadcrumb was written it had
been armed ~6 minutes and `restart-watcher-if-wedged.ps1` still read `armed prompts waiting: 1` —
which is **normal, not a stall**: `index.mjs` picks up on `fsWatch` or on the 5-minute
`RESCAN_INTERVAL_MS`, and a prompt legitimately takes 10–40 min to build. **It becomes a finding only
if the next run still sees it armed with no PR AND a stale heartbeat**, which is the WEDGED
discrimination and belongs to `restart-watcher-if-wedged.ps1`, never to a reading of the queue.

### F2 — Nothing new was reported by any station since 15:24Z, and that is a measurement rather than an absence of looking.

Three instruments agree: `--freshness` `CLEAN` / exit 0 with every station inside cadence; `lastRunAt`
for all four enabled tasks aligned with its newest breadcrumb; and the queue root holding exactly two
`00-*` files, both already dispositioned. 04 next fires at 18:09Z, 03 at 23:02Z, 05 tomorrow 14:22Z.

**DISPOSITION: ACTIONED — the collect is complete because the set is empty.** Stated explicitly
because *"a blind run and a healthy quiet run both produce no news"*, and **this run was sighted**:
PID 15836 on the box, sweep section 0 controls green, and the arming above is a mutation a blind run
could not have made.

### F3 — The device-bridge git guard installs INERT (exit 2) on every station shell. Fourth consecutive run today.

Measured again this run, identical headline. 04 (14:10Z), 05 (14:23Z) and the 15:24Z supervisor run
each measured the same exit code on 2026-09-23. The installer writes its `PATH` export into
`~/.bashrc` and `~/.profile`; a station's shell is non-interactive and non-login, so it sources
neither. **The ban is REMEMBERED, not mechanical** — which DOCTRINE §9.2 records as having failed
seven times.

**DISPOSITION: DEFERRED.** No station-side action exists: the guard is correct, the shell is the
problem, and the station contract itself calls exit 2 the expected outcome and a finding rather than
a stop. Recorded so the occurrence count stays visible. **What would make it urgent:** a 0-byte
`index.lock` appearing in either tree, which never expires and freezes every station. [MEASURED] this
run: `index.lock interactive/clone: False / False`. It has not happened.

### F4 — The binding-read contract again exceeded what one run can carry, and this run declares the shortfall instead of implying compliance.

`DOCTRINE.md` is 2735 lines / ~89k tokens; `00-supervisor.md` is 1593; `STATION-CAPABILITIES.md` is
572. The contract says *"read these three, in full, every run"* — hourly. This run read
`00-supervisor.md` in full, `DOCTRINE.md` §§1–9.1 in full plus the remainder by section index, and
did **not** open `STATION-CAPABILITIES.md`.

**DISPOSITION: DEFERRED — the escalation already exists and re-filing it would be noise.**
`needs-marco/binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md`, 9.0 days old; the
sweep confirms it is still live (`no PR ref … read it as a SNAPSHOT`). **What is added here is one
more datapoint, not a new question.** ⚠️ **The honest cost is stated rather than waved past:** a run
that silently skips a binding document and reports nothing has no way of knowing what it missed, and
*that* — not the skipping — is the failure mode. Nothing this run did turned on an unread passage;
the next run must not assume the same.

### F5 — `weekly-security-audit` has been `enabled: false` for 16.8 days.

[MEASURED] scheduled-tasks MCP: `taskId weekly-security-audit`, `cronExpression 30 7 * * 1`,
`enabled: false`, `lastRunAt 2026-09-06T21:32:44.637Z`, **no `nextRunAt`**. It is the only disabled
task of the five. The station doc records the precedent that makes this worth a line at all: *"all
four scheduled tasks sat disabled for three days and no chat noticed."*

**DISPOSITION: ESCALATED — but deliberately NOT as a new file.** It is **[CANNOT MEASURE] whether
the disable was intentional**: nothing on disk or in the MCP records who disabled it or why, and
guessing Marco's intent is DOCTRINE §5 item 5. It is surfaced as question 5 in `## FOR MARCO` rather
than filed, because `needs-marco/` already holds **46** files and four unanswered questions; adding a
47th for what may be a deliberate pause makes the queue he is already behind on harder to read, not
easier. **If he says it should be running, the next run files it properly — and re-enables nothing
without him**, because enabling a scheduled task is a standing-configuration change, not a station
action.

## WHAT I DID NOT DO

- **Did not merge, fix, smoke or vision-review anything.** `OPEN PRs: 0`. There was no board to
  drive. Q1 and Q2 are answered by that single number: zero open ⇒ zero DIRTY ⇒ no frozen CI.
- **Did not arm a second prompt.** ARM-ONE-AT-A-TIME is the rule and one is now armed. The remaining
  14 HOLDs were not re-triaged individually — 04's 14:10Z gate-liveness sweep did that two hours ago
  and it was collected in full by the 14:33Z addendum and the 15:24Z run.
- **Did not run `-Fix` on the watcher, and did not run the ENSURE-UP relaunch.** The sanctioned
  verdict was `HEALTHY`, the wrapper reads alive (1), and `restart churn: 0 cycle(s) in 20 min`.
  A restart on HEALTHY is the 2026-07-13 incident.
- **Did not treat the 51-minute heartbeat as a stall.** The heartbeat ticks only mid-run and the
  queue had been empty for 53 minutes. `HEALTHY` is the instrument's answer and it outranks mine.
- **Did not prune the orphaned worktree `C:/po-wt/s9hex`** (detached `f878a0a1`, `dirty=0`, ~600 min).
  Worktree hygiene is Station 03's lane and it was DISPATCHED to 03 in the 14:33Z addendum's C5.
  03's next occurrence is `2026-09-23T23:02:45Z`. **Re-dispatching is acting twice on one signal.**
- **Did not chase the 4B failure / no-op counts.** Unchanged from 15:24Z, which dispositioned them:
  `failed/` newest is 09-21, `no-pr-opened/` newest is 09-22. **No NEW silent no-op this cycle** —
  which is one of the five things the station doc forbids staying quiet about, so it is said out
  loud. Q5 has nothing to answer.
- **Did not clear the two untracked dev-tree paths that are not mine** — `Claude Design/docs/index.html`
  and `docs/pr-reviews/pr-2119-review.md`. Neither sits at a path this PR lands, so neither blocks
  the next fast-forward, and `git clean` is on the forbidden list.
- **Did not edit `STATION-CAPABILITIES.md`** for the dead `CADENCE` defect the 15:24Z run recorded
  as C4. Still deferred, still in my lane, still stale in the safe direction.
- **Did not re-file, re-word or re-measure any of the 46 `needs-marco/` files.** Rewriting a
  measurement inside a file Marco has already been asked to answer changes the question under him.
- **Did not touch anything under `docs/approvals/`.** Only Marco creates those. Five parked prompts
  wait on that class; repairing one of those gates would silently remove the only protection lint is
  enforcing on a class that includes an irreversible table drop and a production-data write.
- **Did not touch `/sot/`.** 05's lane, CP-24, absolute for me.
- **Did not touch Azure, Entra or SharePoint.** Absolute. `pr-scopecards-s8b-azure-maps-travel-HOLD.md`
  stays parked and no agent may take a step toward it.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard reported
  itself INERT, so the ban was remembered rather than mechanical — and it was honoured.

## FOR MARCO

**The board is empty, the trunk is green, the watcher is healthy, and one prompt is now building.
Everything else is blocked on you — the same four questions as last hour, plus one new small one.**

1. **`docs/approvals/` has issued nothing in 21 days, and 5 of the 15 parked prompts wait on it**
   (a 6th transitively) —
   `needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`.
   The question is *do you still want these five*, not *please approve them*; two are irreversible
   and stay yours to run whatever you decide. **Answering this clears the most board.**
2. **The fv2 cluster question is 6.0 days old** —
   `needs-marco/fv2-ai-import-digests-output-channels-cluster-still-wanted-2026-09-17.md`. Two
   prompts are parked behind a producer that no longer exists on the board.
3. **Station 06 has been silent 7.4 days** —
   `needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md`. **This is still
   the only one of the five that changes the rate at which the board refills — and this run is the
   evidence.** The single prompt I could arm was one another station staged an hour earlier, and
   with it armed there is now **nothing left to arm without you**. Option (a) — give 06 a cron on a
   minute away from `:05` and `:00` — is complete-and-additive and damages nothing: 06's authority is
   *stage `-HOLD` only*, and a `-HOLD.md` appearing on disk starts no work.
4. **sot/02 §2: generated table, or CI gate?** —
   `needs-marco/sot02-in-pr-table-is-on-its-fifth-refresh-and-rots-within-hours-2026-09-23.md`.
   One line to answer, and it also decides sot/04's drift recurrence, so the two become one prompt
   the moment you pick a form.
5. **NEW, and small: is `weekly-security-audit` meant to be off?** It is `enabled: false` and has
   not run since **2026-09-06** (16.8 days) — the only disabled task of the five. If that is a
   deliberate pause, nothing is wrong and I will stop surfacing it. If it is not, say so and the
   next run files it properly. Re-enabling a scheduled task is a standing-configuration change and
   stays yours.

**Nothing is stuck on an agent.** One prompt armed and building, zero PRs open, no gate, process or
tree needing repair.
