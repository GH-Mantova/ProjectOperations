# Station 00 — Supervisor | 2026-09-14T10:08Z–2026-09-14T10:20Z

## GROUND

```
UTC            2026-09-14T10:08:44Z
origin/main    7d0fb636
dev tree       main @ 7d0fb636  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run is read-write.

Read in the DEV TREE. `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned EMPTY after
`git fetch origin --prune`, so the working copy IS `origin/main` for all three binding documents and
no piped-hash comparison was made (station-contract v3 forbids it).

## WHAT I MEASURED

- [MEASURED] Device bridge reachable. `start_process powershell.exe` → pid 9296 (later 16000 after a
  mid-run shell exit). This run is SIGHTED, not blind.
- [MEASURED] `vm-git-guard.sh` COULD NOT BE INSTALLED. The workspace transport answered:
  `failed to mount ... is under Plan9 share "c" which is not mounted ... A Windows update released
  September 8 prevents Claude's workspace from reaching your files.` Quoted per contract. A FINDING,
  not a STOP — and note the guard's hazard is absent this run precisely because the mount is
  unreachable, so no VM-side `git` was possible in either direction.
- [MEASURED] `status-sweep.ps1` captured to a FILE (it returns early and hides its own section 7):
  412 lines, exit 0. Section 7 verdict: `SAFE TO ACT: no board mutation in progress, no recent
  remote activity, no live station worktrees.`
- [MEASURED] Board, 2 OPEN: `#1923` CLEAN, CI 15 pass / 0 fail; `#1920` BLOCKED, CI 12 pass / 3 fail,
  label `do-not-merge`. `main` CI on 7d0fb636: 4 success / 0 failed (trunk green). armed = 0.
- [MEASURED] RULE 2 probe, LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` — 2216 logs,
  newest `2026-09-14T09:42:13` (NOT the 08-17 decoy tree). POS control `marco.:true` = 666,
  NEG control on a freshly minted needle `zzQn7x4Lp2Vw` = 0. Both PRs matched by `PR #<n>` in the
  log BODY, not by filename:
  - `#1923` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/:
    apps/api/src/modules/rates/rate-tables.service.ts"}`
  - `#1920` → `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco,
    labelled do-not-merge"}`
  **Both open PRs are MARCO'S. There is nothing on this board for me to merge.**
- [MEASURED] `#1920` head `52c69d63` == `origin/feat/ea-2a-estimating-analytics-preset`, and run
  `34830661267` reports `headSha 52c69d63`, `createdAt 2026-09-14T09:57:19Z` — the checks are CURRENT,
  not a stale rollup. The head commit is `Merge branch 'main' into feat/...` authored `GH-Mantova`,
  i.e. `pollForBehindPrs` rebuilding the PR, already-known behaviour.
- [MEASURED] `#1920`'s three reds are TWO different things. `Approval receipt (CP-26)` and
  `PR gates — diff checks` are the known single-cause coupling on a `do-not-merge` PR with no
  accepted receipt — parked by design. The third, `tendering-e2e`, from the JOB LOG (never the diff):
  `✘ 18 [webkit] › tests/e2e/tendering.spec.ts:73:7 › Pipeline view shows the IS kanban stage columns`
  / `Error: locator.waitFor: Test timeout of 60000ms exceeded.` — ONE webkit test, one timeout.
- [MEASURED] `#1920`'s diff touches NO web code: `apps/api/prisma/migrations/...`, `seed.ts`,
  `estimating-analytics-preset.spec.ts`, three `reporting/` files, `docs/decisions/merge-approvals/1920.md`.
  An unrelated-diff CODE failure while `main` is green is transient by the mandate's own test.
- [MEASURED] `check-breadcrumb.mjs --freshness` exit 2: structure 14 checked, 0 malformed.
  `00` 0.5h ok · `03` **83.0h SILENT** · `04` 4.0h ok · `05` **92.0h SILENT**.
- [MEASURED] Scheduler store (`list_scheduled_tasks`), crossed against the above. All of
  `00/03/04/05` **enabled**. `03-machine-minder` `0 9 * * *`, lastRunAt `2026-09-10T23:01:10Z`,
  nextRunAt `2026-09-14T23:00:45Z`. `05-sot-keeper` `10 0 * * *`, lastRunAt `2026-09-10T14:10:55Z`,
  nextRunAt `2026-09-14T14:10:37Z`. The cron-vs-nextRunAt offset is exactly UTC+10, i.e. the crons
  are LOCAL time and this is not a defect.
- [MEASURED] Third instrument — session directories, grouped by `CreationTimeUtc` day.
  POS control: this run's own directory `local_92ba3e98-…` is returned by the probe, so an absence is
  a real absence. 1505 directories retained. `09-09 n=7 · 09-10 n=30 · 09-11 n=8 · 09-12 n=0 ·
  09-13 n=0 · 09-14 n=10`. Last fire before the hole `2026-09-11T06:06:58Z`; first after it
  `2026-09-14T03:08:21Z`. **A 69.0-hour hole with ZERO scheduled sessions of ANY station.**
- [MEASURED] Breadcrumbs dated inside the hole: `09-11` has 7 (all timestamped 00:02–04:08, i.e.
  inside the surviving window), `09-12` has **none**, `09-13` has exactly one —
  `00-00-supervisor-2026-09-13-0900-…` — **for which no scheduled session directory exists.**
- [MEASURED] Section 5 of the sweep printed NO `[STALE]` rows this run. Every row reads
  `cites #N (MERGED) as evidence -- not its premise` or `section 5 CANNOT decide`, so there is
  nothing dischargeable on the tag alone and I discharged nothing.

## WHAT CHANGED

- `gh run rerun 34830661260 --failed` on `#1920` (exit 0). **Read back:** the run is `in_progress`
  and `gh pr checks 1920` now shows `tendering-e2e pending` against job `103937972863`, a DIFFERENT
  job id from the failed `103933009386` — so the rerun genuinely took and did not return `cancelled`
  on a superseded commit. Result not yet known at the close of this run; the next 00 run collects it.
- Nothing else. No arm, no merge, no label change, no discharge, no `/sot/` edit.

## FINDINGS

### F1 — Both open PRs are Marco's, so this board has no work for me to merge

`#1923` is CLEAN and fully green and `#1920` is `escalates:true` + `do-not-merge`; the RULE 2 probe
returns `marco:true` for both, with the POS/NEG controls above and on the LIVE processed tree. I
stood off both. `#1923` in particular is a green PR that only Marco can land — the throughput
constraint, stated once more without re-deriving it.

**DISPOSITION: ACTIONED** — verified by probe with controls, and acted on by standing off.

### F2 — Two of #1920's three reds are the parked state itself; only one was a candidate defect, and it was transient

CP-26 and `PR gates — diff checks` fail together from one cause on a `do-not-merge` PR — that is the
known coupling and is what a parked PR is supposed to look like, not a defect to chase. The third,
`tendering-e2e`, is a single webkit `locator.waitFor` timeout in the tendering kanban spec, on a diff
that touches no web code at all, while `main` is green. That is the mandate's own definition of
transient, so I re-ran it rather than diagnosing a defect.

**DISPOSITION: ACTIONED** — re-run issued and read back as a new job id. If the re-run fails again on
a clean diff, the next run should treat it as a real MAIN-side regression in the tendering spec and
author a `fixes_pr` against main, not chase `#1920`.

### F3 — NEW: the scheduler lost 69 hours, and `--freshness` never said so, because one non-scheduled lane kept reporting

The cause is already known and already ACTIONED — the 0027 run measured that Marco switched the
stations off on 09-11, and the GitHub `Pipeline heartbeat` workflow is what caught it. **Do not
re-diagnose that.** What is NEW, and is recorded here so no future run pays to re-derive it, is the
size and the masking:

- The hole is `2026-09-11T06:06:58Z → 2026-09-14T03:08:21Z` = **69.0 h**, measured from session
  directories with a positive control, with **zero** directories on 09-12 and 09-13. That is by far
  the largest recorded — the previous worst on record is the 17.8 h hole of 09-02.
- Across those 69 h exactly ONE breadcrumb was written (`…-2026-09-13-0900-…`), and it has **no
  scheduled session directory**, so it came from a non-scheduled lane.
- Consequence: `check-breadcrumb.mjs --freshness` compares breadcrumb dates and nothing else, so one
  interactive breadcrumb was enough to keep `00` reading `ok` while 00's *scheduled* lane was dead
  for nearly three days. **A single lane can hold the silence detector open for every lane.**

The station doc's existing cure — cross `--freshness` against `lastRunAt`, then against session
directories — does detect this, and it is what detected it here. So this is not an unguarded hole;
it is a measurement of how far the breadcrumb instrument alone can be wrong, which is the thing the
cure exists for and which had never been quantified.

🔧 **Falsifying probe for a future run:** group session directories by `CreationTimeUtc` day and
confirm the 09-12/09-13 absence still reads zero with this run's own directory as the positive
control. If a station is ever SILENT while `--freshness` reads `ok`, that is this shape.

**DISPOSITION: DEFERRED** — real, not now. The cause is actioned, the detector already works when
all three instruments are crossed, and the board is quiet. What would make it urgent: a second
occurrence of `--freshness ok` while the scheduler store shows a missed occurrence, which would mean
the masking is routine rather than a one-off of a hand-switched-off period.

### F4 — 03 and 05 read SILENT and are NOT stopped stations

Both are `enabled`, and both have a `nextRunAt` TODAY that has not yet arrived: `05` at
`2026-09-14T14:10:37Z`, `03` at `2026-09-14T23:00:45Z`. Their missed occurrences on 09-11/12/13 fall
inside the 69 h hole in F3, which was a machine-wide condition and not a station defect. `04` has
already self-recovered through the same hole (fired 06:10Z and 10:10Z today), which is the positive
control for "they come back on their own".

🔴 **Do not report 03 or 05 as stopped stations, and do not restart or re-arm anything on their
behalf.** `--freshness` will keep printing SILENT until each one fires.

**DISPOSITION: DEFERRED** — self-clearing at the next occurrence. What would make it urgent: `05`
still showing `lastRunAt 2026-09-10` after `2026-09-14T14:11Z`, or `03` after `2026-09-14T23:01Z` —
at that point the re-enable did not take and it becomes real.

### F5 — I deliberately armed nothing

`armed = 0` and the backlog gate reports `ready=1 needs-marco=2 blocked=4`. Every gate-satisfied HOLD
available today lands outside `tests/` or `docs/`, which means every arm becomes another PR only
Marco can merge — and the board already holds two of those, one of them green and waiting. Arming
here lengthens the queue without shortening it. The one `READY TO STAGE` item
(`rates-11c-blocked-consumers`) is explicitly gated on a parity proof having RUN clean, which it has
not.

**DISPOSITION: DEFERRED** — arming resumes when the `tests-docs` lane has an eligible prompt, or when
Marco drains the two open PRs. This is a decision, not an omission.

### F6 — The workspace transport is down again and the git guard could not be installed

The Plan9/virtiofs mount is unreachable with the September 8 Windows update named in the error. This
is the already-actioned "the fault is the TRANSPORT, not the host" finding shipped in `#1641` —
recorded here only because the contract requires the installer's last line to be quoted pass or fail.
**Do not re-raise it and do not re-derive it.** The device bridge was healthy throughout, so this run
lost no coverage.

**DISPOSITION: DEFERRED** — known, shipped, and it cost this run nothing.

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs are `marco:true` under RULE 2. `#1923` being green,
  CLEAN and unlabelled does not clear it, and neither would Marco removing `do-not-merge`.
- **Did not arm.** See F5 — a deliberate decision against a starved `tests-docs` lane.
- **Did not discharge any `needs-marco/` file.** Section 5 printed no `[STALE]` rows; every row was
  an explicit `CANNOT decide`, and discharging on those would be exactly the mistake the section
  warns about.
- **Did not touch 03/04/05's work**, restart the watcher (it is RUNNING, pid 30976, heartbeat 28 min
  with an empty queue = idle, not wedged), or prune the three orphaned worktrees — in particular
  `C:/PR-Master/worktrees/po-vg`, which still holds 1 uncommitted file at 14536 min and is 03's, and
  already escalated.
- **Did not edit `/sot/`, touch Azure/Entra/SharePoint, write production data, or commit on `main`.**
- **Did not wait out the `#1920` re-run.** It was still `in_progress` at close; leaving it for the
  next run is cheaper than holding a session open, and the read-back proves it is genuinely running.
