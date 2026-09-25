# Station 03 - Machine Minder | 2026-09-24T23:03:50Z-2026-09-24T23:22:00Z

## FOR MARCO

**The live watcher node has TWO supervisors and TWO heartbeat watchdogs. One of them has had no
node of its own since 2026-09-20 and it still holds `Stop-Process -Force` over the node that is
running now.** I found the root cause this run, and it is one line in a file that is not in any
repo, so it is yours:

`C:\po-watcher\ensure-watcher.ps1` step 2 (anchor: the comment `# --- 2. Is the watcher already
alive? ---`) asks exactly one question - *is a `node.exe` running `index.mjs`?* It never asks
whether a **wrapper** is alive. The wrapper restarts its own node after 10 s. The keepalive fires
on a schedule. When the keepalive lands inside that 10 s window it sees zero nodes, launches a
**second** detached `watcher-launcher-singlelane.ps1`, and from then on the loser adopts the
winner's node and never leaves. That is measured below, with both relaunches quoted from
`ensure-watcher.log`.

Nothing is broken right now - the rescan loop ticks, the clone is clean, the board is quiet. This
is a latent duplicate that survives every restart and has been live for four days.

**RULE 1 options** (complete-and-additive first):

- **(a) Ask about the wrapper, and make ADOPT prove its own claim.** Two small changes.
  In `ensure-watcher.ps1` step 2, before relaunching, also look for a live
  `watcher-launcher-singlelane.ps1` PowerShell process; if one exists, log
  `wrapper alive, node absent - leaving the relaunch to the wrapper` and exit 0. Separately, in
  `scripts/pr-watcher/supervise-watcher.ps1` (this one IS in the repo, so it can be a PR), make the
  `adopt` branch of `Resolve-WatcherExitAction` check whether the running node already has a
  `start-watcher.ps1` ancestor and **exit** rather than adopt when it does.
  Complete: no new duplicate can be created, and the adopt branch can no longer make one permanent.
  Additive: nothing is removed - the wrapper's own 10 s restart loop already covers the case the
  keepalive was firing into, and a genuinely orphaned node is still adopted. Passes both halves.
- **(b) Kill wrapper pid 30116 now and do nothing else.** Fixes it this minute; fails the "future"
  half outright - the next keepalive/restart race rebuilds it, which is exactly what happened
  between 09-20 and 09-24. It is also a mutation Station 03 may not perform.
- **(c) Only add the PID to every `WATCHDOG` log line.** Fixes the instrument (F3) so a reader can
  tell the two apart; leaves two kill authorities over one node. Fails the "completely" half.

I am **not** asking you to act tonight. Option (a)'s second half is a repo PR and is dispatched to
Station 00 below; only the `ensure-watcher.ps1` half needs you, because that file is outside every
repo this pipeline can PR.

One thing worth knowing about the channel: I escalated the duplicate-watchdog symptom on
2026-09-16 and it is still live nine days later. It never became a file in `needs-marco/` - measured
this run, `watchdog` matches **1** file there and it is an unrelated one. A breadcrumb escalation
that nobody converts into a standing file expires quietly. That is F7.

## GROUND

```
UTC            2026-09-24T23:03:50Z
origin/main    d8eea113
dev tree       main @ d8eea113  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. Run is read-write within this station's report-only lane (a
breadcrumb, and nothing else).

All three binding documents were read from the DEV TREE and proved byte-identical to `origin/main`
before being trusted, using the sound forms only (`git rev-parse <ref>:<path>` against
`git hash-object <path>`, plus `git diff --numstat origin/main -- <path>` EMPTY). No piped
`hash-object` anywhere - DOCTRINE 9.1.

| document | `git rev-parse origin/main:<path>` | `git hash-object <path>` | `--numstat` |
|---|---|---|---|
| `docs/pipeline/stations/03-machine-minder.md` | `a4540c9e...` | `a4540c9e...` | EMPTY |
| `docs/pipeline/DOCTRINE.md` | `81cf88fd...` | `81cf88fd...` | EMPTY |
| `docs/pipeline/STATION-CAPABILITIES.md` | `0ef4dabd...`* | `0ef4dabd...`* | EMPTY |

\* `0ef4dabad3ff5da5c43156af94325bc8035b558e` on both sides.

## WHAT I MEASURED

### Reachability - SIGHTED. This was not a blind run.

[MEASURED] `start_process` shell `powershell.exe`, first call of the run:
`BRIDGE_OK 2026-09-25T09:03:50` (host-local; UTC 2026-09-24T23:03:50Z). A persistent shell (pid
26900) carried the whole run. Desktop Commander tool ids were loaded by keyword `ToolSearch` first
and are environment-specific as the preflight says - the ids this session offers are prefixed
`mcp__plugin_desktop-commander_desktop-commander__`, not the bare form.

### The device-bridge git guard - INSTALLED BUT INERT, the expected station outcome

[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read
on the following line, no pipeline appended:

```
GUARD_EXIT=2
```

Its last line, verbatim:

```
   PATH="/sessions/tender-brave-mccarthy/.local/bin:$PATH" git <args>
```

Exit 2 is the FINDING-not-STOP row of the preflight table. The ban is remembered, not mechanical,
and I ran no `git` from the VM side at all this run - every git call below went through the Windows
host shell.

### The watcher chain - resolved by COMMAND LINE and by ancestry, never by image name

[MEASURED] `Get-CimInstance Win32_Process`, filtered on command line. 38 `node.exe` are running on
this box; exactly one is the watcher.

```
pid=1724   powershell  2026-09-24T07:35:03Z  watcher-launcher-singlelane.ps1     <- LIVE wrapper
  pid=35880  powershell  2026-09-24T07:35:05Z  <encoded> Resolve-WatchdogJudgedAgeMinutes  <- watchdog job
  pid=44740  powershell  2026-09-24T07:35:06Z  start-watcher.ps1
    pid=42212  node      2026-09-24T07:35:07Z  ...\pr-watcher\index.mjs          <- THE watcher

pid=30116  powershell  2026-09-20T21:14:02Z  watcher-launcher-singlelane.ps1     <- SECOND wrapper
  pid=12044  powershell  2026-09-20T21:14:04Z  <encoded> Resolve-WatchdogJudgedAgeMinutes  <- watchdog job
  (no start-watcher child; no node of its own)
```

Both `EncodedCommand` payloads decode to the identical watchdog job body. `ppid` 14324 and 37808
are both ABSENT - reused PIDs, not live parents; the ancestry is established from
`ensure-watcher.log`'s own VERIFIED lines below, not from a stale `ppid`.

### The freeze probe - the only authoritative one, sampled twice, more than five minutes apart

[MEASURED] `<watcher clone>\scripts\pr-watcher\.queue-state.json` - BESIDE THE SCRIPT, never beside
the queue (DOCTRINE 9.5).

| sample | `ts` | read at |
|---|---|---|
| 1 | `2026-09-24T23:10:15.103Z` | 23:10:59Z |
| 2 | `2026-09-24T23:10:15.103Z` | 23:13:34Z |
| 3 | `2026-09-24T23:15:14.378Z` | 23:18:37Z |

`ts` advanced **4 m 59 s** between samples 1 and 3, which is `RESCAN_INTERVAL_MS` (5 min) to within
a second. **The rescan loop is alive and on cadence.** Sample 2 alone would have read "unchanged"
and proved nothing - it was 3 m 19 s after sample 1, inside one interval. That is why the doctrine
says more than five minutes and why I took a third.

`.queue-state.json` at sample 3: `armed=0 runnable=0`. Heartbeat `heartbeat.log` mtime
`2026-09-24T23:08:33Z`, age 5 min - legitimate idle, since the heartbeat only ticks mid-run.
`.watchdog-kill.flag` ABSENT.

### TWO watchdogs, proved from the log's own arithmetic

[MEASURED] `supervisor.log` (868,725 bytes, copied before reading; 5,299 lines). Taking every
`WATCHDOG` line stamped after the live node's start (`2026-09-24T07:35:07Z`) - 49 lines - and
histogramming the gaps between consecutive lines:

| gap (s) | count |
|---|---|
| 25 | 6 |
| 28 | 12 |
| 36 | 1 |
| 84 | 2 |
| 92 | 7 |
| 93 | 2 |
| 95 | 5 |
| >200 | 13 |

**25-28 s and 92-95 s, and 28 + 92 = 120.** `$wdPollSec` is 120. A single 120-second poller cannot
produce a 28-second gap; two pollers offset by ~28 s produce exactly this bimodal pair, repeatedly,
over sixteen hours. The gaps above 200 s are the cycles where the queue was empty and the watchdog
logged nothing, which is by design. The line itself carries **no PID**, so the two are
indistinguishable in the file - only the arithmetic separates them.

### The kill target is discovered, not inherited - so the stale watchdog can kill the live node

[MEASURED], read from source at `scripts/pr-watcher/supervise-watcher.ps1`, inside the
`Start-Job -Name pr-watcher-heartbeat-watchdog` scriptblock's poll loop:

```powershell
$node = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
          Where-Object { $_.CommandLine -match ([regex]::Escape((Join-Path (Split-Path $Heartbeat) 'index.mjs'))) })
...
foreach ($p in $node) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
```

`$Heartbeat` is `$env:PR_WATCHER_REPO_ROOT\scripts\pr-watcher\heartbeat.log`, and both wrappers
carry the same `PR_WATCHER_REPO_ROOT`. The target is therefore resolved **by command line, every
poll**, and is not the PID the watchdog's own lane launched. Watchdog 12044's lane has had no node
since 2026-09-20; the node it will find is 42212.

**Stated honestly: this does not mean it will kill a node the live watchdog would spare.** Both
read the same two clocks and `WATCHDOG_RESTART_GRACE_V1` judges by the later of heartbeat and node
start, so they agree. The measured harms are the ones in F1-F4 below, not a wrong kill.

### The ADOPT line asserts a condition it never checks

[MEASURED] `supervisor.log`, the most recent ADOPT (177 in the file; stamps are host-local +10:00):

```
[2026-09-24T18:01:59.8044280+10:00] ADOPT: a watcher node is already running and no wrapper was
supervising it. Adopting rather than exiting. ([...] SINGLE-INSTANCE: watcher already running (PID 42212).)
```

`2026-09-24T18:01:59+10:00` is `2026-09-24T08:01:59Z`. At that moment node 42212's parent was
`start-watcher.ps1` pid 44740, whose parent was wrapper pid 1724 - measured above. **A wrapper was
supervising it.** `Resolve-WatcherExitAction` reaches `adopt` purely on the string `SINGLE-INSTANCE`
in the child's output, which cannot distinguish "already running WITH a wrapper" from "already
running WITHOUT one". The log line states the stronger of the two as fact.

### The root cause, quoted from the keepalive's own log

[MEASURED] `C:\po-watcher\ensure-watcher.log`, 3,943 lines, 76 `RELAUNCHED` rows. POSITIVE control
`watcher alive` -> **3769**; NEGATIVE control, a freshly minted needle -> **0**.

```
2026-09-20T21:14:07Z  RELAUNCHED - wrapper pid 30116 (Win32_Process.Create returned 0)
2026-09-20T21:14:33Z  VERIFIED node pid 9744 ancestry: powershell.exe:17688 <- powershell.exe:30116 <- WmiPrvSE.exe:14324  detached=True
2026-09-24T07:35:03Z  RELAUNCHED - wrapper pid 1724 (Win32_Process.Create returned 0)
2026-09-24T07:35:30Z  VERIFIED node pid 42212 ancestry: powershell.exe:44740 <- powershell.exe:1724 <- WmiPrvSE.exe:37808  detached=True
```

Wrapper 30116 was a legitimate relaunch on 09-20 and owned node 9744. Node 9744 later died.
**Wrapper 30116 was still alive on 2026-09-24T07:35:03Z when the keepalive launched wrapper 1724** -
it is alive now - and the keepalive launched the second one anyway, because step 2's liveness test
asks only about `node.exe`. Twenty-seven minutes later 30116 adopted 1724's node and has been in
the adopt poll loop since, carrying its 09-20 watchdog job with it. The watchdog job is started
once per `supervise-watcher` invocation and the adopt loop never leaves that invocation, which is
precisely why the duplicate survives every watcher restart.

### Locks, board busy-ness, and the sweep

[MEASURED] `scripts/pipeline/status-sweep.ps1`, run to a file and decoded `utf16le` (the `*>`
redirection writes UTF-16LE - DOCTRINE 9.3; 144,814 bytes, 422 lines).

- Section 0 instrument controls: `gh` reached GitHub, `node` runs. Neither `[BROKEN]`.
- Section 7 VERDICT: `SAFE TO ACT: no board mutation in progress, no recent remote activity, no
  live station worktrees.`
- `index.lock` in BOTH trees: ABSENT (independently re-measured by `Test-Path`, not only from the
  sweep). Scoped git processes touching our trees: 0.
- Open PRs: 4 (`#2183` BEHIND, `#2167` `#2164` `#2158` BLOCKED), all RED. `main` CI on `d8eea113`:
  3 success / 0 failed / 1 running - not yet green, no failure.

### The clone

[MEASURED] `C:\po-watcher\ProjectOperations`: branch `main` @ `d8eea113`,
`git rev-list --left-right --count HEAD...origin/main` -> `0	0`. **Zero behind.**
`git status --porcelain --untracked-files=no` -> EMPTY (the form `start-watcher.ps1` actually uses;
`git status --short` also read 0 this run, so the two forms agree today and DOCTRINE 9.5's
clone-dirty bullet did not fire).

Stash closed loop: **77**, against the **77** my own 2026-09-23T23:04Z run recorded. **No growth in
24 hours** - expected, since the auto-stash only fires on a tracked-dirty clone and the clone has
stayed clean. Dev tree: 1 stash.

### Sentinels

[MEASURED] `C:\po-watcher\STOP-WATCHER` ABSENT. `C:\po-watcher\STOP-WATCHER-LANE2` **PRESENT** -
by design since 2026-08-15, in the `po-watcher` PARENT directory, outside both git repos. Not drift
and not a stop signal. `ensure-watcher.ps1` tests only `STOP-WATCHER`, correctly, and says so in its
own comment.

### The daily clone log - name shape FIRST, mtime SECOND, never constructed

[MEASURED] filtered to `^\d{4}-\d{2}-\d{2}$` basenames, then newest by `LastWriteTimeUtc`:

```
2026-09-24.log  mtimeUtc=2026-09-24T23:15:20  bytes=137065   <- live, 3 min old
2026-09-21.log  mtimeUtc=2026-09-23T18:35:05  bytes=247841
2026-09-18.log  mtimeUtc=2026-09-18T05:51:19  bytes=782865
```

Fresh. The name-shape filter is what keeps `supervisor.log` and the `supervisor.rot-*` /
`supervisor.crashed-*` files out of the selection.

### failed/ triage - nothing new since my last run

[MEASURED] `docs/pr-prompts/failed/` globbed at TOP LEVEL ONLY: **59** files. Newest four:

```
2026-09-21T14:37:18Z  rev-2052-ready.md.log
2026-09-21T14:30:46Z  rev-2052-ready.md
2026-09-21T09:08:10Z  rev-2040-ready.md.log
2026-09-21T09:06:44Z  rev-2040-ready.md
```

My own breadcrumbs at `2026-09-21T23:04Z`, `2026-09-22T23:29Z` and `2026-09-23T23:04Z` all post-date
the newest entry, so every file in `failed/` has already been triaged by a prior run. **No new
failures this run. Nothing is limit-parked; there is no `## Parked` batch awaiting a reset.**

Breadcrumb corpus: 0 of my breadcrumbs at depth 1, **23** under `archive/` - which read the same
from a clone, from CI and from a cloud-fired station, as the contract intends.

### Queue census

[MEASURED] armed (`*-ready.md`, top level only): **1** at sweep time (`rev-2183-ready.md`, an
auto-generated REVIEW JOB and not a prompt), **0** by `.queue-state.json` five minutes later -
consumed in between. `needs-marco/` 48 - `no-pr-opened/` 111 - `failed/` 59 - `blocked/` 153.

### Worktrees

[MEASURED] 4 non-main worktrees, one of them dirty:

```
C:/po-worktrees/sup-cwd-paths        66ac4dcd  [fix/pipeline-scripts-resolve-state-paths-from-module]  dirty=2  age=930 min
   M docs/data-model/metadata-catalog.json
  ?? pr-body.md
C:/po-wt/fv2drop                     d77e3316  [wt-fv2-formrule-contract-drop]      dirty=0  age=865 min
C:/po-wt/s8h                         0a890a49  [wt-s8h]                             dirty=0  age=166 min
C:/po-wt/stage-formrule-web          041fad08  [docs/stage-formrule-legacy-payload-retire]  dirty=0  age=220 min
```

`worktree-registry-escapees: none found under known roots`.

### Controls run this session

POSITIVE: `watcher alive` in `ensure-watcher.log` -> 3769; `DOCTRINE` across `needs-marco/*.md` ->
91 files' worth of hits; `gh` reached GitHub (sweep section 0). NEGATIVE: freshly minted needles
`zzQq03Needle20260925T2313` over `ensure-watcher.log` -> **0** and `zzQq03Needle20260925T2316` over
`needs-marco/*.md` -> **0**. Both needles are spent the moment this file lands.

## WHAT CHANGED

**Nothing on the machines, the board or the queue.** Station 03 is report-only and this run
repaired nothing, armed nothing, merged nothing, killed no process, pruned no worktree, dropped no
stash and moved no file.

The only write this run made anywhere is **this breadcrumb**, at
`docs/pr-prompts/00-03-machine-minder-2026-09-24-2320-a-supervisor-with-no-node-since-the-twentieth-still-holds-kill-authority-over-the-live-watcher.md`
in the dev tree. Station 03 cannot open a PR (STATION-CAPABILITIES section 5), so **it is UNTRACKED
until a board PR commits it** - Station 00 sweeps it up. Two scratch copies were written under
`C:\po-sup-fix-scripts\` (`sweep-03-20260925.txt`, `suplog-copy-03.log`, `ensure-copy-03.log`);
that directory is scratch and outside both repos.

## FINDINGS

### F1 - `ensure-watcher.ps1` asks whether the NODE is alive and never whether a WRAPPER is, so a keepalive firing inside the wrapper's own 10-second restart window creates a permanent second supervisor. Live since 2026-09-20.

Measured in full above: both `RELAUNCHED` rows quoted from `ensure-watcher.log`, wrapper 30116
alive throughout, the step-2 liveness test read from source, and the resulting two-wrapper /
two-watchdog process tree. The duplicate survives every watcher restart because the adopt loop
never exits the `supervise-watcher` invocation that owns the watchdog job.

`C:\po-watcher\ensure-watcher.ps1` is **not in any repo this pipeline can PR** - DOCTRINE 9.5
already records that the launchers in `C:\po-watcher` are not in this repo, and
`needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md` is the standing escalation for
exactly that. So there is no station that can fix this half.

RULE 1 options are stated in full in FOR MARCO above; option (a) is the complete-and-additive one,
(b) fails the future half, (c) fails the completeness half.

**DISPOSITION: ESCALATED** - needs Marco. The file is outside every repo, and the only immediate
containment (killing wrapper pid 30116) is both a mutation this station may not perform and a fix
that does not survive the next restart.

### F2 - The `adopt` branch decides from a STRING and then logs "no wrapper was supervising it" as though it had checked. It is what turns F1's race into a permanent duplicate.

`Resolve-WatcherExitAction` in `scripts/pr-watcher/supervise-watcher.ps1` reaches `adopt` when the
child's output matches `SINGLE-INSTANCE`, and nothing in that path asks who owns the running node.
Measured above: the 2026-09-24T08:01:59Z ADOPT line claims no wrapper was supervising PID 42212
while `start-watcher.ps1` pid 44740 and wrapper pid 1724 were its parent and grandparent.

The adopt branch is correct and necessary for a genuinely orphaned node - it was added 2026-07-20
for that case and must not be removed. What is missing is the check that distinguishes the two: ask
whether the matched node has a `start-watcher.ps1` ancestor, and exit rather than adopt when it
does. This file IS tracked in the repo, so it is an ordinary PR.

**DISPOSITION: DISPATCHED** - to **Station 00**, to stage a prompt against
`scripts/pr-watcher/supervise-watcher.ps1` implementing the ancestry check in the `adopt` branch and
correcting the log line to state what it actually verified. Note the operational consequence for
whoever stages it: after any `scripts/pr-watcher/**` change merges, the RUNNING watcher still
executes the OLD code and a restart is required to adopt it.

### F3 - Two watchdogs write `WATCHDOG` lines into one `supervisor.log` and the line carries no PID, so every count or gap-reading of this pipeline's own health log is 2x wrong.

The gap histogram above (25-28 s paired with 92-95 s, summing to the 120 s poll) is the only thing
that separates them. `WD-Log` writes `"[{0}] WATCHDOG {1}"` with a timestamp and no process
identity. A reader who counts watchdog polls to infer health - which is a natural thing to do with
this file - gets double. This is DOCTRINE section 7's shape inside the pipeline's own instrument:
nothing is empty, nothing warns, and the file answers a question about two pollers as though it
were about one.

The fix is one interpolation in `WD-Log` inside `scripts/pr-watcher/supervise-watcher.ps1`. It does
not remove the duplicate, which is why it is not an alternative to F1 or F2 - it makes the
duplicate visible the moment it recurs, which no instrument does today.

**DISPOSITION: DISPATCHED** - to **Station 00**, to fold into F2's prompt (same file, same PR).

### F4 - `status-sweep.ps1` prints `auto-restart wrapper: alive (2)` and presents the duplicate as health.

[MEASURED] sweep section 2, this run: `[LIVE] auto-restart wrapper: alive (2)`. The count is
correct and its framing is not - two wrappers is the defect, reported in the column that tells a
reader the chain is up. Every `[LIVE]` line in that report is read under the sweep's own
instruction to *"Report ONLY from `[LIVE]` lines"*, and DOCTRINE 9.5 already records that provenance
is not correctness for exactly these derived verdicts.

The additive fix: keep the count, and mark any value above 1 as an anomaly with the second
wrapper's PID and start time beside it, so the sweep names what F3 makes visible in the log.

**DISPOSITION: DISPATCHED** - to **Station 00**, which owns `scripts/pipeline/status-sweep.ps1`
changes. Small enough to ride with F2/F3 or to stage separately.

### F5 - The 2026-09-16 escalation of this same symptom never became a file in `needs-marco/`, which is why it is still live nine days later.

[MEASURED] `Select-String -Pattern 'watchdog' -SimpleMatch` over
`docs/pr-prompts/needs-marco/*.md` -> **1** hit, in
`scheduled-task-runner-stopped-for-77h-while-the-box-stayed-up-2026-09-21.md`, which is about
something else. POSITIVE control `DOCTRINE` over the same corpus -> 91; NEGATIVE control, a freshly
minted needle -> 0. My 2026-09-23 predecessor breadcrumb
`00-03-machine-minder-2026-09-16-2302-two-heartbeat-watchdogs-hold-kill-authority-over-one-node-and-the-sweep-counts-the-duplicate-as-health.md`
is in `archive/` and carries `DISPOSITION: ESCALATED`.

So the disposition was written and the channel was never closed. Station 03 deliberately did not
create the file itself: `needs-marco/` is gitignored by rule and only partly tracked in fact, so a
new file written there by this station would be untracked and would reach nobody - the same failure
in a new costume. The escalation-file channel belongs to Station 00.

⚠️ Relevant to the delivery of every dispatch above: **Station 00's 2026-09-24T23:15Z run was
BLIND** - its own breadcrumb is named `00-00-supervisor-2026-09-24-2315-blind-no-windows-shell.md`.
A dispatch is only as good as the next sighted collect.

**DISPOSITION: DISPATCHED** - to **Station 00**, to convert F1 into a tracked `needs-marco/` file
so it stops depending on a breadcrumb being read.

### F6 - One orphaned worktree holds uncommitted work; three others are clean and prunable.

`C:/po-worktrees/sup-cwd-paths` @ `66ac4dcd` on `fix/pipeline-scripts-resolve-state-paths-from-module`,
age 930 min, holds ` M docs/data-model/metadata-catalog.json` and `?? pr-body.md`. The catalog
modification is the same generated-file churn the dev tree shows; `pr-body.md` is a PR draft. `git
worktree remove` will refuse it and `--force` would discard it. The other three
(`C:/po-wt/fv2drop`, `C:/po-wt/s8h`, `C:/po-wt/stage-formrule-web`) are `dirty=0`. This is the same
class as my 2026-09-21 finding about a merged PR's draft pinning a worktree; the branches here are
younger and two of them (`wt-s8h`, `docs/stage-formrule-legacy-payload-retire`) plausibly belong to
open or just-merged board work, so none of them should be pruned without checking the board first.

**DISPOSITION: DISPATCHED** - to **Station 00**, for the prune decision. Station 03 is report-only
and prunes nothing; this is scope for whoever prunes, not a recommendation to prune.

### F7 - The clone's stash closed loop is at 77 and did not grow in 24 hours.

[MEASURED] 77 stashes in `C:\po-watcher\ProjectOperations`, against 77 recorded by my own
2026-09-23T23:04Z run. The loop is real - `start-watcher.ps1` auto-stashes a tracked-dirty clone on
every start and nothing ever pops - but it only advances when the clone is dirty at launch, and the
clone has stayed clean. Each stash pins the objects it references, so the cost is monotonic disk,
not correctness. The safe remedy when it is time is `git stash drop`, never `pop` (DOCTRINE 9.2 -
popping a closed-loop stash reintroduces whatever dirtied the clone). Not mine to run: the clone is
a shared tree.

**DISPOSITION: DEFERRED** - real, not now. It becomes urgent if the count starts advancing again
(which would mean something is dirtying the clone at launch), or if the clone's `.git` growth turns
into a disk-space question.

## WHAT I DID NOT DO

- **Did not kill wrapper pid 30116 or watchdog pid 12044**, and did not `Stop-Process` anything.
  It is the obvious containment for F1 and it is outside this station's lane - Station 03 is
  report-only, Station 00 dispatches repair - and on its own it does not survive the next restart.
- **Did not edit `C:\po-watcher\ensure-watcher.ps1`, `watcher-launcher-singlelane.ps1` or the
  clone's `supervise-watcher.ps1`.** The first two are outside every repo; the third is a tracked
  repo file whose change belongs in a PR this station cannot open.
- **Did not restart or relaunch the watcher.** Nothing indicated a restart was needed: the rescan
  loop is on cadence, the clone is 0-behind, and no `scripts/pr-watcher/**` change has merged that
  the running node would need to adopt.
- **Did not prune a worktree, drop a stash, or touch `metadata-catalog.json`** in any tree.
- **Did not arm, disarm, rename, move or delete anything in `docs/pr-prompts/`** beyond writing this
  one breadcrumb. No `*-LOOPING.md` rename was warranted - no prompt looped this run.
- **Did not restage any `failed/` entry.** There were no new entries to triage and no limit-parked
  batch awaiting a reset, so there was no canary to restage.
- **Did not write into `needs-marco/`** (F5 explains why: gitignored by rule, partly tracked in
  fact, and a new file there reaches nobody).
- **Did not touch `/sot/`** - Station 05's, CP-24.
- **Did not run `git` through the device bridge against either Windows `.git`.** The guard reported
  itself INERT, so the ban was remembered rather than enforced, and every git call went through the
  host shell.
- **Did not merge, label, unlabel or comment on any PR**, and did not read the four open PRs beyond
  the sweep's `[LIVE]` summary - the board is Station 00's.
- **Left Azure, Entra and SharePoint entirely alone**, as every station always does.
- **Did not re-derive the sweep's section 5 stale-claim block.** It is 270 lines of `[FILE]` cross
  checks about `needs-marco/` currency, and it is Station 00's collect, not machine health.
