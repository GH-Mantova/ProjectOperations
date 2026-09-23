# Station 00 — Supervisor | 2026-09-23T14:14:38Z–2026-09-23T14:3xZ

## GROUND

```
UTC            2026-09-23T14:14:38Z
origin/main    4421531f            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 4421531f      C:\ProjectOperations2
doc version    1                    (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE. This run acted.

## WHAT I MEASURED

**[MEASURED] Host reachable — this was a SIGHTED run.** `start_process` shell `powershell.exe`
answered on the first call. The first shell (PID 35864) exited after its one-shot command, so a
persistent `-NoExit` shell (PID 40620) was started and carried the whole run. A literal
`MARKER_<n>` was echoed after every statement in every chain (DOCTRINE §9.1
`EARLY_RETURN_REPORTED_AS_TERMINATION_V1` guard 1); every marker printed, so no statement in this
run was read as "found nothing" when it had not run. One `interact_with_process` call hit the
180 s MCP cap during the sweep and reported a timeout — guard 2 was applied, the buffer was drained
with `read_process_output` until `0 remaining`, and `MARKER_SWEEP_DONE` was present.

**[MEASURED] Device-bridge git guard — exit 2, INSTALLED BUT INERT: the EXPECTED station outcome.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit read from the INSTALLER
and not from a pipeline appended to it:

```
GUARD_EXIT=2
```

Headline, verbatim: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from
your shell.` Last line, verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/bold-cool-shannon/.local/bin:$PATH" git <args>
```

Its own controls, printed in the same output: `bash -lc 'command -v git'` →
`/sessions/bold-cool-shannon/.local/bin/git` (the shim); `bash -c 'command -v git'` →
`/usr/bin/git`. **So the device-bridge git ban was REMEMBERED, not mechanical, for this run.** No
`git` was run against the mount at any point; every git call went through the Windows host shell.

**[MEASURED] The three binding documents were read IN FULL, and the working copy is PROVEN CURRENT
against `origin/main`.** The sound equivalence probe PREFLIGHT step 2 prescribes, run in the dev
tree `C:\ProjectOperations2` (never the watcher clone), with no pipe and no hash comparison:

```
git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md \
                                  docs/pipeline/stations/00-supervisor.md
   ->  EMPTY
```

EMPTY is the real answer, so what I read is byte-equivalent to `origin/main` for all three.
Divergence control, same shell: `git rev-list --left-right --count HEAD...origin/main` → `0	0`.

**[MEASURED] Dev tree clean; the only two entries are untracked and neither can block a
fast-forward.** All four read-backs, not only the two that pass on a dirty tree:

```
git rev-list --left-right --count HEAD...origin/main  ->  0	0
git diff --numstat                                    ->  EMPTY
git diff --cached --name-status                       ->  EMPTY
git status --porcelain  ->  ?? "Claude Design/docs/index.html"
                            ?? docs/pr-reviews/pr-2119-review.md
```

Neither `??` path is a breadcrumb and neither sits at a path this run's PR lands, so neither is an
FF blocker. Left alone — `git clean` is on the forbidden list (DOCTRINE §9.2).

**[MEASURED] `status-sweep.ps1` — SAFE TO ACT.** Captured to a file (the script returns early and
hides its own section 7 verdict otherwise) and decoded `utf16le` in node, per DOCTRINE §9.3's `*>`
bullet: `bytes=134566 chars=67283 lines=386`, `SWEEP_EXIT=0`, generated `2026-09-23 14:15:41Z`.
Section 0 instrument controls both `[LIVE]` PASS: `gh CAN reach GitHub (saw merged PR #2121)`,
`node runs`. Section 7, verbatim:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Section 3's real mutation signals, all `[LIVE]`: `git index.lock interactive/clone: False / False`;
`git processes touching our trees (scoped): 0`; `no PR touched on GitHub in the last 2 min`.
Re-measured immediately before this run's first mutation (§7's `[LIVE]` expiry rule, `14:21:54Z`):
`LOCK_DEV=False`, `LOCK_CLONE=False`, `GITPROCS=0`.

**[MEASURED] ZERO live `[STALE]` escalation rows in section 5.** Every section-5 line this run is
`[FILE] … cites #N (MERGED) as evidence -- not its premise; does not clear the escalation`, plus one
`pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md references #1612 which CLOSED
UNMERGED -- this may be the escalation's PREMISE`. **Nothing was tagged `[STALE]`, so the COLLECT
clearing step had no work** and no `needs-marco/` file was discharged.

⚠️ **The sweep's own `[LIVE]` lines are not exempt from §7** (`SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1`),
so both derived verdicts I acted on were re-derived from their own sources — the trunk row and the
board row, below.

**[MEASURED] The trunk is genuinely green — re-derived, not quoted.** Full 40-char SHA per §9.4's
short-SHA trap, `-R` and `$LASTEXITCODE` per its CWD trap, assign-then-count with a null guard per
`NULL_COUNT_IS_IN_THE_COUNTER_V1`:

```
git rev-parse origin/main -> 4421531fa1c52ea0ff6469daa4ebfe61c7cecb14
gh run list -R GH-Mantova/ProjectOperations --commit <full sha> --json conclusion,name,event,workflowName
RUNS_EXIT=0   COUNT=4
  Deploy                  | push    | success
  Tendering Browser Smoke | push    | success
  CodeQL                  | dynamic | success
  CI                      | push    | success
```

4 of 4 success, and **no `Dependabot Updates` row on this commit**, so the aggregate verdict and the
trunk-only subset agree — the denylist case that flipped a headline on 2026-09-10 does not arise.

**[MEASURED] The board is EMPTY — Q1 answered verbatim.**

```
gh pr list -R GH-Mantova/ProjectOperations --state open --json number,title,mergeStateStatus,isDraft,labels
 -> []
PRLIST_EXIT=0
```

**0 open PRs, therefore 0 DIRTY.** Exit 0 with `-R` present, so the empty array is a real empty
board and not §9.4's non-repo-CWD artefact; the positive control that `gh` reaches GitHub at all is
the sweep's section 0 line (it saw merged `#2121`). `origin/main`'s tip is `4421531f` — my own
13:20Z board PR `#2121`. **Nothing has merged since 13:25Z**, so nothing on the board changed in the
last hour.

**[MEASURED] Armed count, counted myself and not quoted (Q3).**
`@(Get-ChildItem C:\ProjectOperations2\docs\pr-prompts -Filter '*-ready.md' | Where-Object { $null -ne $_ }).Count`
→ **0**, null-guarded. Sweep section 4 `[LIVE]` agrees: `armed (*-ready.md): 0`.

**[MEASURED] Nothing is armable — `triage-holds.ps1` READ-ONLY, `TRIAGE_EXIT=0`, 76 lines.** Both of
its own instrument controls PASS, quoted from its first two lines:

```
GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (215487 chars), so gate probes can actually run.
SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture, so the SPENT bucket is measurable.
```

`HOLD=14, ready=0, LOOPING=0`; `spent=0  gates-satisfied=0  still-gated=14  unreadable=0`. The 14
REJECTs carry **two** distinct codes:

| reject code | count | prompts |
|---|---|---|
| `[HUMAN_GATE_PRESENT]` | **10** | `pr-524-rates-b-slice2-canonical` · `pr-devtree-sync-ff-only-guard` · `pr-fv2-formrule-contract` · `pr-nav-jobs-projects-merge` · `pr-queue-layout-sot-entry` · `pr-retire-tenderclientnote-s2` · `pr-scopecards-s8b-azure-maps-travel` · `pr-siteid-notnull-backfill` · `pr-tipid-s3-retire-the-name-guard-for-an-id-check` · `pr-vendor-invoice-ocr` |
| `[FILE_GATE_NOT_RELEASED]` | **4** | `pr-fv2-ai-digests` · `pr-fv2-output-channels` · `pr-rates-s11c-drop-legacy-tables` · `pr-tenant-mt4-s2-ownership-migration` |

⚠️ **The script printed its own `!!! SUSPECT: every prompt landed in ONE bucket` warning, and I
checked it rather than quoting past it.** That heuristic keys on the *bucket* count, not the
reject-code count. Four independent readings say the uniformity is real: both instrument controls
PASS (the GIT control is the specific thing the warning tells you to prove); the 14 rejects carry
two different codes, so gate evaluation discriminates; the script re-probed all 14 REJECTs directly
and reported `0 spent behind a REJECT, 14 still needed, 0 UNMEASURABLE`; and `gates-satisfied=0`
against `OPEN PRs: 0` is the expected shape of a board with no chained successor staged.
**[INFERRED]** from those four that the board is genuinely uniform, not the probe broken.

**[MEASURED] The watcher is ALIVE and correctly IDLE — not wedged.** The sanctioned probe,
report-only, no `-Fix`, verbatim:

```
=== 2026-09-24 00:20:24  watcher health check  (Fix=False)
armed prompts waiting: 0
watcher process:       ALIVE (pid 9744)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.
WEDGED_EXIT=0
```

Sweep section 2, `[LIVE]`, same window: `watcher node: RUNNING pid 9744`, `auto-restart wrapper:
alive (1)`, `heartbeat age: 169 min`, `watcher clone: branch=main dirty=0`. **The wrapper probe
returned 1, not 0**, so §3b's `wrapper=0`-is-a-question path was not entered and no relaunch was
attempted. Same pid 9744 as my 12:20Z and 13:20Z runs — no restart in between. A 169-minute
heartbeat with 0 armed is idle by the heartbeat's own semantics (it ticks only mid-run), not a
stall, and `restart churn: 0` corroborates.

**[MEASURED] All four enabled stations are accounted for; none is SILENT.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`,
`structure: 1 checked, 0 malformed`. Crossed against `lastRunAt` from the scheduled-tasks MCP, which
is the cross-check the breadcrumb instrument cannot do for itself:

| station | `--freshness` | MCP `lastRunAt` | MCP `nextRunAt` | row |
|---|---|---|---|---|
| `00` | `2026-09-23T13:20:00Z  1.0h ago (cadence 1h) ok` | **`2026-09-23T14:13:56Z`** | `15:13:52Z` | fresh `lastRunAt` = **this run**, mid-run inside my own window — healthy |
| `03` | `2026-09-22T23:29:00Z 14.8h ago (cadence 24h) ok` | `2026-09-22T23:28:57Z` | `2026-09-23T23:02:45Z` | both fresh and aligned to the second |
| `04` | `2026-09-23T10:10:00Z  4.2h ago (cadence 4h) ok` | **`2026-09-23T14:09:35Z`** | `18:09:31Z` | fresh `lastRunAt`, **no breadcrumb yet** — row 2 of the station doc's table, **NOT a defect** |
| `05` | `2026-09-22T14:23:00Z 23.9h ago (cadence 24h) ok` | `2026-09-22T14:23:04Z` | `2026-09-24T14:22:37Z` | both fresh and aligned |

🔎 **04's row was settled by the third instrument, not assumed.** `list_sessions` reports
`local_0421bd71-b66c-41a9-b7df-603698f7e378 "04 scanner" (running)` — a **fresh `lastRunAt` and a
running session together**, which is the station doc's own definition of *mid-run inside 00's
window*, and it happens on every one of 04's occurrences by construction (00 hourly at `:05`,
04 every 4 h at `:00`, `STATION-CAPABILITIES.md` §6). 04 started `14:09:35Z`, four minutes before
this run; its breadcrumb lands for my 15:13Z collect. The session state field was used only to
corroborate a fresh `lastRunAt`, never as a lock (DOCTRINE §9.5).
`weekly-security-audit` remains `enabled: false` (`lastRunAt 2026-09-06T21:32:44Z`), unchanged and
still Marco's to decide.

**[MEASURED] Station 06 has now been silent for SEVEN DAYS, and that is a re-measurement of an OPEN
escalation rather than a new finding.** Tracked set asked of `origin/main`, never of the dev tree's
index (`TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`), with `-r` and a trailing slash (§9.2):

```
git ls-tree -r --name-only origin/main -- docs/pr-prompts/
TRACKED_TOTAL=1353
S06_BREADCRUMBS=33   newest: archive/00-06-pr-master-2026-09-16-0456-...md
POS_S04=138   (00-04-* — positive control)
NEG_S09=0     (00-09-* — negative control, no such station)
```

06's newest breadcrumb is **2026-09-16T04:56Z**, i.e. **≈177 hours (7.4 days) ago**. The MCP lists
five tasks and **06 is not among them**; sweep section 4C `[FILE]` lists seven folders under
`Scheduled\` and **none is `06-*`**. The open escalation
`needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md` recorded this latency
as **18.4 hours** on 2026-09-07. Its central claim was re-verified live this run per DOCTRINE §7.1's
re-read rule, and it is not merely still true — it is **9.6× worse**.

**[MEASURED] `C:/po-wt/s9hex` is unchanged: clean, detached, now 481 minutes old.**

```
git -C C:\po-wt\s9hex status --short  ->  EMPTY   WT_STATUS_EXIT=0
git -C C:\po-wt\s9hex rev-parse --short HEAD  ->  f878a0a1
git worktree list -> C:/ProjectOperations2 4421531f [main]
                     C:/po-wt/s9hex        f878a0a1 (detached HEAD)
```

Sweep section 2 `[LIVE]` agrees: `orphaned worktree … C:/po-wt/s9hex f878a0a1 (detached HEAD)`,
`dirty=0 files  age=481 min` — 60 minutes older than my 13:20Z reading, consistent with nothing
having touched it.

**[MEASURED] Q5 — no new silent no-op.** Sweep section 4B `[LIVE]`: newest `no-pr-opened/` entry is
still `09-22 17:25Z pr-scopecards-s7-one-cutting-total-b-ready.md.log` and newest `failed/` entry is
still `09-21 14:37Z rev-2052-ready.md.log`. Both pre-date my 13:20Z collect, which already
dispositioned the 09-22 one as a handled historical no-op. **Nothing new since.**

**[MEASURED] Needs-marco corpus instrument control, with a freshly minted needle (§9.6).**
Over `docs/pr-prompts/needs-marco\*.md`, matched by `Path -Unique` and never `Filename`
(`FILENAME_UNIQUE_COLLAPSES_SAME_NAMED_CORPUS_V1`): POSITIVE `Marco` → **39** files of 44;
NEGATIVE `zzQq00Needle20260923T1425` → **0**. ⚠️ That needle is now spent.

## WHAT CHANGED

- **This board PR only.** It archives the fully-dispositioned 13:20Z breadcrumb into
  `docs/pr-prompts/archive/` and lands this one. Nothing else in the repo was touched.
- **Nothing was armed, disarmed, renamed, retired or binned.** `armed (*-ready.md): 0` before and
  after; `HOLD=14` before and after.
- **No PR was merged, closed, labelled, rebased or updated** — the board held 0 open PRs for the
  whole run, so there was nothing to drive.
- **No process was started, killed or restarted.** The watcher's verdict was `OK`, pid 9744
  unchanged from the previous two runs.
- **No file was written into the dev tree.** This breadcrumb was authored inside this run's own PR
  worktree (`C:\po-wt\bd-00-20260923-1420`), which is REPORT CONTRACT cure 1 and is why the
  post-merge fast-forward has no untracked breadcrumb to trip over.

## FINDINGS

### F1 — Nothing has changed since the 13:20Z collect. The board is idle-CORRECT, not stalled.

`origin/main` is still `#2121`'s squash, 0 PRs open, 0 armed, `gates-satisfied=0` of 14, trunk 4/4
green on the full SHA, watcher alive on the same pid. Every one of those was re-measured live this
run with its own instrument controls, not carried forward from the previous breadcrumb. The 14 HOLDs
are held by 10 human gates and 4 unreleased file gates and the station doc forbids arming any of
them, so **an empty board with nothing armable is the correct resting state here.**

**DISPOSITION: ACTIONED** — the correct action was to arm nothing and merge nothing, and nothing was
armed or merged. Verified by read-back: `*-ready.md` count **0** at the end of the run, unchanged
from the start; `gh pr list --state open` still `[]`.

### F2 — Station 06's silence is now 7.4 days, against the 18.4 hours its own escalation recorded.

`needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md` asks Marco one
question: *should Station 06 get a real scheduled task?* Its argument is that 06 owns the only
remedy for the board's throughput constraint — authoring `tests-docs`-only supply, the one lane that
moves without Marco — and that nothing wakes 06. **Both halves re-measured true this run**, and the
latency it quantified at 18.4 hours is now **≈177 hours**. This run is itself the evidence: sweep
section 6 `[LIVE]` reports `ready=1 needs-marco=2 blocked=4`, the one READY-TO-STAGE backlog item
(`[P2] rates-11c-blocked-consumers`) is 06's to stage and not 00's to author, and the board has been
at 0 open PRs / 0 armed / 0 armable for every hourly collect since at least `#2115` (06:29Z).

**DISPOSITION: ESCALATED — carried on the existing open file, not re-filed.** DOCTRINE §7.1's
re-read rule was applied: the escalation's central claim was re-verified against the live system
(MCP task list has no `06`; `Scheduled\` has no `06-*` folder; newest `00-06-*` breadcrumb
`2026-09-16T04:56Z`), so it is a finding and not a lead. Filing a second file for the same question
would split Marco's queue, which is the failure `CONSOLIDATED-stale-remote-heads-one-question`
exists to correct. **The new datum — 18.4 h → 177 h — is recorded here rather than by editing the
escalation**, because rewriting a `needs-marco/` file's measurements under Marco changes the
question he has already been asked. Option (a) in that file remains the complete-and-additive one:
give 06 a cron, on a minute away from `:05` and `:00`.

### F3 — `C:/po-wt/s9hex` is still orphaned, still clean, now 481 minutes old. The dispatch to 03 is CARRIED, not re-filed.

Worktrees and local trees are Station 03's lane. 03 has not had an occurrence since this was first
dispatched at 12:20Z — its `lastRunAt` is `2026-09-22T23:28:57Z` and its `nextRunAt` is
`2026-09-23T23:02:45Z` — so the hand-over has simply not been read yet.

**DISPOSITION: DISPATCHED — to Station 03 (Machine-minder), next occurrence `2026-09-23T23:02:45Z`
(MCP `nextRunAt`).** This is the *third* statement of the same dispatch (12:20Z, 13:20Z, now), not a
third finding. Handing over: prune `C:/po-wt/s9hex` if it is still clean and still detached at
`f878a0a1` then. **Carry the caveat:** `git merge-base --is-ancestor f878a0a1 origin/main` exits
**1**, and on a squash-merge repo that is the expected answer for a *merged* branch as much as an
abandoned one, so **do not read the non-ancestry as evidence of unlanded work** and do not let it
argue against pruning. The work it was built for is on `main` as `#2114` (merged 11:53Z).

### F4 — The device-bridge git ban was REMEMBERED, not mechanical, for the whole of this run.

`vm-git-guard.sh` exited **2** — `INSTALLED BUT INERT`. The shim is byte-correct and off `PATH`,
because the shell a station is given is non-interactive and non-login and sources neither
`~/.bashrc` nor `~/.profile`. A FINDING, not a STOP, quoted rather than passed over because an
install nobody can see in the report is indistinguishable from one that never ran.

**DISPOSITION: DEFERRED.** Real, not now. Making the ban mechanical means changing how the station's
shell is launched, which is neither mine nor a code change in this repo. **What would make it
urgent:** any 0-byte `index.lock` with no owning Windows process in either tree — the failure the
guard exists to prevent, which has cost three freezes in two days historically. Measured this run
immediately before mutating: `LOCK_DEV=False`, `LOCK_CLONE=False`, `GITPROCS=0`. Not urgent today,
and the mitigation cost nothing: no `git` was run against the mount at all.

### F5 — `check-breadcrumb.mjs`'s `CADENCE` map now reads `'00': 1` — the defect F4 of the 13:20Z run carried is GONE.

My 13:20Z breadcrumb deferred this as *"`CADENCE` still reads `'00': 2` against a live cron of
`5 * * * *`"*. **[MEASURED] this run it does not — read from the SOURCE on `origin/main`, not
inferred from the printout:**

```
git show origin/main:scripts/pipeline/check-breadcrumb.mjs | Select-String 'const CADENCE'
 -> const CADENCE = { '00': 1, '02': null, '03': 24, '04': 4, '05': 24 };
```

NEGATIVE control over the same blob, a freshly minted needle → **0**. ⚠️ That needle is now spent.
Corroborated by the effect: `--freshness` printed
`00  last 2026-09-23T13:20:00Z  1.0h ago  (cadence 1h)  ok`, with `04 … (cadence 4h)` and
`03 … (cadence 24h)` in the same output matching their live crons, so the printer reads the map
rather than a constant. `[CANNOT MEASURE]` which PR carried the one-character fix — I did not
`git log` the file, and nothing in this run's verdict turns on it.

**DISPOSITION: ACTIONED — closed as no longer reproducing.** The compensating cross-check ran anyway
(every `--freshness` row crossed against MCP `lastRunAt`, table above). **Falsifying probe:** the
`cadence Nh` token on `00`'s `--freshness` row. If it ever prints `cadence 2h` again, this closure
is wrong and the DEFERRED finding returns.

### F6 — `rates-11c-blocked-consumers` still sits in the backlog as the single `READY TO STAGE` item.

Sweep section 6, `[LIVE]`: `ready=1  needs-marco=2  blocked=4  broken=0`, the one ready item being
`[P2] rates-11c-blocked-consumers`. Staging new work is Station 06 (PR Master)'s lane — 00 arms, it
does not author — and the item's own note records that its downstream
`pr-rates-s11c-drop-legacy-tables` is a destructive table drop, never-arm and Marco-run regardless.

**DISPOSITION: DEFERRED, and it is the same item F2 is about.** Genuinely unblocked and genuinely
not this run's work: its terminal slice is Marco's either way, and the station that stages it has no
clock (F2). **What would make it urgent:** Marco answering F2's escalation with option (b) — *"00
authors it itself"* — or asking for the rates chain to move.

## WHAT I DID NOT DO

- **Did not arm anything.** `gates-satisfied=0`; all 14 HOLDs are correctly gated. Arming any would
  have required overriding a human gate or an unreleased file gate.
- **Did not merge, close, label or rebase any PR.** The board was `[]` for the whole run.
- **Did not author the `tests-docs` supply prompt myself.** That is option (b) of F2's open
  escalation, and choosing it unilaterally is the half of RULE 1 that option fails — it would fold a
  third station into 00 and remove the independent read of a prompt before it runs.
- **Did not edit `needs-marco/station-06-has-no-cadence-…md`.** Rewriting a measurement inside a
  file Marco has already been asked to answer changes the question under him; the new datum is in
  F2 instead.
- **Did not touch `/sot/`.** Station 05's lane, CP-24-enforced.
- **Did not prune `C:/po-wt/s9hex`**, or any worktree — Station 03's lane, carried at F3.
- **Did not restart or touch the watcher.** Verdict `OK`; §3a forbids restarting on anything but
  WEDGED or DOWN, and the wrapper probe read 1 so §3b was not entered either.
- **Did not interrupt, inspect beyond `list_sessions`, or act on Station 04's in-flight run.**
  It started `14:09:35Z`, four minutes before me; that overlap is by construction and is not a
  collision to resolve.
- **Did not touch Azure, Entra or SharePoint**, and ran no `az` or `Connect-MgGraph`. Absolute hard
  stop, all stations.
- **Did not run `git` through the device bridge against the Windows `.git`**, despite the guard
  reporting itself INERT.
- **Did not discharge any `needs-marco/` file.** Zero live `[STALE]` rows this run; the 44 files in
  that queue are Marco's and none was measured dead.
- **Did not clear the two untracked dev-tree files** (`Claude Design/docs/index.html`,
  `docs/pr-reviews/pr-2119-review.md`). Neither sits at a path this PR lands, so neither can block
  the fast-forward, and `git clean` is on the forbidden list.
- **Did not re-run or re-diagnose any CI.** The trunk is green on the full SHA
  `4421531fa1c52ea0ff6469daa4ebfe61c7cecb14` (4 success / 0 failed) and there were no open PRs.

## FOR MARCO

**One question, and it is not new — it is the seven-day-old one getting steadily more expensive.**

`docs/pr-prompts/needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md`:
**should Station 06 get a scheduled task?** When it was written, 06 had been silent 18.4 hours.
It is now **7.4 days**. Meanwhile the board has been empty for every hourly collect today, all 14
staged prompts are held behind gates only you can release, and the one backlog item whose blocker is
gone (`rates-11c-blocked-consumers`) needs 06 to stage it.

Option **(a)** — give 06 a cron, on a minute away from `:05` and `:00` — is the
complete-and-additive one: it consumes today's queued dispatches and every future one, and it
damages nothing, because 06's authority is *stage `-HOLD` only*. A `-HOLD.md` appearing on disk
starts no work; arming stays a deliberate call only 00 makes. Creating the task is yours — the cron
lives in the scheduled-tasks layer, not in this repo.
