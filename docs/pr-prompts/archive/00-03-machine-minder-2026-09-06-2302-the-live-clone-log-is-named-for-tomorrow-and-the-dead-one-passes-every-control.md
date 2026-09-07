# Station 03 - Machine Minder | 2026-09-06T23:01Z-2026-09-06T23:20Z

## GROUND

```
UTC            2026-09-06T23:02:19Z
origin/main    af9d89a1              (fetch +refs/heads/main:refs/remotes/origin/main, then rev-parse, in the DEV TREE)
dev tree       main @ 734ff8c9       C:\ProjectOperations2   (1 behind origin/main)
doc version    1                     (docs/pipeline/stations/03-machine-minder.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE. Run proceeded normally. REPORT-ONLY, as 03 always is.

**This run was SIGHTED.** `[MEASURED]` Desktop Commander loaded via keyword `ToolSearch` first, then
`start_process` shell `powershell.exe` returned `2026-09-07 09:01` / `Test-Path C:\ProjectOperations2
-> True`. Every line below is a probe on the box, not a GitHub-side substitute.

**Device-bridge git guard installed FIRST, before any VM-side call** `[MEASURED]`
`bash /sessions/<id>/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh`, last line quoted verbatim:

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

Preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths, allows
everything else (both controls passed)`. **PASS.** No `git` was run against the Windows `.git` through
the bridge at any point this run; every git call below was native PowerShell on the host.

**Binding documents.** Read from the working copy AFTER proving it is not different from `origin/main`,
using the sound form with no pipe (DOCTRINE 9.1 - a piped hash is unsound in `powershell.exe`):

```
git diff --numstat origin/main -- docs/pipeline/stations/03-machine-minder.md \
                                  docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md
-> EMPTY output for all three. EMPTY = not different. That is the real answer.
```

All three read in full: 03-machine-minder.md (349 lines), DOCTRINE.md (1415 lines, in four reads to
`0 remaining`), STATION-CAPABILITIES.md (403 lines).

## WHAT I MEASURED

**status-sweep.ps1** `[MEASURED]` 2026-09-06T23:02:49Z, run with `-File`. Section 0 positive controls
both PASS (`gh CAN reach GitHub (saw merged PR #1738)`, `node runs`). No `[BROKEN]` anywhere, so the
report is usable. Section 7 verdict: `CAUTION: no local lock, but a PR was touched on GitHub in the
last 2 min` - which was #1740, opened by the watcher at 23:02:55Z. 03 mutates nothing, so the caution
gates nothing here.

**DOCTRINE 9.1 fired live, twice, in this run's own instrument** `[MEASURED]`. Two `-Command "..."`
calls containing `$_` came back as `.Line : The term '.Line' is not recognized` and
`You must provide a value expression following the '+' operator` - the `$` token consumed before
PowerShell parsed it. Both were re-run as `.ps1` files with `-File` and worked. Recorded because
9.1's cure is only credible if stations say when the trap caught them.

**Watcher process** `[MEASURED]`, resolved by COMMAND LINE, never by image name (31 `node.exe` were
running; exactly one is the watcher):

```
pid=31660  startUTC=2026-09-06T23:05:03Z
  "C:\Program Files\nodejs\node.exe" --no-deprecation
  C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs
launcher chain: powershell.exe:36576 (start-watcher.ps1) <- powershell.exe:27936
  (watcher-launcher-singlelane.ps1) <- WmiPrvSE.exe:24868   detached=True
```

Re-measured at 23:08:11Z (DOCTRINE 7 - `[LIVE]` expires): still pid 31660, same creation time.

`[MEASURED]` **status-sweep at 23:02:49Z reported `watcher node: RUNNING pid 27236`. By 23:07Z the
watcher was pid 31660.** The sweep was correct when printed and false four minutes later. That is
DOCTRINE 7's `[LIVE]` rule reproducing inside this run, and it is why F2 below exists.

**Keepalive** `[MEASURED]` `C:\po-watcher\ensure-watcher.log`, tail:

```
2026-09-06T22:55:04Z  watcher alive, pid(s) 27236
2026-09-06T23:04:59Z  RELAUNCHED - wrapper pid 27936 (Win32_Process.Create returned 0)
2026-09-06T23:05:21Z  VERIFIED node pid 31660 ancestry: powershell.exe:36576 <-
                      powershell.exe:27936 <- WmiPrvSE.exe:24868  detached=True
```

Scheduled task `PO Watcher Keepalive`: `state=Ready lastRun=09/07/2026 09:05:02 lastResult=0
nextRun=09/07/2026 09:15:00`. **The keepalive did its job.**

**Locks and concurrency** `[MEASURED]`: no `index.lock` in either tree; no `MERGE_HEAD` /
`REBASE_HEAD` / `CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` / `sequencer` in either tree;
`Get-Process git` -> **0**. In-progress prompts 0. **No stale lock this run.**

**Watcher clone drift** `[MEASURED]`, without fetching in the clone (DOCTRINE 9.5 - the clone's
`origin/main` is pinned at launch and lies):

```
clone HEAD                 af9d89a1c32ae8a848a75643f57607e922a8d630
dev-tree origin/main       af9d89a1c32ae8a848a75643f57607e922a8d630
git -C <dev> rev-list --count af9d89a1..origin/main   ->  0
```

**The clone is 0 behind `origin/main`.** The running watcher is executing current watcher code.
Clone dirty = 1, untracked: `?? docs/pr-reviews/pr-1739-review.md` - i.e. today's review verdict
landed in the CLONE, which is the home the mirror step reads. No repeat of last run's F1 shape.

**RULE 2 probe directory is alive** `[MEASURED]`, pinned to the DEV TREE, never the clone:
`C:\ProjectOperations2\docs\pr-prompts\processed` holds **2016** `*.log`, newest
`pr-deps-s2-puppeteer-major-drops-extract-zip-ready.md.log` at 2026-09-06T23:03:05Z - younger than
both open PRs, which is the control that separates the live directory from the clone's stale decoy.
POSITIVE control `marco.:true` -> **618**. NEGATIVE control (freshly minted needle
`zzQq03Prb20260907`) -> **0**.

**Queue and failures** `[MEASURED]`, against the prior run's breadcrumb
(`00-03-machine-minder-2026-09-05-2301-...`, in `archive/`):

| | 2026-09-05 | 2026-09-06 | delta |
|---|---|---|---|
| `armed (*-ready.md)` | 0 | 2 (`pr-deps-s2-puppeteer...`, `rev-1739`) | +2, both consumed/in flight |
| `failed/` | 41, newest 2026-08-28T21:03:55Z | **41, newest 2026-08-28T21:03:55Z** | **unchanged** |
| `no-pr-opened/` | 109 | 109 | unchanged |
| `needs-marco/` | 26 | 30 | +4 |
| `blocked/` | 120 | 123 | +3 |
| clone stash | 66 | **69** | **+3, see F3** |
| C: free | 178.5 GB | 182.3 GB | not a constraint |

**NOTHING NEW TO TRIAGE in `failed/`.** Its newest file is still the 2026-08-28 expired-OAuth batch
already triaged in `00-03-machine-minder-2026-08-29-2305-oauth-expired-watcher-cannot-run.md`.

**Launcher / sentinel inventory** `[MEASURED]`, with the PATH that DOCTRINE 9.5 calls the
load-bearing half:

```
C:\po-watcher\watcher-launcher-singlelane.ps1   present  2367 B  2026-08-18T02:41:02Z  <- the real one
C:\po-watcher\ensure-watcher.ps1                present  5266 B  2026-08-24T00:01:25Z
C:\po-watcher\watcher-launcher.ps1              present  2083 B
C:\po-watcher\watcher-launcher-lane2.ps1        present  2352 B
C:\po-watcher\STOP-WATCHER                      ABSENT
C:\po-watcher\STOP-WATCHER-LANE2                present  1090 B   <- BY DESIGN since 2026-08-15
NEGATIVE CONTROL C:\po-watcher\zzQq03NoSuchSentinel20260906*  ->  0 files
```

Matches DOCTRINE 9.5 exactly. Not drift, not a stop signal, NOT re-filed as a finding.

**Worktrees** `[MEASURED]` `git worktree list`: two - the dev tree, and `C:/po-vg 23c91ba9
[fix/no-rebase-while-checks-run]`, age 3789 min (63.2 h), dirty 1. See F5.

## WHAT CHANGED

**Nothing on the machines, the board or the queue.** 03 is report-only and mutated none of it: no
repair, no arm, no merge, no label, no prompt moved, no stash dropped, no worktree pruned, no process
killed or started.

Files written this run, all outside the repo except the breadcrumb:

- `C:\po-sup-fix-scripts\st03-*-2026-09-06.ps1` (six probe scripts) and
  `C:\po-sup-fix-scripts\st03-logcopy\` (read-only copies of three logs, because the live daily log is
  held open by the watcher and `Select-String` against it fails).
- **This breadcrumb**, at `C:\ProjectOperations2\docs\pr-prompts\00-03-machine-minder-2026-09-06-2302-...md`.
  It is UNTRACKED until a board PR commits it - **Station 00 must sweep it up.** A breadcrumb filename
  matches no watcher glob, so it arms nothing.

## FINDINGS

### F1 - S1 - the live clone log is named for TOMORROW, and the dead one passes every control

DOCTRINE 9.5 (correction of 2026-09-06T17:5xZ) sends every station to
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\<yyyy-MM-dd>.log` as "the DAILY CLONE LOG",
and 9.5's later correction adds a freshness precondition built on that file. **The file is not daily.
Its name is fixed at LAUNCH from the HOST-LOCAL date, while every line inside it is stamped UTC, and
it never rolls at midnight.**

`[MEASURED]` mechanism, anchored by symbol (`scripts/pr-watcher/start-watcher.ps1`, anchor
`$LogFile = Join-Path $LogDir`):

```powershell
$LogDir  = Join-Path $RepoRoot "scripts\pr-watcher\logs"
$LogFile = Join-Path $LogDir ("{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))
```

`Get-Date` with no `-AsUTC` is host-local (Brisbane, UTC+10), evaluated once, at launch.

`[MEASURED]` 2026-09-06T23:09Z, the two files side by side:

| | `2026-09-06.log` | `2026-09-07.log` |
|---|---|---|
| stamped lines | **1157** | **30** |
| first line | `[2026-09-06T05:35:07.550Z] [watcher] stale lockfile (PID 20000 not found)` | `[2026-09-06T23:05:03.228Z] [watcher] stale lockfile (PID 27236 not found)` |
| last line | `[2026-09-06T23:04:05.228Z]` | `[2026-09-06T23:05:08.638Z]` |
| written by | pid 27236, **DEAD** | pid 31660, **LIVE** |
| `[merge]` (POSITIVE control) | **11** | **0** |
| `opened PR #` | **5** | **0** |
| NEG control `zzQq03N20260907` | 0 | 0 |

```
UTC   today -> 2026-09-06.log   <- the DEAD watcher's file
LOCAL today -> 2026-09-07.log
NEWEST by mtime -> 2026-09-07.log  mtimeUTC=2026-09-06T23:08:36Z   <- the LIVE one
```

**Both ways of naming the file are wrong, and they are wrong in opposite directions.** A run that
computes the name in **UTC** - the clock every station report is written in - gets `2026-09-06.log`,
a file the watcher stopped writing to at 23:04:05Z, whose **positive control passes** (11 `[merge]`
lines, 5 `opened PR #`). It answers confidently about a process that no longer exists. A run that
computes it in **local** time gets the live file, whose `[merge]` and `opened PR #` counts are both
**0** - so the same reader concludes the watcher has never merged anything. That is DOCTRINE 9.6
exactly: an empty result read as an empty world, sitting inside the cure written for it 6 hours ago.

The mismatch window is structural, not a coincidence of this run: at UTC+10 the local date is ahead
of the UTC date from 14:00Z to 23:59Z every day - **ten hours in twenty-four** - and a launch inside
that window pins the file to the LOCAL name for the whole life of that watcher. This watcher launched
at 23:05Z, inside the window. Its predecessor launched at 05:35Z, outside it, which is why
`2026-09-06.log` looked correctly named all day and then silently stopped being the live file.

This is the same clock error DOCTRINE 3 records for watcher logs and STATION-CAPABILITIES 3 records
for mount `stat` times, arriving through a third door.

**FALSIFYING PROBE:** the two-file table above. Re-run it whenever the watcher has relaunched. If a
single file ever holds both the newest line and the current-UTC name across a 14:00Z boundary, this
finding is wrong and must be re-measured.

**The sound rule, and there is no second one: take the newest `*.log` in that directory by
`LastWriteTimeUtc`. Never construct the name from a date, in either clock.**

**DISPOSITION: DISPATCHED -> Station 00.** DOCTRINE is 00's lane to edit; 03 may not. Two things to
hand over, complete-and-additive first (RULE 1):

- **(a) COMPLETE AND ADDITIVE - fix the instrument AND the instruction.** In DOCTRINE 9.5, replace
  every `logs\<yyyy-MM-dd>.log` construction with "the newest `*.log` in that directory by mtime",
  and carry the table above as the falsifying probe; **and** stage a one-line `scripts/` change so
  `start-watcher.ps1` names the file from `(Get-Date).ToUniversalTime()`, matching the UTC stamps it
  writes inside. Fixes it now and stops the next reader re-deriving it. Damages no data entry: the
  file is append-only and a rename affects nothing but future launches.
- **(b) Doc-only.** Correct 9.5 and leave the naming as it is. Fails the "future" half of RULE 1 -
  the instrument keeps disagreeing with its own contents, and every future reader has to remember a
  ten-hour exception rather than read a clock.

### F2 - S2 - the watcher died unclean at 23:04Z with no recorded exit, and took a review build with it

`[MEASURED]` timeline, from the clone logs and `ensure-watcher.log`:

```
23:02:55Z  [merge] pr-deps-s2-puppeteer...: opened PR #1740, policy=tests-docs, waiting.
23:03:02Z  [merge] PR #1740: escalates:true - NOT enabling auto-merge; labelling do-not-merge
23:03:05Z  [ok] pr-deps-s2-puppeteer-major-drops-extract-zip-ready.md -> processed/
23:03:41Z  [start] rev-1739-ready.md (max-turns=240)
23:04:05Z  [update] PR #1740 is BEHIND but checks in flight - not rebasing   <- LAST LINE, pid 27236
   ...     no exit line, no error, no stack, nothing
23:04:59Z  ensure-watcher: RELAUNCHED - wrapper pid 27936
23:05:03Z  [watcher] stale lockfile (PID 27236 not found) - overwriting
23:05:04Z  [queue] rev-1739-ready.md (depth: 1, source: startup-scan)
23:05:05Z  [start] rev-1739-ready.md (max-turns=240)                        <- SECOND build of the same job
```

**The death is unrecorded.** `[MEASURED]` `C:\po-watcher\watcher-launch.log` holds 143
`Watcher exited with code` lines; the newest is `2026-09-06T15:27:31+10:00` = **05:27:31Z, 17.6 hours
before this death**. So no exit line was written for it - consistent with the launcher process dying
alongside its node rather than observing a node exit. `[CANNOT MEASURE]` the cause from any artefact
on the box: the launcher writes the reason only on a clean node exit, and there was none.

**It has happened twice today and left the same fingerprint both times.** Both surviving log files
open with `stale lockfile (PID nnnnn not found) - overwriting` - `PID 20000` at 05:35:07Z and
`PID 27236` at 23:05:03Z. A lockfile whose owner is gone is written by a process that did not clean
up, i.e. was killed, not exited.

**Restart cadence has resumed.** `[MEASURED]` `RELAUNCHED` rows in `ensure-watcher.log`:
09-01 x7, then **09-03 x1, 09-04 x1**, then **09-06: 05:35:03Z, 09:25:04Z, 09:35:06Z, 09:49:32Z,
23:04:59Z - five in one day.** The prior run measured "no restart in the 19:05Z-23:05Z window" and a
37.5 h uptime; this run measured a 3-minute-old watcher.

**The consequence is the duplicate-build shape DOCTRINE 9.5 already names.** `rev-1739` was started
at 23:03:41Z, killed 24 s later, and started again at 23:05:05Z by the new watcher's startup scan.
Also measured in the dead file: **53 `[start]` lines against 5 `opened PR #` lines** in one day -
which is 9.5's "the `opened PR #` set is incomplete because the kill loop stops the build before the
merge step logs it", reproducing at scale.

**DISPOSITION: DISPATCHED -> Station 00.** 03 is report-only; the repair is a `scripts/` change and
00 dispatches it. The specific ask, complete-and-additive first (RULE 1):

- **(a) COMPLETE AND ADDITIVE - make the death self-reporting.** The launcher currently records a
  reason only on a clean node exit, so the failures that matter most are the ones that leave nothing.
  Have the wrapper write a `Watcher vanished (no exit observed), last log line <ts>, lockfile owner
  <pid> not found` row on the relaunch path, and have `ensure-watcher.ps1` capture the dead pid's
  last 20 log lines beside it. Purely additive - new log rows, no behaviour change, nothing existing
  is overwritten. Without it the next five deaths are as unmeasurable as these two.
- **(b) Watch another cycle before spending anything.** Fails the "immediately" half of RULE 1: the
  evidence expires with each relaunch, so waiting costs the very data the diagnosis needs.

### F3 - S2 - the stash closed loop is 69, and last run's own urgency trigger has fired verbatim

`[MEASURED]` `git -C C:\po-watcher\ProjectOperations stash list` -> **69** entries (prior run: 66).
The three new ones are all from today, all inside the 09:25-09:35Z relaunch burst:

```
stash@{0}: On fix/verdict-home-resolver-v1: watcher-preflight-autostash at 2026-09-06T19:35:10+10:00
stash@{1}: On main:                         watcher-preflight-autostash at 2026-09-06T19:28:44+10:00
stash@{2}: On main:                         watcher-preflight-autostash at 2026-09-06T19:25:07+10:00
stash@{3}: On main:                         watcher-preflight-autostash at 2026-09-03T18:55:05+10:00
```

Last run filed this as **DEFERRED** with an explicit falsifying condition: *"what would make it
urgent: a restart cadence that resumes adding entries."* **That condition is now met, by
measurement, not by judgement** - 2.6 days of no growth, then three entries in ten minutes.

**And the mechanism is now MEASURED rather than inferred.** In `scripts/pr-watcher/start-watcher.ps1`
the preflight stash block (anchor: `PRE-FLIGHT: uncommitted TRACKED changes on branch`) runs **before**
the single-instance guard (anchor: `# --- Single-instance guard ---`). So a keepalive relaunch that
arrives while the watcher is already running still stashes the clone first, and only then declines to
start. The log carries both halves of that sequence in order:

```
[2026-09-06T20:08:54+10:00] PRE-FLIGHT: uncommitted TRACKED changes on branch 'main'. Self-healing by stashing
[2026-09-06T20:12:31+10:00] SINGLE-INSTANCE: watcher already running (PID 15336). Not starting another.
```

`[MEASURED]` the same file holds **7 `SINGLE-INSTANCE: watcher already running` rows** in its last 16
preflight lines alone. Every relaunch that hits a dirty clone pays a stash whether or not it starts
anything. Also worth 00's attention: `stash@{0}` was taken while the clone sat on
`fix/verdict-home-resolver-v1`, not `main`.

**DISPOSITION: DISPATCHED -> Station 00.** 03 measured it and may not drop a stash. Options in RULE 1
order:

- **(a) COMPLETE AND ADDITIVE - move the single-instance guard above the preflight stash, and drain
  the backlog with `git stash drop` (never `pop`, DOCTRINE 9.2).** Solves it now (69 entries gone)
  and in future (a no-op relaunch stops minting entries). Damages nothing: the guard exits 0 either
  way, and the entries being dropped are autostashes of a tree the watcher itself declared unsafe.
- **(b) Drop the 69 and leave the ordering.** Fails the "future" half - the count starts climbing
  again on the next relaunch burst, which is how it reached 69.
- **(c) Leave both.** Fails both halves; the loop is already at 69 and is the reason F4 below could
  not be answered.

### F4 - S2 - one of today's four logged preflight stashes exists in neither the stash list nor the stash reflog

`[MEASURED]` `2026-09-06.log` carries **four** `PRE-FLIGHT: stash entry:` lines today - at
19:25:07, 19:28:44, 19:35:12 and **20:08:57 (+10:00)**. `git stash list` filtered to `2026-09-06`
returns **three**, and the missing one is the newest of the four. `git reflog show stash` returns the
same three; the 20:08:54 entry is absent from the reflog as well. NEGATIVE control (entries dated
`2026-12-25`) -> **0**.

An entry gone from both the list and the reflog was removed by `git stash drop` or `git stash pop` -
both delete the reflog row - and not by any read. **`[CANNOT MEASURE]` which of the two, or by which
actor.** 03 did not touch it; last run's F4 was DEFERRED, so 03 did not touch it then either.

This matters beyond bookkeeping: DOCTRINE 9.2 describes this loop as one where **"nothing ever pops"**,
and prescribes `drop`, never `pop`, precisely because a pop re-dirties a shared clone under a running
watcher. Something popped or dropped in that clone today and left no signature. If it was a `pop`, it
is a live hazard; if a `drop`, it is fine but the loop is being drained by an unnamed hand, and 9.2's
characterisation needs a sentence.

**DISPOSITION: DISPATCHED -> Station 00.** 00 collects across lanes and is the only actor that can
ask which of them ran it. The cheap discriminator: if a `pop` ran, the popped content should appear
as dirt in the clone shortly after 20:08:57+10:00 - `git log`/reflog on the clone's `HEAD` and the
`[watcher] preflight` rows after that timestamp will show it. Nothing here needs doing by 03.

### F5 - S2 - C:\po-vg is unchanged 63 hours on, and its commit is on no remote branch at all

Repeat of last run's F3, re-verified live rather than quoted (DOCTRINE 7.1 re-read rule):

```
git worktree list        ->  C:/po-vg  23c91ba9  [fix/no-rebase-while-checks-run]
status-sweep             ->  dirty=1 files   age=3789 min (63.2 h)
git -C C:\po-vg status --porcelain  ->  ?? scripts/pipeline/check-pipeline-heartbeat.mjs
git -C C:\po-vg log --oneline -1    ->  23c91ba9 fix(pr-watcher): never rebase a PR whose checks are still running
git ls-remote --heads origin fix/no-rebase-while-checks-run  ->  EMPTY
   POSITIVE control: git ls-remote --heads origin main  ->  af9d89a1...  refs/heads/main
git branch -r --contains 23c91ba9  ->  EMPTY
```

**So the commit exists in exactly one place on earth and so does the untracked file.** The branch is
not on the remote, and no remote branch contains the commit. Prior run measured 39 h; it is now 63 h.

⚠️ **status-sweep section 5 is actively misleading about this one.** It prints five
`[STALE] po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md references #NNNN which is
MERGED -- escalation is DEAD, clear it` lines. **The PR references are dead; the escalation's subject
is alive.** A reader who clears the file on the sweep's advice deletes the only record of bytes that
exist nowhere else. The sweep is cross-checking PR numbers, which is all it can do - but the wording
"escalation is DEAD, clear it" is stronger than the evidence supports for any escalation whose subject
is not a PR.

**DISPOSITION: ESCALATED -> Marco.** Second consecutive run, same root cause, and the station brief is
explicit: repeat failure of the same root cause is ESCALATED, not retried. A question with options, in
RULE 1 order:

- **(a) COMPLETE AND ADDITIVE - preserve, then prune.** Push `fix/no-rebase-while-checks-run` to
  origin (or commit the untracked file onto it first) so both artefacts exist somewhere durable, then
  `git worktree remove C:/po-vg`. Nothing is lost, the orphan stops being reported every run, and the
  fix becomes reviewable. Passes both halves.
- **(b) Leave it alone and keep reporting it.** Fails the "immediately" half: three station runs have
  now spent probes on it, and it is one accidental `--force` from gone.
- **(c) Prune with `--force`.** Fails the "without damaging existing data" half outright - it discards
  the only copy. Listed only to be ruled out.

**Marco's call, because pushing a branch and discharging an open escalation are both his.**

### F6 - last run's F5 is RESOLVED, verified live

The malformed literal-path directory reported on 2026-09-05 (`C:<U+F03A>temppr-1648.diff` and the
`C?ProjectOperations2docspr-reviews` family) is gone, and the watcher now sweeps them itself.
`[MEASURED]` in today's live log: `[2026-09-06T23:05:03.863Z] [watcher] sweep: removed empty
malformed literal-path dir "C?ProjectOperations2docspr-reviews"`. Independently: directories in the
clone root matching `ProjectOperations2|temppr` -> **0**; files matching `temppr|diff$` -> **0**.

**DISPOSITION: ACTIONED.** Verified by the two probes quoted above; nothing further owed, and it is
not re-filed as an open finding.

### F7 - heartbeat: nothing new to triage, and the queue moved on its own

`failed/` is unchanged at 41 files with the same 2026-08-28T21:03:55Z newest entry, so no new
quarantine has appeared in 9 days. Both armed prompts this run were consumed by the watcher without
03's involvement: `pr-deps-s2-puppeteer-major-drops-extract-zip-ready.md` -> `[ok] -> processed/` and
PR #1740 (correctly held for Marco, `escalates:true`, labelled `do-not-merge`), and `rev-1739` is a
review job, not a prompt.

**DISPOSITION: ACTIONED.** No triage was owed and none was performed.

## WHAT I DID NOT DO

- **Repaired nothing.** 03 is report-only. The watcher was not restarted, no stash was dropped, no
  worktree pruned, no process killed, no lockfile cleared. Every one of F1-F5 is handed on.
- **Did not touch the board.** No PR read beyond what status-sweep reported, no label, no merge, no
  comment. #1740 carries `do-not-merge` and stays untouched.
- **Did not arm, disarm or move a prompt.** The only file 03 wrote inside the repo is this breadcrumb.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard was installed
  first and its last line is quoted under GROUND.
- **Did not run `restart-watcher-if-wedged.ps1`.** It is the sanctioned liveness probe but it can
  restart, and a station whose lane is report-only should not carry that risk when
  `status-sweep.ps1` plus a direct `Win32_Process` read answered the question. Noted as a deliberate
  choice, not an oversight.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
- **Did not chase the `no-pr-opened/` (109) or `blocked/` (123) backlogs.** Neither has a new entry
  since 2026-09-02 and 2026-09-06T04:26Z respectively, and both are queue triage rather than machine
  health.
- **Did not run `lint-prompt.mjs` on this file**, deliberately: DOCTRINE says a `lint-prompt` verdict
  on a breadcrumb is not evidence in either direction and must not be quoted as one.

## VALIDATOR

`[MEASURED]` the one validator that governs a breadcrumb was run, and the command is quoted so the
claim is checkable:

```
node scripts/pipeline/check-breadcrumb.mjs --structure          (in C:\ProjectOperations2)
ADMIT   00-03-machine-minder-2026-09-06-2302-the-live-clone-log-is-named-for-tomorrow-and-the-dead-one-passes-every-control.md
NOTE    ...same file... is UNTRACKED - it reaches nobody until a board PR commits it
structure: 5 checked, 0 malformed, 0 skipped as pre-contract
CLEAN
EXIT: 0
```

**breadcrumb-clean, by `check-breadcrumb.mjs` at exit 0.**

⚠️ **Two breadcrumbs are sitting UNTRACKED right now, not one.** The same pass flagged
`00-04-scanner-2026-09-06-2210-an-escalated-bootstrap-defect-has-no-needs-marco-home-and-the-sweep-calls-its-sibling-dead.md`
- Station 04, filed 52 minutes before this one - as untracked as well. **Station 00's next board PR
needs to sweep BOTH**, or 04's run reaches nobody.

<!-- Station 00: this breadcrumb is UNTRACKED in the dev tree at
     C:\ProjectOperations2\docs\pr-prompts\ . Please sweep it into the next board PR, together with
     Station 04's 2026-09-06-2210 breadcrumb, which is also untracked. -->
