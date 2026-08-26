# Station 00 — Supervisor | 2026-08-26 00:08Z–00:14Z

## GROUND

```
UTC            2026-08-26 00:08:33Z
origin/main    8f0377e5            (fetched +refs/heads/main:refs/remotes/origin/main first)
dev tree       main @ 8f0377e5     C:\ProjectOperations2   (HEAD..origin/main = 0)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE — this run was not read-only. NOT BLIND: `start_process` on `powershell.exe`
reached `LAPTOP-E6NHU4E4`. Read in full this run: `00-supervisor.md`, `DOCTRINE.md`,
`STATION-CAPABILITIES.md`.

## WHAT I MEASURED

**Board (status-sweep 00:09:11Z, cross-checked live).** [MEASURED] 4 open PRs:

| PR | mergeState | CI | labels | watcher routing |
|---|---|---|---|---|
| #1325 | UNSTABLE | 6 pass / 1 fail | `do-not-merge` | `escalates:true — held for Marco` |
| #1323 | BLOCKED | 10 pass / 2 fail | `do-not-merge` | `escalates:true — held for Marco` |
| #1320 | CLEAN | 12 pass / 0 fail | *(none)* | `stays for Marco (outside tests/ or docs/: apps/web/src/App.tsx)` |
| #1316 | CLEAN | 12 pass / 0 fail | *(none)* | `stays for Marco (outside tests/ or docs/: apps/api/jest.config.ts)` |

**All four are watcher-routed to Marco.** [MEASURED] The routing probe was run against the
**CLONE** log (`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\2026-08-24.log`, 17 hits),
not the dev tree — the dev-tree `logs\` has not been written since 2026-07-08 and a probe pointed
there returns July only. That is an instrument trap worth naming: **the dev-tree watcher log dir
looks alive and is three weeks dead.** Two of the four carry no label at all (#1316, #1320), so a
label-only check would have cleared half this board wrongly — the standing trap, re-confirmed.

**The reds are not defects.** [MEASURED] job logs read, not the PR page:

- **#1323** `PR gates`: CP-11, CP-12, CP-13, CP-17, CP-22, CP-23, CP-24, CP-25 all **PASS**;
  CP-09/10 SKIP. The single FAIL is
  `CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true). A human must review and REMOVE the label]`.
- **#1325** `PR gates`: identical shape — every other gate PASS/SKIP, sole FAIL is CP-26. Every
  non-gate job reports `skipping` (docs-only path filter). CP-24 explicitly PASSes it as
  `sot-only change (doc-reconcile PR): sot/04-data-model.md`.
- **#1323** `tendering-e2e`: the log's own verdict is `##[error]The operation was canceled.`,
  42 s in, immediately after `pnpm install --frozen-lockfile` reported `Done in 15.1s`. **A
  cancellation, not a test failure.** No test ever ran.

So the board's *entire* red surface is **one human gate firing correctly, plus one cancelled run.**

**Trunk is GREEN.** [MEASURED] per-commit, the sanctioned way:
`gh api repos/GH-Mantova/ProjectOperations/commits/8f0377e5/check-runs` → `total 12,
non-success 0, pending 0`. I did **not** quote `status-sweep`'s trunk colour — §9.4 / the standing
trap: `gh run list --branch main` is non-deterministically stale.

**Machinery.** [MEASURED] watcher node RUNNING pid 29024; auto-restart wrapper alive (1);
heartbeat age 455 min — which with **ARMED = 0** is *idle*, the correct state, not wedged (the
heartbeat ticks only mid-run). `git index.lock` absent in both trees; 0 git processes; no PR
touched in the last 2 min.

**Queue.** [MEASURED] `armed (*-ready.md) = 0` at depth 1 · needs-marco 9 · no-pr-opened 107 ·
failed 20 · blocked 0. Nothing staged this run.

**Clone.** [MEASURED] `C:\po-watcher\ProjectOperations` is on `docs/sot-04-bp0a-job-canonical`,
dirty = 38 = **34 ` D` deletions under `docs/pr-reviews/`** (the verdict-archive sweep, by design)
**+ 4 `??` live verdicts** for exactly the four open PRs (`pr-1316/1320/1323/1325-review.md`).
This reproduces Station 03's F1/F2 measurement independently. `status-sweep`'s
`NOT clean-on-main` on this tree is a **permanent false alarm**, not news.

## WHAT CHANGED

**One mutation.** Re-ran the cancelled `tendering-e2e` run on #1323:
`gh run rerun 32905002862 --failed`.

**Read back** (DOCTRINE §1 — the first invocation printed nothing, which is exactly the shape that
gets reported as "done" and is not):
`gh run view 32905002862 --json status,attempt,updatedAt` →
`{"attempt":2,"status":"in_progress","updatedAt":"2026-08-26T00:12:31Z"}`. **attempt 2 exists and
is running** — the rerun took. A second explicit attempt returned
`cannot be rerun; This workflow is already running`, which is the confirmation, not a failure.

Nothing else. **No prompt armed. No PR merged. No label touched. No git write in either tree.**

## FINDINGS

### F1 — Every open PR is behind Marco's human gate. The pipeline cannot move this board.

[MEASURED] 4 of 4 open PRs are watcher-routed to Marco (evidence table above). Marco's 2026-08-25
22:10Z clearance was **batch-only** and was spent on #1322 / #1319 / #1317 / #1321. RULE 2 is not
overridden by green, by CLEAN, by an absent label, or by a verified diff. #1320 and #1316 are
**12/12 green and have been for hours**; they are waiting on nothing but a human.

**ESCALATED** — to Marco, as a question, not a status update:

> **Four PRs are finished and waiting only on you. Which do you want released?**
>
> - **#1316** `feat(tendering): capacity service + tenders.allocate permission (EW-2a)` — CLEAN,
>   12/12 green, no label. Routed only because it touches `apps/api/jest.config.ts`.
> - **#1320** `fix(web): gate /crm and /clients routes behind RequirePermissions crm.view` — CLEAN,
>   12/12 green, no label. Routed only because it touches `apps/web/src/App.tsx`.
> - **#1323** `feat(pipeline): arm-prompt.ps1 serializer` — `do-not-merge`. **This is the arming-trap
>   fix, and arming stays held until it lands** (see F2). Its only real red was a cancelled e2e,
>   now re-running.
> - **#1325** `docs(sot-04): reverse B-P0a direction to Job-canonical` — `do-not-merge`, sot-only,
>   CP-24 PASS. Blocks the bp0a slice work.
>
> **RULE 1, complete-and-additive first:** clear **#1323 first, then #1325**. That is the option
> that solves it immediately *and* in future without touching data entry — #1323 removes the
> arming race that is currently the reason this station arms nothing, and #1325 unblocks the bp0a
> chain, so the board resumes moving on its own instead of needing you again in two hours.
> *Alternatives:* clearing only the two green feature PRs (#1316/#1320) fails the **future** half —
> it lands work but leaves arming frozen and you back here next cycle. Clearing all four in one
> batch passes both halves but spends your review on #1323's 335-line new `arm-prompt.ps1` in the
> same breath as three unrelated diffs; it is faster, not safer.
>
> A clearance is read as **batch-only** unless you say otherwise.

### F2 — Arming stays held this cycle, and the condition is measured, not assumed.

[MEASURED] The resume condition carried from 2026-08-25 22:10Z is *"#1323 merges **OR** Marco-gated
open ≤ 2, **AND** no commit on origin/main in the preceding 10 min."* Live: #1323 is **open**;
Marco-gated open = **4**. Both halves of the OR are false, so the condition does not fire.

Two independent reasons reinforce it, and either alone would be sufficient:

1. [MEASURED] the clone is not on `main` and carries 4 untracked live verdicts — Station 03's F2
   shows a restart would stash them; arming is what forces that restart.
2. [INFERRED, from Station 04 2026-08-25 22:10Z] a **released** `requires_on_main` /
   `requires_file_on_main` gate is a **permanent lint REJECT** (5/5 released → REJECT; 4/4 unmet →
   ADMIT as control). The staged fix `pr-gate-release-is-not-a-reject-HOLD.md` is itself unarmed.

**DEFERRED** — not now, and the trigger is explicit: resume arming the moment **#1323 is on
`origin/main`**, or Marco-gated open drops to ≤ 2, *and* origin/main has been quiet 10 min. The
three re-verified armable HOLDs remain
`pr-unified-api-key-vault-slice4c-retire-old-screens` (#1111, 11 d),
`pr-rates-consumers-s3-persona-export` (#1257, 5 d), `pr-fv2-maintenance-usage-intervals`.

### F3 — The dev-tree watcher log directory is three weeks dead and reads as live.

[MEASURED] `C:\ProjectOperations2\scripts\pr-watcher\logs` exists, is populated, and its newest
`*.log` by mtime is **2026-07-08**. The live log is in the clone. A Marco-routing probe pointed at
the dev tree returns 13 hits, all from July, all about PRs #504–#514 — **a confident, coherent,
entirely historical answer**, which is §7's exact failure shape. I hit this myself this run and
caught it only because the PR numbers were three weeks stale.

**ACTIONED** — corrected in-run by re-probing the clone path (17 hits, 2026-08-23→08-25, covering
every current PR). Recorded here and in project memory so the next station's probe starts at
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs`. Verified by the contrast: the clone
probe returns #1316/#1320/#1323/#1325; the dev-tree probe returns none of them.

### F4 — COLLECT: 19 breadcrumbs validated, 18 of them UNTRACKED.

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0, **CLEAN**:
`19 checked, 0 malformed, 7 skipped as pre-contract`. Freshness: 00 ok (2.0 h / 2 h) · 03 ok
(1.2 h / 4 h) · 04 ok (2.0 h / 4 h) · 05 ok (10.0 h / 24 h) · 02 dispatch-only. **No station is
silent.** But 18 of 19 carry `is UNTRACKED — it reaches nobody until a board PR commits it`.

Station findings collected and dispositioned this run:

- **03 F1** (verdict-archive sweep dirties the clone permanently) — reproduced independently above.
  **DEFERRED**, pending a staged fix prompt; 00 does not create PRs (LL-38) and arming is held (F2).
  Urgent the moment a watcher restart is needed while verdicts are live.
- **03 F2** (a restart stashes the 4 live verdicts) — **ACTIONED as a constraint**: this run did not
  restart the watcher, and did not need to (pid 29024 alive, wrapper alive, ARMED 0).
- **03 F3** (4 orphaned worktrees each hold one **unpushed** commit; three are `/sot/`) —
  **DEFERRED**, with the sweep's "prune" advice explicitly overruled. `status-sweep.ps1` calls these
  "aborted run leftovers — investigate/prune"; 03 measured that pruning the *branch* destroys the
  only copy on earth. Do not prune. Station 05 adopts the three `docs/sot-*` branches.
- **03 F4** (the active log is named for the watcher's START date, so there is no `2026-08-26.log`)
  — **ACTIONED**: applied this run; it is why F3 above resolved correctly.
- **04 2026-08-25 22:10Z** (released gate = permanent lint REJECT) — **DEFERRED** into F2's
  resume condition.

**ACTIONED** (the collect itself) / **DEFERRED** (getting the breadcrumbs tracked).

### F5 — CP-26 red is the gate, and this run cost nothing proving it again.

[MEASURED] Both RED PRs fail `PR gates` on CP-26 **alone**, with every other gate PASS or SKIP.
`ci.yml`'s `on: pull_request` still has no `types:`, so the label race runs both ways and
"green + CLEAN" does not mean "not held". No CI run was spent trying to drive CP-26 green.

**DEFERRED** — the fix is `types: [..., labeled, unlabeled]` in `ci.yml`. Not this run's lane while
arming is held; it needs a staged prompt.

## WHAT I DID NOT DO

- **Merged nothing.** All four open PRs are watcher-routed to Marco; RULE 2 binds, and the 22:10Z
  clearance was batch-only and is spent. #1316 and #1320 being 12/12 green does not release them.
- **Armed nothing.** F2 — the resume condition is measured false on both branches of its OR.
- **Did not clean the watcher clone.** 34 deletions + 4 untracked verdicts is by design (03 F1),
  and `git checkout` / `stash` / `clean` in `C:\po-watcher\ProjectOperations` is an absolute stop.
- **Did not prune the 4 orphaned worktrees**, against `status-sweep`'s advice — each holds an
  unpushed commit that exists nowhere else (03 F3).
- **Did not restart the watcher.** It is alive and idle with 0 armed; a restart would stash the four
  live review verdicts for nothing.
- **Did not quote `status-sweep`'s trunk colour.** Read `check-runs` per-commit instead.
- **Did not create a PR** to track the 18 untracked breadcrumbs — LL-38, that is 06/02's lane.
- **Did not wait out** the #1323 `tendering-e2e` rerun. It was `in_progress` at 00:12:31Z; the next
  run reads its conclusion. If it goes green, #1323's only remaining red is CP-26 — i.e. it is
  finished and waiting purely on Marco.
