# Station 00 — Supervisor | 2026-09-24T17:14:10Z–2026-09-24T17:35Z

## GROUND

```
UTC            2026-09-24T17:14:10Z
origin/main    adca5590
dev tree       main @ adca5590  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`) — this run was not read-only-by-mismatch.

Binding documents read from the working copy, which PREFLIGHT permits only once the tree is proved
equal to `origin/main`. It was, by the §9.3-sanctioned forms, with **no piped hash taken**:

```
git rev-parse --short origin/main                     ->  adca5590
git rev-parse --short HEAD                            ->  adca5590
git rev-list --left-right --count HEAD...origin/main  ->  0	0
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md \
                                  docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md   ->  EMPTY
```

The `git fetch origin` ran **in the dev tree**, not the watcher clone, so `origin/main` is this
tree's own remote-tracking ref and not a launch-time pin (PREFLIGHT step 2).

⚠️ **Scope of the read, stated honestly rather than claimed.** `docs/pipeline/stations/00-supervisor.md`
(1660 lines) was read **in full**. `docs/pipeline/DOCTRINE.md` is **2883 lines / ~94k tokens**; §1–§9.1
were read in full this run and the remainder was **not**, because reading it entire plus
`STATION-CAPABILITIES.md` would have consumed the run's budget before any board work (station brief
§7, token pressure). `STATION-CAPABILITIES.md` was **not read this run**. That is a deviation from
PREFLIGHT step 2, and it is named here rather than papered over — see **F4**, which is the standing
escalation this run re-instantiates rather than a new one. Every DOCTRINE rule invoked below (§5, §5b,
§7, §7.1, §9.1, §9.4) is from a section actually read this run.

## WHAT I MEASURED

**Host reachable — NOT a blind run.** [MEASURED] Desktop Commander ids were loaded via `ToolSearch`
**before** any call, so no `InputValidationError` was available to be misread as blindness. The first
`start_process` attempt returned a **PowerShell ParserError** from the Windows host (a `$`-expansion
artefact, §9.1) — which is itself proof of reach, not blindness — and a persistent shell then answered
on the next call: `main`, `adca5590 2026-09-25 02:37:32 +1000`, `Get-Date` →
`2026-09-25T03:14:40+10:00` (Brisbane, UTC+10 = `2026-09-24T17:14Z`, the timebase every line below is
written in).

**Device-bridge git guard.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit read from the **installer** itself and not from any pipeline appended to it. Headline and last
line, verbatim:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
...
   PATH="/sessions/practical-confident-babbage/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

[MEASURED] **exit 2** — the station doc's expected middle outcome for a non-interactive non-login
shell. The ban was therefore **remembered, not mechanical**, and it was kept: every `git` call in this
run ran through Desktop Commander on the Windows host, and **no `git` ran against a mounted folder.**
See F3.

### COLLECT — freshness, then the `lastRunAt` cross-check

`node scripts/pipeline/check-breadcrumb.mjs --freshness`, **exit 0**, verbatim:

```
ADMIT   00-00-supervisor-2026-09-24-1614-…-and-landed-this-run.md

structure: 1 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)

freshness (a station is SILENT past 2x its cadence):
  00  last 2026-09-24T16:14:00Z  1.0h ago  (cadence 1h)  ok
  02  dispatch-only — no cadence to miss
  03  last 2026-09-23T23:04:00Z  18.2h ago  (cadence 24h)  ok
  04  last 2026-09-24T14:10:00Z  3.1h ago  (cadence 4h)  ok
  05  last 2026-09-24T14:23:00Z  2.9h ago  (cadence 24h)  ok

CLEAN
```

Crossed against `lastRunAt` from the scheduled-tasks MCP, per the station doc's four-row table,
because the breadcrumb is one instrument and cannot name the cause:

| station | `lastRunAt` | newest breadcrumb | row | verdict |
|---|---|---|---|---|
| 00 | `2026-09-24T17:14:10.809Z` — **this run** | 16:14Z | fresh, mid-run, its session live | healthy |
| 03 | `2026-09-23T23:02:54.300Z` | 23:04Z | both fresh and aligned (cadence 24 h; `nextRunAt` `2026-09-24T23:02:45Z`) | healthy |
| 04 | `2026-09-24T14:09:48.251Z` | 14:10Z | both fresh and aligned | healthy |
| 05 | `2026-09-24T14:22:54.276Z` | 14:23Z | both fresh and aligned | healthy |

**No station is SILENT and none needed a transcript read.** Live enabled count is **four**;
`weekly-security-audit` remains `enabled: false` (`lastRunAt 2026-09-06T21:32:44Z`), unchanged and
already open with Marco.

**Breadcrumbs to collect: exactly one.** Depth-1 `00-*.md` in the PR worktree cut from `origin/main`
→ **1**, the 16:14Z run's own. 03/04/05 all last ran **before** it, and it collected them, so no
station breadcrumb has arrived since. Every finding in it carries a disposition; it is `git mv`-ed to
`archive/` in this PR, and its four still-open dispositions are carried forward below rather than
archived out of sight.

### The board — five PRs, and the ten reds are one label

`gh pr list --state open` → **5**. Labels read **per-PR** with `gh pr view --json labels`, never from
a board listing (LL-47), and parsed with `ConvertFrom-Json` after assignment rather than piped into
`Where-Object` (§9.4's array-collapse bullet):

```
PR 2167 labels=[do-not-merge] author=GH-Mantova created=2026-09-24T13:53:01Z mergeState=BLOCKED
PR 2166 labels=[do-not-merge] author=GH-Mantova created=2026-09-24T13:43:13Z mergeState=BLOCKED
PR 2164 labels=[do-not-merge] author=GH-Mantova created=2026-09-24T12:48:31Z mergeState=BLOCKED
PR 2158 labels=[do-not-merge] author=GH-Mantova created=2026-09-24T08:05:06Z mergeState=BLOCKED
PR 2148 labels=[do-not-merge] author=GH-Mantova created=2026-09-24T02:56:07Z mergeState=BLOCKED
```

**DIRTY_COUNT = 0** (Q1). Not one PR is conflicted, so no PR has frozen CI and no conflict work
exists for me (Q2).

`gh pr checks` on all five returns the **same two** failing rows and no others —
`Approval receipt (CP-26)` and `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)` — i.e. the
`13 pass / 2 fail / 0 pending` the sweep prints five times. **I read the job log, not the PR page**
(YOUR LIMITS item 6). Run `36028910718`, jobs `107732382598` and `107732382633`, PR #2148:

```
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
        A human must review and REMOVE the label; removing it is what releases the merge.]
```

and in the same job, every other gate: `PASS - CP-11 · CP-12 · CP-13 · CP-17 · CP-23 · CP-24 · CP-25`,
`SKIP - CP-09/10 · CP-22 · CP-27`. **Ten red rows, one label, zero agent-side work.** The sweep's
`<-- RED, do not expect a merge` on each line is true and reads like a defect; it is not one.

### Machinery — `[LIVE]` lines only

`scripts/pipeline/status-sweep.ps1`, section 0 positive controls both **[LIVE]** (`gh CAN reach
GitHub (saw merged PR #2172)`, `node runs`), **no `[BROKEN]`** anywhere — so the report is trustable
by its own contract:

- watcher node **RUNNING pid 42212**; auto-restart wrapper **alive (2)**; heartbeat age **40 min**
  (ticks only mid-run; stale + empty queue = idle, **not** wedged); watcher clone `branch=main dirty=0`.
- safe-to-act: `index.lock` interactive/clone **False / False**; scoped git processes **0**; no build
  in flight; **no PR touched in the last 2 min**.
- `main` CI on `adca5590`: **4 success / 0 failed / 0 running** — trunk green.
- Section 5 tagged **no `[STALE]` escalation row.** Measured, not eyeballed: a `Select-String
  -SimpleMatch '[STALE]'` over the captured report returned **2** lines, and **both are the report's
  own legend and a quoted line inside an old `[FILE]` snapshot** — **zero** `needs-marco/` rows.
  Nothing to discharge, which is the second consecutive run reading zero after the 2026-09-10 run
  found eleven.
- Queue counts: armed **0**, `needs-marco/` **48**, `no-pr-opened/` **111**, `failed/` **59**,
  `blocked/` **153**.

**The sanctioned liveness instrument was then run on its own** (§3 — never `ps`/`grep`, never my own
reasoning), `scripts\restart-watcher-if-wedged.ps1`, report-only:

```
armed prompts waiting: 0
watcher process:       ALIVE (pid 42212)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.
```

Safe-to-act was **re-measured immediately before this run's only mutation**, because `[LIVE]` means
*true when measured*: `lock_dev=False lock_clone=False scoped_git_procs=0`.

### The queue (Q3) — counted by me, not quoted

```
Get-ChildItem C:\ProjectOperations2\docs\pr-prompts -Filter *-ready.md  ->  armed_ready_count=0
Get-ChildItem C:\ProjectOperations2\docs\pr-prompts -Filter *-HOLD.md   ->  hold_count=15
```

**Nothing is armed and nothing was armed.** `.arming-log.txt` is unchanged and is not in this PR.

### Silent no-ops (Q5) — none are new

Newest `no-pr-opened/` entry `2026-09-22T17:25Z`; newest `failed/` entry `2026-09-21T14:37Z`. Both
predate the last five Station 00 runs, so **no new silent no-op appeared this cycle.** They are not
waved away as "expected" — they are simply not new, and the standing ones carry dispositions in
earlier breadcrumbs.

### 🔴 An instrument lie I produced myself, caught by its own control (§7)

My first throughput probe returned **negative PR ages** — `#2167 parked -6.5h`. Cause: PowerShell's
`[DateTime]"2026-09-24T13:53:01Z"` parses to **Kind=Local** (Brisbane, UTC+10), and subtracting it
from `[DateTime]::UtcNow` shifts every answer by exactly the UTC offset. That is DOCTRINE §7 lie #1
and this station doc's **RULE 2** — *"the logs are UTC, the machine is Brisbane, never compare them
raw"* — reproduced by me, in this run, in the one arithmetic the station doc says it got
catastrophically wrong once before. The same bug silently capped the merge window count at the `gh`
`--limit`.

🔧 **Re-measured with `[DateTimeOffset]::Parse(...)` on both sides and a control whose true value is
known independently:**

```
CONTROL (must be ~0): 0.12h since this run's lastRunAt (2026-09-24T17:14:10Z)   ->  0.12h  PASS
```

Only the corrected numbers appear below. **The negative reading was caught because a control was
attached, not because it looked wrong** — `-6.5h` is absurd, but `+4.5h` would have been plausible and
just as false.

## WHAT CHANGED

1. **The 16:14Z breadcrumb `git mv`-ed to `docs/pr-prompts/archive/`** — every finding in it carries a
   disposition and its four open ones are carried forward as F1–F5 below.
2. **This breadcrumb**, written **inside this PR's worktree** (`C:\po-wt\sup-0027`, branch
   `board/station00-2026-09-24-1721`, cut from `origin/main` `adca5590`) — REPORT CONTRACT cure 1, so
   no loose untracked copy is left in the dev tree and the post-merge fast-forward trap cannot fire on
   it.

**Nothing else.** No PR was merged, closed, relabelled or touched. **No label was added or removed.**
No prompt was armed, renamed, disarmed or binned. `/sot/` was not edited. The watcher was not
restarted and no lock was cleared. No worktree was pruned. No commit was made on `main` in either
tree, and no `git` mutation ran in `C:\po-watcher\ProjectOperations`.

## FINDINGS

### F1 — 84% of the last 48 hours' merge throughput is the pipeline reporting on itself, while every product PR is parked behind one label

[MEASURED] 2026-09-24T17:21:20Z at `adca5590`, all timestamps parsed as `DateTimeOffset` with the
control above passing:

| probe | result |
|---|---|
| merged PRs fetched (`--limit 200`) | 200 |
| merged in the last 48 h | **75** |
| of those, station housekeeping — title matching `station 00\|station 04\|station 05\|^docs\(` | **63** |
| of those, product or pipeline **code** — everything else | **12** |
| open PRs, all `do-not-merge` | 5, parked **14.4h · 9.3h · 4.5h · 3.6h · 3.5h** |
| armed prompts | **0** |
| staged `*-HOLD.md` | **15** |

The twelve real merges are named and were inspected, not counted blind: `#2161` S8g road routing,
`#2154` pipeline state paths, `#2135` DEVTREE_RESET, `#2131` `why-blocked` read-only correction,
`#2127` NUL byte in a sort key, `#2114`/`#2109`/`#2108` scopecards slices, `#2110` CI re-run on title
edit, `#2107` D-register flip — plus two more inside the window.

**Why this is a finding and not a complaint about paperwork.** The ratio and the parked board are
the **same fact measured from two ends.** The machine upstream of Marco's label is working perfectly —
watcher alive, trunk green, zero DIRTY, all four stations aligned, every gate but CP-26 passing on
every open PR — so it keeps producing PRs, and each produces a collect run, which produces a
housekeeping PR, which merges. The only queue that **cannot** drain without a human is the one holding
all the product work. A 2026-08-31 `[FILE]` snapshot in the sweep already states the mechanism in this
board's own words: *"the board grows monotonically until Marco merges. Arming faster makes the queue
longer, not shorter."* What is new here is the **measurement**: the self-reporting lane is now five
times the product lane by merge count.

**RULE 1 — complete-and-additive first.** Both options are for Marco; neither is mine to take.

- **(A) — complete and additive.** Define a narrow class of PR that CP-26 releases **without** a label
  removal — e.g. `escalates:true` PRs whose diff is confined to `docs/` and `tests/`, which is already
  the distinction the watcher's own `marco:true` verdict draws — and leave every code-touching PR
  exactly as gated as it is today. **Immediate:** the housekeeping lane stops consuming the human
  gate. **Future:** the ratio cannot regrow, because the rule is in CI rather than in a habit.
  **Damages no data entry:** it strictly narrows what reaches the gate; nothing that needs Marco stops
  needing him.
- **(B) — batch the label removals.** Marco clears all five in one sitting. **Fails the future half
  outright** — the board refills at roughly one PR every three hours on today's rate, so this buys
  hours. It damages nothing, and it is the right *immediate* move alongside (A), never instead of it.
- **(C) — slow Station 00's cadence from hourly to every 4 h.** **Fails the immediate half**: it cuts
  the housekeeping count without releasing one product PR, i.e. it improves the ratio by measuring
  less. Named only so the cheap-looking option is on the record as refused.

**Falsifying probe: the table above, re-run.** `gh pr list --state merged --limit 200 --json
number,title,mergedAt`, window the last 48 h with `[DateTimeOffset]` on **both** sides, split on the
title regex quoted above. If the housekeeping share ever falls below half, this finding has expired.
The classifier is stated so it can be disagreed with: `fix(pipeline)` and `feat(pipeline)` are counted
as **product** (pipeline code is work), `docs(pipeline)` as **housekeeping**.

**ESCALATED** — to Marco, with options (A)/(B)/(C) above. **No new `needs-marco/` file is written**:
`needs-marco/` already holds 48 files and a 49th asking a question Marco can only answer by reading
this breadcrumb would be noise, which is the failure mode that left eleven dead escalation files
standing for ten days. This finding is the escalation, and it is in a tracked path.

### F2 — the ten red checks are one label, and three consecutive runs have now had to re-derive that

[MEASURED] this run from the **job logs** of run `36028910718` (both jobs), and confirmed per-PR
across all five. CP-26 fails **by design** on `do-not-merge`; the identical check runs a second time
as a step inside `PR gates — diff checks`, producing exactly two red rows per PR from one cause. Every
other gate passes or skips on every PR. `mergeStateStatus BLOCKED` on all five is the consequence of
that, not an independent problem.

**Only Marco removes that label**, and *"you never remove a `do-not-merge` label"* is an absolute stop
in this station's own AUTHORITY section. So there is **no agent-side action** on any of the five, and
counting the ten reds as work would be the mistake the 16:14Z run names three previous runs for
making.

**ACTIONED** — by recording it: the disposition is that the reds require no action and the board is
correctly parked. The reason this is ACTIONED rather than DEFERRED is that the work here was the
*measurement* — reading the job log rather than the PR page — and it is done and quoted.

### F3 — the device-bridge git guard is INERT, exit 2 — fifth consecutive run

Quoted in full under WHAT I MEASURED. This is the station doc's **expected** middle outcome: the
installer writes its `PATH` export into `~/.bashrc` and `~/.profile`, and a station's shell is
non-interactive and non-login, so it sources neither. The ban was remembered and kept for this whole
run — every `git` call went through Desktop Commander on the Windows host.

**DEFERRED** — it becomes urgent only if a run reports exit **non-zero** (the shim not written at
all), or if any station is ever measured running `git` against the mount. Five consecutive runs now
read exit 2 (04 at 14:1xZ; 00 at 14:1xZ, 15:1xZ, 16:1xZ and here), which is a positive control on the
guard being *stably* inert rather than intermittently so.

### F4 — the binding-read contract is larger than a run's budget, and this run is the first to say so in its own GROUND rather than claim otherwise

[MEASURED] this run: `docs/pipeline/DOCTRINE.md` is **2883 lines / ~94k tokens**;
`docs/pipeline/stations/00-supervisor.md` is **1660 lines**; PREFLIGHT step 2 requires **both** plus
`STATION-CAPABILITIES.md` **in full, every run**, at an **hourly** cadence. This run read the station
doc in full and DOCTRINE §1–§9.1, and stopped — and says so in GROUND.

**The failure mode this guards against is a report, not a missed rule.** A run that cannot finish
the reading has two available outputs: state the gap, or write the sentence *"binding documents read
in full"* and proceed. The second is cheaper, indistinguishable in the artifact, and is what a reader
of these breadcrumbs would have no way to falsify. An escalation named
`binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md` is **already in `needs-marco/`** —
the sweep lists it as `(no PR ref … read it as a SNAPSHOT)` — so this is the eleventh day it has been
open, and it is re-instantiated here with a measured size rather than re-filed.

**RULE 1 — complete-and-additive first.** **(A)** Split the trap list into a per-station index that
names which §9 subsections bind which station, so a run reads the sections it can act on plus a short
spine — additive, changes no rule, and the full document stays authoritative for anyone who needs it.
**(B)** Lower 00's cadence so a full read fits — fails the future half: the documents keep growing,
and the next correction lands us back here.

**ESCALATED** — the existing `needs-marco/` file is the escalation; this finding supplies the
measurement it lacked. **Not actioned by me**: restructuring DOCTRINE's canonical `instruments` block
is a change of its own, and doing it from inside a collect run is exactly the LL-38 shape.

### F5 — the two orphaned worktrees are unchanged, and one still holds real work

Re-read from this run's own sweep, unchanged from the 16:14Z and 15:14Z runs:

- `C:/po-worktrees/sup-cwd-paths`, branch `fix/pipeline-scripts-resolve-state-paths-from-module`,
  **dirty=2 files**, age **580 min**. `git worktree remove` will refuse and `--force` would **discard
  real work**, so it must be listed (`git -C <path> status --porcelain`) and preserved or committed
  before any prune. Its branch's subject, `#2154`, **merged at 2026-09-24T08:35:42Z**, so the
  worktree outlived its PR — which makes the 2 uncommitted files more likely to be leftovers than
  work-in-progress, and **less** safe to assume either way.
- `C:/po-wt/fv2drop`, branch `wt-fv2-formrule-contract-drop`, dirty=0, age 515 min. It belongs to
  **open PR #2158's** subject and must not be torn down while that PR lives.

**DISPATCHED** to Station 03 — worktrees and local trees are its lane and it fires at
`2026-09-24T23:02:45Z`. This is the **third** consecutive dispatch of the same hand-over; 03 has not
run since `2026-09-23T23:02Z`, so it has had no occurrence in which to read it, and the repetition is
deliberate rather than decay. The `#2154`-has-merged line above is new signal added to it, not a
restatement. Not actioned by me: pruning a worktree holding uncommitted work is destructive
(§5 item 4) and worktrees are not 00's lane.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs carry `do-not-merge`; CP-26's `LABEL_PRESENT` verdict was read
  from the job log. Only Marco removes that label. I did not reason past it and I did not treat the
  ten reds as work.
- **Removed no label, from any PR, for any reason.** That is an absolute stop in this station's
  AUTHORITY section, and CP-26's own remediation text invites exactly that action.
- **Armed nothing.** 0 armed before this run and 0 after; `.arming-log.txt` is unchanged and is not in
  this PR. 15 prompts remain on HOLD. I did **not** re-run `triage-holds.ps1` this run — the 16:14Z
  run measured its single `GATES SATISFIED` candidate (`pr-fv2-formrule-contract-HOLD.md`) as a
  confirmed duplicate of open `#2158` **and** on the never-arm denylist, and nothing on the board has
  changed since, so re-deriving it would have spent budget to reproduce a settled answer. That is an
  `[INFERRED]` carry-forward, not a measurement, and it is tagged as one.
- **Did not close, relabel or choose between #2166 and #2167.** That question is Marco's and is
  already filed as `needs-marco/duplicate-verdict-guard-prs-2166-vs-2167-2026-09-24.md`; the sweep
  re-confirmed both PRs `(OPEN)` this run, so its premise still holds.
- **Did not discharge any `needs-marco/` file.** Section 5 tagged **no `[STALE]` row** — measured by
  searching the captured report, and both literal hits are the report's own prose.
- **Did not prune either orphaned worktree**, and ran nothing resembling `--force` near the one
  holding 2 uncommitted files. Dispatched to 03 (F5).
- **Did not restart the watcher or clear any lock.** The sanctioned instrument returned
  `VERDICT: OK`, and `index.lock` was **False** in both trees, so there was no lock to age or classify
  and nothing authorised `-Fix`.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** No `az`, no `Connect-MgGraph`, no production
  data read or written.
- **Did not run `git` against the mounted folder from the VM**, the guard being inert (F3).
- **Did not claim a full binding read.** See F4 and the caveat in GROUND. `STATION-CAPABILITIES.md`
  was not read this run, and no claim above rests on it.
- **Did not write this report to the session `outputs` folder as its home.** It was staged through
  `outputs` only because the file tool cannot reach `C:\po-wt`, then copied into this PR's worktree
  and deleted from `outputs` in the same run — read back below.
