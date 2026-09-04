# Station 00 - Supervisor | 2026-09-04T06:09:16Z-2026-09-04T06:29Z

## GROUND

```
UTC            2026-09-04T06:09:16Z
origin/main    dd7db248            (fetch first, then rev-parse)
dev tree       main @ dd7db248      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Read in the DEV TREE (`C:\ProjectOperations2`), never the watcher clone. Doc version and bootstrap
AGREE, so this run had full authority. SIGHTED, not blind: `start_process` shell `powershell.exe`
returned PID 24104 on the first call, after loading the schema with a KEYWORD `ToolSearch`
(see FINDING 3 - the literal ids the contract supplies do not exist here).

Working copy proven byte-current with `origin/main` for all three binding docs by
`git rev-parse origin/main:<path>` == `git hash-object <path>` (`6746ecc8` / `e3a1b3bd` /
`3d3b94f1`), plus `git diff --name-only -- docs/pipeline/` EMPTY. See FINDING 2: the probe the
canonical block itself prescribes disagreed with that, and it is the probe that is wrong.

## WHAT I MEASURED

**Sweep.** `scripts/pipeline/status-sweep.ps1` 06:13:17Z -> **CAUTION**, 1 "LIVE STATION WORKTREE"
(`C:/po-queue`). Re-run 06:21:28Z after FINDING 4 -> **SAFE TO ACT**.

**Board, four readings, and it moved three times.**

| UTC | open PRs | armed | note |
|---|---|---|---|
| 06:13 | **0** (`gh pr list --json` raw string length **2** = `[]`, and `$rows` assigned-then-counted = 0) | 0 | board empty |
| 06:21 | 0 | **1** | `pr-watcher-merge-policy-nested-test-paths-ready.md` appeared |
| 06:26 | **1** (`#1570`) | 1 | `#1570` created 06:23:43Z |
| 06:27:52 | 1 (`#1570` BLOCKED) | **0** | the `-ready.md` had become `-LOOPING.md` |

**Trunk GREEN.** [MEASURED] `gh run list --commit dd7db248b2327162c2fdc98aaa29db1261a2328e` (FULL
40-char SHA, per DOCTRINE 9.4) -> 4 runs, `CI` / `Deploy` / `Tendering Browser Smoke` /
`Push on main`, all `completed success`. Raw length 331, `$rows` assigned then counted = 4.

**DIRTY count: ZERO.** No PR has frozen CI (Q1/Q2 of the answer sheet: nothing to fix, nothing to
escalate as a conflict).

**Freshness.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` -> exit **0**, `CLEAN`.
`00` 0.6h · `03` 7.2h · `04` 4.1h · `05` 8.3h - no station SILENT. Crossed against
`list_scheduled_tasks` as the contract requires: all five tasks `enabled: true`;
`04-scanner lastRunAt 2026-09-04T06:10:28.646Z`, `05-sot-keeper 2026-09-03T14:11:26Z`
(next 14:10:37Z), `03-machine-minder 2026-09-03T23:01:39Z` (next 2026-09-04T23:00:45Z).
**05 has stayed recovered.**

**RULE 2 / DOCTRINE 10.1 lane probe, pinned to the LIVE tree and fully controlled.**
`C:\ProjectOperations2\docs\pr-prompts\processed` - **1877** logs, newest `2026-09-04T05:56:45Z`,
`marco.:true` -> **607**, negative control `marco.:zzzNoSuchZzz` -> **0**. The age discriminator
holds: newest log 05:56Z is younger than the only open PR (06:23Z is younger still - see below).
Per-PR, matching `PR #<n>` in the log BODY: **POS control `#1567` -> 1 hit**; **`#1570` -> NO LOG**.

**`#1570` hand-classified.** [MEASURED] `gh pr view 1570 --json files,labels` ->
`scripts/pr-watcher/__tests__/classify-policy-files.test.mjs` (ADDED) and
`scripts/pr-watcher/index.mjs` (MODIFIED); label **`do-not-merge`**
("escalates:true - Marco merges this, not automation"). Both paths are outside `^(tests|docs)/`.
`[NO LANE VERDICT - hand-classified] MARCO'S`, and separately label-gated.
⚠️ Note the trap in its own subject matter: a `__tests__` file under `scripts/` is **not** under
`tests/` - the rule is a PATH PREFIX, not a file kind. That is exactly what the PR sets out to
change, and until it lands the classification above is the correct one.

**Machinery, and it changed inside the run.** 06:14Z: watcher node **24744** (up since
2026-09-03T08:55Z), wrappers 2, no `index.lock`, no `MERGE_HEAD`/`REBASE_HEAD`/`CHERRY_PICK_HEAD`,
no rebase dirs. 06:25:36Z: node 24744 **GONE**, node **2572** created 06:25:08Z, wrappers 3.
`restart-watcher-if-wedged.ps1` (report-only) 06:25:51Z -> **`VERDICT: HEALTHY - no action`**,
`restart churn: 1 cycle(s) in 20 min (threshold 4)`. `C:\po-watcher\watcher-launch.log` records
`[start] pr-watcher-merge-policy-nested-test-paths-ready.md` 06:24:03Z (`source: startup-scan`),
`[update] PR #1570 branch updated (was BEHIND)` 06:24:08Z, then
`Watcher exited with code 1 (raw node exit: -1)` 06:24:45Z.

**COLLECT.** Two breadcrumbs in the queue root: 00's own `0540` (every finding dispositioned in it,
including its own ADDENDUM) and **04's `0610`, filed DURING this run and still untracked**. 04's
findings are dispositioned below (FINDING 2, FINDING 1).

## WHAT CHANGED

**One mutation, and it is not on the board.** I removed the orphaned git worktree `C:/po-queue`
(FINDING 4), after rescuing its three untracked scratch files to
`C:\po-sup-fix-scripts\rescued-po-queue-20260904\`. Read back: `git worktree list` now shows five
entries instead of six, the branch ref `fresh/union-open-pr-heads` still resolves to `7fb49655`,
and the sweep verdict moved `CAUTION` -> `SAFE TO ACT`.

**Nothing else.** No merge, no arm, no disarm, no label, no rename, no watcher restart, no board PR.
The only other file this run created is this breadcrumb. That is deliberate and is argued in
FINDING 1.

## FINDINGS

### FINDING 1 - THREE Station 00 sessions are alive at the same moment, one of them armed a prompt nine minutes into my run, and the sweep called the board SAFE 99 seconds later

This is the run's headline and it is a live safety finding, not a retrospective one.

[MEASURED] `mcp__session_info__list_sessions` at 06:26Z returns, most-recent-first:

| session dir created (UTC) | title | state |
|---|---|---|
| `local_2698df40-…` **05:39:57Z** | **"00 supervisor"** | **running** |
| `local_cfda57b3-…` 06:10:28Z | "04 scanner" | idle |
| `local_38901e4d-…` **04:08:48Z** | **"00 supervisor"** | **running** |

Plus mine, `local_d1a72961-…` created **06:08:49Z** (`00-supervisor lastRunAt
2026-09-04T06:08:49.670Z` confirms it). **That is three Station 00 sessions in `running` state at
once**, the oldest of them **two hours and twenty minutes** past its own start.

[MEASURED] the arm, and its process chain - the first time this pipeline has traced one:

```
.arming-log.txt  2026-09-04T06:19:49Z  ARMED  pr-watcher-merge-policy-nested-test-paths
                 escalates=true  by=Marco@  pid=14292  caller=powershell.exe:28128
```

`pid 14292` is GONE. `pid 28128` is ALIVE: `powershell.exe -NoProfile -NoLogo`, parent `35680`
(`powershell.exe -Command "powershell.exe -NoProfile -NoLogo"`), grandparent **node 26392** started
**06:14:22Z** - a Desktop Commander instance. **It is not mine**: my own chain is
`17088 -> 24104 -> node 26480`, started **06:08:56Z**. Two independent Desktop Commander servers were
running against this box, and the one that is not mine armed a prompt.

**Who.** [MEASURED] `read_transcript` on the still-running 05:39:57Z "00 supervisor" session returns,
as its most recent turns, *"Sanctioned verdict is **DOWN** - that's in my fix set"* and *"Wrapper
(pid 33496) is alive but no node … Giving the wrapper's own backoff one more window before I
intervene"*. That session is **driving the machinery right now**. [MEASURED] Station 04's own
`0610` breadcrumb, line 211, says **"04 arms nothing"** and line 127 records the same arm as
*"another actor armed a prompt nine minutes into this run"* - so 04 observed it and disclaims it.
[MEASURED] nothing in `scripts/**` invokes `arm-prompt.ps1` programmatically (only the script itself
and `lint-prompt.mjs`'s own tests reference it), and the `.queue-sync-ledger.txt` is dated
**2026-08-19**, so this was not a side effect of `queue-sync.ps1`. It was a deliberate
`arm-prompt.ps1` call from an agent session that is not mine and not 04's.

**And the consequence chain ran inside twenty minutes.** The arm at 06:19:49Z -> the watcher built
it and opened **`#1570` at 06:23:43Z** -> the watcher crashed (`exit 1`, raw node `-1`) at 06:24:45Z
having already re-picked the same still-present `-ready.md` at 06:24:03Z from a `startup-scan` ->
node 2572 came up 06:25:08Z -> by 06:27:30Z the `-ready.md` was gone and
`pr-watcher-merge-policy-nested-test-paths-**LOOPING**.md` was on disk. **The other Station 00
applied DOCTRINE 3c's LOOPING rename while I was measuring the loop.** I had reached the same
conclusion and was one command from making the same rename. That is the LL-38 collision with the
collision avoided by seconds and by luck, not by a guard.

**Three things this refutes or sharpens, each measured:**

1. **`BOARD DRIVING` condition 3 ("single actor") is not merely unproven - it is measurably FALSE,
   three-deep, right now.** The escalation raised 2026-09-03T07:06Z as *"TWO STATION 00s DROVE ONE
   BOARD FOR ~10 MIN"* is not an incident that happened; it is the steady state.
2. **The cause is that Station 00 sessions do not terminate.** The 04:08 run is still `running` at
   06:26Z. 00's cron is HOURLY. A run that outlives its cadence is a second actor by construction,
   and nothing sequences them. The 05:40 run's own FINDING 1 noticed the 04:08 run "still working
   long after it wrote breadcrumb 0409" and read it as a reporting gap; it is a concurrency defect.
3. **`status-sweep.ps1`'s single-actor gate cannot see it.** It printed
   `SAFE TO ACT: no board mutation in progress` at **06:21:28Z**, **99 seconds after** an arm by
   another actor. Its four signals (in-progress prompts, `index.lock`, git processes, recent remote
   activity) are all blind to a completed `git mv` by a live peer.

**DISPOSITION: ESCALATED.** This is escalation #22 ("single actor is a claim, not a fact") and the
09-03 "two supervisors, one board" item, merged and now with a traced actor - and it needs Marco,
because every complete option is a change to how the scheduled task is configured or to the arming
primitive, neither of which a station may make unilaterally. RULE 1, complete-and-additive FIRST:

- **(A) Give the board a lease, and make a station prove it holds it.** `arm-prompt.ps1`,
  `Merge-Pr` and any `git mv` under `docs/pr-prompts/` first acquire a short-lived
  `docs/pr-prompts/.board-actor.lock` carrying `{sessionId, pid, startedAt, expiresAt}`; every
  PREFLIGHT reads it and a station that finds a live lease it does not own reports and stops.
  **Passes both halves**: it makes the collision impossible today, and it keeps working as
  concurrency grows, because it keys on the lease rather than on a count. Additive - it writes one
  new gitignored file and refuses nothing that is genuinely alone. Pair it with **(A2)**: have the
  scheduled 00 run **skip** if a previous 00 session for the same task is still `running`, which is
  the half a lock cannot supply because a hung session holds no lock.
- **(B) Make `.arming-log.txt` attributive and tracked** (escalation #22's own option A - an
  `ARM_ACTOR` env var plus the parent command line). Necessary and worth doing, but on its own it
  **fails the *solves-it* half**: it tells you afterwards who collided; it prevents nothing.
- **(C) Pause the hourly 00 cron and run it by hand.** Fails the *future* half - the drift returns
  the moment it is re-enabled, and it disables the only station that collects.
- **(D) Nothing.** Fails both. Today it cost nothing only because the other actor happened to be
  competent and happened to be a beat ahead of me.

⚠️ **Do not read this as "the other session misbehaved."** Everything it did was correct Station 00
work - a legitimate arm of an ADMIT prompt, and the sanctioned LOOPING rename. **The defect is that
two correct supervisors are indistinguishable from one, and the board cannot tell.**

### FINDING 2 - The freshness probe the station contract prescribes returns a sha that matches nothing, and it fires in the FIRST step of every run

[MEASURED] At `HEAD == origin/main == dd7db248`, with `git diff --name-only -- docs/pipeline/`
**EMPTY**, the canonical block's own currency check disagreed on **all three** binding documents:

| path | `git show origin/main:<p> \| git hash-object --stdin` | `git rev-parse origin/main:<p>` | `git hash-object <p>` |
|---|---|---|---|
| `stations/00-supervisor.md` | `669051d0` | **`6746ecc8`** | **`6746ecc8`** |
| `DOCTRINE.md` | `be52d8b9` | **`e3a1b3bd`** | **`e3a1b3bd`** |
| `STATION-CAPABILITIES.md` | `b45bebe6` | **`3d3b94f1`** | **`3d3b94f1`** |

**The piped form is the liar, and it matches NOTHING** - not the blob, not the worktree, not
`--no-filters` (`6f7bfc5e` for DOCTRINE). Cause: a **PowerShell native-command pipeline re-encodes
the stream between `git show` and `git hash-object --stdin`. It is the same family as DOCTRINE
9.3's `>`-writes-UTF-16LE bullet, one layer over - and 9.3 does not name the pipe form.

**Why it matters more than an odd number.** The direction of the error is the dangerous one. An
agent that runs the prescribed probe on a *current* tree is told its tree is **stale in three
binding documents at once**. The doctrinal responses to that are a fetch-and-fast-forward or, worse,
a `git checkout --` inside the dev tree - **THE BOARD TRAP**, which resurrects consumed prompts.
DOCTRINE 9.2's stale/ahead-dev-tree bullet and the station-contract's freshness cure both point a
reader straight at it. And the 2026-09-03T23:0xZ measurement that established the per-tree-ref trap
used this same idiom; **that comparison survives** (both sides were mangled identically, so a
*difference between two trees* is still real), but the absolute shas quoted there are not blob shas
and must not be re-used as anchors.

🔧 **The cure, and it is one line:** compare `git rev-parse origin/main:<path>` against
`git hash-object <path>`. No pipe, no encoding layer, and both sides are real blob shas. If you
only need "is my copy current", `git diff --numstat origin/main -- <path>` being EMPTY is
authoritative and cheaper.

**Independently corroborated the same hour.** Station 04's `0610` breadcrumb reaches the same
conclusion from its own measurements - its title is literally *"the mandated freshness probe returns
a sha that matches nothing"*. Two stations, two instrument sets, one answer.

**DISPOSITION: DISPATCHED -> Station 06 (PR Master)**, to stage a one-bullet DOCTRINE 9.2 addendum
carrying the table above and the cure. It is a hash-gated canonical block (`instruments v2`), so the
edit needs the `lint-station.mjs` REJECT -> `--write-canonical` -> ADMIT procedure and must not be
hand-patched in one station doc. ⚠️ **This dispatch is knowingly aimed at a station with NO CADENCE**
(open escalation: `06 HAS NO CADENCE`, `CADENCE` at `check-breadcrumb.mjs:36` has no `'06'` key at
all, so nothing will ever report this as parked). **So it is also recorded here as directly
actionable by the next 00 run in a quiet window**: it is a `docs/`-only change, inside 00's own lane,
and one PR. The falsifying probe is the table above - re-run the three commands; if the first column
ever agrees with the second, this finding is dead.

### FINDING 3 - PREFLIGHT step 1 names two tool ids that do not exist here, I hit it first-hand, and the fix is staged, ADMIT, docs-only and unarmed

[MEASURED, on myself] The station-contract v2 PREFLIGHT tells me to run
`ToolSearch select:mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process,mcp__remote-devices__device_bash`.
Neither id exists in this scheduled Cowork environment. The tool that actually opened this run's
shell is **`mcp__plugin_desktop-commander_desktop-commander__start_process`**, with no
`mcp__remote-devices__` prefix, and there is no `device_bash` tool at all. I reached the box only
because I used a **keyword** `ToolSearch` for `desktop-commander` instead of the literal the block
supplies. A station that follows the block literally gets "no such tool" - which the very same
paragraph tells it is *not* blindness - and is thereby instructed to press on with no shell.

This is a live defect in the first step of every station's every run, and it is exactly the class
DOCTRINE 7 exists for: the instruction that produces a confident wrong reading.

**The fix is already staged and is unusually clean.**
`docs/pr-prompts/pr-preflight-tool-names-are-environment-specific-HOLD.md`:

- [MEASURED] `node scripts/pipeline/lint-prompt.mjs <it>` -> **`ADMIT (size 3)`, exit 0**;
  negative control `pr-524-rates-b-slice2-canonical-HOLD.md` -> **`REJECT [HUMAN_GATE_PRESENT]`,
  exit 1**. `git --version` -> `2.55.0.windows.3`, so the git-dependent gates really ran
  (DOCTRINE 9.5: a broken `git` fails OPEN into a false ADMIT).
- [MEASURED] **RULE 4's full three-marker detector, case-sensitive, with a positive control**:
  candidate `watcher: do-not-arm` 0 / `DO NOT ARM` 0 / `Arm ONLY` 0; POS control `pr-524` **0 / 1 /
  1**. The detector can fire, and it does not fire on this prompt. Marker regexes read from source:
  `lint-prompt.mjs:818,820,822`.
- **I read the BODY** for a prose gate (the failure mode invisible to both regexes). There is none.
  Its single `auto-merge` mention is the `## STANDING AUTHORITY` boilerplate sentence, present on
  **64 of the 78** depth-1 HOLDs (negative control `zzzNoSuchSentenceZzz` -> 0) - boilerplate, not
  an instruction.
- **Its whole `scope` is `docs/pipeline/stations/*.md` + `_canonical-blocks.json`** - entirely under
  `docs/`, so it passes `classifyPolicyFiles` and would land through the `tests-docs` auto-merge lane
  with no human, which DOCTRINE 10.3 measured live and healthy (`#1563`, merged 03:10Z).
- Premise is ALIVE and I verified it by reading the file, not just the lint: `00-supervisor.md`
  still contains `mcp__remote-devices__`.

**I did not arm it, and the reason is FINDING 1, not doubt about the prompt.** At 06:19:49Z another
actor armed a different prompt. RULE 4 is **one at a time**; arming a second while a peer supervisor
is mid-flight on the first is precisely the collision this pipeline keeps paying for.

**DISPOSITION: DEFERRED, with a trigger and a complete evidence pack so the next run arms in one
step.** Arm it when BOTH hold: (1) `Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` is
**0**, and (2) `list_sessions` shows no other `"00 supervisor"` in `running` state. Then
`arm-prompt.ps1` (never a bare `git mv`), and read back `armed 0 -> 1` plus
`git diff --cached --name-status` carrying only that rename. Re-run the lint and the three-marker
detector first - both are cheap, and an ADMIT recorded here is a claim about 06:2xZ, not about then.

### FINDING 4 - The recurring CAUTION was one orphaned worktree, and it had been dispatched to a station that is REPORT-ONLY and could not have executed it

The 05:40Z run correctly proved `C:/po-queue` an orphan and correctly declined to prune it, but
**DISPATCHED it to Station 03**. [MEASURED] `STATION-CAPABILITIES.md` section 5: 03's "Repair the
machines" cell is **`⚠️ report-only`**; and `list_scheduled_tasks` puts 03's next occurrence at
**2026-09-04T23:00:45Z**. So the disposition addressed a station that lacks the authority to act,
seventeen hours out - during which the sweep returns **CAUTION** to roughly seventeen hourly 00
runs, and CAUTION is the verdict that stands the next run down. That is the orphaned-disposition
mechanism doing measurable damage, not a theoretical one.

It is 00's own work: `00-supervisor.md` PHASE 3f puts orphaned worktrees in this station's hands,
and the record already contains the precedent (2026-08-29: *"04 routed the worktrees to 03 - 03 is
REPORT-ONLY and could not have done it; 00 did, under PHASE 3f"*).

[MEASURED] before acting: `C:/po-queue` HEAD `7fb49655` -> `git merge-base --is-ancestor` against
`origin/main` **exit 0**, i.e. its commit is already on `main`; its remote branch
`fresh/union-open-pr-heads` had been deleted (seen in this run's `fetch --prune`); `git status
--porcelain` showed three untracked scratch files `_bt.mjs`, `_bt2.mjs`, `_bt3.mjs`. I copied those
to `C:\po-sup-fix-scripts\rescued-po-queue-20260904\` first, then
`git worktree remove --force C:\po-queue` (exit 0) and `git worktree prune`.

Read back: `git worktree list` = 5 entries, `C:/po-queue` gone; `git rev-parse --verify
fresh/union-open-pr-heads` still returns `7fb496553e220910e337e75ba320e539ccb12829`, so **no ref was
destroyed**; and the sweep at 06:21:28Z now prints
`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`

**DISPOSITION: ACTIONED** - pruned, read back three ways, sweep verdict cleared.
🔧 **And the general lesson, which outlives the instance: before writing `DISPATCHED -> 03`, check
section 5. 03 may only REPORT. Anything that repairs is 00's, and dispatching it to 03 converts a
five-minute fix into a seventeen-hour false CAUTION.**

### FINDING 5 - The four remaining worktrees are NOT safe to prune the same way, and one of them is detached

[MEASURED] `git merge-base --is-ancestor <HEAD> origin/main` for each:

| worktree | branch | HEAD | on main? | dirty |
|---|---|---|---|---|
| `C:/po-1483-fix` | `fix1483` | `9de072673edd10fd6e9c3c81f61ed0a7bb1aa8f4` | **no** (exit 1) | 0 |
| `C:/po-guard` | `guard/never-arm-cd-s1` | `dd95464592a87b8ed38cd9118bddaf89bec77d99` | **no** | 0 |
| `C:/po-sa-fix` | `pipeline/standing-authority-reject` | `12c20e90094d8cfae844f7c4b7a5a2d1314c0450` | **no** | 0 |
| `C:/po-work/s2-e2e` | **DETACHED** | `f85f11cf26f937533ffec6fb17d8ee026be15621` | **no** | 0 |

Three carry a named branch, so removing the worktree keeps the commit reachable and the removal is
reversible. **`C:/po-work/s2-e2e` does not**: it is detached at a commit that is not on `main`, so
removing that worktree unreferences `f85f11cf` and it becomes garbage-collectable. That is
DOCTRINE 5.4 territory and I will not do it on my own judgement. The two `REGISTRY-ESCAPEE`
directories the sweep names (`C:\po-worktrees\fix-1523` age 1485 min, `...\vs-s2-durable-smoke` age
1261 min, both `size=0KB .lock=False`) are unchanged.

The four SHAs above **are** the manifest, so nothing here is lost work: any of them is restorable
with `git branch <name> <sha>`. That is the same export-then-delete shape escalation #14 recommends.

**DISPOSITION: DEFERRED.** The three branch-backed worktrees are safe to remove whenever a run has
the minutes; none of them is causing a false verdict now that `po-queue` is gone, so there is no
urgency and no reason to spend a peer-collision risk on them. The detached one becomes urgent only
if disk or a `git gc` is at issue, and its removal should be paired with `git branch
recovered/s2-e2e f85f11cf` first, which makes it reversible and then trivially safe.

### FINDING 6 - The watcher died and came back inside this run; the verdict is HEALTHY and I did not touch it

[MEASURED] node **24744** (up since 2026-09-03T08:55Z) was alive at 06:14Z and **gone** by
06:25:36Z; node **2572** was created 06:25:08Z. `watcher-launch.log` shows the death as
`Watcher exited with code 1 (raw node exit: -1)` at 06:24:45Z, **42 seconds after** it started the
armed prompt from a `startup-scan`. `restart-watcher-if-wedged.ps1` (report-only, 06:25:51Z) ->
**`VERDICT: HEALTHY - no action`**, `armed prompts waiting: 1`, `restart churn: 1 cycle(s) in 20 min
(starts=1 exits=1, threshold 4)`. Wrapper count 3, taken seconds after a restart and therefore not
yet the `>~2` fault signature from the crash-loop playbook - it wants one more reading, not an
intervention.

I did **not** run `-Fix`. Two independent reasons, either sufficient: the sanctioned verdict is
HEALTHY (RULE 1 of the "how you decide the watcher is down" section - trust its verdict over my own
reasoning), and the 05:40Z Station 00 session was **at that moment reasoning about restarting it**
(FINDING 1's transcript quote). Two supervisors restarting one watcher is how nine wrappers ate the
board on 2026-09-01.

**DISPOSITION: ACTIONED - measured, verdict HEALTHY, deliberately no intervention.** The falsifying
probe for the next run is the churn number crossed against node uptime: if node 2572 is still up and
`restart churn` has decayed toward 0, this was a single crash on a poisoned start and nothing more.
If a third node appears with churn climbing, it is the crash-loop playbook, step 1.

## WHAT I DID NOT DO

- **Did not arm anything.** A peer supervisor armed at 06:19:49Z; RULE 4 is one at a time
  (FINDING 3). The candidate is fully evidenced and trigger-gated, not parked on a vague future.
- **Did not open a board PR**, so this breadcrumb is untracked in the dev tree - the second home the
  REPORT CONTRACT sanctions. A commit into a git index another live Station 00 is staging renames
  into is the LL-38 collision itself, and `#1570` is inside its merge window besides. **Concrete
  hand-off:** the next 00 run that finds no other `"00 supervisor"` in `running` state should open
  ONE `docs/`-lane board PR carrying this breadcrumb, 04's `0610`, and 00's `0540`, `git mv`'d to
  `docs/pr-prompts/archive/` where dispositioned - that PR is inside 00's own lane and 00 may merge
  it via `Assert-SmokedOrEscalate` -> `Merge-Pr`.
- **Did not merge or touch `#1570`.** It is `scripts/pr-watcher/**`, hand-classified MARCO'S with
  `NO LOG` and the negative control passing, and it separately carries `do-not-merge`. Two gates,
  both binding, neither mine to clear.
- **Did not rename the LOOPING prompt** - the peer supervisor had already done it by 06:27:30Z, and
  doing it twice is the collision, not the cure.
- **Did not restart the watcher** (FINDING 6), **did not prune the four remaining worktrees**
  (FINDING 5), **did not act on the ~30 `[STALE]` needs-marco lines** the sweep prints - they are
  dead escalation refs already batched to 03, and clearing them is a MOVE to
  `needs-marco/discharged/`, never a delete.
- **Did not touch** `/sot/`, Azure/Entra/SharePoint, production data, the watcher clone's git, or any
  label.

**Q6, the one most important thing blocking progress right now:** nothing on the board is blocked -
0 armed, 0 DIRTY, trunk green on `dd7db248`, one PR that is correctly Marco's. **The blocker is
underneath the board: three Station 00 sessions are alive at once and the pipeline has no way to
tell one supervisor from three.** Everything else this run found was small; that one is the reason
this run declined to act on anything it could otherwise have driven.

---

## ADDENDUM 2026-09-04T06:32Z - the duplicate landed. FINDING 1's mechanism is no longer a risk, it is an outcome.

Appended after the body above was written, per the 05:40Z run's own cure for its FINDING 1: a run
that observes the board move after writing its breadcrumb must append rather than bill a later run.

[MEASURED] `gh pr list --state open` at **06:32:11Z** -> **TWO** PRs, and they are the same work:

| PR | created | title |
|---|---|---|
| `#1570` | 2026-09-04T06:23:43Z | `fix(watcher): classifyPolicyFiles matches nested __tests__ and .test/.spec files` |
| **`#1571`** | **2026-09-04T06:28:43Z** | `fix(pr-watcher): tests-docs policy accepts nested __tests__ and .test/.spec files` |

Both **BLOCKED**, both from the single arm at 06:19:49Z. `.arming-log.txt` is unchanged - its tail
is still that one entry - so **no second arm happened**. This is the crash-and-startup-scan re-fire
completing: the watcher died at 06:24:45Z with the `-ready.md` still on disk, node 2572 re-scanned
it, and the second attempt opened its own PR five minutes after the first. The LOOPING rename landed
between the second start and the second PR, which stops a *third* fire but could not recall the
second.

**So the duplicate the queue-reconcile rule exists to prevent has now actually been produced**, in
this run, under observation. `armed` currently reads **1**, but that file is `rev-1571-ready.md` - an
auto-generated REVIEW JOB, not a prompt (DOCTRINE 9.5). **Real armed = 0.**

**I did not close either PR.** Both are hand-classified Marco's (`scripts/pr-watcher/**`) and both
carry `do-not-merge`; choosing which duplicate survives is a judgement about the *content* of two
diffs I did not author, and the peer supervisor that produced them is still `running` and better
placed to make it. Escalation #14 also records that a closed PR's branch is the only copy of its
work, so closing one is not free.

**DISPOSITION: ESCALATED - folded into FINDING 1, not raised separately.** It is the same defect
with a receipt: two supervisors and one crashing watcher produced two PRs for one prompt, and the
only thing that limited it to two was a rename that happened to win a five-minute race. It sharpens
FINDING 1's option **(A)**: a board lease would not have prevented this particular duplicate (one
actor, one arm, a crash in between), so **(A) needs its stated partner (A3): after any watcher
restart, reconcile the surviving `*-ready.md` against the open board BEFORE the startup-scan
dispatches it** - which is `00-supervisor.md` PHASE 1 rule 6 written as code instead of as advice.
That is a `scripts/pr-watcher/**` change, so it is Marco's to land, and it belongs in the same answer.
