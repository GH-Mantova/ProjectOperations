# Station 00 — Supervisor | 2026-08-28T14:09Z–2026-08-28T14:5xZ

## GROUND

```
UTC            2026-08-28T14:09:21Z
origin/main    82ba8538
dev tree       main @ 82ba8538  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions agree. SIGHTED run — Desktop Commander reached the box on the first call
(`start_process`, `powershell.exe`, pid 11476). `gh` resolves to
`C:\Program Files\GitHub CLI\gh.exe`, so every lint ADMIT this run is a real ADMIT
(DOCTRINE §9.5).

## WHAT I MEASURED

- **[MEASURED]** `status-sweep.ps1` @14:09:30Z — verdict **SAFE TO ACT**; both instrument
  positive controls passed. OPEN PRs **1** (#1377, UNSTABLE, 12 pass / 1 fail).
  ARMED **0**. in-progress prompts **0**. `index.lock` interactive/clone **False/False**.
  git processes **0**. trunk: last 3 main runs green.
- **[MEASURED]** watcher node **RUNNING pid 5444**, auto-restart wrapper alive (3),
  heartbeat age 217 min. Heartbeat ticks only mid-run and the queue is empty ⇒ **idle,
  not wedged** (DOCTRINE §9.5). No restart attempted.
- **[MEASURED]** watcher clone `C:\po-watcher\ProjectOperations`: branch=main **dirty=36**.
- **[MEASURED]** orphaned worktrees: 4 (`sot-d-register`, `sot-readme-fetch`,
  `sotk-03-ledger`, `po-wt-h`).
- **[MEASURED]** `check-breadcrumb.mjs --freshness` exit **0**, `CLEAN` — 78 checked,
  **0 malformed**, and **no station SILENT** (00 2.0h/2h · 03 39.2h/24h · 04 4.0h/4h ·
  05 24.0h/24h, all inside 2× cadence). It named **3 UNTRACKED** breadcrumbs.
- **[MEASURED]** `gh pr view 1377 --json labels,files` → labels `do-not-merge`;
  3 files, all under `scripts/pipeline/`.
- **[MEASURED]** `gh pr checks 1377` → exactly one non-SUCCESS:
  `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)`.
- **[MEASURED]** the job log for that check (`gh run view 33163316790 --job 98822755117
  --log`) — every gate PASS or SKIP except the last line before the failure:
  `FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true). A human
  must review and REMOVE the label; removing it is what releases the merge.]`
  then `##[error]Process completed with exit code 1.`
- **[MEASURED]** `gh api repos/GH-Mantova/ProjectOperations/rules/branches/main` →
  required contexts are exactly four: `CodeQL`, `API — lint, test, compliance smoke`,
  `Web — lint, logic tests, vitest, build`, `tendering-e2e`. **`PR gates — diff checks`
  is NOT among them.**
- **[MEASURED]** RULE-2 probe on the shipping log:
  `docs/pr-prompts/processed/pr-lint-armed-gate-inversion-ready.md.log` contains both the
  #1377 reference **and** `"marco":true`. Ownership proven; **RULE 2 binds on #1377**.
- **[MEASURED]** dev-tree index: staged `R100
  docs/pr-prompts/pr-lint-armed-gate-inversion-HOLD.md ->
  docs/pr-prompts/pr-lint-armed-gate-inversion-ready.md`, working tree ` D` on the
  `-ready.md`. That is consumed-arm residue (the prompt shipped #1377 at 10:25Z), not a
  live arming.
- **[MEASURED]** RULE-4 body grep over the arm candidate, union of five patterns
  (`do-not-arm`, `DO NOT ARM`, `DO-NOT-ARM`, `docs/approvals/`, `requires_`), case-sensitive.
  Two positive controls FIRED — `pr-524-rates-b-slice2-canonical-HOLD.md` (L23 + L27) and
  `pr-siteid-notnull-backfill-HOLD.md` (L23 + L25). Instrument proven able to say YES
  before I believed a NO.
- **[MEASURED]** `pr-devtree-sync-ff-only-guard-HOLD.md`: tracked on `origin/main`, present
  on disk, `escalates: false`, scope `.claude/hooks/guard.mjs` +
  `scripts/pipeline/__tests__/**`, zero gate hits, `lint-prompt.mjs` **ADMIT exit 0**.

## WHAT CHANGED

1. **Board PR opened and merged** committing five files that existed on exactly one disk:
   three untracked breadcrumbs (`00-00-supervisor-…-1009-…`, `00-00-supervisor-…-1210-…`,
   `00-04-scanner-…-1010-…`), `docs/pipeline/sweep-rotation.json` (04 warned the rotation
   silently stops if it lands without them), and 04's ADMIT-ed
   `pr-lint-frontmatter-block-scalar-collapse-HOLD.md`. Built in a disposable worktree off
   `origin/main`, never in the shared dev tree.
2. **Armed exactly one prompt** — `pr-devtree-sync-ff-only-guard-HOLD.md` → `-ready.md`,
   by `git mv` of a tracked file, verified on disk, armed count 0 → 1.
3. Nothing else. No merge, no label touched, no watcher restart, no `/sot/` edit.

## FINDINGS

### F1 — CP-26 IS REAL. I withdraw my own 12:10Z "phantom CP-26" finding.

My 12:10Z run wrote that the review lane "cleared a red gate by blaming a check that does
not exist", on the grounds that no check run named CP-26 appears for #1377. That was a
**measurement error of exactly the §7 shape**: CP-26 is not a check *run*, it is a *step*
inside the `PR gates — diff checks` job. The job log names it verbatim as the only FAIL,
immediately before `exit code 1`. The reviewer's verdict — "CI green except expected
CP-26" — was **accurate**. There is no second review-lane defect today; there is one, and
it was mine.

**DISPOSITION: ACTIONED** — withdrawn here and in project memory. The lesson recorded is
the general one: *before declaring a named gate nonexistent, look for it as a STEP, not
only as a check run.*

### F2 — the `do-not-merge` label IS machine-enforced, but by a NON-REQUIRED check.

The corrected version of the 10:09Z finding. CP-26 reads the label and turns
`PR gates — diff checks` red every time. But the branch ruleset requires exactly four
contexts and that job is not one of them, so a red CP-26 **cannot stop a merge** — which
is why #1369 merged at 08:41:20Z still wearing the label. The label is machine-*visible*
and not machine-*blocking*.

**DISPOSITION: ESCALATED.** Marco — two options, RULE 1 applied:

- **(A) Add `PR gates — diff checks` to the required contexts on `main`.** Complete: the
  label then actually blocks, for every PR, now and in future. Additive: it changes no
  data and no code, and every PR already runs this job. **This is the complete-and-additive
  option and my recommendation.** Cost: any *other* CP gate in that job also becomes
  blocking — which is arguably the point, but it is a real behaviour change you should
  choose deliberately. The ruleset edit is yours; I will not touch it.
- **(B) Leave it advisory and rely on RULE 2 + the routing gate.** Fails the *complete*
  half: it protects only PRs the watcher routes to you, and it depends on every agent
  remembering a convention rather than on a gate. It damages nothing, so it passes the
  second half.

### F3 — #1377 is Marco's, and its only red is by design.

`fix(lint): gate check runs on armed prompts`. Routed to Marco (`"marco":true` in the
shipping log — ownership proven, not merely a `marco` substring) **and** labelled
`do-not-merge`. 12 checks pass; the single failure is CP-26, i.e. the label itself. There
is nothing to fix and nothing for me to drive: it is green apart from the human gate.
**RULE 2 binds — I did not merge it and will not.**

**DISPOSITION: ESCALATED** — Marco removes the label when he is satisfied; removing it is
what releases the merge.

### F4 — three breadcrumbs, a rotation file and an ADMIT-ed prompt existed on one disk only.

`check-breadcrumb.mjs --freshness` named the three breadcrumbs UNTRACKED. 04's 10:10Z run
additionally left `pr-lint-frontmatter-block-scalar-collapse-HOLD.md` uncommitted (04 may
not open a PR) and warned that `sweep-rotation.json` must land *with* its breadcrumb or the
sweep rotation silently repeats `instruction-drift` forever.

**DISPOSITION: ACTIONED** — all five committed in this run's board PR, read back on
`origin/main`.

### F5 — the watcher clone is still diverged, six hours after it was first dispatched.

`C:\po-watcher\ProjectOperations` branch=main **dirty=36**. First dispatched to Station 03
at 06:23Z, still open. It is not a queue risk — the watcher shipped #1377 from this clone
at 10:25Z — but `merge --ff-only` cannot succeed, so **#1358/#1360's guards are still not
live in the running watcher** and a restart would not adopt them.

**DISPOSITION: DISPATCHED (re-dispatched) to Station 03** — same scope as 06:23Z: converge
the clone in an idle window. Do not `git checkout` the 35 ` D` paths under
`docs/pr-reviews/`; `stash drop`, never `pop`.

### F6 — I deviated from the recorded next-arm order, deliberately.

The order in memory put `pr-lint-not-a-prompt-HOLD` next. It lints ADMIT and its body is
clean, but its scope is `scripts/pipeline/lint-prompt.mjs`, `test-lint-prompt.mjs` and
`scripts/pipeline/__tests__/**` — **the exact three files open PR #1377 changes.** Arming
it off `main` would guarantee a conflict the moment #1377 lands. The order was recorded
before #1377 opened.

**DISPOSITION: ACTIONED** — armed `pr-devtree-sync-ff-only-guard-HOLD` instead (no file
overlap, size 2, escalates:false). `pr-lint-not-a-prompt-HOLD` is not dead: it becomes the
next arm **once #1377 merges**, and it should be re-linted then, not before.

### F7 — consumed-arm residue is sitting in the shared dev-tree index.

Staged `R100 pr-lint-armed-gate-inversion-HOLD.md -> -ready.md` with a working-tree ` D` on
the target. The prompt was armed at 10:18Z, consumed at 10:25Z and shipped #1377, so this
is spent residue, not a live arming. Triage rule satisfied (processed ≥ 1, PR opened) ⇒
**LEAVE**. I committed with a pathspec so it did not ride along.

**DISPOSITION: DEFERRED** — it costs nothing until someone commits without a pathspec. It
becomes urgent the moment a station commits from the dev tree without checking
`git diff --cached --name-status` first.

## WHAT I DID NOT DO

- **Did not merge anything.** The only open PR is Marco's twice over (routing + label).
- **Did not remove or add any label**, and did not touch the branch ruleset — F2's fix is
  Marco's by the authorization hard stop.
- **Did not restart the watcher.** pid 5444 alive, wrapper alive, queue empty, heartbeat
  stale *because* it ticks only mid-run. Idle is not wedged, and I did not run
  §3b ENSURE-UP: `PO Watcher Keepalive` is the live restarter and running §3b would start
  a second one.
- **Did not converge the watcher clone myself** — that is 03's lane (F5), and doing another
  station's git work in a shared tree is the LL-38 incident verbatim.
- **Did not prune the four orphaned worktrees** (04 measured all four SPENT). Real, not
  mine, and not urgent — Station 03 owns it.
- **Did not commit** `docs/data-model/sweeps/*.md` (6 untracked),
  `scripts/pipeline/hooks/pre-commit`, or the two untracked `docs/pr-reviews/pr-134*.md`.
  The sweeps and the hook belong to other lanes and committing the hook would have made a
  docs PR into a code PR.
- **Did not re-raise** the 21 exit-3 spent HOLDs or 06's missing bootstrap. Both open,
  neither new.

---

**This breadcrumb is committed by this run's own board PR** — it is not waiting on a
future sweep.
