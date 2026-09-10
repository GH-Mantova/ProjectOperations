# Station 03 - Machine Minder | 2026-09-10T23:01:10Z-2026-09-10T23:15Z

## GROUND

```
UTC            2026-09-10T23:01:10Z
origin/main    3e1be716              (git fetch origin +refs/heads/main:refs/remotes/origin/main, then git rev-parse --short origin/main)
dev tree       main @ 3e1be716       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. This run was NOT read-only-forced.

**Sighted run.** `start_process` shell `powershell.exe` succeeded (PID 32300) and every probe below
ran on the Windows host through Desktop Commander.

**Which tree I read in, and why the working copy was safe to read.** All three binding documents were
read from the dev tree working copy, `C:\ProjectOperations2`. The PREFLIGHT block prefers
`git show origin/main:<path>`; the sound equivalence check was run instead and passed:
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/03-machine-minder.md` returned **EMPTY** in the dev tree, i.e. the working
copies are not different from `origin/main`. No piped hash was taken (DOCTRINE 9.1 - the
`git show | git hash-object --stdin` form is unsound under `powershell.exe`). `HEAD` is `origin/main`
exactly: `git rev-list --left-right --count origin/main...HEAD` -> `0  0`.

## WHAT I MEASURED

**vm-git-guard install: FAILED, and no VM-side call was made.** [MEASURED] Two attempts, both
identical: `bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount
... is under Plan9 share "c" which is not mounted; create: RPC error -1: ensure user: user
optimistic-admiring-turing already exists unexpectedly: uid=1994 gid=1994`. There is no installer
last line to quote **because the installer never ran** - the Linux workspace would not start at all.
Per the PREFLIGHT block a failed install is a FINDING, not a STOP (F7). The exposure it guards was
**zero** this run: every `git` call was PowerShell on the Windows host, none through the bridge, and
both `index.lock` probes read False at the start and the end.

**status-sweep.ps1 ran and its section 0 controls PASSED.** [MEASURED]
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...\status-sweep.ps1 *> <file>`, EXIT 0,
133,608 bytes, generated `2026-09-10 23:02:34Z`. Captured with `*>` and decoded **utf16le** in node
per DOCTRINE 9.3 - read as UTF-8 the 392-line report is structureless. Section 0:
`gh CAN reach GitHub (saw merged PR #1863)`, `node runs`. No `[BROKEN]`, so the report is usable.
Section 7: `SAFE TO ACT`.

**Host clocks.** [MEASURED] now `2026-09-10T23:06:06Z`; `LastBootUpTime` `2026-09-10T05:38:37Z`
(**the machine rebooted 17.5 h ago**); TZ `E. Australia Standard Time` (Brisbane, UTC+10), so the
local date leads the UTC date for this whole run.

**The watcher is alive NOW, resolved by command line and never by image name.** [MEASURED]
`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` -> **9** `node.exe` running; exactly one
matches `pr-watcher`: **pid 18228**, `CreationDate 2026-09-10T05:39:45Z`, cmdline
`"C:\Program Files\nodejs\node.exe" --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`.
Wrapper chain alive: `powershell.exe` **19848** running `C:\po-watcher\watcher-launcher-singlelane.ps1`
(the real launcher) and `powershell.exe` **20704** running `start-watcher.ps1`.
`ensure-watcher.log` tail `2026-09-10T22:55:02Z  watcher alive, pid(s) 18228`.

**The rescan loop is ticking - this is not a frozen watcher.** [MEASURED] The live daily clone log
was FOUND by name shape then mtime, never constructed (DOCTRINE 9.5): of **45** `*.log` in
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs`, **40** are daily-shaped and the newest is
`2026-09-10.log`, mtime `2026-09-10T23:04:52Z`, 93,579 B, 940 lines (copied before reading - the live
file is held open). Its last three `verdict-archive sweep` lines are `22:54:51.904Z`, `22:59:51.872Z`,
`23:04:52.529Z` - **five minutes apart, on `RESCAN_INTERVAL_MS`**. POSITIVE controls in the same copy:
`verdict-archive sweep` 302, `[merge]` 8, `opened PR #` 4. NEGATIVE control, a freshly minted needle
`zzQq03Needle` + `20260910T2306` -> **0**.

**The reboot did NOT reproduce 09-09's outage, and it is important to say why not.** [MEASURED]
`ensure-watcher.log` rows run on the 10-minute grid up to `05:35:04Z  watcher alive, pid(s) 13352`,
then `05:39:36Z  RELAUNCHED - wrapper pid 19848 (Win32_Process.Create returned 0)` and
`05:39:59Z  VERIFIED node pid 18228 ancestry: powershell.exe:20704 <- powershell.exe:19848 <-
WmiPrvSE.exe:8152  detached=True`. Boot was `05:38:37Z`, so the watcher was back in **68 seconds**.
`05:39:36Z` is **off the `:05/:15/:25/:35/:45/:55` local grid**, which is the discriminator my
2026-09-09 run established: an off-grid relaunch is the **logon** trigger firing, not the repetition.
So this reboot was attended and a human logon happened to arrive one minute after it. **Nothing was
fixed** - see F1.

**Keepalive cadence over 24 h is healthy.** [MEASURED] in node over `ensure-watcher.log`: **146** rows
in the last 24 h against ~144 expected at a 10-minute cadence, and **0** gaps wider than 12 minutes.

**Clone state, and the drift.** [MEASURED] `C:\po-watcher\ProjectOperations`: branch `main`,
HEAD `e4ecd9a5`, and its own cached `origin/main` also `e4ecd9a5` (it is fetched only at launch),
`rev-list --left-right --count origin/main...HEAD` -> `0  0` *within the clone*. Measured against the
**real** `origin/main` from the dev tree: `git rev-list --count e4ecd9a5..origin/main` -> **12**
commits, `e4ecd9a5` dated `2026-09-10T22:00:25+10:00` against `3e1be716` at
`2026-09-11T08:42:23+10:00` - **10 h 42 m behind**. See F3 for why that is not a restart.

**The sweep's clone-dirty warning is FALSE, exactly as DOCTRINE 9.5's newest bullet says.**
[MEASURED] both forms against the clone in the same minute:
`git status --short` -> **2** (`?? docs/pr-reviews/pr-1850-review.md`, `?? docs/pr-reviews/pr-1852-review.md`
- review verdicts the `rev-<N>` job writes into the clone by design);
`git status --porcelain --untracked-files=no` -> **0**. The sweep printed
`watcher clone: branch=main dirty=2  <-- NOT clean-on-main; the watcher may refuse to start`.
Nothing is dirty by `start-watcher.ps1`'s own definition, and a tracked-dirty clone auto-stashes
rather than refusing. This is the bullet landed at 2026-09-10T20:2xZ, reproducing at 23:0xZ. **No
dispatch is filed for it**: `#1845` and `#1852` are already open, green, and repair the sweep.

**Stash, the closed loop.** [MEASURED] clone `(git stash list).Count` = **71**; dev tree = **0**.
That is **+1** since my 2026-09-09 run's 70. DOCTRINE 9.2's instruction is to report the count and
its growth, which is what this line is; it was DEFERRED as F3 on 09-09 and nothing about it changed
in kind.

**Board-busy gate, measured at the START and re-measured at the END of the run.** dev-tree
`index.lock` **False**, clone `index.lock` **False**, `git` processes **0**, and in the clone
`MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` / `sequencer`
all **False**. **No stale-lock finding this run** - there was no lock to size or age.

**Worktrees: 2 non-main, down from 6 on 09-09.** [MEASURED] `git worktree list`:
`C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]` and
`C:/po-worktrees/pr1823  9664f95a [feat/ea-gate-reporting-team-permission]`. The two live station
worktrees my last run found have been torn down. `C:/po-vg` -> `?? scripts/pipeline/check-pipeline-heartbeat.mjs`,
HEAD commit dated `2026-09-04T17:53:38+10:00`, and `git ls-remote --heads origin
fix/no-rebase-while-checks-run` is **EMPTY** (POSITIVE control: the same query for `main` returns
`3e1be7160f3d01cc9c758f0a082f70a3203076ff`). `C:/po-worktrees/pr1823` is **clean** (`status --porcelain`
0 files) - see F5.

**Trunk is GREEN, and the short-SHA trap reproduced in the same breath.** [MEASURED]
`gh run list -R GH-Mantova/ProjectOperations --commit 3e1be7160f3d01cc9c758f0a082f70a3203076ff
--json conclusion,name,event,workflowName,createdAt`, EXIT 0 -> **5** runs, **every one `success`**:
`Pipeline heartbeat`/schedule, `CI`/push, `Tendering Browser Smoke`/push, `Deploy`/push,
`CodeQL`/dynamic. The identical query with the **short** SHA `3e1be716` returned **2 characters**
(`[]`) at exit 0 - DOCTRINE 9.4's trap, live.

**09-09's F2 is RESOLVED, and I checked it rather than assuming it.** [MEASURED] `Pipeline heartbeat`
is `success` on `origin/main` (above), and `node scripts/pipeline/check-breadcrumb.mjs --freshness`
exits **0** `CLEAN` with `00` last `2026-09-10T22:08:00Z` (1.0 h), `03` `2026-09-09T23:01:00Z`
(24.1 h), `04` `2026-09-10T22:10:00Z` (1.0 h), `05` `2026-09-10T14:11:00Z` (9.0 h) - **no station
SILENT**. My own 09-09 breadcrumb is now tracked in `archive/`, i.e. it was collected. The collect
that had stopped for 37 hours is running again: `#1856`, `#1860`, `#1861` and `#1863` are 00 collect
PRs merged inside the last eight hours. ⚠️ The `CADENCE` map in `check-breadcrumb.mjs` still prints
`(cadence 2h)` for `00` against a live cron of `5 * * * *`; that is the known open defect recorded in
`STATION-CAPABILITIES.md` section 6 and is not re-filed here.

**Queue.** [MEASURED] armed `*-ready.md` at **TOP LEVEL ONLY**: **0** (POSITIVE control that the glob
works: **40** `*-HOLD.md` at the same level). `needs-marco/` 48, `no-pr-opened/` 109, `failed/` 45,
`blocked/` 132. `.arming-log.txt` is **76** lines on disk and **76** lines at `origin/main` - DOCTRINE
9.5's tracked/untracked gap is closed today; newest arm `2026-09-10T11:50:44Z ARMED
pr-triage-corpus-suffix-union ... actor=station-00.cowork-audit`.

**Open board: 5 PRs, all `CLEAN`, no labels.** [MEASURED] `gh pr list -R <repo> --state open --json
number,headRefName,mergeStateStatus,labels` EXIT 0: `#1852 fix/status-sweep-trunk-verdict-scoped`,
`#1850 feat/triage-corpus-union`, `#1845 fix/status-sweep-gitproc-scoped`,
`#1832 fix/vm-git-guard-selftest-and-recursion`, `#1823 feat/ea-gate-reporting-team-permission`.
⚠️ The sweep, four minutes earlier, read `#1832` and `#1823` as **BLOCKED**. `[LIVE]` means *true when
measured* - both had gone CLEAN by the time I asked.

**Restarter and sentinels present.** [MEASURED] `scripts\restart-watcher-if-wedged.ps1` True,
`C:\po-watcher\ensure-watcher.ps1` True, `C:\po-watcher\watcher-launcher-singlelane.ps1` True,
`C:\po-watcher\STOP-WATCHER` **False**, `C:\po-watcher\STOP-WATCHER-LANE2` **True** (present by
design, DOCTRINE 9.5 - not drift and not a stop signal).

**Bootstrap layer.** [MEASURED] `C:\Users\Marco\Claude\Scheduled\` holds 7 folders; all five station
`SKILL.md` files share mtime `2026-09-01T00:07:44Z`, `weekly-security-audit` `2026-08-17T06:37:17Z`,
`_retired-2026-08-18` has none. Scheduled-tasks MCP, five enabled tasks:
`03-machine-minder` cron `0 9 * * *` (**daily**), `lastRunAt 2026-09-10T23:01:10Z`,
`nextRunAt 2026-09-11T23:00:45Z` - against a bootstrap that still says "every 4 hours". Unchanged
open escalation `station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`; not re-filed.

**Disk.** [MEASURED] `C:` free **173 GB**. Not a constraint.

**This breadcrumb is `breadcrumb-clean`, and that word is used only because the validator was run.**
[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs` -> `structure: 3 checked, 0 malformed,
0 skipped`, this file `ADMIT`, overall `CLEAN`, **exit 0**. `lint-prompt.mjs` was NOT run against it
and its verdict would mean nothing either way (station contract - it gates `docs/pr-prompts/` as
*prompts* and rejects a breadcrumb for having no front matter).

**End-of-run re-measure, at `2026-09-10T23:12:59Z`** - the safe-to-act verdict expires the moment it
prints, so it was taken twice: dev `index.lock` **False**, clone `index.lock` **False**, `git`
processes **0**, watcher pid 18228 still alive. Unchanged from the start of the run.

### A lead, not a finding

The `PO Watcher Keepalive` run at `2026-09-10T23:05:02Z` reported `LastTaskResult 3221225786`
(`0xC000013A`, `STATUS_CONTROL_C_EXIT`) and wrote **no** row to `ensure-watcher.log`; the newest row
was `22:55:02Z`, 11 minutes old at the time of reading. My 2026-09-09 run measured `LastTaskResult 0`
on the same task, so the value is new. **Against 146 rows and zero >12-minute gaps in 24 h this is one
occurrence, and it landed inside this station's own run window**, so I cannot separate "the keepalive
had a bad tick" from "my run perturbed it". It belongs under WHAT I MEASURED, not in FINDINGS.
**The probe for the next run: `Get-ScheduledTaskInfo -TaskName 'PO Watcher Keepalive'` plus a grid-gap
count over `ensure-watcher.log`.** If the result is 0 and the grid is dense, this line dies.

## WHAT CHANGED

**Nothing on the machines and nothing on the board.** This station is REPORT-ONLY. This run repaired
nothing, restarted nothing, killed nothing, pruned nothing, armed nothing, merged nothing and labelled
nothing. Two files were written, both outside the repo's tracked state except this one:
`C:\po-sup-fix-scripts\sweep-03-20260911.txt` and `C:\po-sup-fix-scripts\live-daily-copy.log`
(scratch), and **this breadcrumb**.

## FINDINGS

### F1 - The keepalive is still gated on an interactive logon. Today's reboot cost 68 seconds instead of 8h27m only because a human happened to log in a minute after it.

[MEASURED] `Get-ScheduledTask -TaskName 'PO Watcher Keepalive'`: State `Ready`; Principal
`UserId=Marco  LogonType=Interactive  RunLevel=Limited`; triggers `MSFT_TaskLogonTrigger` (enabled)
and `MSFT_TaskDailyTrigger` (`StartBoundary 2026-08-24T00:05:00+10:00`, `Repetition PT10M / P1D`) -
**still no boot trigger, still an interactive principal.** Byte-for-byte the configuration my
2026-09-09 run measured, and the option (a) it escalated has not been applied.

What changed is only the luck. On 09-09 the reboot was unattended and the watcher was absent
**8 h 26 m 54 s**. Today the reboot at `05:38:37Z` was followed by an off-grid relaunch at
`05:39:36Z` - a logon time - and the outage was **68 s**. **A defect that did not fire is not a
defect that was fixed**, and the next unattended restart reproduces 09-09 exactly.

**Options, RULE 1 applied. This is the scheduled-task layer, which is Marco's; no station may change it.**

**(a) COMPLETE AND ADDITIVE - add an `At startup` trigger (1-2 min delay) AND set the principal to
"Run whether user is logged on or not".** Passes both halves: it fixes every future unattended
restart, and it damages no data - the keepalive is idempotent (`MultipleInstances IgnoreNew`, and
`ensure-watcher.ps1` no-ops while the watcher is alive, which its 146 "watcher alive" rows in 24 h
demonstrate). ⚠️ Two things only Marco can settle: a non-interactive principal needs the stored
password, and it must be confirmed that nothing in the watcher chain depends on an interactive
desktop.

**(b) Add the boot trigger only, leaving the principal `Interactive`.** Fails the FUTURE half: the
task still cannot run before a logon, so on an unattended reboot the new trigger changes nothing. It
looks like a fix and is not one.

**(c) Leave it and rely on someone noticing.** Fails the FUTURE half outright. 09-09 measured the
noticing: the 8.5-hour gap ran its full length unremarked, and the one alarm that fired blamed the
stations.

**DISPOSITION: ESCALATED.** Unchanged since 2026-09-09 and re-stated because the near-miss is
evidence *for* it, not against it. Marco owns the layer and option (a) turns on a credential question
only he can answer.

### F2 - `gh pr view <n> --json number` returns a well-formed row at exit 0 for a PR that does not exist, so the natural negative control passes and the natural existence probe says every integer is on the board.

[MEASURED] 2026-09-10T23:0xZ at `3e1be716`, `gh version 2.90.0 (2026-04-16)`, all five forms in one
shell, `-R GH-Mantova/ProjectOperations` on every call (DOCTRINE 9.4's CWD bullet):

| form | exit | stdout |
|---|---|---|
| `gh pr view 999999 --json number` - **the failing form** | **0** | `{"number":999999}` |
| `gh pr view 999999 --json number,state` | 1 | `GraphQL: Could not resolve to a PullRequest with the number of 999999. (repository.pullRequest)` |
| `gh pr view 999999 --json state` | 1 | the same GraphQL error |
| `gh pr view 1823 --json number,state` - POSITIVE control | 0 | `{"number":1823,"state":"OPEN"}` |
| `gh pr view 1863 --json number` - POSITIVE control, a merged PR | 0 | `{"number":1863}` |

**Mechanism.** `number` is derivable from the argument, so `gh` answers it locally and never issues
the query. Add any field the server must supply and the call fails **loudly**. Nothing is empty and
nothing warns, so DOCTRINE 9.6 cannot fire - this is 9.6 inverted, a **fabricated** row read as a
real one.

🔴 **Why it is worth a bullet rather than a note: `number` is the minimal, obvious field, and it is
the one that never asks.** DOCTRINE 9.6 requires every run to mint a fresh negative control; a run
that mints one as *"a PR number that cannot exist"* and probes it this way gets a **PASS**, which
reads as *"my instrument is broken"* and is exactly how a true finding gets retired. Used in the
other direction - *"is PR N on this board?"* - it answers **yes for every integer**.

**It fired in this run.** My first negative control was `gh pr view 999999 -R $R --json number 2>$null`
and it returned `negExit=0`. I recorded that as a working control and only caught it because the
answer looked too clean; the four rows above are the re-measurement.

🔧 **Cure: never probe existence with `--json number` alone. Ask for a field the server must answer -
`state`, `title`, `mergedAt` - or request two fields and test `$LASTEXITCODE` before parsing.**
⚠️ **Falsifying probe: the five rows above.** Re-run them; if row 1 ever exits 1, or row 2 ever exits
0, this finding is wrong and must be re-measured.

**DISPOSITION: DISPATCHED to Station 00.** It belongs in `DOCTRINE.md` section 9.4 next to the
short-SHA and CWD bullets, which is a `docs/` change inside 00's lane and outside 03's. 03 is
report-only and opens no PRs. The measurement above is complete enough to land verbatim.

### F3 - The watcher clone is 12 commits and 10h42m behind `origin/main`, and none of them touch `scripts/pr-watcher/**`, so the running watcher's CODE is current and a restart would measure nothing.

[MEASURED] clone HEAD `e4ecd9a5` (`2026-09-10T22:00:25+10:00`) against `origin/main` `3e1be716`
(`2026-09-11T08:42:23+10:00`); `git rev-list --count e4ecd9a5..origin/main` -> **12**;
`git diff --name-only e4ecd9a5..origin/main` -> **178** files, and grouped by top-level directory
they are `docs=177`, `sot=1`. The same query scoped `-- scripts/pr-watcher` returns **0**.

DOCTRINE 9.5 is explicit that *"a restart adopts nothing"* and that the clone must be
fast-forwarded first - but it is equally true that a restart is only warranted when the clone's copy
of the watcher's code differs from `main`. **Here it does not.** The drift is entirely the
documentation and breadcrumb traffic that 00's collect landed while this watcher instance has been
running since `05:39:45Z`, and the clone re-fetches at launch, so it self-corrects on the next
restart with no intervention.

⚠️ Recording the negative deliberately: a later run reading *"clone 12 behind"* alone would have a
plausible case for a restart, and restarting a healthy watcher to adopt 177 docs commits is pure
downside. **The discriminator is `git diff --name-only <cloneHEAD>..origin/main -- scripts/pr-watcher`,
and a non-zero answer there is what makes a restart a real proposal.**

**DISPOSITION: DEFERRED.** Real, measured, not now. It becomes URGENT the moment any
`scripts/pr-watcher/**` change merges while this instance is running - at which point the proposal is
a detached `Invoke-CimMethod -ClassName Win32_Process -MethodName Create` relaunch via
`C:\po-watcher\watcher-launcher-singlelane.ps1` during an idle window, wrapper stopped before the
node, verified to survive 40 s+ with the clone 0-behind. That proposal is Station 00's to dispatch,
not 03's to perform.

### F4 - Two `rev-` review jobs sit in `failed/`, both exited 0, and NEITHER wrote a verdict file in ANY of the three homes. Both PRs merged anyway.

Only two entries in `failed/` (45 files) are newer than my last run at `2026-09-09T23:01:42Z`:
`rev-1837-ready.md` (`2026-09-10T02:37:06Z`) and `rev-1837-ready.md.log` (`02:41:33Z`). Triaged, and
the older `rev-1746` pair re-read alongside it because they share a signature:

| | `rev-1837` | `rev-1746` |
|---|---|---|
| log `Exit:` | **0** | **0** |
| what the log claims | `Verdict: **MERGE** ... Verdict file at docs/pr-reviews/pr-1837-review.md` | `Scheduled a wakeup in ~4 minutes to check on the CI and continue the review.` + `SessionEnd hook ... failed: Hook cancelled` |
| `pr-<N>-review.md` in the dev tree | **absent** | **absent** |
| in the clone's `docs/pr-reviews/` | **absent** | **absent** |
| in `C:\po-watcher\verdicts-archive\` | **absent** | **absent** |
| the PR itself | `#1837` **MERGED** `2026-09-10T02:44:36Z` | `#1746` **MERGED** `2026-09-07T08:16:38Z` |

**All three homes were checked** (DOCTRINE 9.5 - *"treat 'no verdict for PR N' as UNMEASURED until
all three homes have been checked"*), which is the only reason this is a finding rather than a guess.

**The classification.** This is **not** TRANSIENT and **not** a CLEAR-CUT code failure: no test, lint
or check-run names a defect, and the exit code is 0. It is the station brief's own
*"watcher agents over-claim done"* pattern, in its purest form - `rev-1837` states the path of a file
it did not write. `#1837` then merged **2 minutes 4 seconds** after the review job ended, so nothing
downstream noticed the verdict was missing.

⚠️ **What I did NOT conclude.** Whether the merge was *gated* on that verdict is
**[CANNOT MEASURE]** from here - DOCTRINE 10.3 records that `verdictApproves` reads
`docs/pr-reviews/pr-<N>-review.md`, but reading the merge path for these two PRs means reading
`index.mjs` and the merge verdicts, which is diagnosis 00 is better placed to do and which I will not
substitute with an inference. What is measured is narrower and sufficient: **two review jobs in eight
days produced no verdict, exited 0, and were filed `failed/` - and the routing to `failed/` is the
only thing in the chain that behaved correctly.**

**Second occurrence of one signature, so it must not simply be restaged.** The station brief's own
rule - repeat failure of the same root cause is escalated, not retried - applies, and 03 is
report-only in any case: I copied nothing back to `docs/pr-prompts/` and armed nothing.

**DISPOSITION: DISPATCHED to Station 00.** Handed over: the two `failed/` entries above, the
three-home negative for both PRs with their merge timestamps, and the specific question 00 can answer
and I cannot - *does anything gate a `tests-docs` merge on a verdict file that these two runs never
produced?* If the answer is yes, this is a silent hole in the merge gate; if no, the `rev-` lane is
doing work nobody reads.

### F5 - The sweep calls `C:/po-worktrees/pr1823` an "aborted run leftover - investigate/prune". It is the checked-out head of OPEN PR #1823.

[MEASURED] `status-sweep.ps1` section 2 printed
`orphaned worktree (aborted run leftover -- investigate/prune): C:/po-worktrees/pr1823  9664f95a
[feat/ea-gate-reporting-team-permission]`, `dirty=0 files  age=1491 min`. In the same run,
`gh pr list -R <repo> --state open --json number,headRefName` (EXIT 0) returns
`#1823  feat/ea-gate-reporting-team-permission  CLEAN` - **that branch is an open PR's head**, and
`9664f95a` is the SHA DOCTRINE 10.2.1 already names as the dev-tree worktree that authored `#1823`'s
merge-approval receipt.

The classifier reaches "orphaned" from **age alone** (24.9 h). It never asks whether the branch is on
the board. The blast radius is small today - the worktree is clean and its branch is pushed, so a
prune would lose nothing - but the word it prints is `prune`, and it prints it against the one open
PR on this board carrying product code. ⚠️ Same family as the `dirty=2` row measured above: a sweep
`[LIVE]` line that is fresh and derived wrongly, which is precisely the bullet landed at
2026-09-10T22:1xZ.

🔧 The complete-and-additive form: **before classifying a non-main worktree as orphaned, cross its
branch against `gh pr list --state open --json headRefName` and label a match `live - open PR #N`.**
It removes the false label permanently, cannot hide a genuine orphan (a branch on no open PR is
unaffected), and adds no new instrument - the sweep already calls `gh` in section 1.

**DISPOSITION: DISPATCHED to Station 00.** `scripts/pipeline/status-sweep.ps1` is outside 03's lane,
and **two sweep repairs are already open and green on this board** (`#1845` GITPROC_SCOPED_V1,
`#1852` TRUNK_VERDICT_SCOPED_V1), so 00 should decide whether this rides with them or takes its own
prompt rather than have 03 stage a third in parallel.

### F6 - `C:/po-vg` still holds one unpushed file, now 6.6 days old.

[MEASURED] `git -C C:/po-vg status --porcelain` -> `?? scripts/pipeline/check-pipeline-heartbeat.mjs`;
branch `fix/no-rebase-while-checks-run` @ `23c91ba9`, HEAD dated `2026-09-04T17:53:38+10:00`;
`git ls-remote --heads origin fix/no-rebase-while-checks-run` **EMPTY**, against the POSITIVE control
`main` -> `3e1be716...`. Unchanged from my 09-08 and 09-09 runs and from the open escalation
`po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`.

**DISPOSITION: DEFERRED.** Already escalated, still true, nothing new. Pruning it would discard the
only copy of that file - `git worktree remove` refuses on a dirty tree and `--force` destroys it -
and 03 does not mutate in any case. It becomes URGENT if anyone proposes a worktree cleanup pass.

### F7 - The device-bridge git guard could not be installed, because the bridge itself would not start.

`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` never ran: the Linux workspace
failed to mount on two consecutive attempts (`Plan9 share "c" which is not mounted`). There is no
installer last line to quote, which is why this says so explicitly rather than leaving the PREFLIGHT
block's *"quote the installer's last line, pass or fail"* silently unsatisfied. The script is present
in the repo, so this is an environment failure and not a missing file.

⚠️ **This is the second consecutive run with the same mount error** (09-09 F5 recorded it verbatim),
and `#1832` - a `vm-git-guard` self-test fix - is open and green on the board right now, so the guard
is under active repair by another lane.

**DISPOSITION: DEFERRED.** The exposure this run was **zero**: with the bridge down no VM-side `git`
call was possible, every `git` I ran was PowerShell on the host, and both `index.lock` probes read
False at the end. It is recorded rather than dismissed because it matters on the next run where the
bridge IS up and the guard is skipped for a different reason. It is not a STOP, per the PREFLIGHT
block's own instruction.

## WHAT I DID NOT DO

- **Did not restart, kill, relaunch or wedge-check anything.** The watcher node is alive, its rescan
  loop ticked three times five minutes apart during this run, and 03 is report-only. F3 records the
  clone drift and the reason a restart would measure nothing.
- **Did not fast-forward, fetch, stash, drop, pop or otherwise `git` the watcher clone beyond reads.**
  Every clone command was `rev-parse`, `status`, `stash list` or `rev-list`.
- **Did not prune either worktree.** `C:/po-vg` holds the only copy of an unpushed file; `pr1823`
  belongs to an open PR (F5).
- **Did not touch the `PO Watcher Keepalive` task.** It lives in the scheduled-task layer, which no
  station may edit, and option (a) needs a credential decision from Marco.
- **Did not restage, copy back or arm anything from `failed/`.** Both entries are the same signature
  and 03 has no arming authority; the AUTHORITY block in the station doc overrides the older brief's
  restage-by-copy clause.
- **Did not open a PR, merge, label, or remove a label.** 03 has none of those.
- **Did not stage a third `status-sweep.ps1` fix prompt** alongside the two already open and green
  (`#1845`, `#1852`). Deciding whether F5 rides with them is 00's call, and staging in parallel is how
  duplicates get built (DOCTRINE 10.6).
- **Did not clear, discharge or re-check any `needs-marco/` file.** Not 03's lane.
- **Did not diagnose the `tests-docs` merge path for `#1837` / `#1746`.** [CANNOT MEASURE] here; F4
  hands 00 the question rather than an inference.
- **Did not create `docs/pipeline/pause.json`.** Nothing here is a deliberate pause, and the heartbeat
  is green anyway.
- **This breadcrumb is UNTRACKED** in the dev tree at `C:\ProjectOperations2\docs\pr-prompts\` and
  reaches nobody until a board PR commits it. The collect is running again (09-09's F2 is resolved),
  so it should be swept up on 00's next hourly run - but it is stated here rather than assumed.
