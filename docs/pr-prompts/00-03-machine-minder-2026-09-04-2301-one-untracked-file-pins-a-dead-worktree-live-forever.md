# Station 03 - Machine Minder | 2026-09-04T23:01Z-2026-09-04T23:12Z

## GROUND

```
UTC            2026-09-04T23:01:11Z
origin/main    f9961700            (fetched, then rev-parse, in the dev tree)
dev tree       main @ d7a6f055     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** - this run is not read-only.

Host reached: `start_process` shell `powershell.exe` -> `LAPTOP-E6NHU4E4`, local clock
`2026-09-05 09:01:11` (Brisbane, UTC+10). **This was a SIGHTED run, not a blind one.**

All three binding documents were read in the **dev tree** and proved current against `origin/main`
by `git diff --numstat origin/main -- <path>` (the sanctioned form; no piped hash was taken):
`03-machine-minder.md` EMPTY, `DOCTRINE.md` EMPTY, `STATION-CAPABILITIES.md` EMPTY. Empty numstat =
not different, so the working-copy read is sound.

## WHAT I MEASURED

- **[MEASURED] Watcher chain intact, all three links.** `Get-CimInstance Win32_Process` filtered by
  **command line**, never by image name (DOCTRINE 9.5): wrapper `35328`
  (`watcher-launcher-singlelane.ps1` - the correct launcher), inner `36224`
  (`scripts\pr-watcher\...`), node `20000` (`scripts\pr-watcher\index.mjs`). **24 `node.exe` are
  running and exactly one is the watcher** - the reason the cmdline filter exists.
- **[MEASURED] Watcher node start time `2026-09-04 19:37:14` local = `2026-09-04T09:37:14Z`**, i.e.
  13.4 h uptime at sweep time. Heartbeat age 21 min; queue armed=0, in-progress=0, so that is
  **idle, not wedged** (DOCTRINE 9.5: the heartbeat only ticks mid-run).
- **[MEASURED] The running watcher code is byte-current with `main`.** Clone HEAD `04992194`
  (#1611, `2026-09-04T22:24:48Z`); real remote main `f9961700` (#1613, `22:47:55Z`); **1 commit and
  23 minutes behind.** `git diff --name-only 04992194 f9961700 -- scripts/pr-watcher scripts/pipeline`
  -> **EMPTY**, POSITIVE CONTROL: the same range without a pathspec -> **2** files. So no restart is
  warranted to adopt anything.
  - ⚠️ **Instrument note.** Run inside the clone, `git rev-list --count HEAD..<real-main-sha>` returns
    `fatal: Invalid revision range` - not because the clone has diverged, but because it has not yet
    **fetched** that object. Read alone that fatal is a convincing "clone is broken" finding. The
    drift must be counted **in the dev tree**, which holds both commits. I nearly filed the false
    version.
- **[MEASURED] No locks, no git writes mid-flight.** `index.lock` absent in **both** trees
  (dev `False`, clone `False`); `Get-Process git` -> **0**.
- **[MEASURED] Sentinels correct.** `STOP-WATCHER` absent; `STOP-WATCHER-LANE2` **present, which is
  BY DESIGN since 2026-08-15** (DOCTRINE 9.5) - not drift, not a stop signal.
- **[MEASURED] Clone dirty=2**, and the two halves are different in kind:
  `M docs/data-model/metadata-catalog.json` (tracked) and
  `?? scripts/pr-watcher/.conflict-notified-prs.json` (untracked watcher runtime state).
- **[MEASURED] Stash closed loop static.** Clone `git stash list` = **66**, newest
  `2026-09-03 18:55:05 +1000`, oldest `2026-07-14 08:44:31 +1000`. Dev tree = **0**.
- **[MEASURED] Worktrees: 5 non-main, newest write per tree** (now `2026-09-04T23:05:05Z`):
  `C:/po-vg` 09-04T07:55Z (**15.2 h**, dirty=1) - classified LIVE by the sweep;
  `C:/po-guard` 09-04T00:04Z (23.0 h); `C:/po-sa-fix` 09-03T05:38Z (41.5 h);
  `C:/po-1483-fix` 09-02T02:27Z (68.6 h); `C:/po-work/s2-e2e` 09-02T00:31Z (70.6 h). Last four all
  `dirty=0`, so no uncommitted work is at risk in any of them.
- **[MEASURED] Registry escapees re-confirmed empty, this time with a positive control.**
  `C:\po-worktrees\fix-1523` and `C:\po-worktrees\vs-s2-durable-smoke`: **6215 directories, 0 files**
  each, no `.git`, top-level `apps, node_modules, packages`. POSITIVE CONTROL:
  `C:\ProjectOperations2\scripts\pipeline` -> **74** files, proving the file enumerator works.
  A naive `-Recurse` count returns `6215` for both and reads as "full checkout" - the directory
  skeleton survived the teardown, the content did not.
- **[MEASURED] `failed/` has nothing new.** 41 files, newest `2026-08-28T21:03Z`
  (`pr-crm-s3-account-on-client-create`, `rev-1386`, `rev-1385`, `rev-1384`) - all OAuth-401
  quarantines already triaged and dispositioned in my `2026-08-29-2305` breadcrumb. **No new entry
  since. Nothing triaged this run, and nothing is limit-parked.**
- **[MEASURED] Disk `C:` 174.1 GB free of 952.4 GB = 18.3%.**
- **[INFERRED] The stash count did not move in 24 h because the clone was clean at the last launch.**
  My previous breadcrumb recorded "two per day". The node relaunched at `09-04T09:37Z`, while
  `metadata-catalog.json` was not touched until `09-04T11:36:14Z` - two hours later. Nothing to
  stash at preflight, so nothing was stashed. The loop is intact; its rate is not two-a-day.

## WHAT CHANGED

**Nothing.** Station 03 is report-only. No process started or killed, no worktree pruned, no
escapee removed, no stash dropped, no clone fast-forwarded, no board or queue file touched. The only
write this run is this breadcrumb.

## FINDINGS

### F1 - One untracked file pins a dead worktree LIVE forever, and it freezes the whole board

`C:/po-vg` holds exactly one uncommitted file, `?? scripts/pipeline/check-pipeline-heartbeat.mjs`,
last written `2026-09-04T07:55:32Z` - **15.2 hours of zero filesystem activity.** The sweep reports
it as `LIVE STATION WORKTREE ... do NOT prune; a station is working here`, and section 7 therefore
returns `CAUTION: 1 LIVE STATION WORKTREE(s) ... Prefer to wait and re-run` instead of `SAFE TO ACT`.

I read the classifier rather than inferring it. `status-sweep.ps1:177`:

```powershell
$isLive = ($dirtyCount -gt 0) -or ($ageMinutes -ge 0 -and $ageMinutes -lt 30)
```

and its own comment at `:159`: `dirty (any uncommitted files) => LIVE STATION WORKTREE regardless of
age`. **Dirtiness alone pins LIVE with no expiry.** The 30-minute recency test is reachable only for
a *clean* tree, so it can never rescue a dirty one. An aborted run that left a single untracked file
behind emits a board-wide "prefer to wait" on **every sweep, forever**, until a human notices.

This is the exact shape DOCTRINE 9.5 records for `list_sessions`: a flag that never clears, being
read as a live-actor signal, becoming a precondition that nothing can satisfy. Two runs have already
stood down on that one. This one has the same failure mode with a wider blast radius, because
`status-sweep.ps1` is the instrument DOCTRINE 9.5 names as the *cure* for `list_sessions`.

RULE 1, complete-and-additive first: **make the liveness test conjunctive - `dirty AND recent`, with
the recency window applied to both branches** (a live station writes constantly; 30 min of silence
means it is gone whether or not it left a file). That fixes it immediately and for every future
aborted run, and it damages nothing, because the "do not prune" advice is preserved for genuinely
active trees and no data is touched either way. The alternative - clean up `po-vg` by hand - fails
the *future* half: the next aborted dirty worktree re-creates the freeze.

⚠️ **The untracked file is work, not litter.** `check-pipeline-heartbeat.mjs` does not exist on
`origin/main`. Whoever prunes `po-vg` must **preserve or commit that file first**, never discard it.

**DISPATCHED -> Station 00.** The fix is a one-line change to `status-sweep.ps1:177` plus the comment
at `:159-161`; that is a repair, and Station 03 is report-only. `status-sweep.ps1` is outside
`tests|docs`, so the resulting PR is Marco's under RULE 2 - it does not self-merge.

### F2 - Four orphaned worktrees, all clean, 23 h to 70 h old

`C:/po-guard` (23.0 h, `guard/never-arm-cd-s1`), `C:/po-sa-fix` (41.5 h,
`pipeline/standing-authority-reject`), `C:/po-1483-fix` (68.6 h, `fix1483`), `C:/po-work/s2-e2e`
(70.6 h, detached `f85f11cf`). **All `dirty=0`** - measured, so pruning loses no uncommitted work -
and all four are correctly classified `orphaned` by the sweep. `po-guard` and `po-vg` are both new
since my `2026-09-03` run; the other three were reported then and are unchanged.

**DISPATCHED -> Station 00** for `git worktree remove`. Nothing here is urgent and nothing is at
risk; it is accumulating disk (see F5) and sweep noise.

### F3 - The two registry escapees are dead, and now proved so with a control

Unchanged from my `2026-09-03` report except for age (`fix-1523` 41.4 h, `vs-s2-durable-smoke`
37.7 h). Re-measured because the prior claim carried no positive control and a bare recursive count
returns **6215** for each, which reads as a full checkout. With the control it is **6215 directories
and 0 files**, no `.git`, and `git worktree list` in **both** the dev tree and the clone is unaware of
them - so no registry entry is at stake either.

**DISPATCHED -> Station 00.** Safe to `Remove-Item -Recurse`. Removal is a repair, not my lane. This
finding is now on its second run without action; it is harmless, but it is also the cheapest item on
00's list.

### F4 - The clone's tracked dirty file is line-endings only, not content

`git status --porcelain` reports `M docs/data-model/metadata-catalog.json`, but
`git diff --numstat -- docs/data-model/metadata-catalog.json` returns **EMPTY** alongside
`warning: ... LF will be replaced by CRLF the next time Git touches it`. Empty numstat = not
different once the clean filter runs. So `dirty=2` is one line-ending touch plus one untracked
runtime-state file (`.conflict-notified-prs.json`, which the watcher writes itself). **Neither will
stop the launcher**, and the sweep's `<-- NOT clean-on-main; the watcher may refuse to start` is, on
this reading, a warning about nothing. The watcher has in fact been up 13.4 h.

**DEFERRED.** It becomes worth acting on only if the launcher ever actually refuses on it. Do not
dispatch a restart on the strength of that sweep line - the same caution I recorded on 2026-09-03,
and it held again today.

### F5 - The preflight stash loop is at 66 and did NOT grow; my own prior rate figure was wrong

66 stashes, `2026-07-14` to `2026-09-03`, unchanged across 24 hours. My `2026-09-03` breadcrumb said
"two per day", which would have predicted 68 today. The cause is measured in WHAT I MEASURED: the
clone happened to be clean when the node relaunched at `09-04T09:37Z`. **The loop is real and still
closed - nothing ever pops - but it accrues per *dirty launch*, not per day.** Given F4, the next
launch will stash the CRLF touch and tick it to 67.

**DEFERRED**, unchanged. It is bookkeeping debt. It becomes urgent if a preflight stash ever captures
work someone needs back. The sanctioned drain is `git stash drop`, **never `pop`**, and it is a clone
write, so it belongs to 00.

I am recording the correction rather than quietly restating the number, because a rate figure pasted
into a report is state, and this is what stale state looks like one day later.

### F6 - Cadence measured: the cron is DAILY, and the bootstrap still says every 4 hours

My last two runs started `2026-09-03T23:02Z` and `2026-09-04T23:01Z` - **23 h 59 m apart**, with no
run in between (no `00-03-*` breadcrumb bearing a 2026-09-04 date other than this one). That is a
measurement of the interval itself, not a reading of the schedule, and it settles the direction:
**four-hourly is not what is happening.**

This is already open as
`docs/pr-prompts/needs-marco/station-03-cadence-bootstrap-says-4h-cron-says-daily-2026-09-03.md`, and
`STATION-CAPABILITIES.md` section 5 flags the same disagreement. I am adding the interval
measurement, not opening a second escalation.

**ESCALATED -> Marco** (existing escalation, now with evidence). The question is one line: *should 03
run every 4 h as its bootstrap and the section 6 table say, or daily as the cron actually does?*
RULE 1 - the complete-and-additive answer is **set the cron to 4 h and leave the docs alone**: it
satisfies the documented contract immediately, it is additive (more frequent measurement of a
report-only station cannot damage data entry), and it removes the disagreement permanently. The
alternative - edit the bootstrap and section 6 down to daily - is also complete, but it fails the
*immediate* half for machine health: a crash at 23:05Z currently goes unseen for a full day, and
"manually after any crash or reboot" is only reachable by a human who already knows something broke.

### F7 - Disk at 18.3% free

174.1 GB free of 952.4 GB. Not a problem today and I am not dressing it as one. It is worth stating
because F2 and F3 hold six abandoned trees, several carrying `node_modules`, and this is the number
that decides when they stop being tidiness and start being a machine-health issue.

**DEFERRED.** Re-measure next run; it becomes a finding below roughly 10%.

## WHAT I DID NOT DO

- **Repaired nothing.** No worktree removed, no escapee deleted, no stash dropped, no watcher
  restarted, no clone fast-forward, no `status-sweep.ps1` edit. Station 03 is **report-only**;
  F1-F3 are dispatched to Station 00, which owns the repair.
- **Did not touch `po-vg`**, specifically not the untracked `check-pipeline-heartbeat.mjs`. It is
  unpublished work and removing the worktree without saving it would destroy it silently.
- **Triaged no `failed/` entries.** All 41 predate `2026-08-29` and were dispositioned in that run's
  breadcrumb. Re-triaging them would be re-diagnosing a solved problem, which the brief forbids.
- **Did not touch the board or the queue.** No prompt armed, disarmed, copied or restaged; no PR
  read as an action, no label, no merge. `#1614` and `#1615` are open and mid-CI and are none of my
  business.
- **Did not run `git` against the Windows `.git` through any device bridge**, and did not run
  `git checkout .` / `reset --hard` / `stash pop` / `git clean` anywhere.
- **Azure / Entra / SharePoint: not touched, not read, not enumerated.**
- **Did not clear the `[STALE]` escalation rows** in sweep section 5 (16 files in `needs-marco/`
  carrying references to merged PRs). That is a queue mutation and belongs to Station 00; it is
  already on its list from prior runs.
