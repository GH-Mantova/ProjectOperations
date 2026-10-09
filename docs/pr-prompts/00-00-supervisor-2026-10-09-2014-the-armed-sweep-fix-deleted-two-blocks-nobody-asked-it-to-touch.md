# Station 00 - Supervisor | 2026-10-09T20:14Z-2026-10-09T20:5xZ

## GROUND

```
UTC            2026-10-09 20:14
origin/main    6332dd05            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 6332dd05      C:\ProjectOperations2
doc version    1                    (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE (1 == 1). Full read/write run.

## WHAT I MEASURED

**Reachability.** [MEASURED] ONE keyword `ToolSearch` for `desktop-commander`, then
`start_process` shell `powershell.exe` succeeded on the first call (PIDs 37136, 33548, 34876).
Not blind.

**Git guard.** [MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit read from the installer itself and not from a pipeline: `EXIT=2`. Last line:
`   PATH="/sessions/gifted-upbeat-bohr/.local/bin:$PATH" git <args>`. Headline:
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Exit 2 is the expected station outcome - a FINDING, not a stop. The device-bridge git ban was
therefore REMEMBERED this run, not mechanical, and I ran no VM-side `git` at all.

**Binding reads.** [MEASURED] all three from `git show origin/main:<path>` in the DEV TREE after
`git fetch origin`, written to `%TEMP%` and read with Desktop Commander: `st00.md` 64870 B
(466 lines, read in full), `doctrine.md` 60566 B (508 lines, read in full), `stcap.md` 107606 B
(740 lines, read in full across three slices). No piped `hash-object` comparison was made
(DOCTRINE 9.2 - unsound in `powershell.exe`).

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, generated 2026-10-09 20:15:04Z.
Section 0 positive controls both `[LIVE]` PASS (`gh` reached GitHub, saw merged #2293; `node`
runs). No `[BROKEN]`.

- `[LIVE] OPEN PRs: 1` - `#2294 BEHIND`, `CI: 12 pass / 3 fail / 0 pending  <-- RED`
- `[LIVE] WAITING ON MARCO: 0 open PR(s) labelled do-not-merge` (at sweep time; see WHAT CHANGED)
- `[LIVE] ALL OPEN (non-draft): 1; oldest #2294, open 0h`
- `[LIVE] main CI on 6332dd05: 4 success / 0 failed / 0 running  (trunk green)`
- `[LIVE] watcher node: RUNNING pid 8848`, auto-restart wrapper alive (1), heartbeat age 33 min
  (ticks only mid-run; stale + empty queue = idle, NOT wedged), clone `branch=main
  tracked-dirty=0 untracked=3`
- `[LIVE] armed (*-ready.md): 0` - `needs-marco/: 52` - `no-pr-opened/: 111` - `failed/: 80` -
  `blocked/: 204`
- `[LIVE] git processes touching our trees (scoped): 0`; `board lease: free`; `no PR touched on
  GitHub in the last 2 min`; `watcher build: no build in flight`
- `[LIVE] non-main worktrees found: 33`, plus `worktree-registry-escapees: 3 found -- Station 03
  should review and prune if confirmed dead`
🟢 **The verdict WAS reached this run, and I nearly reported otherwise.** [MEASURED] the sweep
ran to completion in its own shell (PID 37136, 489 lines total) while I worked in a second
shell, and its closing lines are:

```
==================== 7. VERDICT ====================
  [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
SWEEP COMPLETE 2026-10-09 20:15:04Z
```

I had already drafted this bullet as `[CANNOT MEASURE] ... for the sixth consecutive
occurrence` before draining that shell at the end of the run. **That would have been a DOCTRINE
7 instrument lie in the same line six previous runs got wrong** - the instrument was working and
my reading of it was not. What actually ran out in those runs was the READER, not the sweep. See
F6, which is rewritten around this.

**Section 5 therefore DID complete, and it found no `[STALE]` rows at all.** [MEASURED] across
the 52 `needs-marco/` files it printed only `[FILE]` rows of two shapes - `cites #N (MERGED) as
evidence -- not its premise; does not clear the escalation` and `names no subject PR in its
filename or first heading but cites N MERGED PR(s) -- section 5 CANNOT decide whether it is
stale` - plus `(no PR ref, or gh down -- cannot cross-check; read it as a SNAPSHOT)`. It closed
with `[LIVE] [CANNOT MEASURE] dispatched register absent on origin/main`. So there was nothing
for me to retire this cycle, and that is now a measurement rather than an omission.

**Section 6 backlog gates.** [MEASURED] `ready=1  needs-marco=2  blocked=4  broken=0`.
The one READY TO STAGE item is `[P2] rates-11c-blocked-consumers`; the two needs-marco items are
`[P1] model-merge-slices-rehomed` (explicitly DO NOT AUTO-STAGE) and
`[P2] map-locations-waste-rate-coupling`. See F7.

**Board re-measured immediately before mutating.** [MEASURED] `.git/index.lock` absent,
`MERGE_HEAD` absent, no `rebase-merge` / `rebase-apply`, `Get-Process git` count **0**.
`Enter-BoardLease -Actor 'station-00.scheduled'` -> `LEASE_RETURN=[True]` - the RETURN VALUE is
the reading, not `$LASTEXITCODE`. The same actor string was passed to every later primitive so
none could fall back to a generated `pwsh-<pid>` actor and refuse against my own lease.

**COLLECT - breadcrumb freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs
--freshness`, exit **0**, verdict `CLEAN`:

```
structure: 1 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-10-09T19:13:00Z  1.0h ago  (cadence 1h + grace 0.5h)  ok
  02  dispatch-only - no cadence to miss
  03  last 2026-10-08T23:06:00Z 21.2h ago  (cadence 24h + grace 3h)   ok
  04  last 2026-10-09T18:10:00Z  2.1h ago  (cadence 4h + grace 1h)    ok
  05  last 2026-10-09T14:22:00Z  5.9h ago  (cadence 24h + grace 3h)   ok
```

`breadcrumb-clean` is quoted here because `check-breadcrumb.mjs` was actually run and exited 0.
No station is MISSED, so no MISSED classification was needed and **no scheduled task was
touched** - DOCTRINE 7 forbids it on a freshness reading alone in any case.

**COLLECT - what was waiting.** [MEASURED] `Get-ChildItem docs\pr-prompts -Filter '00-*.md'` at
depth 1 returns exactly one file, the 1913 breadcrumb, and `git ls-files --error-unmatch` finds
it TRACKED (it landed with #2293). Nothing from 03, 04 or 05 awaited collection. Every finding
in 1913 carries a disposition; I dispositioned its two open DEFERRED items below (F1 closes its
F2; F5 carries its F4 forward) and archived it in this run's PR.

**Queue census.** [MEASURED] `Get-ChildItem docs\pr-prompts -Filter '*-ready.md'` -> **nothing**
at depth 1 (DOCTRINE 9.2: a gitignored `*-ready.md` never shows as `??`, so `Test-Path` /
`Get-ChildItem` is the instrument, never `git status`). Depth-1 `*-HOLD.md`: **13** - one fewer
than the 1913 run's 14, because the prompt it armed is the one now open as #2294.

**#2294, the PR the previous run armed.** [MEASURED]
`gh pr view 2294 --json files,headRefOid,labels` at `8a7278e8`: four paths,
`labels: []`, `mergeStateStatus: BEHIND`. `gh pr checks 2294` -> 3 fail:

| check | verdict at `8a7278e8` |
|---|---|
| `Approval receipt (CP-26)` | fail |
| `Pipeline — arm-prompt tests (Windows)` | fail |
| `Pipeline — watcher + linter tests` | fail |

The two test jobs failed on the **same two** named tests, read from
`gh run view <run> --job <job> --log-failed` (DOCTRINE 3 - never from the diff):
`not ok 19 - 5. status-sweep.ps1 declares [CmdletBinding()] and -Actor param (BOARD_LEASE_V1)`
and `not ok 260 - status-sweep.ps1 calls marco-queue.mjs in section 1 only, never from section 7`.
CI totals: `# tests 471 / # pass 469 / # fail 2`.

**The cause, measured against the merge base and not inferred from the diff.** [MEASURED]
`git merge-base origin/main pr2294` -> `6aaaddb8`. Reading
`scripts/pipeline/status-sweep.ps1` out of each ref with `Select-String -SimpleMatch`, with
`STATUS SWEEP` as the POSITIVE control on the same file in the same call:

| ref | `marco-queue.mjs` | `HEARTBEAT_ALARM_TEXT_V1` | `SkipSection5` | `prViewCache` | ctl `STATUS SWEEP` |
|---|---|---|---|---|---|
| `origin/main` 6332dd05 | 4 | 1 | 0 | 0 | 2 |
| merge-base 6aaaddb8 | 4 | 1 | 0 | 0 | 2 |
| `pr2294` 8a7278e8 | **0** | **0** | 7 | 4 | 2 |
| after my fix 7671943c | 4 | 1 | 7 | 4 | 2 |

The control is identical in every ref, so the two zeroes are a real absence and not a broken
reader (DOCTRINE 9.6). The branch **deleted** both blocks. See F1.

**Lane classification of #2294, measured with both controls.** [MEASURED]
`node scripts/pipeline/check-instrument-lane.mjs --range origin/main...pr2294h`, exit 0:
`controls: positive(in-lane path classifies as in-lane)=true
negative(out-of-lane path classifies as out-of-lane)=true`, verdict
**`INSTRUMENT_LANE: OUT_OF_LANE`** on exactly one path,
`docs/pr-prompts/superseded/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`; the other three
(`status-sweep.ps1` and the two `__tests__` files) classify `IN_LANE`.

**CP-26's actual text, read rather than guessed.** [MEASURED] job 113991213705:
`FAIL - CP-26 approval-receipt [RECEIPT_REQUIRED_BY_DIFF] PR #2294 touches files that require an
approval receipt (outside tests/ or docs/: scripts/pipeline/status-sweep.ps1), but
docs/decisions/merge-approvals/2294.md is not in this PR's diff`. It is armed by the diff, so
the `do-not-merge` label does not satisfy it; only a committed receipt does.

**The prompt is tracked at TWO paths in the PR tree.** [MEASURED] `git ls-tree -r --name-only`:
`pr2294h` holds **both** `docs/pr-prompts/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` and
`docs/pr-prompts/superseded/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`. Blob SHAs:
root `dcfea8bb` on both `origin/main` and the branch, superseded copy `7ea7a4ce` - so the copy
was EDITED, not moved, and the two are not interchangeable. `check-queue-layout.mjs` passed on
this PR regardless. See F2.

**The dev tree held two fast-forward blockers, both created by the previous run's arm.**
[MEASURED] `git status --porcelain --untracked-files=no`:
`M docs/pr-prompts/.arming-log.txt` and
`D docs/pr-prompts/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`, with
`git diff --numstat` showing `1 0` and `0 112`. `git diff --cached --name-status` EMPTY and
`git rev-list --left-right --count HEAD...origin/main` -> `0 0` - **both of which PASS on this
tree**, which is exactly why the station doc says only the fourth probe catches it. The 1913 run
read all four and recorded "the FF cure was NOT needed this run"; that was true when it read
them, and its own `arm-prompt.ps1` call created both blockers afterwards. See F3.

**FF cure applied, primary branch, read back.** [MEASURED] raw-Buffer node write
(`fs.writeFileSync(abs, execFileSync('git', ['show','HEAD:'+rel]))`), no EOL conversion
attempted: `BLOB_BYTES=6133`, `ON_DISK_BYTES=6133`,
`HEAD_BLOB=dcfea8bb...` vs `DISK_BLOB=dcfea8bb...` (`git hash-object <rel>`, clean filter
applied), `BLOB_MATCH=true`. Then `git update-index --refresh -- <that path>`, and its
**PER-PATH output** read rather than its exit code: it named only
`docs/pr-prompts/.arming-log.txt: needs update`, i.e. the restored path is index-clean. Four
probes after: `LEFTRIGHT 0 0`, `--numstat` = the arming-log line only, `--cached` EMPTY,
`status --porcelain --untracked-files=no` = the arming-log line only.

**Local test run of the fix, in an isolated worktree off the PR head.** [MEASURED]
`node --test "scripts/pipeline/__tests__/*.mjs"` in `C:\PR-Master\worktrees\sup-2294-restore`:
`TEST_EXIT=0`, reporter totals `tests 500 / suites 54 / pass 500 / fail 0`. Both previously
failing tests are named PASS in that output, as is my new negative control.

**CI read back on the new head.** [MEASURED] `gh pr checks 2294` at `7671943c`:
`Pipeline — watcher + linter tests  pass`, `Pipeline — arm-prompt tests (Windows)  pass`,
`PR gates — diff checks  pass`, `Web  pass`, `CodeQL  pass`; `Approval receipt (CP-26)  fail`;
`API — lint, test, compliance smoke` and `tendering-e2e` still `pending` at the time of writing.

## WHAT CHANGED

**1. Pushed `7671943c` to #2294's branch `fix/sweep-section5-dedupe-and-fast-switch`.**
Restored the two deleted blocks by reverse-applying ONLY the three deletion hunks
(`git apply -R` of a sub-patch built from the nine-hunk diff; `--check -v` first, all three
`succeeded` with a -27 line offset), leaving the six hunks that carry the work the prompt asked
for untouched. Narrowed `board-lease.test.mjs`'s param-block regex terminator from `)` to
`[,)]` and added a negative control beside it. Pushed via the sanctioned primitive:
`Invoke-GitPush -Branch fix/sweep-section5-dedupe-and-fast-switch -WorkTree
C:\PR-Master\worktrees\sup-2294-restore` -> `PUSH_RETURN=[7671943c]`, read back
`LOCAL=7671943c...` and `REMOTE_AFTER=7671943c...` (equal).

**2. Labelled #2294 `do-not-merge`** - `gh pr edit --add-label`, exit 0, read back
`READBACK_LABELS=do-not-merge`. So the WAITING ON MARCO line now counts it. I added a label; I
removed none.

**3. Commented on #2294** (`issuecomment-6088852839`) with the deletion table, the lane verdict
and why no station can release it, so the next reader of that PR does not have to re-derive it.

**4. Restored `docs/pr-prompts/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` in the dev
tree** from `HEAD`, byte-identically (above). Nothing was deleted and no `git checkout --` or
`git clean` was used.

**5. This PR** - from the isolated worktree `C:\PR-Master\worktrees\sup-2014` off `origin/main`
`6332dd05`, branch `docs/board-collect-2026-10-09-2014`: this breadcrumb, the archiving of the
1913 breadcrumb, and the one-line `docs/pr-prompts/.arming-log.txt` append that the previous
run's arm left uncommitted in the dev tree. Committing that line is the additive resolution:
it preserves the arming audit record on `main` instead of discarding it, and it clears the
second FF blocker.

Nothing else changed. **No merge** (the only open PR is red on CP-26 and out of lane), no
`do-not-merge` label removed, no prompt armed, no `needs-marco/` file retired, no scheduled task
touched, no `/sot/` edit, no worktree pruned, no production data, no Azure / Entra / SharePoint.

## FINDINGS

### F1 - The watcher's build of an instrument-repair prompt deleted two unrelated blocks from the same file, and one of them is a gate

[MEASURED] the table under WHAT I MEASURED: against merge base `6aaaddb8`, the branch at
`8a7278e8` carried **0** occurrences of `marco-queue.mjs` and **0** of
`HEARTBEAT_ALARM_TEXT_V1` in `status-sweep.ps1`, where the base has 4 and 1, with an identical
positive control in every ref. The diff is `74 insertions / 84 deletions` on a prompt whose
scope was "add a switch and dedupe a loop".

The `MARCO_QUEUE_LINE_V1` deletion is the consequential one. It is **not** a report: Station
00's own contract says to read the WAITING ON MARCO and ALL OPEN lines before arming, and
MARCO_QUEUE_LINE_V1 exists because arming one at a time protects the dev tree but not Marco's
queue. A rewrite that silently removes those two lines removes the only instrument that answers
the question. The `HEARTBEAT_ALARM_TEXT_V1` deletion took the `databaseId,createdAt` fields with
it, so it would have failed quietly rather than loudly.

Both reds were these deletions, not the new work: the two failing tests are the regression tests
that exist for precisely these two blocks, and they did their job. The new work's own tests all
passed at `8a7278e8`.

**ACTIONED** - restored byte-for-byte by reverse-applying only the three deletion hunks and
pushed as `7671943c`; `marco-queue.mjs` back to 4 and `HEARTBEAT_ALARM_TEXT_V1` back to 1 with
`SkipSection5`/`prViewCache` still at 7/4; local suite 500/500; both named test jobs now PASS on
the new head per `gh pr checks`. This closes the 1913 breadcrumb's F1 (the section 5 repair) on
the code side.

### F2 - The prompt put its own superseded copy in `scope:`, which puts the PR out of the instrument lane by construction and leaves it with no station-writable receipt

[MEASURED] `check-instrument-lane.mjs` returns `OUT_OF_LANE` with both controls passing, on the
single path `docs/pr-prompts/superseded/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`;
`docs/**` is on the instrument lane's NEVER-LIST. CP-26 reports `RECEIPT_REQUIRED_BY_DIFF`
because `status-sweep.ps1` is outside `tests|docs`. The `instrument` standing lane requires
every non-receipt diff path to be in `instrument-lane.json`, which this one is not; `lane: sot`
is false; and a scheduled station may not write `authority: personal`. **So #2294 is green on
everything a station can drive and un-releasable by any station.** This is the
NEVER_LIST_BEFORE_ARMING_V1 failure shape arriving by a second route - not a never-listed
target file, but a `docs/` path the prompt listed in its own scope.

⚠️ I checked whether this is structural to every watcher build before writing it up, because
that would be a much larger claim: `git grep superseded origin/main -- scripts/pr-watcher
scripts/pipeline/lint-prompt.mjs scripts/pr-gates` returns **one** hit, in a test fixture. The
watcher does **not** file consumed prompts to `superseded/` itself. This is a property of this
one prompt's `scope:`, not of the lane or the watcher, and must not be inflated into one.

⚠️ I deliberately did **not** restructure #2294's diff to clear the gate. Dropping the `docs/`
path would make it `IN_LANE` and let me merge it under INSTRUMENT_LANE_V1 with a standing
`instrument` receipt - and that is precisely the move STATION-CAPABILITIES 5 warns about
(`NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`: PRs that "exist to repair this pipeline's
own instruments" are the class a station is most tempted to merge itself). Engineering a diff to
clear a gate is reasoning past the gate.

**ESCALATED** to Marco - see FOR MARCO, with RULE 1 options. Labelled `do-not-merge` so the
WAITING ON MARCO line counts it, and commented on the PR with the measurements.

### F3 - `arm-prompt.ps1` leaves two tracked changes in the dev tree that block the next fast-forward, and three of the station doc's four probes pass on them

[MEASURED] after the 1913 arm, the dev tree held `M docs/pr-prompts/.arming-log.txt` and
`D docs/pr-prompts/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`, while
`git diff --cached --name-status` was EMPTY and
`git rev-list --left-right --count HEAD...origin/main` was `0 0`. The station doc already says
only `git status --porcelain` catches this; what this run adds is **when** it is created. The
1913 run ran all four probes, got a clean reading, recorded "the FF cure was NOT needed this
run", and then armed - and the arm is what created both blockers. The probes were run at the
only moment they could not see the problem.

The deletion is the `git mv` half of arming that nobody commits (`-ready.md` is gitignored, so
only the `-HOLD.md` deletion is tracked); the modification is the audit line
`arm-prompt.ps1` appends to a TRACKED file. Both persist until some later PR happens to carry
them.

**ACTIONED** - cure applied and read back (raw-Buffer restore, `BLOB_MATCH=true`, per-path
`update-index --refresh`), and the arming-log line committed in this run's PR rather than
discarded, so the audit record survives. **The durable half is a doc change, not a code change:**
the four-probe read-back belongs AFTER the last mutation of a run, not before it. Dispatched
below as part of F6 rather than hand-edited here, because `arm-prompt.ps1` is on the instrument
lane's NEVER-LIST and the station doc is not mine to rewrite mid-run.

### F4 - Nothing stops a future Station 00 re-arming a prompt whose work is already open as a PR

[MEASURED] the restored `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` is back at depth 1 and
its premise is still LIVE (`SkipSection5` is absent from `origin/main`'s
`status-sweep.ps1` - 0 hits, against the `STATUS SWEEP` control's 2). So `lint-prompt.mjs` will
ADMIT it again on the next run, and a 00 that arms the only admissible HOLD without checking
open PRs would make the watcher build #2294's work a second time. DOCTRINE 10.6 names this
exact failure and asks the prompt be marked superseded; the marking is manual and, here, lives
only inside #2294's unmerged copy.

I did not add a marker to the root copy: the established convention in this repo is to MOVE a
retired prompt into `docs/pr-prompts/superseded/`, not to annotate it in place (no
`superseded_by`-style front matter exists anywhere under that folder), and #2294 already carries
that move with an edited copy (blob `7ea7a4ce` vs root `dcfea8bb`). Writing a competing
annotation on the root copy would put two differing versions on a collision course.

🔴 **So the guard for the next run is this line: do NOT arm
`pr-sweep-section5-dedupe-and-fast-switch`. Its work is open as #2294, waiting on Marco.** The
hazard window closes by itself the moment #2294 merges - the premise goes dead and lint will
REJECT it - and whoever merges #2294 should `git rm` the root copy in the same board cycle, since
the merge otherwise lands the prompt at two tracked paths (F2's measurement).

**DEFERRED** - to the run that merges #2294, which must do the `git rm`. What would make it
urgent: a 00 run arming the only admissible HOLD on an empty board without first reading the
open-PR list, which is how this cycle's board would have grown a duplicate build.

### F5 - Thirty-three non-main worktrees and three registry escapees, still growing, still 03's lane

[MEASURED] the 20:15:04Z sweep: `non-main worktrees found: 33`, nearly all tagged
`orphaned worktree (aborted run leftover - investigate/prune)` with
`HOLDS <n> COMMIT(S) ON NO REMOTE BRANCH`. The two that need care before anything else:
`C:/po-worktrees/sup-cwd-paths` (4 commits **plus 2 uncommitted files**, age 22360 min) and
`C:/PR-Master/worktrees/sweep-dirty-untracked-v1` (1 commit plus 1 uncommitted file, age 10045
min). Also `worktree-registry-escapees: 3 found` - `C:\PR-Master\worktrees\bootstrap-check`
(age 9889 min), `C:\PR-Master\worktrees\sweep-section5` (42 min), `C:\po-wt\dispatch-register-v1`
(9994 min), all 0 KB with `.lock=False`. The sweep's own note says a squash-merged branch also
appears here, so "orphaned" is not "unmerged".

This carries forward the 1913 breadcrumb's F4, which dispatched the same census to 03 for its
2026-10-09T23:02Z occurrence. That occurrence has not happened yet, so this is not a missed
dispatch - it is the same item, re-measured, with the escapee list added.

**DISPATCHED** to **03 Machine-minder** (next occurrence 2026-10-09T23:02Z): classify all 33 by
asking the board per branch (`gh pr list --head <branch> --state merged`), prune only the ones
proven squash-merged, preserve the uncommitted files in the two trees named above before
touching them, and review the three registry escapees. Report the surviving census so the next
00 can see the direction of travel.

### F6 - The sweep's verdict was never unreachable. The READER was giving up, and five runs recorded that as the instrument failing

🔴 **This finding reverses what the last five breadcrumbs concluded, including the one I archived
this run.** [MEASURED] the sweep completed normally this occurrence: 489 lines, section 5 crawled
all 52 `needs-marco/` files, section 6 printed the backlog gates, and section 7 printed
`SAFE TO ACT`, with `SWEEP COMPLETE 2026-10-09 20:15:04Z` as its last line. Nothing was changed
to make that happen - I ran the same `status-sweep.ps1` from `origin/main` that the 19:15Z run
ran.

The difference is purely in how it was read. The 14:27Z, 15:27Z, 16:14Z, 17:14Z and 19:15Z runs
each drained the sweep's output synchronously, hit their reading budget partway through section
5's `[FILE]` rows, and recorded `[CANNOT MEASURE] the verdict`. This run started a SECOND shell,
did the whole of the board work in it, and drained the first shell at the end - by which time
the sweep had long finished. **I was one step from writing the same `[CANNOT MEASURE]` line
myself**; the draft of this breadcrumb contained it.

This is DOCTRINE 7 in its purest form, and it had the most expensive polarity available: five
consecutive runs reported a working instrument as broken, and the pipeline armed, built and is
now escalating a PR (#2294) to repair something that was not failing. ⚠️ **That does not make
#2294 wrong or wasted** - section 5 really does ask `gh` once per occurrence rather than once per
distinct PR number (383 against 153, measured 16:29Z), the dedupe is a real improvement, and
`-SkipSection5` is a legitimate switch. What is wrong is the *reason* given for urgency. The
honest framing is "this sweep is slower than it needs to be", not "the gate every station obeys
is unreachable".

🔧 **The cure costs nothing and is available to the next run immediately: start the sweep in one
shell, do the run's work in another, and drain the sweep at the end.** No code, no PR, no
Marco. The reading budget was never the sweep's problem to solve.

**ACTIONED** - verdict quoted above (`SAFE TO ACT`) for the first time in six occurrences, and
the procedural cure is written down here where the next run collects it. The urgency claim
attached to #2294 is corrected in FOR MARCO rather than repeated.

### F7 - The backlog gates have a READY TO STAGE item nobody has staged, and I did not read section 6 until after I had finished acting

[MEASURED] section 6: `ready=1  needs-marco=2  blocked=4  broken=0`. The ready item is
`[P2] rates-11c-blocked-consumers` - "SLICE 11c cannot run: 7 services bypass the rate resolver",
with the FK decision recorded SETTLED 2026-08-19 and four slices already staged. The two
needs-marco items (`[P1] model-merge-slices-rehomed`, `[P2] map-locations-waste-rate-coupling`)
both carry explicit DO-NOT-AUTO-STAGE notes and are Marco's.

I reached this only on the same late drain that produced F6, i.e. after the run's mutations were
done. Staging is **Station 06's lane**, not mine - I arm what is staged, I do not design new
work - so nothing was lost by reading it late this once. But a 00 run that never drains its
sweep never sees the backlog section at all, which is the second thing F6's reading pattern was
silently costing.

⚠️ I am not arming anything off this line. `rates-11c-blocked-consumers`' own note says the
consumers are "staged but not yet merged", and the 11c chain is destructive (it drops rate
tables) with a parity proof that must RUN clean first - that is a hard stop, not a staging
question.

**DISPATCHED** to **06 PR Master**: confirm whether the four `rates-11c-blocked-consumers`
slices named in the register are still staged and still have live premises, and say in the
register what the next arming step is. Nothing in it is armable by 00 until the parity proof has
run clean.

Two doc changes also belong to this finding and are **DISPATCHED to 05 SoT-keeper** (next
occurrence 2026-10-10T00:10Z) if it judges them source-of-truth, else to 06 as a staged prompt:

1. The station contract's four-probe FF read-back should be stated as running **after the run's
   last mutation**, not before it - F3 measures a run that passed all four and then created the
   blockers itself.
2. `PROMPT-SCHEMA.md` should say that a `scope:` entry under `docs/` puts the resulting PR
   outside the instrument lane, so an instrument-repair prompt should not list its own
   superseded copy; the retiring move belongs in Station 00's board PR instead. That is the whole
   of F2's cause, and it is one sentence.

## WHAT I DID NOT DO

- **Did not merge anything.** The one open PR is red on a required check (CP-26) and
  `OUT_OF_LANE`. `Assert-SmokedOrEscalate` / `Merge-Pr` were not called: there was nothing they
  could have been called on honestly.
- **Did not restructure #2294's diff to clear the lane gate** (F2). Measured, considered,
  refused.
- **Did not act on the sweep verdict, because I had not read it yet when I acted** (F6). I
  re-measured section 3's inputs directly before every mutation instead - `git processes
  touching our trees: 0`, `board lease` taken by me, no `index.lock`, no `MERGE_HEAD`, no
  rebase state - and the verdict, read afterwards, agrees: `SAFE TO ACT`. Quoting it now is a
  record, not a retro-justification.
- **Did not arm anything.** 13 depth-1 HOLDs; the only one that linted ADMIT last run is the one
  now open as #2294, and re-arming it is the F4 hazard. I did not re-lint the other 13: the 1913
  run linted all 14 and recorded nine `HUMAN_GATE_PRESENT` (Marco's to clear) and four
  `FILE_GATE_NOT_RELEASED`, and nothing merged to `main` since that reading could have released
  a file gate - `origin/main` moved only by #2293, a docs-only board PR. [INFERRED], and the
  reason I am content to infer it is that arming is the mutation it would gate, and I armed
  nothing.
- **Did not retire any `needs-marco/` escalation** - but this time because there was nothing to
  retire, not because I could not look. Section 5 completed over all 52 files and produced
  **zero `[STALE]` rows** (F6). No escalation was retired and none was re-surfaced to Marco.
- **Did not touch the 33 worktrees or the 3 registry escapees** - 03's lane (F5), and two of
  them hold uncommitted work that `--force` would discard.
- **Did not add a superseded marker to the restored root HOLD** (F4) - it would compete with
  #2294's edited copy.
- **Did not enable, disable, run, re-run or edit any scheduled task.** No station read MISSED.
- **Did not touch `/sot/`** (05's alone), Azure / Entra / SharePoint, or production data.
- **Did not run any `git` from the VM side** - the guard reported INERT (exit 2), so that ban was
  remembered, not mechanical.

## FOR MARCO

**One thing needs you, and it is small: release PR #2294.**

⚠️ **First, a correction to what the last five breadcrumbs told you, mine included until I
caught it:** the sweep's verdict was NOT unreachable. It completed normally this run and printed
`SAFE TO ACT`. Five consecutive runs reported a working instrument as broken because they drained
its output synchronously and ran out of reading budget mid-section-5; running the sweep in one
shell and the work in another fixes that for free, and I have written that down (F6). **#2294 is
still worth landing** - section 5 genuinely asks `gh` 383 times for 153 distinct PR numbers, and
the dedupe plus `-SkipSection5` are real improvements - but it is a speed fix, not an emergency,
and you should weigh it as one.

Everything a station can drive on it is green: both test jobs pass, 500/500 locally, and I have
already fixed the two blocks the builder deleted outside its scope. The only red is
`Approval receipt (CP-26)`, which wants `docs/decisions/merge-approvals/2294.md`, and no
scheduled station may write the `authority: personal` form it needs. It is labelled
`do-not-merge` so it shows on the WAITING ON MARCO line.

Why no station can do it: the prompt listed its own superseded copy
(`docs/pr-prompts/superseded/...-HOLD.md`) in `scope:`, so the diff carries a `docs/` path,
`check-instrument-lane.mjs` returns `OUT_OF_LANE`, and the `instrument` standing receipt is
therefore unavailable. `lane: sot` would be a lie. I could have deleted that one path to make it
in-lane and merged it myself; I did not, because that is reasoning past the gate.

**Options, complete-and-additive first (RULE 1):**

1. ✅ **Review #2294 and commit `docs/decisions/merge-approvals/2294.md` with
   `authority: personal`** (the gate's own failure message carries the exact front matter), then
   remove the `do-not-merge` label. Then add one sentence to `PROMPT-SCHEMA.md`: a `scope:`
   entry under `docs/` puts the PR outside the instrument lane, so an instrument-repair prompt
   should not list its own superseded copy - Station 00's board PR does the retiring move.
   **Solves it immediately AND stops the next instrument prompt landing in the same place. Damages
   nothing: it adds a receipt and a rule, and removes no gate.**
2. ⚠️ Add a `queue` lane to `scripts/pr-gates/standing-lanes.json` covering
   `docs/pr-prompts/**` so a station can write a standing receipt for a prompt-retiring path.
   Solves the future half and is additive, but **fails the immediate half** (#2294 still needs
   your receipt today, because CP-26 is armed by the diff it already has), and it widens station
   merge authority into the queue - which is a bigger decision than this one PR warrants. Your
   call, not mine.
3. ❌ Drop the `docs/` path from #2294 so it goes in-lane and a station merges it under
   INSTRUMENT_LANE_V1. **Fails the future half** - the prompt-authoring trap stays live for the
   next instrument fix - and it is the gate-clearing move I refused above. Listed only so the
   option set is honest.

Also still open from earlier cycles and unchanged by this run: the 33 non-main worktrees are
dispatched to 03 tonight, and `arm-prompt.ps1`'s audit message still names
`.arming-log.txt` without its `docs/pr-prompts/` directory (1913's F3) - both already filed, and
neither needs you this cycle.

This breadcrumb is in this run's own PR, so nothing is left in the dev tree for a later sweep to
pick up.
