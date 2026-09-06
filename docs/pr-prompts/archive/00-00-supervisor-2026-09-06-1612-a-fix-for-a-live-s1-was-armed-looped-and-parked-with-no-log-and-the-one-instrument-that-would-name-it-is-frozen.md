# Station 00 - Supervisor | 2026-09-06T16:12:38Z-2026-09-06T16:35Z

## GROUND

```
UTC            2026-09-06T16:12:38Z
origin/main    494b86c9            (git fetch --prune origin, then git rev-parse origin/main)
dev tree       main @ 494b86c9     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Versions AGREE - this run is not read-only.

SIGHTED. `start_process` shell `powershell.exe` returned a live Windows shell (pid 15936) on the
first attempt. This was **not** a blind run: every `[MEASURED]` line below came from Desktop
Commander against `C:\ProjectOperations2`, `C:\po-watcher` and `gh`.

Device-bridge git guard, per PREFLIGHT step 1, last line quoted verbatim:

```
vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths, allows everything
else (both controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

Freshness of the three binding documents, the sound form (PREFLIGHT step 2, no piped hash):
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` -> **EMPTY**. The working copies I read ARE `origin/main`'s.
All three read in full.

## WHAT I MEASURED

### COLLECT - one breadcrumb since my last run, and it is my own

`node scripts/pipeline/check-breadcrumb.mjs --freshness` -> exit **0**, `CLEAN`,
`structure: 1 checked, 0 malformed`. Freshness table: `00` 1.1h ago ok - `03` 17.2h ago ok -
`04` 2.0h ago ok - `05` 2.0h ago ok. [MEASURED]

Crossed against the queue root: `Get-ChildItem docs\pr-prompts -Filter '00-*.md'` returns exactly
**1** file, the 15:08Z supervisor breadcrumb, and nothing from 03/04/05 has been written since. 04's
newest (14:10Z) and 05's (14:11Z) both predate the 15:08Z collect and were dispositioned there;
03's newest is 2026-09-05T23:01Z, likewise already collected. [MEASURED]

The 15:08Z breadcrumb is fully dispositioned - F1 ACTIONED, F2 ACTIONED, F3 DISPATCHED->03,
F4 ESCALATED, F5 DEFERRED, F6 ACTIONED, F7 DEFERRED - and it is TRACKED
(`git ls-files --error-unmatch` exit **0**; negative control on a minted path exit **1**). It is
therefore archived in this run's PR.

Caveat on `--freshness`, carried not re-derived: `check-breadcrumb.mjs`'s own `CADENCE` map still
reads `'00': 2` against a live cron of `5 * * * *`, so a green `ok` for **00** is a weaker statement
than for any other station (STATION-CAPABILITIES section 6). Cross-checked against the board here
rather than trusted alone.

### The board at 16:2xZ - 3 open, all three are Marco's, none is mine to merge

`scripts/pipeline/status-sweep.ps1` (captured to a FILE, because it returns early and hides its own
section 7 verdict), section 0 controls both `[LIVE]` PASS:

```
[LIVE] OPEN PRs: 3
[LIVE]    #1713  CLEAN    15 pass / 0 fail / 0 pending  (green)
[LIVE]    #1709  CLEAN    15 pass / 0 fail / 0 pending  (green)
[LIVE]    #1699  BLOCKED  13 pass / 2 fail / 0 pending  <-- RED
[LIVE] main CI on 494b86c9: 4 success / 0 failed / 0 running  (trunk green)
```

Section 7: **SAFE TO ACT** - no board mutation in progress, no recent remote activity, no live
station worktrees. Section 3: 0 in-progress prompts, `index.lock` False/False in both trees, 0 git
processes, no PR touched in the last 2 min. [MEASURED]

`#1713` and `#1709` read **BEHIND** at 15:08Z and read **CLEAN** now: `PR_WATCHER_AUTO_UPDATE`
rebased them under me between the two runs (my own `git fetch --prune` reported all three heads
moving: `99c32bde..e2c7bd4b`, `f6b9234d..524ef156`, `db4f6e6d..764c3f0b`). That is escalation #24
behaving exactly as recorded - **do not hand-update a BEHIND PR.** [MEASURED]

### RULE 2 - probe calibrated on the LIVE tree, and it is SILENT on all three

Tree pinned to `C:\ProjectOperations2\docs\pr-prompts\processed`, never the watcher clone
(DOCTRINE 9.5, the decoy that passes its own positive control):

```
LOGS                     = 2005
newest log (mtime)       = 2026-09-06T14:33:45Z   rev-1724-ready.md.log
POS  -Pattern 'marco.:true'                 = 617
NEG  -Pattern 'zzQq00Needle20260906T1613'   = 0        <- freshly minted, now spent
```

Freshness precondition asserted, not assumed: the newest log (14:33:45Z) is **younger** than the
oldest open PR (`#1699`, created 08:44:40Z), which is the only control that separates the live
directory from the seventeen-day-stale decoy in the clone. [MEASURED]

Per-PR discriminator, prompt logs only, `rev-*` excluded (DOCTRINE 9.5, cause (b)):
`Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'`

| PR | hits | reading |
|---|---|---|
| #1713 | 0 | no watcher verdict |
| #1709 | 0 | no watcher verdict |
| #1699 | 0 | no watcher verdict |
| #999999 | 0 | NEGATIVE control |
| **#1675** | **1** | **POSITIVE control - a PR the watcher provably opened** |
| **#1606** | **2** | **POSITIVE control** |

The positive controls pass, so `0` is a real absence and not a broken query. I did **not** use the
`watcher-launch.log` `opened PR #<n>` test, because its freshness precondition FAILS this run - see
the measurement under FINDINGS F2.

`[NO LANE VERDICT - hand-classified]` for all three, by `classifyPolicyFiles` read from the
function, not from a paraphrase. Every one of the three carries a `apps/api/prisma/migrations/`
path:

- `#1713` -> `apps/api/prisma/migrations/20260907000000_rate_line_fields/migration.sql`
- `#1709` -> `apps/api/prisma/migrations/20260906180000_tender_client_bid_status/migration.sql`
- `#1699` -> `apps/api/prisma/migrations/20260906120000_rates_value_columns_require_unit/migration.sql`

`classifyPolicyFiles` refuses any path matching `(^|/)migrations/` on its own clause, and DOCTRINE
10.1 step 3 says in terms that **no station lane covers migrations**. All three are **MARCO'S**.
Labels on all three: **none**. Auto-merge armed on all three: **False**. [MEASURED]

### #1699's red - read from the job log, both reds, one cause

`Approval receipt (CP-26)`, job `101512255634`:

```
FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #1699 was labelled do-not-merge and
released, but docs/decisions/merge-approvals/1699.md is not in this PR's diff against merge-base
with origin/main.
```

`PR gates - diff checks`, job `101512255725`, fails on the **same assertion**, every other CP
passing (`PASS - CP-25 failure-honesty` immediately above it):

```
FAIL - CP-26 do-not-merge [PR #1699 ... docs/decisions/merge-approvals/1699.md is not in this PR's
diff ...]
```

**One cause, two reds** - the CP-26 / diff-checks coupling, re-confirmed. The label timeline is
`labeled do-not-merge 09:13:09Z` -> `unlabeled 09:50:08Z`, both actor `GH-Mantova`, which is also
how every agent authenticates and therefore attributes nothing. [MEASURED]

### Machinery - alive, stable 4.4 h, and one instrument still dead

`scripts\restart-watcher-if-wedged.ps1` (report-only, the ONLY sanctioned liveness verdict):

```
armed prompts waiting: 0
watcher process:       ALIVE (pid 27236)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.
```

- node pid 27236 `CreationDate` = **2026-09-06T11:49:57Z** - alive **4.4 h**. [MEASURED]
- `ensure-watcher.log` records `watcher alive, pid(s) 27236` every 10 min from 13:15:03Z to
  16:15:03Z with no gap. [MEASURED]
- heartbeat CONTENT last line `[2026-09-06T14:33:04.236Z] rev-1724-ready.md elapsed=240s`; that job
  was filed to `processed/` 41 s later at 14:33:45Z. Heartbeat ticks only mid-run, armed is 0, so
  99 min of silence is **idle**, not wedged. [MEASURED]
- clone `C:\po-watcher\ProjectOperations` HEAD = **`16ddb58b`**, branch `main`, dirty=2
  (`?? docs/pr-reviews/pr-1709-review.md`, `?? docs/pr-reviews/pr-1713-review.md`).
  `origin/main` is `494b86c9`. **Unchanged since the 12:08Z run first raised it.** [MEASURED]

Armed count taken THREE ways and all three agree on **0**: `status-sweep` section 4,
`restart-watcher-if-wedged`, and `@(Get-ChildItem docs\pr-prompts -Filter '*-ready.md').Count`.
Dev tree `git diff --numstat` EMPTY and `git diff --cached --name-status` EMPTY before I touched
anything. [MEASURED]

## WHAT CHANGED

1. **`needs-marco/WATCHER-CRASH-LOOP-2026-09-06-200907.md` moved to `needs-marco/discharged/`.**
   Read back: source `Test-Path` -> **False**, destination `Test-Path` -> **True**,
   `needs-marco/` file count 30 -> **29**. Moved, never deleted. Rationale under F1.
2. **This breadcrumb**, written inside this run's own PR worktree (`C:\po-worktrees\board-1612`,
   created off `origin/main` at `494b86c9`), which is cure 1 for the post-merge fast-forward
   blocker - no loose copy is left in the dev tree, so the blocker cannot occur.
3. **The 15:08Z breadcrumb `git mv`'d to `docs/pr-prompts/archive/`** in the same PR, every finding
   in it having carried a disposition.

Nothing else. **No PR merged, no prompt armed, no label touched, no watcher restarted.**

## FINDINGS

### F1 - [S2] ACTIONED - the supervisor filed a STOP escalation six hours ago, recovered from it, and nothing could ever mark it dead

`docs/pr-prompts/needs-marco/WATCHER-CRASH-LOOP-2026-09-06-200907.md`, written by
`scripts/pr-watcher/supervise-watcher.ps1` at `2026-09-06T20:09:07+10:00` = **10:09:07Z**:

> The watcher child (start-watcher.ps1) exited non-zero **4 times in a row with the identical
> reason** ... `watchdog-kill churn: 4 kills in 20 min` ... the supervisor has stopped and is
> telling you instead.

**The condition is measurably gone.** Node pid 27236 started `11:49:57Z` - 1 h 40 m AFTER the
supervisor stopped - and has been alive 4.4 h with `restart churn: 0 cycle(s) in 20 min` and an
unbroken `watcher alive` line every ten minutes in `ensure-watcher.log`. `ensure-watcher.ps1`
relaunched what `supervise-watcher.ps1` gave up on.

**Why it could never clear itself.** `status-sweep.ps1` section 5 tags a `needs-marco/` file
`[STALE]` only by cross-checking a PR number in it against GitHub. This file names **no PR**, so it
reads `[FILE] ... (no PR ref ... read it as a SNAPSHOT)` forever. Three station runs (11:16Z,
14:10Z, 15:08Z) have now passed over it - I grepped the 15:08Z breadcrumb for `CRASH-LOOP`,
`watchdog` and `crash` and all three return **0** - and it would have gone on telling every future
reader "the watcher is in a crash loop and the supervisor has STOPPED" while the watcher was
healthy. That is the false-alarm shape my own station doc says licenses destructive action: the
next reader's obvious move is to restart a watcher that has been stable for four hours.

**ACTIONED.** Moved to `needs-marco/discharged/` with the measurements above, never deleted, so the
record survives and the alarm does not. The move is inside `docs/pr-prompts/`, which is this
station's lane; the folder is gitignored (`.gitignore:76-83`), so this is a filesystem change and
does **not** appear in this PR's diff - which is why it is written down here.

**Falsifying probe:** `restart-watcher-if-wedged.ps1` restart-churn count. If it ever returns >0
again, the loop is back and this discharge was premature.

**One thing the escalation itself gets wrong, carried for 03, not fixed here:** its step 3 sends the
reader to `scripts/pr-watcher/logs/supervisor.log`. That file's newest line is
`[2026-08-17T17:06:19]` - **twenty days stale**. It is not the log the running supervisor writes.
A reader following the escalation's own instructions finds a healthy-looking twenty-day-old file.

### F2 - [S2] DISPATCHED -> Station 03 - a fix for a live S1 was armed, looped, and parked with NO log, and the one instrument that would name what killed it is frozen

This is the most important thing on the board this run.

`.arming-log.txt` (60 lines) records three arms this morning, then nothing since:

```
2026-09-06T08:17:13Z ARMED pr-scopesub-s6-the-bars-provisional-split      actor=station-00-scheduled-0808Z
2026-09-06T08:22:53Z ARMED pr-jobroles-s1-noaccess-instead-of-a-dead-shell actor=marco-delegated
2026-09-06T09:20:50Z ARMED pr-watcher-verdict-home-resolver               actor=station-00-scheduled-0908Z
```

Where each one went [MEASURED], searching `processed/`, `no-pr-opened/`, `failed/`, `blocked/` and
the queue root:

| prompt | outcome | log |
|---|---|---|
| `pr-scopesub-s6-...` | `processed/` | `.log` present |
| `pr-jobroles-s1-...` | `processed/` | `.log` present |
| **`pr-watcher-verdict-home-resolver`** | **`-LOOPING.md` in the QUEUE ROOT** | **NONE, anywhere** |

A recursive `Get-ChildItem docs\pr-prompts -Recurse -Filter '*verdict-home-resolver*'` returns
**exactly one** file: the `-LOOPING.md` itself. No `processed/`, no `no-pr-opened/`, no `failed/`
entry. The prompt ran, ran again, was renamed by the LOOPING cure so it could not run a third time,
and left **no record of what happened in either run**.

**What was parked.** That prompt's `scope:` is `scripts/pr-watcher/index.mjs` and its premise is
`! grep -q "VERDICT_HOME_RESOLVER_V1" scripts/pr-watcher/index.mjs`. It is the fix for the
verdict-mirror defect that DOCTRINE 9.5 now carries as a live S1: `verdict mirror skipped` appears
**68** times in `watcher-launch.log` against the positive control `verdict mirrored to PR` = 262,
twelve of them on 2026-09-05 alone, and every one was then filed `[ok] -> processed/` - a
produced-and-discarded verdict recorded as a successful review job. Because `verdictApproves` reads
that same single path, a verdict landing in another home cannot release the `tests-docs` lane, and
the PR times out into `{"ok":false,"marco":true,...}` which RULE 2 then correctly forbids any
station from clearing. **The fix for that is now parked with no owner and no plan.**

**The defect is reproducing right now, on this board.** The clone is dirty with exactly two
untracked files - `docs/pr-reviews/pr-1709-review.md` and `pr-1713-review.md` - i.e. the review
verdicts for the two green open PRs exist in the clone and nowhere else, which is the same
wrong-home symptom the parked prompt exists to remove.

**The causal link to F1 is [INFERRED], and saying so is the finding.** The third arm is at
09:20:50Z; the supervisor records `4 kills in 20 min` and stops at 10:09:07Z; the watchdog fires on
`heartbeat stale > 15 min while armed>0 and 0 in-progress` (quoted from `supervisor.log`'s own
`WATCHDOG started` line), and `armed>0` was true only because of those three arms. That composes
into a coherent story - the watchdog repeatedly killed this prompt's run, the prompt looped, and
the supervisor gave up - **and I cannot measure it**, because the instrument that would name which
prompt was killed is `watcher-launch.log`, whose `LastWriteTimeUtc` is **2026-09-06T05:27:31Z**
against a node `StartTime` of `11:49:57Z`. It has recorded nothing for 10.8 h. [MEASURED]

That is a **new kind of cost** for 04's F1 / the 15:08Z run's F3(a). Every previous instance was the
frozen log giving a *stale* answer. This one is the frozen log having **destroyed the only evidence
of a real incident**, and there is no second transport that can recover it.

**DISPATCHED -> Station 03**, folded into the existing F3 dispatch rather than filed separately, as
one piece of work with an explicit ORDER:

1. Unfreeze `watcher-launch.log` (F3(a), unchanged: diagnose whether `Start-Transcript -Append
   -Force` is throwing with a prior wrapper still holding the handle, and give the wrapper a log
   path that cannot silently vanish). **This comes first now** - without it, the next kill is
   equally unattributable.
2. Fast-forward the clone from `16ddb58b` to `origin/main`, dealing with its two untracked
   `docs/pr-reviews/` files first (`stash drop`, **never `pop`**), then restart in an idle window,
   then leave exactly one supervisor family. A `git` write in `C:\po-watcher\ProjectOperations` is
   an absolute hard stop for this station - I may not do it.
3. Only then may `pr-watcher-verdict-home-resolver-LOOPING.md` be re-armed. **Do not re-arm it
   before 1 and 2**: the watcher would build it with the same code, under the same watchdog, that
   just killed it twice.

**03 does not run until `2026-09-06T23:00:45Z`**, so this sits 6.75 h more. That is the **seventh**
measured cost of the open 03-cadence question (bootstrap says 4 h, live cron says daily) and of the
open "who may fast-forward the watcher clone" question. Both are already with Marco - cited, not
re-raised.

### F3 - [S2] ESCALATED (already on file; cited, not re-filed) - #1699 is red on a receipt no agent may write

`#1699` fails `RELEASED_NO_RECEIPT`, quoted verbatim under WHAT I MEASURED, and the second red is
the same assertion reached through `pr-gates.mjs`. The cure named by the gate itself is to commit
`docs/decisions/merge-approvals/1699.md` on the PR branch. **No agent may author an approval
receipt** - a receipt an agent writes attests to a release decision no agent made, and that is the
standing rule that survived escalation #20. So this PR cannot go green without Marco, and it could
not be merged by me even if it did, because it carries a `prisma/migrations/` path.

Already on file as `needs-marco/cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md`
and `#1635`. **Cited, not re-filed.** The one thing worth adding: `#1721` made a label event re-run
CI, so **a colour change on `#1699` is not a clearance** - only a receipt is.

### F4 - [S3] DEFERRED - `C:\po-vg` still holds one uncommitted file, 56 h old

`status-sweep` section 2, `[LIVE]`: `C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]`,
`dirty=1 files  age=3377 min`, with the sweep's own warning that `git worktree remove` will refuse
and `--force` would discard it. Unchanged from the 15:08Z run, which also deferred it.

**DEFERRED.** It becomes urgent the moment anyone prunes worktrees in bulk, and the cheap
protection is that the sweep prints the warning every run. What would change this: a decision on
whether `fix/no-rebase-while-checks-run` is still wanted, which is upstream of me.

### F5 - [S3] ACTIONED as a measurement - the duplicate-prompt exposure still has not fired

`.arming-log.txt` is unchanged since `09:20:50Z`; armed is **0** by three independent instruments;
so no armed prompt can currently duplicate an open second-lane PR. DOCTRINE 10.6's exposure - a
second-lane PR does not consume the prompt that describes the same work, and the premise dies on
MERGE not on OPEN - remains real and remains unfired. **Re-measure, never quote.**

## WHAT I DID NOT DO

- **I armed nothing, deliberately, and this is a decision rather than an omission.** Three reasons,
  and the first alone is sufficient: the watcher would build any prompt I arm using the clone at
  `16ddb58b`, nine-plus commits behind `origin/main`, so both watcher fixes merged today are still
  not in the code that would run it; the last prompt armed into exactly this state
  (`pr-watcher-verdict-home-resolver`, 09:20:50Z) was killed, looped, parked and left no log, and
  nothing about the watcher has changed since; and the board's throughput constraint is Marco, not
  arming rate - all three open PRs are his, so arming makes the queue longer, not shorter.
  **The trigger that changes this: 03 completes F2 steps 1 and 2** (transcript unfrozen, clone
  fast-forwarded, one supervisor family). Then arm one, and prefer a `tests/`-or-`docs/`-only
  prompt.
- **I merged nothing.** All three open PRs carry a `prisma/migrations/` path, so all three are
  Marco's under `classifyPolicyFiles`, and no station lane covers migrations.
- **I did not hand-update `#1713` or `#1709`**, though both are green and CLEAN.
  `PR_WATCHER_AUTO_UPDATE="true"` rebases BEHIND PRs on a timer; hand-updating races it, moves the
  head under a reader and cancels in-flight CI (escalation #24).
- **I did not touch the watcher clone.** `git` write in `C:\po-watcher\ProjectOperations` is an
  absolute hard stop for this station, and its two untracked review files are 03's to resolve.
- **I did not re-arm `pr-watcher-verdict-home-resolver-LOOPING.md`.** The LOOPING rename exists
  precisely so it cannot run a third time, and re-arming before F2 steps 1-2 would reproduce the
  kill with the evidence still unrecoverable.
- **I did not author an approval receipt for `#1699`.** Absolute.
- **I did not use the `watcher-launch.log` `opened PR #<n>` lane test.** Its freshness precondition
  fails: log mtime `05:27:31Z` against a node `StartTime` of `11:49:57Z` and open PRs created as
  late as `11:46:21Z`. Per DOCTRINE 9.5 that is `[CANNOT MEASURE]`, not "second lane". I used the
  `processed\pr-*.log` discriminator instead, with two passing positive controls.
- **I did not clear the other 29 `needs-marco/` files** the sweep tags `[STALE]`. That bulk
  discharge is already dispatched to 03 and doing it here would be two actors on one job. F1 is a
  single file, discharged because it is a live false alarm about the machinery, not a stale PR
  reference.
- **`/sot/`, Azure/Entra/SharePoint, production data, `docs/data-model/metadata-catalog.json`** -
  untouched. The first is 05's, the second is an absolute hard stop, the third is Marco's.
