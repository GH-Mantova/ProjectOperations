# Station 00 - Supervisor | 2026-10-09T19:13Z-2026-10-09T19:4xZ

## GROUND

```
UTC            2026-10-09 19:14
origin/main    6aaaddb8            (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 6aaaddb8      C:\ProjectOperations2
doc version    1                    (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE (1 == 1). Full read/write run.

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` succeeded on the first call
after ONE keyword `ToolSearch` for `desktop-commander` (PID 24152, and a second shell PID 17124).
Not blind.

**Git guard.** [MEASURED] `bash /sessions/<id>/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh`
captured into a variable, exit read from `$?` of the script itself and NOT of a pipeline:
`GUARD_EXIT=2`. Last line: `   PATH="/sessions/jolly-keen-noether/.local/bin:$PATH" git <args>`.
Exit 2 = INSTALLED BUT INERT, the expected station outcome. A FINDING, not a stop. The device-bridge
git ban is therefore REMEMBERED, not mechanical, for this run - and I ran no `git` from the VM side.
First attempt piped the run into `tail` and reported `EXIT=0`; that was the pipeline's exit, exactly
the trap the station contract names. Re-measured without the pipe.

**Binding reads.** [MEASURED] all three read from `git show origin/main:<path>` in the DEV TREE after
`git fetch origin`, written to `%TEMP%\sup00\` and read with Desktop Commander: `station.md` 32883 B,
`doctrine.md` 30719 B (508 lines, read in full), `caps.md` 54828 B (740 lines, read in full). No
piped `hash-object` comparison was made (DOCTRINE 9.2 - unsound in powershell.exe).

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, generated 2026-10-09 19:15:00Z.
Section 0 positive controls both `[LIVE]` PASS (`gh` reached GitHub, saw merged #2292; `node` runs).
No `[BROKEN]`.
- `[LIVE] OPEN PRs: 0` - `[LIVE] WAITING ON MARCO: 0` - `[LIVE] ALL OPEN (non-draft): 0`
- `[LIVE] main CI on 6aaaddb8: 4 success / 0 failed / 0 running (trunk green)`
- `[LIVE] watcher node: RUNNING pid 8848`, auto-restart wrapper alive (1), heartbeat age 169 min
  (ticks only mid-run; stale + empty queue = idle, NOT wedged), clone `branch=main tracked-dirty=0
  untracked=3`.
- `[LIVE] non-main worktrees found: 33`, classified as orphaned-with-unpushed-commits in volume.
- **[CANNOT MEASURE] the sweep's closing SAFE / CAUTION / DO-NOT-ACT verdict.** Section 5's PR crawl
  had not finished when my reading budget ran out, for the FIFTH consecutive occurrence
  (14:27Z, 15:27Z, 16:14Z, 17:14Z, and this run). I quote no sweep verdict. See F1.

**Board re-measured immediately before mutating.** [MEASURED]
`gh pr list --state open --limit 20 --json number,title,updatedAt` -> `[]`.
`.git/index.lock` absent; no `MERGE_HEAD` / `rebase-merge` / `CHERRY_PICK_HEAD`; `Get-Process git`
count 0; no `*in-progress*` file in the queue.

**Dev tree state.** [MEASURED] `git diff --cached --name-status` EMPTY; `git diff --numstat` EMPTY;
`git rev-list --left-right --count HEAD...origin/main` -> `0	0`; `git status --porcelain` shows only
`??` untracked entries (`.codex/`, `AGENTS.md`, `Claude Design/**`, `docs/pr-reviews/pr-*.md`) and no
tracked modification. Both root breadcrumbs from the previous cycles are TRACKED
(`git ls-files` finds 1815 and 1830), so no untracked file is sitting at a path a fast-forward must
create. The FF cure was NOT needed this run.

**COLLECT - breadcrumb freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`,
exit **0**, verdict `CLEAN`:
```
structure: 2 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-10-09T18:30:00Z   0.8h ago  (cadence 1h + grace 0.5h)   ok
  02  dispatch-only - no cadence to miss
  03  last 2026-10-08T23:06:00Z  20.2h ago  (cadence 24h + grace 3h)    ok
  04  last 2026-10-09T18:10:00Z   1.1h ago  (cadence 4h + grace 1h)     ok
  05  last 2026-10-09T14:22:00Z   4.9h ago  (cadence 24h + grace 3h)    ok
```
`breadcrumb-clean` is quoted here because `check-breadcrumb.mjs` was actually run and exited 0.

**COLLECT - freshness crossed against `lastRunAt`.** [MEASURED] scheduled-tasks MCP:

| station | cron | lastRunAt | newest breadcrumb | reading |
|---|---|---|---|---|
| 00-supervisor | `5 * * * *` (jitter 532 s) | 2026-10-09T19:13:59Z (this run) | 18:30 | both fresh and aligned - healthy |
| 03-machine-minder | `0 9 * * *` | 2026-10-08T23:06:07Z | 2026-10-08 23:06 | aligned; next 23:02Z - healthy |
| 04-scanner | `0 */4 * * *` | 2026-10-09T18:09:38Z | 18:10 | aligned - healthy |
| 05-sot-keeper | `10 0 * * *` | 2026-10-09T14:22:42Z | 14:22 | aligned - healthy |
| weekly-security-audit | `30 7 * * 1` | 2026-09-06T21:32:44Z | n/a | `enabled: false`, unchanged, already Marco's |

No station is MISSED, so no MISSED classification was needed and no scheduled task was touched.

**COLLECT - what was waiting.** [MEASURED] `Get-ChildItem docs\pr-prompts\00-*.md` at depth 1 returns
exactly two files, both mine: the 1815 and 1830 breadcrumbs. Nothing from 03, 04 or 05 is awaiting
collection - 04's 18:10 report was collected and archived by #2292. Every finding in 1815 and 1830
already carries a disposition, so both are archived in this run's PR.

**Queue census.** [MEASURED] `git ls-files 'docs/pr-prompts/*-ready.md'` returns **nothing at depth 1**
(every hit is under `processed/` or `superseded/`), and `Get-ChildItem docs\pr-prompts\*-ready.md`
returned nothing before arming - so nothing was armed when this run began (DOCTRINE 9.2: a
gitignored `*-ready.md` never shows as `??`, so `Test-Path` is the instrument, not `git status`).
Depth-1 tracked `*-HOLD.md`: **14**. `needs-marco/`: **52** files.

**Every depth-1 HOLD linted.** [MEASURED] `node scripts/pipeline/lint-prompt.mjs <file>` on all 14.
Exactly **one** ADMIT:

| verdict | prompt | reason |
|---|---|---|
| **ADMIT** | `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` | size 3 |
| REJECT | `pr-524-rates-b-slice2-canonical` | HUMAN_GATE_PRESENT (line 3 `DO NOT ARM`) |
| REJECT | `pr-nav-jobs-projects-merge` | HUMAN_GATE_PRESENT (`<!-- watcher: do-not-arm -->`) |
| REJECT | `pr-queue-layout-sot-entry` | HUMAN_GATE_PRESENT |
| REJECT | `pr-retire-tenderclientnote-s2` | HUMAN_GATE_PRESENT (line 4 `DO NOT ARM`) |
| REJECT | `pr-scopecards-s8b-azure-maps-travel` | HUMAN_GATE_PRESENT |
| REJECT | `pr-sec-a2-email-codes-and-reset-links` | HUMAN_GATE_PRESENT |
| REJECT | `pr-siteid-notnull-backfill` | HUMAN_GATE_PRESENT |
| REJECT | `pr-vendor-invoice-ocr` | HUMAN_GATE_PRESENT |
| REJECT | `pr-fv2-ai-digests` | FILE_GATE_NOT_RELEASED (`ai-form-import.service.ts` not on main) |
| REJECT | `pr-fv2-output-channels` | FILE_GATE_NOT_RELEASED (`form-digests.service.ts` not on main) |
| REJECT | `pr-rates-s11c-drop-legacy-tables` | FILE_GATE_NOT_RELEASED (Marco approval file absent) |
| REJECT | `pr-tenant-mt4-s2-ownership-migration` | FILE_GATE_NOT_RELEASED (Marco approval file absent) |
| REJECT | `pr-tipid-s3-retire-the-name-guard-for-an-id-check` | GATE_NOT_RELEASED (`BACKFILL_UNMATCHED_ZERO` needle absent) |

⚠️ **The table above is read from each run's quoted verdict LINE, not from the summary classifier I
wrote in the same loop.** [MEASURED] that classifier was `if ($o -match 'ADMIT') {'ADMIT'}` against
the whole captured output, and `lint-prompt.mjs` prints both words in its own legend - so it labelled
six REJECTs as `ADMIT`, including all four FILE_GATE_NOT_RELEASED prompts. A reader who trusted my
summary column would have armed a prompt whose gate is not released. The verdicts in the table are
the ones `lint-prompt.mjs` itself printed, and `arm-prompt.ps1` re-ran the lint on the one prompt I
armed and printed `ADMIT` independently. Third occurrence this day of a filter I wrote myself
returning a confident wrong reading (see the 1014 and 1313 breadcrumbs).

**Premise of the armed prompt, executed.** [MEASURED]
`(Select-String -Path scripts\pipeline\status-sweep.ps1 -Pattern 'SkipSection5' -SimpleMatch).Count`
-> **0**, against POSITIVE control `'STATUS SWEEP'` -> **2** on the same file (so the reader works and
the zero is a real absence, not a broken probe - DOCTRINE 9.6). `Test-Path
scripts\pipeline\__tests__\status-sweep-section5.test.mjs` -> **False**. The premise
`! grep -q "SkipSection5" scripts/pipeline/status-sweep.ps1` is LIVE and the work is not shipped.

**NEVER_LIST_BEFORE_ARMING_V1, checked before arming.** [MEASURED] `scripts/pipeline/instrument-lane.json`
`files[]` contains `scripts/pipeline/status-sweep.ps1` as its FIRST entry, and `tests[]` is
`scripts/pipeline/__tests__/**`. So the two code paths in this prompt's scope are **IN the lane**, not
on the NEVER-LIST (which is `pipeline-lib.ps1`, `arm-prompt.ps1`, `new-worktree.ps1`,
`retire-escalation.mjs`, `dispatch.mjs`, `scripts/pr-watcher/**`, `scripts/pr-gates/**`, `.github/**`,
`docs/**`, `sot/**`, `apps/**`, `prisma/**`, and `instrument-lane.json` itself). See F2 for the
consequence of its THIRD scope path.

**MARCO_QUEUE_LINE_V1.** [MEASURED] at arming time, from the 19:15:00Z sweep:
`WAITING ON MARCO: 0` and `ALL OPEN (non-draft): 0`. I armed one prompt against an empty queue.

**Board lease.** [MEASURED] `Enter-BoardLease -Actor 'station-00.scheduled'` returned
`LEASE_RETURN=[True]` - the RETURN VALUE is the reading, not `$LASTEXITCODE`. `$env:PO_ACTOR` was set
to the same string before `arm-prompt.ps1`, and `-Actor` passed explicitly, so the script could not
fall back to a generated `pwsh-<pid>` actor and refuse itself.

**Arming audit line.** [MEASURED] `arm-prompt.ps1` printed `Audit line written to .arming-log.txt`.
`Test-Path C:\ProjectOperations2\.arming-log.txt` -> **False**, and a two-deep recursive search of
`C:\` for that name returned nothing. The line is in fact at
`docs/pr-prompts/.arming-log.txt` (`$armLog = "$REPO_ROOT\docs\pr-prompts\.arming-log.txt"`,
arm-prompt.ps1:669) and the write SUCCEEDED:
`2026-10-09T19:17:32Z  ARMED  pr-sweep-section5-dedupe-and-fast-switch  escalates=false  actor=station-00.scheduled  by=Marco@LAPTOP-E6NHU4E4  pid=42940  caller=powershell.exe:17124`.
My root-path check was the broken instrument, not the script. See F3.

## WHAT CHANGED

**1. Armed `pr-sweep-section5-dedupe-and-fast-switch`.** [MEASURED] via
`scripts/pipeline/arm-prompt.ps1 -Name pr-sweep-section5-dedupe-and-fast-switch -Actor station-00.scheduled`,
`ARM_EXIT=0`, output `SUCCESS: ...-HOLD.md -> ...-ready.md` and
`Index contains exactly the two expected paths` then `ARM_INDEX_RELEASED`.

Read back, after the fact, with `Test-Path` rather than `git status` (9.2):

| probe | reading |
|---|---|
| `Test-Path docs\pr-prompts\pr-sweep-section5-dedupe-and-fast-switch-ready.md` | **True** |
| `(Get-Item ...-ready.md).Length` | **6245** bytes |
| `Test-Path ...-HOLD.md` | **False** (gone, as a `git mv` should leave it) |
| NEGATIVE control `Test-Path docs\pr-prompts\pr-no-such-prompt-ready.md` | **False** |
| `git diff --cached --name-status` after the release | EMPTY |

The board lease is deliberately left HELD: `arm-prompt.ps1` keeps it so the gap between the arm and
the watcher's next heartbeat stays covered, and it expires on its own after 30 minutes.

**2. This breadcrumb, and the archiving of the two collected ones** - in this run's own PR worktree
`C:\PR-Master\worktrees\sup-1913` off `origin/main` 6aaaddb8, branch
`docs/board-collect-2026-10-09-1913`. Cure 1: nothing is left in the dev tree to block the next
fast-forward.

Nothing else changed. No merge (the board was empty), no label touched, no `needs-marco/` file
retired, no scheduled task touched, no `/sot/` edit, no worktree pruned.

## FINDINGS

### F1 - The sweep's safe-to-act verdict has now been unreachable for five consecutive occurrences, and the fix is armed

[MEASURED] this run is the fifth hourly occurrence (after 14:27Z, 15:27Z, 16:14Z, 17:14Z) in which
section 5's PR crawl did not finish inside the run, so the closing SAFE / CAUTION / DO-NOT-ACT line
was never reached. Every station is told to obey that verdict; a verdict no caller reaches is a gate
not in force. The cause is section 5's shape: it asks `gh pr view <n>` once per OCCURRENCE of a PR
number inside `needs-marco/`, not once per distinct number - 383 occurrences against 153 distinct
numbers across 52 files, measured at 16:29Z, i.e. roughly 230 redundant round trips per run.

This cycle I did not re-measure the crawl or attempt a hand-rolled dedupe: the repair is a prompt
that now exists and lints ADMIT, and hand-rolling the same de-duplication inside a station run is
exactly the "do not hand-roll board operations" failure. I armed it instead.

**ACTIONED** - `pr-sweep-section5-dedupe-and-fast-switch` armed at 19:17:32Z, verified `-ready.md`
on disk at 6245 bytes with the `-HOLD.md` gone and a negative control returning False. The watcher
builds it; the next run drives the PR.

### F2 - The armed prompt's scope carries a `docs/` path, so its PR will probably need Marco even though its code paths are in the instrument lane

[MEASURED] the prompt's `scope:` is three paths - `scripts/pipeline/status-sweep.ps1` (first entry in
`instrument-lane.json`'s `files[]`), `scripts/pipeline/__tests__/status-sweep-section5.test.mjs`
(matches its `tests[]` glob), and
`docs/pr-prompts/superseded/pr-sweep-section5-dedupe-and-fast-switch-HOLD.md`. [INFERRED] if the
builder honours that third path, the diff contains a `docs/` path; `docs/**` is on the instrument
lane's NEVER-LIST, so `check-instrument-lane.mjs` will not report `IN_LANE`. CP-26 is armed by the
diff and `status-sweep.ps1` sits outside `tests|docs`, so a receipt is required; `standing-lanes.json`
holds only `sot` and `instrument`, and the `instrument` lane requires every non-receipt diff path to
be in `instrument-lane.json`. A `docs/` path fails that, and no scheduled station may write
`authority: personal`. **So the likely outcome is: PR green, out of lane, waiting on Marco.**

The other branch is live too: if the watcher instead consumes the prompt into the gitignored
`processed/`, the diff is the two in-lane paths only, `IN_LANE` holds, and I may merge it under
INSTRUMENT_LANE_V1 with a standing `instrument` receipt. **Which branch happened is not guessable and
must not be guessed** - the next run reads `check-instrument-lane.mjs` against the PR's actual current
head and lets that decide. Arming was still right: the build is not wasted either way, and this
prompt repairs the gate this station has failed to quote five times.

**DEFERRED** - to the next occurrence, which will have a PR number to measure. If it is out of lane,
label it `do-not-merge` so the WAITING ON MARCO line counts it, and say in that breadcrumb that it
needs Marco's release. What would make this urgent: the PR going green and sitting unlabelled, which
would leave an out-of-lane PR looking merge-ready.

### F3 - `arm-prompt.ps1`'s audit message names the file without its directory, and a station checking the repo root concludes the audit silently failed

[MEASURED] the script prints `Audit line written to .arming-log.txt` (arm-prompt.ps1:712) while
writing to `$REPO_ROOT\docs\pr-prompts\.arming-log.txt` (line 669). I read the message literally,
tested `C:\ProjectOperations2\.arming-log.txt` -> False, searched `C:\` two deep -> nothing, and was
one step from reporting a silent no-op in the arming audit trail. The line was there all along. The
same bare filename appears in the `-Force` waiver message at line 431.

This is a message defect, not a behaviour defect: nothing is lost and the audit works. But it is
DOCTRINE 7 shaped - a confident, coherent, wrong negative produced by a correct-looking probe - and
`arm-prompt.ps1` is on the instrument lane's NEVER-LIST, so a one-word fix there needs Marco anyway
and is not worth his queue on its own.

**DEFERRED** - fold the path into both messages (`docs/pr-prompts/.arming-log.txt`) the next time an
`arm-prompt.ps1` change goes to Marco for another reason. What would make it urgent: a station acting
on the false negative - e.g. concluding the arm was unaudited and re-arming, or reporting a phantom
instrument failure to Marco.

### F4 - Thirty-three non-main worktrees, most holding unpushed commits, and the census is growing

[MEASURED] the 19:15:00Z sweep classified `non-main worktrees found: 33`, and nearly every one is
tagged `orphaned worktree (aborted run leftover - investigate/prune)` with a
`HOLDS <n> COMMIT(S) ON NO REMOTE BRANCH` warning: `C:/po-wt/fv2drop` 21 commits (age 22235 min),
`C:/po-wt/s8h` 16 (21536 min), `C:/po-wt/rcpt-2183` 15 (10878 min), `C:/po-worktrees/sup-cwd-paths`
4 commits **plus 2 uncommitted files** (22300 min), and roughly two dozen more in the 1-6 commit
range. The sweep's own note says a squash-merged branch also shows here, so "orphaned" is not
"unmerged" - each one needs `gh pr list --head <branch> --state merged` before anyone prunes it.

Worktree hygiene is Station 03's lane and the sweep is explicit that `git worktree remove` would
refuse the dirty one while `--force` would discard real work. I did not touch any of them.

**DISPATCHED** to **03 Machine-minder** (next occurrence 2026-10-09T23:02Z): classify all 33 by
asking the board per branch, prune only the ones proven squash-merged, and preserve
`C:/po-worktrees/sup-cwd-paths`' two uncommitted files before doing anything to it. Report the
surviving census so the next 00 can see whether it is growing or shrinking.

### F5 - The git guard reported INERT again, so the device-bridge git ban held only because I remembered it

[MEASURED] `GUARD_EXIT=2`, `vm-git-guard INSTALLED BUT INERT`. Expected, documented, and not a stop.
Recorded because the station contract asks for the exit code of every run: the ban on running `git`
from the VM side against the Windows `.git` was a remembered rule this run, not a mechanical one, and
DOCTRINE 9.2 records that remembered version failing seven times. I ran no VM-side `git`.

**DEFERRED** - no action. The installer writes its `PATH` export into `~/.bashrc` and `~/.profile`
and a station's shell is non-interactive and non-login, so exit 2 is structural, not a regression.
What would make it urgent: a run that needs VM-side `git` at all, which would mean reaching for the
one-call `PATH=...` form rather than relying on memory.

## WHAT I DID NOT DO

- **Did not merge anything.** [MEASURED] 0 open PRs. `Assert-SmokedOrEscalate` / `Merge-Pr` were not
  called because there was nothing to call them on.
- **Did not quote a sweep verdict.** Section 5 did not finish (F1). I state that rather than
  substituting an inference, and no claim in this report rests on a safe-to-act verdict.
- **Did not triage `needs-marco/` for `[STALE]` rows.** That pass lives in the sweep section that
  does not finish; re-asking 153 distinct PR numbers by hand is the same cost the armed fix removes.
  No escalation was retired and none was re-surfaced to Marco. Next run, after the fix lands.
- **Did not touch the 33 worktrees** - 03's lane (F4), and pruning the dirty one risks real work.
- **Did not arm a second prompt.** Only one HOLD linted ADMIT; the other 13 are gated, nine of them
  by a human marker that is Marco's to clear.
- **Did not release the board lease.** `arm-prompt.ps1` holds it deliberately until it expires.
- **Did not enable, disable, run, re-run or edit any scheduled task.** No station read MISSED, and
  DOCTRINE 7 forbids it on a freshness reading alone in any case.
- **Did not touch `/sot/`**, Azure / Entra / SharePoint, or production data.
- **Did not investigate `.codex/` or `AGENTS.md`**, untracked in the dev tree and visible in
  `git status`. Station 04 mapped that layer at 06:1xZ today (CODEX_LAYER_MAPPED_V1) and the two open
  questions behind it are Marco's, already filed. Nothing to add.

## FOR MARCO

Nothing new needs you this cycle. Two things are heading your way:

1. **`pr-sweep-section5-dedupe-and-fast-switch` is armed** (F1). It repairs
   `status-sweep.ps1`, whose safe-to-act verdict has now been unreachable inside five consecutive
   station runs. If the resulting PR lands a `docs/` path in its diff it will be out of the
   instrument lane and will need your release (F2) - the next run will tell you which, with the PR
   number.
2. **Thirty-three worktrees, most with unpushed commits** (F4), dispatched to 03 tonight. If 03
   cannot prove a branch was squash-merged it will leave the worktree alone, so the census may stay
   large until you say whether anything in `C:/po-wt/fv2drop` (21 commits, 15 days old) or
   `C:/po-worktrees/sup-cwd-paths` (4 commits + 2 uncommitted files, 15 days old) is worth keeping.
   That is a keep-or-discard call on real work, so it is yours, not 03's.
