# Station 00 — Supervisor | 2026-09-25T01:14:15Z–2026-09-25T01:47Z

## GROUND

```
UTC            2026-09-25T01:14:15Z
origin/main    1e5f3f11              (git fetch origin +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 1e5f3f11       C:\ProjectOperations2
doc version    1                     (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE. This run is READ-WRITE.

## WHAT I MEASURED

### Reachability — SIGHTED. This was not a blind run.

Desktop Commander tool schemas were loaded via `ToolSearch` first (a validation error is not
blindness). `start_process` shell `powershell.exe` returned PID 32176 with an interactive prompt;
`interact_with_process` then answered `git rev-parse --abbrev-ref HEAD` → `main` and
`git log -1` → `1e5f3f11`. [MEASURED]

⚠️ `$env:COMPUTERNAME` came back EMPTY through the first `start_process -Command` form while
`Get-Date` and `git` answered correctly — DOCTRINE §9.1's `-Command`-layer expansion, firing on the
opening call. Every subsequent statement went through `interact_with_process`, which does not
expand, and markers were echoed after each one.

### The device-bridge git guard — INSTALLED BUT INERT, the expected station outcome

`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit code read from the
INSTALLER itself and not from a pipeline appended to it:

```
GUARD_EXIT=2
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
```

Its last line, verbatim:

```
PATH="/sessions/relaxed-nifty-feynman/.local/bin:$PATH" git <args>
```

Exit 2 is the middle outcome the PREFLIGHT table names as EXPECTED for a station: a FINDING, not a
STOP. The ban is REMEMBERED, not mechanical. No `git` was run against the mount this run.

### The binding documents were read from the working copy, and that was proved sound

PREFLIGHT step 2 says read from `git show origin/main:<path>`, never the working copy. Instead of
asserting it, I measured the equivalence with the sound form (never a piped hash):

```
git rev-list --left-right --count HEAD...origin/main            -> 0	0
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md \
                                  docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md   -> EMPTY
```

EMPTY is the real answer, so the working copy is byte-equivalent to `origin/main` for all three.
Run in the DEV TREE, never the watcher clone. All three were read in full: 00-supervisor.md
(1715 lines), DOCTRINE.md (3001), STATION-CAPABILITIES.md (592). [MEASURED]

### The session mounted TWO folders, not eleven

`/sessions/<id>/mnt/` holds `ProjectOperations2`, `PR-Master`, `outputs`, `uploads` and three dot
directories — **no `po-watcher` and no `po-sup-fix-scripts`**. [MEASURED] That is not a refutation of
`STATION-CAPABILITIES.md` §3's `BLIND_RUN_OTHER_MOUNTS_V1`; it is that paragraph's own rule holding:
*"The mount list is a property of the session, not of this file — enumerate `/sessions/<id>/mnt/` at
the start of a run rather than assume."* A blind run in THIS session could not have reached the
clone log or `verdicts-archive` at all.

### The sweep — SAFE TO ACT, and captured to a file then decoded `utf16le`

`status-sweep.ps1` captured with `*>`; the file was **145,756 bytes opening `FF FE`**, i.e. UTF-16LE,
exactly the trap DOCTRINE §9.3 records for the cure PREFLIGHT step 4 prescribes. Decoded with node,
423 lines. Section 0 controls both PASS (`gh` reached GitHub, saw merged #2186; node runs). No
`[BROKEN]`. Section 7:

```
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

`index.lock` in dev tree and clone both **False**; scoped `git` processes **0**.

⚠️ **I got the `[STALE]` count wrong on my first attempt and caught it on a control.** I ran
`Select-String -Pattern '\[STALE\]' -SimpleMatch`, which searches for the LITERAL backslashes
(DOCTRINE §9.3) and returned **0**. Re-measured in node by `indexOf`: **4** occurrences, POSITIVE
control `[LIVE]` → **98**, NEGATIVE control a freshly minted needle → **0**. All four are the
sweep's own HOW-TO-READ prose and a quotation inside a `[FILE]` block — **zero live `[STALE]`
escalation rows this run**, so there is nothing for COLLECT to discharge under that heading. The
first reading would have said the same thing for the wrong reason.

### The board — four PRs, all four parked on Marco's label, and TWO carry a real extra red

`gh pr view <n> --json ... --json` + `ConvertFrom-Json` after assignment (never a `--jq` string
literal, §9.4), `-R` on every call:

| PR | merge | files | head | labels |
|---|---|---|---|---|
| #2184 | BLOCKED | 4 | `fix/s8i-travel-index-reset-and-tip-dailykm` | `do-not-merge` |
| #2183 | BLOCKED | 14 | `feat/sec-a1-auth-fail-fast` | `do-not-merge` |
| #2167 | BLOCKED | 3 | `fix/verdict-guard-spaced-path-candidates` | `do-not-merge` |
| #2158 | BLOCKED | 10 | `feat/fv2-formrule-contract-drop` | `do-not-merge` |

**DIRTY count: 0.** No PR is conflicted, so no PR has frozen CI. The board is not stuck on conflicts.

Failing checks, and the CP-26 VERDICT TOKEN read from column 3 of the job log (never the pass/fail
counts, §9.4):

| PR | not-success | CP-26 token |
|---|---|---|
| #2184 | **3** — `tendering-e2e`, CP-26, `PR gates — diff checks` | `[LABEL_PRESENT]` |
| #2183 | **3** — `tendering-e2e`, CP-26, `PR gates — diff checks` | `[LABEL_PRESENT]` |
| #2167 | 2 — CP-26, `PR gates — diff checks` | `[LABEL_PRESENT]` |
| #2158 | 2 — CP-26, `PR gates — diff checks` | `[LABEL_PRESENT]` |

All four tokens read verbatim `FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the
do-not-merge label (escalates:true). A human must review and REMOVE the label`. That is
**PARKED BY DESIGN** — two reds, one cause, no agent-side action, and `[RELEASED_NO_RECEIPT]` appears
nowhere. #2167 and #2158 are therefore fully accounted for: nothing about them is work.

**#2184 and #2183 carry a THIRD red that the label does not explain**, and it is the same one.

### The third red, read from the job log and not from the diff

`gh run view <run> --job <job> --log`, split on the tab and searched in the **last** column (§9.1 —
column 1 is the job name and matches every line otherwise). #2184's log is 3133 lines; #2183's is
comparable.

Both PRs fail the **same four tests**, in a file neither PR touches
(`tests/e2e/pr-acceptance/batch1-dashboards.spec.ts`, last modified 2026-08-17):

```
✘ 24 batch1-dashboards.spec.ts:262 › SLICE 5 — dashboard-level filter bar renders and accepts input
✘ 25 batch1-dashboards.spec.ts:350 › SLICE 7 — create dashboard from Reporting dashboard template
✘ 26 batch1-dashboards.spec.ts:398 › SLICE 4 — add a report chart widget from the gallery
✘ 27 batch1-dashboards.spec.ts:468 › SLICE 6 — Export button on a report widget triggers a download
4 failed
##[error]Process completed with exit code 1.
```

#2184's diff is 4 files about a traffic index and Tip Finder `dailyKm`. #2183's is 14 files about
refusing to boot on placeholder JWT secrets. **Neither touches dashboards.** Same four tests, same
order, two unrelated diffs.

### It is a FLAKE, and the evidence is the workflow's own history — not a re-run I hoped would pass

`gh run list --workflow 'Tendering Browser Smoke' --limit 20`:

| run | conclusion | branch | created |
|---|---|---|---|
| 36078386860 | **success** | `fix/s8i-travel-index-reset-and-tip-dailykm` | 00:37:25Z |
| 36079440566 | **failure** | `fix/s8i-...` — *same branch, same commit* | 00:51:23Z |
| 36078390259 | **success** | `feat/sec-a1-auth-fail-fast` | 00:37:28Z |
| 36079586490 | **failure** | `feat/sec-a1-...` — *same branch, same commit* | 00:53:24Z |
| 36079589983 | **success** | `feat/fv2-formrule-contract-drop` | 00:53:27Z |
| 36079444971 | **success** | `fix/verdict-guard-spaced-path-candidates` | 00:51:27Z |
| 36078718595 | **success** | **push main** | 00:41:50Z |

[MEASURED] Both branches PASSED this workflow fourteen minutes before they failed it, with no push
in between (the 00:51–00:53 batch is the re-trigger after #2186 moved `main` at 00:41Z). In that same
batch two sibling branches PASSED. `main` itself passed at 00:41Z. **A non-deterministic failure, not
a regression and not either PR's defect** — so station-doc rule 5 applies and the remedy is a re-run.

### ⚠️ The Postgres line in that log invites exactly the wrong diagnosis, and I nearly filed it

The e2e log's service-container dump carries, timed to three of the four failures:

```
2026-09-25 00:58:43.543 UTC [295] ERROR:  duplicate key value violates unique constraint "user_dashboards_user_id_slug_is_system_key"
```

My first reading was that this constraint collision WAS the cause. It is not.
`apps/api/src/modules/platform/user-dashboards.service.ts` **provokes and catches that exact error on
purpose** — its own comment reads *"@@unique([userId, slug, isSystem]) constraint. On P2002 we
re-read and…"*, and the create path returns the existing row on P2002. The Postgres ERROR line is
the server logging a collision the application handles. [MEASURED] from the source.

The actual failure text, from the same log, is a UI timing failure and nothing to do with the
constraint:

```
Error: locator.click: Test timeout of 60000ms exceeded.
Error: expect(locator).toBeVisible() failed
Error: element(s) not found
```

**[CANNOT MEASURE]** the trigger of the timing failure from the log alone. What is measured is that
it is non-deterministic and not diff-related. A benign-but-alarming DB line sitting in the most-read
log on this board is a §7 trap with a wrong diagnosis attached, which is why it is written down here
rather than left as a private correction.

### The watcher — HEALTHY by the sanctioned script, and the two-wrapper defect is reconfirmed

`scripts\restart-watcher-if-wedged.ps1` (no `-Fix`), verbatim:

```
armed prompts waiting: 1
watcher process:       ALIVE (pid 42212)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
queue last moved:      59 min ago  (rev-2185-ready.md)
heartbeat last write:  0 min ago
VERDICT: HEALTHY - no action.
```

A 0-minute heartbeat with 1 armed prompt is the watcher **building the prompt this run armed**.

ENSURE-UP, resolved by ANCESTRY and not by the command-line probe's verdict (§3b): the probe returns
`wrapper=2`, and the parent chain settles which is real —

```
NODE 42212 ANCESTRY: 44740:powershell.exe <- 1724:powershell.exe
WRAP 1724   start 2026-09-24 17:35:03   <- owns node 42212
WRAP 30116  start 2026-09-21 07:14:02   <- owns NOTHING
```

[MEASURED] Wrapper 30116 has had no node of its own since 2026-09-20 and still holds `Stop-Process`
authority over the live node. That is Station 03's F1, unchanged, already escalated to Marco as
`needs-marco/ensure-watcher-relaunches-a-second-wrapper-because-it-only-asks-about-the-node-2026-09-25.md`
by my 00:14Z run. No new action; the root cause file is outside every repo this pipeline can PR.

### The queue, counted myself

```
armed (*-ready.md)   1   pr-watcher-adopt-ancestry-and-watchdog-identity-ready.md   (armed by THIS run)
*-LOOPING.md         0
*-HOLD.md           15   (14 after this run's arm, +1 staged by this run)
needs-marco/        48
no-pr-opened/      111   newest 2026-09-22T17:25Z — nothing new since my last run
failed/             61   newest rev-2186-ready.md.log, 2026-09-25T00:43Z — a rev-* REVIEW JOB, not a prompt (§9.5)
blocked/           153
```

No new silent no-op. The newest `failed/` entry is the review job for #2186, which is the review lane
and not a build failure.

### Freshness, crossed against `lastRunAt` — the breadcrumb is one instrument and cannot name a cause

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, **exit 0**, so
`breadcrumb-clean` is quoted here on the validator's own verdict. `structure: 3 checked, 0 malformed`.

| station | newest breadcrumb | `lastRunAt` (MCP) | cron | reading |
|---|---|---|---|---|
| 00 | 2026-09-25T00:14Z (1.2 h) | 2026-09-25T01:14:15Z | `5 * * * *` | fresh `lastRunAt`, no breadcrumb yet = **this run, mid-window**. Not a defect |
| 03 | 2026-09-24T23:20Z | 2026-09-24T23:03:07Z | `0 9 * * *` | aligned; next 09-25T23:02Z |
| 04 | 2026-09-24T22:11Z | 2026-09-24T22:09:52Z | `0 */4 * * *` | aligned; next 09-25T02:09Z — **no occurrence missed** |
| 05 | 2026-09-24T14:23Z | 2026-09-24T14:22:54Z | `10 0 * * *` | aligned; next 09-25T14:22Z |

`weekly-security-audit` remains `enabled: false`, `lastRunAt 2026-09-06T21:32:44Z` — unchanged, and
consistent with `STATION-CAPABILITIES.md` §1's 2026-09-15 correction. The live ENABLED count is
**four**. No station is SILENT and no occurrence is missing, so no transcript read was needed.

### The tracked set was asked of `origin/main`, never of the dev tree

`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` (trailing slash AND `-r`, §9.2), matched
by basename: all three depth-1 breadcrumbs are **tracked on `origin/main`** — landed by #2185/#2186.
So none of them is unreported, and committing a second root copy would be the 2026-09-07 duplicate.
They are ARCHIVED by this run instead.

### The worktrees — the sweep flags an OPEN PR's tree for prune

Six non-main worktrees, each branch crossed against the board with
`gh pr list -R <owner>/<repo> --head <branch> --state all`. POSITIVE control: four branches resolved
to real PR numbers. NEGATIVE control: three resolved `NO PR`, which is a real absence (they are
watcher build trees named `wt-*`).

| worktree | branch | sweep says | board says |
|---|---|---|---|
| `C:/po-wt/s8i-fixforward` | `fix/s8i-travel-index-reset-and-tip-dailykm` | orphaned / **prune** | **#2184 OPEN** |
| `C:/po-worktrees/sup-cwd-paths` | `fix/pipeline-scripts-resolve-state-paths-from-module` | orphaned + **HOLDS UNCOMMITTED WORK** | #2154 MERGED |
| `C:/po-wt/stage-formrule-web` | `docs/stage-formrule-legacy-payload-retire` | orphaned / prune | #2176 MERGED |
| `C:/po-wt/fv2drop` | `wt-fv2-formrule-contract-drop` | orphaned / prune | NO PR |
| `C:/po-wt/s8h` | `wt-s8h` | orphaned / prune | NO PR |
| `C:/po-wt/sec-a1` | `wt-sec-a1` | orphaned / prune | NO PR |

And the "uncommitted work" the sweep says to preserve, listed before suggesting deletion as §3f
requires — `git -C C:\po-worktrees\sup-cwd-paths status --porcelain`:

```
 M docs/data-model/metadata-catalog.json
?? pr-body.md
```

The first is the pre-existing CRLF smudge on a generated file that
`UPDATE_INDEX_REFRESH_EXIT_IS_NOT_PER_FILE_V1` measured at 00:3xZ as `--numstat origin/main` EMPTY —
no local-only content. The second is a scratch PR body. **Nothing to preserve**, on a branch whose PR
merged as #2154.

The mechanism, read from the source (`scripts/pipeline/status-sweep.ps1`, anchor
`# worktree-liveness: classify each non-main worktree`): the only liveness test is
`$isLive = ($ageMinutes -ge 0 -and $ageMinutes -lt 30)` — **directory mtime**. Nothing asks whether
anything still needs the tree. The 2026-09-05 correction that made recency decide is right about what
it measures; it simply never asks the board.

### Controls run this session

- Guard installer exit read from the INSTALLER, not from a pipeline appended to it → **2**.
- Working-copy vs `origin/main` for all three binding docs: `--numstat` EMPTY, `rev-list` `0	0`.
- Sweep decoded `utf16le` after detecting the `FF FE` BOM; 423 lines recovered.
- `[STALE]` count: broken `-SimpleMatch` form **0**, sound node form **4**, POSITIVE `[LIVE]` **98**,
  NEGATIVE freshly minted needle **0**.
- Job-log grep split on tab, last column only; CP-26 token quoted verbatim from column 3.
- `--jq` string literals avoided entirely; every `gh` read is `--json` + `ConvertFrom-Json` after
  assignment, `-R` passed on every call, `$LASTEXITCODE` tested before parsing.
- Worktree branch lookup: POSITIVE 4 real PR numbers, NEGATIVE 3 `NO PR`.
- §10.6 duplicate check on both prompts: scope crossed against all four open PRs' file lists →
  **0 overlap**; POSITIVE control that the probe can see the area — #2167 touches three
  `scripts/pr-watcher/` paths and none is in either scope.
- `lint-prompt.mjs`: armed prompt **ADMIT exit 0**; new staged prompt **ADMIT exit 0**.
- `check-breadcrumb.mjs --freshness`: **CLEAN, exit 0**.
- Markers echoed after every statement in every `interact_with_process` chain; one
  `Process has finished execution` message was FALSIFIED by draining the buffer, which returned the
  full output and the chain's last marker (§9.1 —
  `FALSE_TERMINATION_IS_AN_EARLY_READ_NOT_AN_UNRUN_STATEMENT_V1`, confirmed again).

## WHAT CHANGED

1. **Re-ran the failed `tendering-e2e` jobs on #2184 and #2183.**
   `gh run rerun 36079440566 --failed` → exit **0**; `gh run rerun 36079586490 --failed` → exit **0**,
   both at 2026-09-25T01:29Z. Read back at 01:33Z and again at 01:44Z: `tendering-e2e` =
   **IN_PROGRESS** on both, and the FAILURE list on each PR is back to the two label reds only.
   ⚠️ **The e2e outcome is `[CANNOT MEASURE]` at the close of this run** — it had not finished. I am
   NOT claiming these PRs are green. The read-back the next run must perform is named in F1 below.

2. **Armed `pr-watcher-adopt-ancestry-and-watchdog-identity`** via `arm-prompt.ps1`
   (`-Actor station-00.sched0114`), after `-WhatIf` passed and after re-measuring the safe-to-act gate
   immediately before mutating (`index.lock` dev/clone **False/False**, scoped `git` processes **0**,
   watcher node 1). Exit **0**. Read back: `*-ready.md` count **1**, the `-HOLD.md` **gone**, and the
   arming log's new line:

   ```
   2026-09-25T01:29:14Z  ARMED  pr-watcher-adopt-ancestry-and-watchdog-identity  escalates=true  actor=station-00.sched0114  by=Marco@LAPTOP-E6NHU4E4  pid=42636  caller=powershell.exe:23260
   ```

   The script RELEASED the staged rename from the index itself (`ARM_INDEX_RELEASED`), so the dev
   tree's index is clean and only an unstaged ` D` of the HOLD remains — the watcher's own build PR
   retires it to `superseded/`. `.arming-log.txt` is carried in THIS PR, as DOCTRINE §9.5 requires of
   any run that arms.

3. **Staged one new prompt**, `pr-sweep-orphan-worktree-asks-the-board-HOLD.md` (`size: 2`,
   `escalates: true`, `module: pipeline`), `lint-prompt.mjs` **ADMIT exit 0**. It fixes the worktree
   classifier defect measured above. Staged rather than folded into the armed prompt on purpose: that
   prompt was already complete for 03's F2/F3/F4 and armable, and growing an armable prompt's
   `done_when` right before arming it risks a partial build (§8.2 — split when the addition is its own
   change).

4. **Archived the three dispositioned breadcrumbs** into `docs/pr-prompts/archive/` by `git mv`
   inside this PR's worktree: 03's 2026-09-24-2320, the blind run's 2026-09-24-2315, and my own
   2026-09-25-0014. Every finding in all three carries a disposition from the 00:14Z run. Safe for
   freshness — `--freshness` matches by trailing path segment (§9.5) and read `CLEAN` after the move
   was staged.

5. **Wrote this breadcrumb inside this run's PR worktree** (Cure 1), never into the dev tree, so no
   loose untracked copy exists there to block the next fast-forward.

Nothing was merged. Nothing was pruned. No label was removed. `/sot/` untouched.

⚠️ **For the next run:** after this PR merges, the dev tree will hold the three archived breadcrumbs
as tracked-and-moved paths at the ROOT, plus an unstaged ` D` of the armed prompt's `-HOLD.md`, plus
the pre-existing ` M docs/data-model/metadata-catalog.json` smudge. All three block
`git merge --ff-only`. The cure is the raw-Buffer restore in `00-supervisor.md`, and the discriminator
is to **read the NAMES `git update-index --refresh` prints, not its exit code** — the smudge is not
this run's and will make the exit code non-zero for a file nobody touched.

## FINDINGS

### F1 — #2184 and #2183 were red on a NON-DETERMINISTIC e2e failure, not on their own diffs, and the re-run is in flight

Both PRs failed the same four tests in `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts` — a file
neither touches — while the identical commits PASSED the same workflow fourteen minutes earlier and
two sibling branches PASSED in the same batch. `main` passed at 00:41Z. Station-doc rule 5 names this
class as transient and the remedy as a re-run; DOCTRINE §2 forbids re-running without naming a cause,
and the cause named here is the measured non-determinism plus the failure text
(`locator.click: Test timeout`, `element(s) not found`), not a hope.

**DISPOSITION: ACTIONED** — both `--failed` re-runs dispatched at 01:29Z, exit 0 each, and the prior
FAILURE cleared from both PRs' failure lists. ⚠️ The e2e result itself is **[CANNOT MEASURE]** at
close: still `IN_PROGRESS`. **The read-back for the next run is one call:**
`gh pr checks 2184 -R GH-Mantova/ProjectOperations --json name,state` and the same for 2183, reading
`tendering-e2e`. If it is SUCCESS, F1 is discharged and both PRs are green-but-for-the-label. If it
FAILED again on the same four tests, the flake is reproducible and becomes a real defect — at which
point it is `tests/e2e/**`, i.e. inside the `tests|docs` lane, and belongs in a staged prompt rather
than a hand fix.

### F2 — The `duplicate key` line in the e2e log is provoked and caught on purpose, and reading it as the cause is the available wrong answer

`user_dashboards_user_id_slug_is_system_key` collisions are logged by Postgres three times per failing
run, timed to three of the four failures. `user_dashboards.service.ts` **deliberately** relies on that
constraint and recovers on P2002 — its own comment says so. So the alarming line is normal operation,
and the real failure text is a UI timing one.

**I made this mistake in this run and caught it by reading the service source.** The cost of not
catching it would have been a fabricated data-integrity defect filed against two PRs that have none,
and a fix aimed at a constraint that is working.

**DISPOSITION: DEFERRED** — real, and worth a DOCTRINE §9 bullet, but it is not urgent and a
canonical-block edit is more than this run should carry alongside an arm. It becomes urgent the moment
a run files a defect against that constraint. The falsifying probe is the service comment itself:
`grep -n "P2002" apps/api/src/modules/platform/user-dashboards.service.ts`.

### F3 — `status-sweep.ps1` labels a worktree "orphaned — investigate/prune" on directory mtime alone, and one of the six it flagged holds OPEN PR #2184's head branch

The classifier's only liveness test is `$isLive = ($ageMinutes -ge 0 -and $ageMinutes -lt 30)`.
Nothing asks the board. On a board where `do-not-merge` holds every PR for hours, a PR's build tree
crosses that threshold thirty minutes after its build ends, so the false label is the common case.
A run acting on it would have removed the working tree of a live PR. The dirty row is wrong in the
same expensive direction: the "uncommitted work" it demands a human preserve is a CRLF smudge whose
`--numstat origin/main` is EMPTY, plus a scratch `pr-body.md`, on a branch whose PR merged as #2154.

This also **discharges Station 03's F6**, which dispatched the prune DECISION to 00 and which my own
00:14Z run DEFERRED. The decision is: **prune nothing**, and fix the instrument that asked.

**DISPOSITION: ACTIONED** — staged as `pr-sweep-orphan-worktree-asks-the-board-HOLD.md`,
`lint-prompt.mjs` ADMIT exit 0, scope crossed against all four open PRs with 0 overlap. Not armed:
RULE 4 allows one armed prompt at a time and this run's arm is already in flight. The next run arms it
once the queue is clear.

### F4 — The two-wrapper defect is unchanged and correctly parked with Marco

Wrapper 30116 (started 2026-09-21T07:14Z) owns no node; node 42212's ancestry resolves to wrapper
1724. Both hold kill authority. The root cause is `C:\po-watcher\ensure-watcher.ps1`, outside every
repo this pipeline can PR.

**DISPOSITION: ESCALATED** — already a tracked channel as
`needs-marco/ensure-watcher-relaunches-a-second-wrapper-because-it-only-asks-about-the-node-2026-09-25.md`,
filed by the 00:14Z run. The repo-side half (make ADOPT prove its claim, give WATCHDOG lines a PID,
stop the sweep reporting two wrappers as health) is the prompt this run ARMED. No new escalation —
re-stating it would be the duplicate-escalation failure 03's own F5 recorded.

### F5 — COLLECT found nothing undispositioned and no station silent

All three breadcrumbs in the window carry a disposition on every finding. `--freshness` CLEAN exit 0;
every station's `lastRunAt` aligns with its newest breadcrumb and no occurrence is missing. Zero live
`[STALE]` escalation rows, measured with a sound instrument after my first one lied.

**DISPOSITION: ACTIONED** — the three breadcrumbs are archived in this PR, which is what closes the
channel.

## WHAT I DID NOT DO

- **Merged nothing.** All four open PRs carry `do-not-merge` with CP-26 reading `[LABEL_PRESENT]`.
  Only Marco removes that label; a run that meets `[LABEL_PRESENT]` has finished. Three of the four
  also sit outside `tests|docs` and outside 00's recorded `docs/` lane, so
  `STATION-CAPABILITIES.md` §5's `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` would forbid the
  merge even with the label gone.
- **Removed no label**, on any PR, for any reason.
- **Pruned no worktree**, including the three that are genuinely prunable. Worktree removal is
  machine hygiene and the authority matrix assigns "repair the machines" away from 00; and having just
  proved the instrument that recommends pruning is unreliable, acting on its recommendation in the
  same run would be the §7 failure of believing a reading I had measured wrong.
- **Did not touch `C:\po-watcher\ProjectOperations` with any mutating git command.** Read-only only.
- **Did not clear the pre-existing ` M docs/data-model/metadata-catalog.json` smudge.** It predates
  this run by a day (#2161), `--numstat origin/main` is EMPTY, and it is not mine to resolve inside a
  collect PR. It is named in WHAT CHANGED so the next run does not re-diagnose it.
- **Did not arm a second prompt.** RULE 4 is one at a time and the watcher is mid-build on this run's
  arm (heartbeat 0 min).
- **Did not edit `/sot/`.** Station 05's lane, CP-24.
- **Touched no Azure, Entra or SharePoint surface.** Absolute.
- **Did not add a DOCTRINE §9 bullet for F2**, though it deserves one — a canonical-block change must
  be re-recorded and shipped across all seven station docs in one PR, which is more than a collect run
  that also armed should carry. Deferred explicitly rather than silently.
- **Did not read any station transcript.** No station was SILENT and no occurrence was missing, so
  there was no verdict a transcript was needed to justify.
- **Did not re-run `bring-up-to-speed.ps1`** on top of `status-sweep.ps1`. The sweep answered every
  question this run needed and the token budget is scarce; where I needed a `[LIVE]` line to ACT on, I
  re-derived it from its own source instead (§9.5 — provenance is not correctness).
