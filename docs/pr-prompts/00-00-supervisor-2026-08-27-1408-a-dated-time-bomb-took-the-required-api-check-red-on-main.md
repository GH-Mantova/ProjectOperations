# Station 00 — Supervisor | 2026-08-27 14:08Z–14:32Z

## GROUND

```
UTC            2026-08-27 14:08:38Z
origin/main    01ad020e            (fetched, then rev-parse)
dev tree       main @ cb9fce55     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions AGREE — full authority this run. Box reachable (`start_process` powershell.exe,
`hostname` = LAPTOP-E6NHU4E4). **Not blind.**

## WHAT I MEASURED

**Machinery — all [MEASURED].**

| Probe | Result |
|---|---|
| `.git\index.lock` | **ABSENT** |
| watcher node (`pr-watcher[\\/]index\.mjs` cmdline) | **1 process, pid 28328** — same PID as the 12:08Z run ⇒ same process, alive |
| `supervise-watcher.ps1` wrapper | 0 — **not a fault**; the restarter is the Windows task, not the wrapper |
| `PO Watcher Keepalive` scheduled task | state=Ready, lastRun 2026-08-27T14:05:01Z, **lastResult=0**, next 14:15Z |
| clone heartbeat | mtime 12:32:52Z, last line `rev-1353-ready.md elapsed=300s` |
| armed (`docs/pr-prompts/*-ready.md`, depth 1) | **0** |

Heartbeat is 95 min stale **because the watcher is idle with 0 armed prompts** — DOCTRINE §9.5:
the heartbeat only ticks mid-run, so age alone cannot separate idle from wedged. An idle watcher
with 0 armed prompts is CORRECT, not wedged. **No restart. No ENSURE-UP relaunch.**

**Board — [MEASURED].** 1 open PR at run start: **#1353** (BLOCKED, no labels), from
`pr-lessons-folder-s3-ref-checker`. `origin/main` unchanged at `01ad020e` since the 12:08Z run
⇒ **nothing merged in this window ⇒ the RULE-2 breach count did NOT increase (still 8).**

**RULE-2 probe on #1353 — [MEASURED], `processed/pr-lessons-folder-s3-ref-checker-ready.md.log`:**

```
[watcher] merge result for PR #1353: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: .github/workflows/ci.yml"}
```

`marco:true`, **no label applied** — the routing path again, exactly as recorded. `rev-1353`
returned a **MERGE** verdict; a MERGE verdict does not clear RULE 2. **#1353 NOT MERGED.**

**Breadcrumbs collected.** Only one breadcrumb has appeared since the 12:08Z run and it is my own
from that run. **Nothing new from 03/04/05 to disposition.** `check-breadcrumb.mjs --freshness`:
00 ok · 04 ok (10:10Z) · 05 ok · **03 reported SILENT at 15.2h against `cadence 4h` — the known
`CADENCE['03']=4` defect; 03's cron is DAILY (last 2026-08-26T23:01Z), so it is NOT silent.**
9 malformed breadcrumbs, 7 of them 06's — unchanged, already on the ledger.

### The red I chased — and what it actually was

#1353 carried two failures. Neither was #1353's fault.

**(a) `Pipeline — watcher + linter tests` — self-inflicted, by design.** [MEASURED, job log
98515152774] The PR's own new `check-sot-refs` checker exits 1 on 115 path-shaped references in
`sot/**` that do not resolve, e.g. `sot/06-active-specs.md:3734 → modules/projects/projects.controller.ts`.
The guard is working; the content it guards is dirty.

**(b) `API — lint, test, compliance smoke` — a MAIN regression, and it is the important one.**
[MEASURED, job log 98515182455] Exactly **1 test of 3620** failed, in
`apps/api/src/modules/crm/accounts/__tests__/accounts.service.spec.ts` — a file #1353 does not
touch. The rev-1353 verdict called this "pre-existing and unrelated". **Pre-existing: yes.
Unrelated: no — it is the whole board.**

## WHAT CHANGED

1. **Opened PR #1354** (`fix/going-cold-fixed-clock`, head `e09ef227`), built in a **disposable
   worktree** `C:\po-worktrees\fix-goingcold-clock` off `origin/main`. Never the dev tree, never
   the watcher clone. 2 files, +41/−18.
2. **Armed native squash auto-merge on #1354** — read back `autoMerge enabled=True method=SQUASH`,
   then **merged at 14:28:02Z** into `origin/main` as `71b4fc49`. Read back on main.
3. Nothing else. No arming (0 armed, 0 gate-cleared candidates promoted this run), no merges of
   watcher-routed work, no watcher restart, no label touched, no `/sot/` edit.

## FINDINGS

### F1 — A dated time bomb took a REQUIRED check red on `main` at 2026-08-27T12:00:00Z

`accounts.service.spec.ts` pinned `NOW` to the **literal** `2026-08-14T12:00:00Z` and derived
`daysAgo(n)` from it, while `deriveGoingCold` read the **real** `Date.now()`. Two clocks, drifting
one day per day. `daysAgo(1)` = `2026-08-13T12:00:00Z` crossed `GOING_COLD_THRESHOLD_DAYS = 14` at
**exactly 2026-08-27T12:00:00Z** and is red permanently from then on.

**Positive control run first (§7) — the check CAN pass, which is what makes the failure meaningful:**

| clock | `(now − 2026-08-13T12:00Z) / 1 day` | result |
|---|---|---|
| 2026-08-27T11:00:00Z | 13.958 | `false` — PASSES |
| 2026-08-27T14:11:00Z | 14.0914 | `true` — FAILS |

`main @ 01ad020e` reads all-13-green **only because its API job ran before 12:00Z.**
[MEASURED, `gh api .../commits/01ad020e/check-runs` — read per-commit, never `gh run list --branch main`.]

**Blast radius:** `API — lint, test, compliance smoke` is one of the **four** checks required by
ruleset "Main". From 12:00:00Z today, **every PR is unmergeable and `main` is red** — the board was
hours from a total freeze, and would have frozen silently, since the symptom looks like an
unrelated flake on whatever PR happens to be open.

**Fix — complete and additive (RULE 1, both halves pass).** `deriveGoingCold` gains an **optional**
`nowMs: number = Date.now()`; the sole production caller (`accounts.service.ts:413`, verified by
`git grep`) passes two arguments and is untouched. No signature break, no behaviour change, no
migration, **no data-entry path affected**. The spec now injects the same fixed instant it builds
its dates from, so no date can detonate it again. It also closes the hole the old spec itself
named — its Case 1 comment read *"We can't inject nowMs here ... test only the structural
invariants"*, so the actual `>14 days → cold` rule was **never asserted**. It is now, plus the
exact boundary (14 d = not cold, 14 d + 1 ms = cold) and a case proving the default wall-clock
path still works. 8 assertions → 16.

**Evidence it works: CI, not my opinion.** On #1354 all **13 of 13** checks reached SUCCESS,
including `API — lint, test, compliance smoke`.

**DISPOSITION: ACTIONED — and read back to `main`.** PR **#1354 MERGED 2026-08-27T14:28:02Z**,
merge commit `71b4fc49`; `origin/main` moved **`01ad020e` → `71b4fc49`** [MEASURED, re-fetch +
rev-parse]. Fix verified present on main [MEASURED,
`git show origin/main:apps/api/src/modules/crm/accounts/accounts.service.ts`]:

```
* `nowMs` is an OPTIONAL injected clock, defaulting to the real wall clock.
nowMs: number = Date.now()
const diffMs = nowMs - lastContactedAt.getTime();
```

**The board is unblocked — confirmed on `main`, not inferred.** [MEASURED,
`gh api .../commits/71b4fc49/check-runs`] `API — lint, test, compliance smoke` =
**completed/success**, **0 failures across all 13 check-runs**, from a run that executed
**after** 12:00:00Z. That is the read-back that matters: the same job, the same clock window that
was failing, now green. Merged via native squash auto-merge, never by hand.

### F2 — The rev-1353 verdict waved away the outage it was looking straight at

`rev-1353-ready.md.log`: *"API failure is pre-existing and unrelated."* Half right, and the wrong
half was load-bearing. Pre-existing — yes. Unrelated — no: it is a required check, newly red on
`main`, and calling it "unrelated" is precisely how a board-freezing regression gets filed as
someone else's noise. The reviewer had the failing job in reach and did not read it.

The generalisable rule, and it is DOCTRINE §3 restated with teeth: **"pre-existing" is a claim
about WHERE the fault came from, never a reason to stop looking.** A reviewer that finds a red it
did not cause must still name the cause or say plainly it did not look. Note the shape matches the
existing docs-only rule (*a docs-only PR failing a CODE check is proof of a MAIN regression*) — a
pipeline-tooling PR failing an API unit test is the same signal, and nothing currently says so.

**DISPOSITION: DEFERRED** — worth a line in the review-prompt contract and in the fix-lane rule
(generalise "docs-only" to "a PR that cannot have touched the failing area"). Not urgent now that
F1 is fixed; it becomes urgent the next time a reviewer sees a red on a required check, because the
outcome is a silent board freeze rather than a visible failure.

### F3 — #1353 is watcher-routed to Marco and stays for him

`marco:true`, reason `outside tests/ or docs/: .github/workflows/ci.yml`, **no label applied** —
the routing path, which applies none. Verdict is MERGE; that does not clear RULE 2.

Its remaining red (`check-sot-refs`, 115 dangling `sot/**` refs) is real but is **not** a defect in
#1353 — it is the guard finding pre-existing dirt the moment it is switched on. Worth Marco knowing
before he merges: **the moment #1353 lands, `check-sot-refs` is red on `main` until those 115 refs
are cleaned.** Whether that is acceptable is his call, and there is a shape question underneath it:
many of the unresolved refs read as **module-relative** (`modules/projects/projects.controller.ts`
almost certainly means `apps/api/src/modules/projects/projects.controller.ts`), so part of the 115
may be the checker being too literal rather than the docs being wrong. Cleaning them is a `/sot/`
edit and belongs to Station 05 regardless.

**DISPOSITION: ESCALATED** — see the question below.

### F4 — `CADENCE['03'] = 4` still makes 03 read SILENT on a daily cron

Third run in a row where the freshness tool reports 03 SILENT and the correct reading is "not due
yet". A check that cries wolf every run trains its reader to skip it — which is the whole value of
the freshness probe gone. One-line fix (`'03': 24`).

**DISPOSITION: DEFERRED** — deliberately not folded into #1354. F1 was a live board freeze and a
fix PR that mixes an urgent unblock with unrelated tidy-up is slower to review and riskier to
revert. It is a standalone one-line PR for the next run or for 04.

## WHAT I DID NOT DO

- **Did not merge #1353.** RULE 2, proven live by the `marco:true` probe rather than by its labels
  (it has none). A MERGE verdict and a green board are both irrelevant to that gate.
- **Did not restart the watcher, and did not run the §3b ENSURE-UP relaunch** despite `wrapper=0`.
  ENSURE-UP as written starts a SECOND supervisor; the real restarter is the `PO Watcher Keepalive`
  task, measured Ready with lastResult=0 three minutes before this run.
- **Did not arm anything.** 0 armed and nothing gate-cleared was promoted — with a required check
  red on `main`, arming new work would only have queued PRs that cannot merge.
- **Did not touch the 115 `sot/**` refs.** `/sot/` is Station 05's alone.
- **Left no worktree behind.** `C:\po-worktrees\fix-goingcold-clock` and its `.pr-body.md` scratch
  removed and pruned after the merge; verified absent. Closing state re-measured at 14:38Z:
  **no `index.lock` · watcher pid 28328 (unchanged for the whole run) · 0 armed.**
- **Did not audit `apps/web/src/pages/crm/AccountsListPage.tsx:28`**, which mirrors the same
  going-cold logic client-side. The `Web` check is green, so it is not part of this unblock —
  but it is the obvious place for a second copy of the same bug, and worth a look.

## ESCALATED — for Marco

**#1353 is routed to you and I have not merged it. Before you do, know that merging it turns
`check-sot-refs` red on `main` immediately**, on 115 pre-existing unresolved references inside
`sot/**`. Everything else about the PR is green and its review verdict is MERGE.

Applying RULE 1 — *solves it completely, now and in future, without damaging existing or future
data entry*:

- **(A) Land #1353 with the checker wired in NON-blocking, then clean the 115 refs, then make it
  blocking.** Passes both halves: the guard exists from day one, `main` never goes red, no data is
  touched, and the end state is the full guard. Costs one extra follow-up PR.
- **(B) Clean the 115 refs first (Station 05, `/sot/` doc-reconcile PR), then land #1353 blocking.**
  Also passes both halves and reaches the same end state; slower, and it holds a finished PR behind
  a docs cleanup of unknown size. Worth first checking how many of the 115 are really dangling
  versus module-relative paths the checker reads too literally — that number decides whether B is
  hours or minutes.
- **(C) Land #1353 as-is and accept a red `main` until the refs are cleaned.** Fails the *"without
  damaging"* half — not data, but a red required check blocks **every** PR, which is exactly the
  freeze F1 just came out of.
- **(D) Don't land it.** Fails the *"solves it completely"* half; the dangling refs stay invisible.

**A is my recommendation.**
