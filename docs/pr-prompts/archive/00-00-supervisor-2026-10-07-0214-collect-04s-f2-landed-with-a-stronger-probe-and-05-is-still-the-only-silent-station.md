# Station 00 — Supervisor | 2026-10-07T02:14Z–2026-10-07T02:4xZ

## GROUND

```
UTC            2026-10-07T02:14:23Z
origin/main    500e07f3            (fetch first, then rev-parse)
dev tree       main @ 500e07f3     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (00-supervisor SKILL.md, station_doc_version: 1) — MATCH, run is read/write
```

## WHAT I MEASURED

**Reachability — SIGHTED.** [MEASURED] One keyword `ToolSearch` for `desktop-commander` loaded the
toolkit; `start_process` shell `powershell.exe` returned `2026-10-07T02:14:23Z` and hostname
`LAPTOP-E6NHU4E4`. Not blind, no retry needed.

**Git guard — exit 2, INSTALLED BUT INERT.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, read as the installer's own
status with nothing piped onto it, exit **2**. Headline:
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
Last line: `   PATH="/sessions/admiring-serene-galileo/.local/bin:$PATH" git <args>`. This is the
station doc's expected exit-2 outcome — a finding, not a stop. **No `git` ran through the device
bridge this run**; every `git` and `gh` call below ran on the Windows host through Desktop Commander.

**Binding reads.** [MEASURED] `docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md`
and `docs/pipeline/STATION-CAPABILITIES.md` all read in full via
`git show origin/main:<path>` in the **dev tree** after
`git fetch origin`. `git rev-parse origin/main` = `git rev-parse HEAD` =
`500e07f3438eb58217bced5a3c3d7b474c6966cd`; `git rev-list --left-right --count HEAD...origin/main`
→ `0 0`. No piped `hash-object` comparison was made (DOCTRINE §9.2). No REFERENCE file was needed:
no core line sent me to one this run.

**§9.1 reproduced first-hand, in my own second call.** [MEASURED] `'FRESHNESS_EXIT=' + $LASTEXITCODE`
inside `-Command "..."` arrived at PowerShell as `'FRESHNESS_EXIT=' +` —
`ParserError: You must provide a value expression following the '+' operator`. Every later probe ran
as a `.ps1` via `-File` and behaved. The §9.1 cure is current and works.

**Sweep — SAFE TO ACT.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, exit 0, generated
02:15:25Z. Section 0 positive controls both passed (`gh` reached GitHub seeing merged #2259; `node`
runs), so the report is trustworthy. Section 7: `SAFE TO ACT: no board mutation in progress, no
recent remote activity, no live station worktrees.` Section 3: `git index.lock` false/false, scoped
git processes **0**, board lease **free**, no PR touched in the last 2 min, no watcher build in
flight (newest heartbeat tick 34.4 min old; ticks are 60 s apart only while a build runs, so stale +
empty queue = idle, not wedged). Watcher node **RUNNING pid 39052**, auto-restart wrapper alive.

**Board — empty and green.** [MEASURED] section 1: **OPEN PRs 0**, **WAITING ON MARCO 0**, all open
non-draft 0. `main` CI on `500e07f3`: 4 success / 0 failed / 0 running — trunk green. Most recent
merges #2252–#2259, all 2026-10-06/07.

**MARCO_QUEUE_LINE_V1 figures, copied for the record as the station doc requires.**
[MEASURED] `armed (*-ready.md)`: **0**. `WAITING ON MARCO`: **0** open PRs labelled `do-not-merge`.
Both zero at the moment I armed, which is the loosest this queue has been in weeks.

**Breadcrumb freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`
exit **2**. Structure pass: 2 checked, 0 malformed. Freshness:
`00 1.0h ago ok` · `02 dispatch-only` · `03 3.2h ago ok` · `04 0.1h ago ok` ·
`05 last 2026-09-24T14:23:00Z 299.9h ago MISSED`. `MISSED: 1 station(s)`. Three stations read `ok`
in the same output, so the validator can produce a positive and the single negative is meaningful.

**Dev tree was DIRTY on a tracked path at run start, and that is a latent fast-forward block.**
[MEASURED] `git status --porcelain` → ` M docs/pipeline/sweep-rotation.json` plus 04's untracked
breadcrumb and 24 untracked `docs/pr-reviews/pr-*-review.md` files. `git diff --numstat` →
`2 2 docs/pipeline/sweep-rotation.json`; `git diff --cached --name-status` → EMPTY. Station 04 left
the rotation advance dirty **deliberately and correctly** (it may not commit), and flagged it for me.
Swept into this run's PR — see WHAT CHANGED.

**F2 re-measured independently before acting on it (DOCTRINE §7.1 re-read rule).** [MEASURED]
2026-10-07T02:2xZ, over every `SKILL.md` behind an **enabled** task:
`BOOTSTRAP_CORE_REFERENCE_V1` → **1 hit each** for `00-supervisor`, `03-machine-minder`,
`04-scanner`, `05-sot-keeper`; all four mtime `2026-10-06T05:59:29Z`. The literal phrase
STATION-CAPABILITIES quoted, `read these three in full`, → **0 hits in all four**. POSITIVE control
`station_doc_version` → 2 hits each; NEGATIVE control, a needle minted this run
(`ZZNEEDLE-SUP-20261007-0225`) → 0 hits each. **This is a stronger reading than 04's**, which
reported the shorter substring `read these three` as present once — true, but that single hit is the
heading of the *split* instruction, and the phrase the stale paragraph actually quoted is absent
altogether.

**Arming premise, with both controls.** [MEASURED] in the dev tree:
`GITPUSH_WORKTREE_MANDATORY_V1` in `scripts/pipeline/pipeline-lib.ps1` → **0 hits** (premise TRUE,
the fix is not yet applied). POSITIVE control `Invoke-GitPush` → 1 hit. NEGATIVE control, the needle
minted this run → 0 hits. `Test-Path C:\po-fix` → **False**, so the bad default still points at a
path that does not exist. `node scripts/pipeline/lint-prompt.mjs` on the prompt →
`ADMIT pr-gitpush-worktree-mandatory-HOLD.md (size 2)`, exit **0**. The prompt is tracked on
`origin/main` (`git cat-file -e` exit 0), so arming can be the `git mv` the station doc requires
rather than the creation of a `-ready.md` that `.gitignore:75` would swallow.

**`needs-marco/` tracking, asked before appending.** [MEASURED] `git ls-files -- docs/pr-prompts/needs-marco/`
→ **11** tracked files of 52 on disk, and
`git ls-files --error-unmatch -- docs/pr-prompts/needs-marco/stations-00-03-05-...-2026-10-06.md`
→ found, exit 0. So that file **is** tracked, and my append to it had to ride inside this run's PR
rather than be left loose in the dev tree. It did.

**Orphan worktrees — 30 non-main, 2 registry escapees, and I touched none.** [MEASURED] section 2
classified 30 non-main worktrees as orphaned; two hold uncommitted work
(`C:/po-worktrees/sup-cwd-paths` 2 files, `C:/PR-Master/worktrees/sweep-dirty-untracked-v1` 1 file)
and most hold unpushed commits. Plus `REGISTRY-ESCAPEE: C:\PR-Master\worktrees\bootstrap-check` and
`C:\po-wt\dispatch-register-v1`, both 0KB, no `.lock`. **03's lane** — see WHAT I DID NOT DO.

## WHAT CHANGED

One board PR off `origin/main` in an isolated worktree `C:\po-wt\sup-1007-0215`, branch
`docs/board-1007-0215-collect`, minted clean at `500e07f3` (`git status --porcelain` EMPTY before
any edit). Board lease held as actor `station-00` for the duration (`LEASE_OK=True`).

1. **`docs/pipeline/STATION-CAPABILITIES.md`** — F2 correction. Removed the two retired clauses from
   the `DOCTRINE_CORE_SPLIT_V1` paragraph and replaced them with `BOOTSTRAPS_ARE_SPLIT_V1`: the
   measurement, both controls, the substring trap that makes the stale version self-confirming, the
   rule rather than the state, and a falsifying probe.
2. **`docs/pr-prompts/needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`**
   — appended a dated UPDATE recording that a *second* station reached the same verdict on different
   instruments four hours apart, and handing Marco one new cheap-to-test lead (the open
   `task-store-reverts-verified-writes` item is a plausible mechanism, which would make a re-arm
   appear to succeed and then revert — so confirm by `lastRunAt` after the next occurrence, never by
   reading `enabled` straight after the change). **Discharged nothing.**
3. **`docs/pipeline/sweep-rotation.json`** — committed 04's rotation advance verbatim
   (`last_index: 3`, `last_run_utc: 2026-10-07T02:10:17Z`, `last_station: 04-scanner`), clearing the
   tracked-dirty fast-forward block it would otherwise have left in the dev tree.
4. **Committed 04's breadcrumb** `00-04-scanner-2026-10-07-0210-...md` at its tracked path, so its
   findings reach somebody.
5. **Archived my own previous cycle's breadcrumb** `00-00-supervisor-2026-10-07-0113-...md` to
   `docs/pr-prompts/archive/` via `git mv`. Every finding in it carried a disposition.
   `check-breadcrumb.mjs` matches by basename, so it still counts for `--freshness`.
6. **This breadcrumb**, written directly into the PR worktree (REPORT CONTRACT Cure 1) so it does
   not block the next fast-forward.
7. **ARMED one prompt**: `git mv docs/pr-prompts/pr-gitpush-worktree-mandatory-HOLD.md`
   → `pr-gitpush-worktree-mandatory-ready.md`, via `arm-prompt.ps1`, one at a time.

04's breadcrumb is left in the queue root, not archived — it is the **current** cycle, and the
station doc reserves archiving for completed ones.

## FINDINGS

### F1 — S2 — 05-sot-keeper is still the only silent station, and 04 confirms it on a second instrument

[MEASURED] Both instruments this run: `--freshness` exit 2 with `05` alone at 299.9h MISSED while
00/03/04 read `ok`; and Station 04's independent MCP read at 02:10Z giving `05-sot-keeper`
`enabled: true`, `lastRunAt 2026-09-27T21:38:18Z` — byte-identical to the value recorded at 00:21Z,
so nothing moved in four hours and the 2026-10-06T14:22Z occurrence did not fire. 05 is the only
station that may edit `/sot/`, so that lane has been unattended for twelve days.

This is **already open with Marco** as
`needs-marco/stations-00-03-05-have-not-fired-for-nine-to-eleven-days-2026-10-06.md`, narrowed at
00:21Z from three stations to 05 alone when its own falsifying probe fired. I did **not** open a
second file for it — a duplicate escalation is how one question becomes two queues. Its next probe
(`lastRunAt` for 05 after `2026-10-07T14:22:37Z`) is ~12 hours out and cannot be run this run.

**DISPOSITION: ESCALATED.** Already with Marco; this run appended the second-instrument confirmation
and the task-store-reverts lead to the existing file rather than raising a new one. The remedy is a
scheduled-task-store write, which is on the station doc's forbidden list for a MISSED reading, and I
changed no scheduled task. Nothing to re-escalate before 14:22Z.

### F2 — S3 — STATION-CAPABILITIES told every reader the bootstraps were pre-split; they have carried the split since 2026-10-06

Dispatched to me by Station 04 (its F2) because `docs/pipeline/` is outside 04's write lane. Measured
independently before acting — see WHAT I MEASURED; my reading is stronger than 04's, because the exact
phrase the stale paragraph quoted is absent from all four enabled bootstraps, not merely superseded.

The harm is specific and this file's own §1 predicts it: a reader grepping the shorter substring
`read these three` finds a hit and confirms the retired clause, so the stale version is
self-confirming, while a reader who opens the bootstrap sees the opposite. This is the **second**
time this has happened inside this file, after the 2026-08-31 `02-board-driver` line failed the same
way in the same section — which is why the replacement states the rule (*read the bootstrap; never
quote this file for what a bootstrap says*) rather than a fresh state claim, and carries its own
falsifying probe.

**DISPOSITION: ACTIONED.** Corrected in this run's board PR; verified by reading the paragraph back
out of the worktree after the edit. Docs-only, inside 00's recorded lane.

### F3 — S3 — the F10 Invoke-GitPush repair had been staged for an hour with nothing to arm it, so I armed it

[MEASURED] `pr-gitpush-worktree-mandatory-HOLD.md` was staged by my own 01:13Z run (merged in #2257)
after F10 was dispatched to Station 06, **which has no cadence** — the dispatch had no actor, which
is exactly what that run's own breadcrumb title records. Its premise is still TRUE with both controls
(`GITPUSH_WORKTREE_MANDATORY_V1` → 0 hits; `Invoke-GitPush` → 1; needle → 0), `Test-Path C:\po-fix`
is still **False**, and lint ADMITs it at size 2.

It names no predecessor gate, so DOCTRINE §8.4's waiting condition does not apply and nothing but an
actor was holding it. Board conditions at the moment of arming were as permissive as they get:
0 open PRs, 0 armed, 0 on Marco's queue, trunk green, lease free, no build in flight. The defect it
repairs is a §7-class instrument lie in the board's own library — `Invoke-GitPush` returns a
well-formed 40-hex SHA and exit 0 after `Push-Location` to a non-existent tree has already failed,
so it can report a push that went somewhere else entirely.

**DISPOSITION: ACTIONED.** Armed this run via `arm-prompt.ps1`, one at a time, read back. It carries
`escalates: true` and touches `scripts/`, so the watcher will label it `do-not-merge` and the PR
**stays for Marco** — I will not merge it, and the next run must not read its label as stale.

### F4 — S3 — 30 orphaned worktrees, 2 registry escapees, and several holding work that a prune would destroy

[MEASURED] section 2 of the sweep: 30 non-main worktrees classified orphaned. Two hold **uncommitted**
work — `C:/po-worktrees/sup-cwd-paths` (2 files, age 18400 min) and
`C:/PR-Master/worktrees/sweep-dirty-untracked-v1` (1 file, age 6086 min) — and most of the rest hold
commits on no remote branch, including `C:/po-wt/fv2drop` at 21 and `C:/po-wt/rcpt-2183` at 15. Two
registry escapees, both 0KB with no `.lock`: `C:\PR-Master\worktrees\bootstrap-check` and
`C:\po-wt\dispatch-register-v1`.

This is growing — my 23:34Z run recorded 27, this one 30, and three of the new ones are my own and my
predecessors' board worktrees. The sweep's own line says a squash-merged branch also appears here, so
most of the unpushed-commit warnings are probably benign; *probably* is not a prune authority, and
`--force` on the two dirty ones would discard real work.

**DISPOSITION: DISPATCHED** to Station 03 (machine-minder), whose lane this is and which is healthy
again (`lastRunAt 2026-10-06T23:02:55Z`, breadcrumb 3.2h ago). Handing over: classify each of the 30
with `gh pr list --head <branch> --state merged` before pruning anything, preserve the two dirty trees
first, and the two 0KB escapees look safe but are yours to confirm. I cleaned up my own worktree at
the end of this run and otherwise touched none of them.

### F5 — note, no severity — 24 untracked PR review files are accumulating in the dev tree

[MEASURED] `git status --porcelain` lists 24 untracked `docs/pr-reviews/pr-*-review.md` files
(#2183 through #2255), plus `.codex/`, `AGENTS.md` and four `Claude Design/` paths. None is at a path
this run's PR creates, so none blocks the next fast-forward **today** — but each is a verdict living
only in the dev tree, and DOCTRINE §9.5 records that a verdict has three possible homes and a reader
checking one cannot claim absence.

**DISPOSITION: DEFERRED.** Not urgent: the PRs they review are all merged, so no merge decision is
waiting on them. It becomes urgent the moment a PR lands any of those exact paths on `main`, which
would turn each one into a fast-forward block of the kind the REPORT CONTRACT describes — or the
moment a run needs a verdict for one of those numbers and reads only the clone.

## WHAT I DID NOT DO

- **Did not merge anything.** There was nothing to merge: 0 open PRs at run start. The only merge
  this run performs is its own board PR, through `Assert-SmokedOrEscalate` → `Merge-Pr`, never by hand.
- **Did not touch the scheduled-task store** — not enabled, disabled, run, re-run or edited. 05's
  silence is a MISSED reading, and the station doc forbids all of those on that reading alone.
- **Did not open a second escalation for 05.** The existing file covers it and was already narrowed
  to 05 alone; I appended to it instead.
- **Did not discharge any escalation.** Nothing became provably resolved this run, and 05's probe does
  not fire until 14:22Z. `retire-escalation.mjs` was not called.
- **Did not clear the `[STALE]` rows section 5 printed.** Every one it flagged resolves to *"names no
  subject PR in its filename or first heading … section 5 CANNOT decide whether it is stale"* — a
  lead, not a verdict, and the station doc requires re-asking each PR individually with
  `gh pr view <n> --json state,mergedAt` before retiring. That is a real backlog of 52 files and it
  did not fit beside arming; it is the obvious first job for the next run that finds the board empty.
- **Did not prune a worktree, clear a lock, or touch watcher state** — 03's lane, dispatched above.
- **Did not arm a second prompt.** One at a time, by contract, even with Marco's queue at zero.
- **Did not stage the `rates-11c-blocked-consumers` backlog item** the sweep lists as READY TO STAGE.
  Its own note says the parity proof must have RUN clean before 11c may merge, it drops database
  tables, and `map-locations-waste-rate-coupling` is an unanswered design decision that section 6
  says must be settled *before* the drop. That is a hard stop (§5.5, design question) wearing a
  ready-to-stage badge.
- **Did not run `git` through the device bridge**, the guard's exit-2 INERT report notwithstanding.
- **Did not write to any of the five gitignored sinks.** This breadcrumb is the report, at a tracked
  path, inside the PR that commits it.
