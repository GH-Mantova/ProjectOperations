# Station 00 - Supervisor | 2026-08-25T14:08Z - 2026-08-25T14:20Z

## GROUND

```
UTC            2026-08-25T14:09:19Z
origin/main    b968e4f1            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ b968e4f1     C:\ProjectOperations2   (HEAD..origin/main = 0)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE. NOT BLIND - Desktop Commander reached the box (`start_process`, powershell.exe,
PID 31160 REPL + seven `-File` script runs).

Cowork reported "today" as 2026-08-26; the box and the board are at **2026-08-25 14:xxZ**.
That is the known AEST(+10) local-vs-UTC skew, not a clock fault.

## WHAT I MEASURED

**Repo hygiene** [MEASURED] `.git\index.lock` absent. No `MERGE_HEAD` / `REBASE_HEAD` /
`CHERRY_PICK_HEAD` / `rebase-merge` / `rebase-apply` / `sequencer`. Dev tree clean and level with
origin/main.

**Shared index** [MEASURED] `git diff --cached --name-status` carries exactly one entry, left by my
own 12:08Z run:
`R100  docs/pr-prompts/pr-arm-lock-s1-serialize-arming-HOLD.md -> ...-ready.md`.
That is the arming rename awaiting a board PR. I did not drain it (see WHAT I DID NOT DO).

**ARMED = 0** [MEASURED] `Get-ChildItem docs\pr-prompts -Filter *-ready.md` (depth 1) returns
nothing; `.queue-state.json.armed = 0`. `pr-arm-lock-s1` was picked up, built, and consumed - it is
now PR #1323. The lane is FREE.

**Watcher LIVE** [MEASURED] `Win32_Process` filtered on cmdline `pr-watcher[\\/]index\.mjs`:
exactly ONE node, **pid 29024**, started 2026-08-24 15:35:04 (unchanged since the 12:08Z run - no
restart happened). `.queue-state.json` `ts` field, two samples:
`14:08:08.837Z` then `14:13:07.638Z` = **GAP 4.98 min**, consistent with `RESCAN_INTERVAL_MS`.
Not frozen. (Three intermediate reads at 14:11:08, 14:11:42 and 14:12:18 all returned the SAME
`14:08:08.837Z` - that is the tick interval, NOT a freeze. Do not sample inside 5 minutes and call
it a stall.)

**Restarter** [MEASURED] `Get-ScheduledTaskInfo "PO Watcher Keepalive"`: state=Ready,
lastRun 2026-08-26 00:08:15 local (= 14:08:15Z), **lastResult=0**, nextRun 00:15 local. Working.

**Wrapper ABSENT** [MEASURED] `supervise-watcher.ps1` process count = **0** while node is alive.
Station doc section 3b would have me relaunch it. I did not - see WHAT I DID NOT DO.

**Board: 7 open PRs** [MEASURED] `gh pr list --state open --json ...` from `C:\po-watcher\ProjectOperations`:

| PR | mergeState | labels | title |
|---|---|---|---|
| #1323 | CLEAN | do-not-merge | feat(pipeline): arm-prompt.ps1 serializer - exclusive lock + index guards |
| #1322 | CLEAN | (none) | fix(crm): remove double x100 on win_rate display |
| #1321 | CLEAN | do-not-merge | feat(tendering): guard win-count against triple-flip |
| #1320 | CLEAN | (none) | fix(web): gate /crm and /clients behind RequirePermissions crm.view |
| #1319 | UNSTABLE | do-not-merge | feat(crm): idempotent backfill script for Account rows |
| #1317 | CLEAN | (none) | ci(e2e): dispatch-only Playwright container trial (slice 1/2) |
| #1316 | CLEAN | (none) | feat(tendering): capacity service + tenders.allocate (EW-2a) |

Board was 6 at 12:22Z. **#1323 is new** - it is the PR built from the prompt I armed last cycle.

**ALL SEVEN are watcher-routed to Marco** [MEASURED] - both probes, both files, all seven:

- Probe A, `scripts\pr-watcher\logs\2026-08-24.log` (still the live log; the watcher does NOT roll
  daily - do not look for a `2026-08-25.log`), pattern `PR #<n> stays for Marco`:
  `#1316 outside tests/ or docs/: apps/api/jest.config.ts` ·
  `#1317 outside tests/ or docs/: .github/workflows/playwright-container-trial.yml` ·
  `#1319 escalates:true - held for Marco, labelled do-not-merge` ·
  `#1320 outside tests/ or docs/: apps/web/src/App.tsx` ·
  `#1321 escalates:true` · `#1322 outside tests/ or docs/: apps/web/src/pages/crm/AccountDetailPage.tsx` ·
  `#1323 escalates:true`.
- Probe B, `docs\pr-prompts\processed\<prompt>.md.log`, pattern `merge result for PR #<n>:` -
  seven `{"ok":false,"marco":true,...}` lines with matching reasons.
- Control: 591 `stays for Marco` lines exist across the log set, so the query is not silently empty.

**A LABEL-ONLY CHECK IS WRONG ON FOUR OF SEVEN.** #1316 #1317 #1320 #1322 carry NO label and are
still Marco-routed, purely by the `tests-docs` path rule.

**#1319's only red is the hold itself** [MEASURED] - read from the job log, not the PR page.
`gh run view 32833543696 --job 97757596917 --log`, tail:
```
PASS - CP-11 migrations        PASS - CP-12 env-vars      PASS - CP-13 dependencies
PASS - CP-17 dto-validation    SKIP - CP-09/10 scope      PASS - CP-23 seed-without-migration
PASS - CP-24 sot-purity        SKIP - CP-22               PASS - CP-25 failure-honesty
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label ... removing it is what releases the merge.]
```
Every other check on #1319 is green including `tendering-e2e` (13m43s). There is nothing to fix.

**NEW - CP-26 IS A RACE, AND IT IS GREEN BY DEFAULT** [MEASURED] + [INFERRED cause].
Three PRs carry `do-not-merge`. Their `PR gates - diff checks` job:

| PR | created | do-not-merge applied (log) | PR-gates verdict |
|---|---|---|---|
| #1319 | earlier | 09:43:22Z | **fail** (CP-26) - run 32833543696 started 09:45:20Z |
| #1321 | 10:09:23Z | 10:10:43Z | **pass** - run 32835764994 |
| #1323 | 12:27:29Z | 12:28:10Z | **pass** - run 32847693127 |

[INFERRED] `.github/workflows/ci.yml` declares `on: pull_request: branches: [main]` with **no
`types:` list**. The GitHub default is `opened, synchronize, reopened` - **`labeled` is not in it.**
So the gate is evaluated when the PR opens, roughly one minute BEFORE the watcher applies
`do-not-merge`, and never re-runs on the labelling. #1319 is red only because a later push
(`synchronize`) happened to re-run the gate after the label already existed.

Consequence: **a `do-not-merge` PR normally shows CP-26 PASS and mergeStateStatus CLEAN.**
DOCTRINE 8.3a and STATION-CAPABILITIES section 5 both describe CP-26 as a binding gate. Measured, it
is a coin-flip that lands green on the normal path. The surviving defence is the live label read in
`merge-queue.mjs` rule 2 - a single guard, where the docs claim two.

**Breadcrumb COLLECT** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit 2:
9 checked, 0 malformed, 7 skipped as pre-contract. **All 9 flagged UNTRACKED.** Freshness:
`00` 2.0h ok · `02` dispatch-only · **`03` 15.1h ago, SILENT (cadence 4h)** · `04` 4.0h ok ·
`05` 23.9h ok. **No station breadcrumb has been written since my 12:08Z run** - nothing new to
disposition from 03/04/05 this cycle.

**Queue shape** [MEASURED] 61 `pr-*.md` at depth 1, 57 `-HOLD.md`, 0 `-ready.md`.
**2 are UNTRACKED and therefore un-armable by `git mv`** - `pr-hygiene-gitignore-no-pr-opened-HOLD.md`
and `pr-watcher-idle-tick-liveness-HOLD.md` (re-measured against `git ls-files`, unchanged from
12:22Z). These are the only two prompts in the queue whose PR would plausibly be docs-only, i.e. the
only two the watcher would merge ITSELF without touching Marco's gate. Both are locked out.

## WHAT CHANGED

**Nothing on the board and nothing in the queue.** No merge, no arm, no label change, no restart,
no git mutation. One new untracked breadcrumb (this file).

## FINDINGS

### F1. The entire board - all seven PRs - sits on the human-review gate. RULE 2 binds every one.

Merged nothing. Five are CLEAN and green; #1319's sole red is the hold itself; #1322 #1320 #1316
#1317 carry no label at all and are gated purely by the `tests-docs` path rule. Four chains remain
stalled behind them (EW-2b <- #1316, e2e-s2 <- #1317, wincount s2/s3 <- #1321, arm-lock s2 <- #1323).

**DISPOSITION: ESCALATED** - this is the third consecutive run escalating the same `tests-docs`
question, and the board has gone 2 -> 5 -> 6 -> 7 in the eight hours since it was first raised. See
the question block at the end.

### F2. CP-26 passes on the normal path. The gate the docs call binding is a race.

Measured above: same label, opposite verdicts, and the difference is whether a second push happened
to re-run the job after the label landed.

The complete-and-additive fix is one line in `.github/workflows/ci.yml`: add an explicit
`types: [opened, synchronize, reopened, labeled, unlabeled]` to the `pull_request` trigger. It makes
CP-26 evaluate on every label change in both directions - which also means removing the label
re-runs the gate and releases the merge without needing a dummy push. It adds a trigger, changes no
data, and breaks nothing that exists. A narrower alternative (have the watcher apply the label
BEFORE opening the PR) fails the "future" half: it fixes new PRs and leaves label REMOVAL still
requiring a push to take effect.

**DISPOSITION: DISPATCHED to Station 06 (PR Master)** - stage a `-HOLD.md` for the `ci.yml` trigger
fix. I cannot create the PR (authority matrix: 00 create-a-PR = no) and I will not hand-edit a
workflow. Note for 06: the fix touches `.github/`, so its own PR will itself be Marco-routed.

### F3. Station 03 - Machine Minder has been SILENT for 15.1 hours.

Last breadcrumb 2026-08-24T23:01Z; cadence 4h. This is the **fifth consecutive supervisor run** to
report it. Either the device task is not firing or it is firing and not reporting; both are defects
and neither is something I can fix from here - Station 03 is a device task, invisible to
`list_scheduled_tasks`, and its schedule is Marco's to inspect.

**DISPOSITION: ESCALATED** (repeat) - included in the question block.

### F4. Every station breadcrumb on disk is UNTRACKED. Nine of them, this day alone.

`check-breadcrumb.mjs --freshness` NOTEs each one: "it reaches nobody until a board PR commits it".
No scheduled station may create a PR, so nothing commits them. Project memory remains the only
channel that closes. This is the same E1 raised at 12:08Z.

**DISPOSITION: ESCALATED** (repeat) - included in the question block.

### F5. The `supervise-watcher.ps1` wrapper is absent while node pid 29024 is alive.

Station doc section 3b instructs an ENSURE-UP relaunch. **I deliberately did not relaunch it.**
Relaunching starts a second supervisor carrying the kill loop, and the `PO Watcher Keepalive`
scheduled task (Ready, PT10M, lastResult 0, last fired 14:08:15Z) already covers process death.
Section 3b is a known defect in the station doc, not a real fault on the box.

**DISPOSITION: DEFERRED** - it becomes urgent if Keepalive ever reports a non-zero lastResult or
goes Disabled, because Keepalive asserts PID EXISTENCE ONLY and cannot detect a freeze. The section
3b correction belongs in a station-doc PR, which is Station 06's lane.

## WHAT I DID NOT DO

- **Merged nothing.** All seven PRs are watcher-routed (RULE 2). A MERGE verdict, a green board and
  an absent label do not override it; only Marco does, in chat.
- **Armed nothing, with the lane free and the watcher live.** The binding constraint right now is
  human review, not lane capacity: seven PRs are already queued on Marco and every real code slice
  the watcher builds lands on the same gate. An eighth adds review load and multiplies CI cost -
  branch protection requires up-to-date, so each eventual merge re-runs the full suite
  (`tendering-e2e` ~13 min) on everything still open. The only two prompts that would have bypassed
  the gate entirely (docs-only, watcher-merged under `tests-docs`) are the two UNTRACKED ones that
  `git mv` refuses to arm. Arming one via `Move-Item` would work - the watcher globs the disk - but
  it leaves no audit trail and no way back, which fails the "without damaging" half of RULE 1.
- **Did not drain the staged rename** `pr-arm-lock-s1-serialize-arming-HOLD.md -> -ready.md`. It is
  the true record of last cycle's arming and belongs in the next board PR. Any chat committing in
  this tree must use a pathspec commit - the index is shared.
- **Did not touch the `do-not-merge` label on #1319, #1321 or #1323.** Only Marco removes it.
- **Did not relaunch the watcher wrapper** (F5), did not restart the watcher, did not clear anything.
- **Did not fix `ci.yml` myself.** Workflow edit + PR creation are outside 00's authority.

## ESCALATED TO MARCO - three questions, RULE 1 options first

**Q1. The `tests-docs` routing rule now gates the whole board. Third ask.**
Every PR touching a single file outside `tests/` or `docs/` goes to your desk. Measured today:
`apps/api/jest.config.ts`, one workflow file, `apps/web/src/App.tsx`,
`apps/web/src/pages/crm/AccountDetailPage.tsx`. That is four of seven, none of them labelled.

- **(A) Complete + additive - RECOMMENDED.** Add a NAMED allow-list of config-only paths to the
  routing rule (e.g. `apps/*/jest.config.ts`, `.github/workflows/**` when the diff is workflow-only),
  leaving `escalates:true` and the `do-not-merge` label untouched. Solves it now and for every future
  slice; adds a rule, removes no gate, touches no data. Passes both halves.
- **(B) Case-by-case release.** You name individual PRs in chat and I merge those. Fails the
  "future" half - the next four slices arrive tomorrow with the same shape.
- **(C) Leave as-is.** Fails the "immediately" half - four chains are stalled today and the open set
  grew 2 -> 7 in eight hours.

**Q2. Who commits station output?** Nine breadcrumbs written today, zero tracked, and no scheduled
station may open a PR. Options: (A) grant Station 06 a standing docs-only breadcrumb-sweep PR each
morning - additive, auditable, no new authority for 00; (B) let 00 open docs-only PRs - fastest, but
widens 00's authority into 06's lane, which is the LL-38 shape; (C) accept project memory as the
only channel and stop writing breadcrumbs - honest, but loses the on-main audit trail.

**Q3. Station 03 has been silent 15 hours, five runs running.** It is a device task, so I cannot see
its schedule and cannot restart it. Please check whether `03-machine-minder` is still firing.

---
*Stamped `origin/main` = `b968e4f1`. Breadcrumb is UNTRACKED at the time of writing.*
