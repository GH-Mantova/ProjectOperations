# Station 00 — Supervisor | 2026-09-01T20:09Z–2026-09-01T20:25Z

## GROUND

```
UTC            2026-09-01T20:09:49Z
origin/main    a063db2c            (fetched, then rev-parse)
dev tree       main @ 156ecd4a     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Versions AGREE — this run had full authority. **SIGHTED run**: `start_process` returned a
PowerShell shell on `LAPTOP-E6NHU4E4` on the first attempt. This is not a blind run and its
quiet findings are real quiet, not absence of instruments.

## WHAT I MEASURED

- `[MEASURED]` **Locks absent in BOTH trees**, checked first per standing protocol.
  `Test-Path C:\ProjectOperations2\.git\index.lock` → `False`;
  `C:\po-watcher\ProjectOperations\.git\index.lock` → `False`.
- `[MEASURED]` **Sweep verdict: SAFE TO ACT.** `bring-up-to-speed.ps1`, generated
  `2026-09-01 20:09:54Z`. Instrument positive controls both `[LIVE]` PASS (gh reached GitHub,
  saw merged #1499; node runs).
- `[MEASURED]` **Board is ONE open PR: `#1483`**, BLOCKED, CI 11 pass / 3 fail. Nothing else open.
- `[MEASURED]` **`#1477` MERGED at 2026-09-01T19:48:01Z** — 21 minutes before this run started.
  `gh pr view 1477 --json ...` → `mergedBy=GH-Mantova`, `author=GH-Mantova`,
  `autoMergeRequest=False` (null), `labels=` (none), head `test/export-make-summary-helper`,
  three files, all `apps/api/…` (`estimate-export.service.spec.ts`,
  `test-support/make-summary.ts`, `quote-html.builder.spec.ts`).
- `[MEASURED]` **RULE-2 probe, with its positive control.** In `docs/pr-prompts/processed/`:
  `Select-String -Path *.log -Pattern 'marco.:true'` → **602** verdicts (POS control passes;
  was 592 on 08-31, so the corpus is still growing and the probe is live).
  - `PR #1483` → 5 lines, including the live verdict
    `[watcher] merge result for PR #1483: {"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`.
  - `PR #1477` → **1 line, and it is NOT a watcher merge verdict**:
    `rev-1477-ready.md.log :: PR #1477 verdict: **BLOCK** (reported as REJECT-AND-REDO)`.
- `[MEASURED]` **`#1483` currently carries NO labels** (`gh pr view 1483 --json labels` → empty),
  while its watcher verdict still reads `labelled do-not-merge`. The 08:51:48Z label removal
  (escalation #20) has **not** been reverted.
- `[MEASURED]` **main is FULLY GREEN at the new head.**
  `gh run list --commit a063db2c8a8594845ee85198a9cfa5dec68fb011` (full 40-char SHA, per §9.4)
  → 4 runs, all `completed / success`: CI, Tendering Browser Smoke, Deploy, Push on main.
- `[MEASURED]` **`#1483`'s CI red is ONE thing only.** `gh run view 33551922904 --log-failed`
  → 47 lines, every one from the `Approval receipt (CP-26)` job:
  `FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #1483 was labelled do-not-merge and
  released, but docs/decisions/merge-approvals/1483.md is not in this PR's diff…`.
  The third red (`PR gates — diff checks`) is the same CP-26 step failing the whole job, not an
  independent gate failure.
- `[MEASURED]` **No approval receipt has ever been authored, for any PR.**
  `git ls-tree -r --name-only origin/main -- docs/decisions/merge-approvals/` returns exactly
  one entry: `README.md`.
- `[MEASURED]` **`#1483`'s e2e red GREW from 7 to 9.** `gh run view 33551923033 --log-failed`
  at head `ba048dbb` → **`9 failed / 155 passed (13.8m)`**. The seven previously reported are
  still there (`batch3-scope-items` :65/:122/:184/:252, `batch3-scope-waste`:45,
  `batch8-misc` :91/:105) **plus two NEW ones**: `batch3-scope-cutting.spec.ts:48` and `:218`.
- `[MEASURED]` **The live watcher wrapper is `watcher-launcher-singlelane.ps1`.** Direct
  `Get-CimInstance Win32_Process` query:
  `30600 watcher-launcher-singlelane.ps1` → `34332 start-watcher.ps1` → `28400 node index.mjs`.
- `[MEASURED]` **Machinery held.** node pid **28400** unchanged since the 18:09Z run; wrapper
  alive (1); watcher clone `branch=main dirty=0`; heartbeat age 103 min with an empty queue
  (idle, not wedged); 0 git processes; 0 in-progress prompts.
- `[MEASURED]` **COLLECT: the queue is empty.** `node scripts/pipeline/check-breadcrumb.mjs
  --freshness` → `CLEAN`, exit **0**. `structure: 2 checked, 0 malformed`. Freshness: 00 1.8h,
  03 21.2h, 04 2.0h, 05 6.0h — **no station SILENT**. The only two breadcrumbs in the queue root
  are this station's own 18:09Z and 18:25Z reports, both already dispositioned and shipped in
  `#1498`/`#1499`.
- `[MEASURED]` **`triage-holds.ps1`**: `spent=0  gates-satisfied=40  still-gated=30  unreadable=0
  of 70`. Both controls PASS (GIT control read 46137 chars of DOCTRINE; SPENT control emitted
  exit 3 on the fixture). Two distinct verdicts observed, so the instrument is calibrated.
- `[MEASURED]` **RULE 4 arming detector, second instrument.** Case-sensitive grep of the
  three-marker union (`DO_NOT_ARM|do-not-arm|Arm ONLY`) on the candidate → **0 hits**;
  positive control on `pr-524-rates-b-slice2-canonical-HOLD.md` → **1 hit**. Body read in full:
  no prose gate. `## STANDING AUTHORITY` present and is boilerplate, not an arming grant.

## WHAT CHANGED

- **ARMED** `pr-station-docs-wrong-wrapper-and-false-gitignore-claim` via
  `scripts/pipeline/arm-prompt.ps1` (the primitive — never a bare `git mv`). `-WhatIf` first
  (`all checks pass`), then the real run: `ADMIT`, rename, index verified to contain exactly the
  two expected paths, `ARM_INDEX_RELEASED`, lock released, exit 0.
  **Read back:** `ready=True hold=False`, `armed-count=1`, `git diff --cached --name-status`
  empty, audit line `2026-09-01T20:15:47Z  ARMED  pr-station-docs-wrong-wrapper-and-false-gitignore-claim  escalates=false`.
- **DISCHARGED** `needs-marco/pr-1477-review-block.md` →
  `needs-marco/discharged/pr-1477-review-block.md` (moved, never deleted).
  **Read back:** `after-src=False after-dst=True`; needs-marco 40 → **39**.
- This breadcrumb, plus the archiving of the two dispositioned 18:09Z/18:25Z breadcrumbs.

## FINDINGS

### F1. `#1477` merged 21 minutes ago and NO instrument can say who merged it — 8th occurrence

`#1477` was hand-classified MARCO'S by the 18:09Z run (all three files under `apps/api/`, outside
the `^(tests|docs)/` **path prefix** — the rule is a prefix, not a file kind, even though all
three files are tests by kind). It merged at 19:48:01Z with `autoMergeRequest: null`, no labels,
and `mergedBy=GH-Mantova` — **the shared token, which names no human**. There is no watcher merge
verdict for it, so the RULE-2 probe is structurally silent (DOCTRINE §10.1).

This is the same unattributable-release shape as escalation **#20** (`#1483`'s `do-not-merge`
removed at 08:51:48Z). It is now the **eighth** occurrence, and the second in one day. It is also
the exact case escalation #20's receipt convention exists to make answerable — and
`docs/decisions/merge-approvals/` still holds **only a README**, so the convention has never once
been used.

Two mitigating measurements, stated so nobody re-litigates them: **main is fully green at
`a063db2c`** (4/4 runs success, including the browser smoke), and the `BLOCK` review verdict that
`#1477` carried claimed *"TypeScript now rejects them"* — **refuted by the live build**. The block
was stale, exactly as `pr-1156-review-block.md` was (§7.1). No harm landed; the attribution gap is
the finding, not the diff.

**DISPOSITION: ESCALATED** — folds into open escalation #20, which is Marco's and has two halves.
This run adds the eighth data point and the measurement that the receipt directory is still empty.
🔴 **No agent may author a `merge-approvals/<N>.md`** — an agent-written receipt turns the only
working instrument into a rubber stamp.

### F2. `#1483` cannot go green from this station, and its e2e red got WORSE

Two independent reds, and I own neither:

1. **`Approval receipt (CP-26)` → `RELEASED_NO_RECEIPT`.** Marco's, absolutely. Half (i) of
   escalation #20. `#1483` cannot go green without it.
2. **`tendering-e2e` → 9 failed / 155 passed**, up from 7 at the 18:09Z run, with two new
   failures in `batch3-scope-cutting.spec.ts` (:48, :218). **These are `#1483`'s own diff, not a
   trunk regression** — main runs the same suite and is green at `a063db2c`.

`#1483` also still carries a live `marco:true` verdict, so **RULE 2 bars me from merging it**
regardless of colour. 04 measured seven HOLD prompts transitively behind it, so this remains the
highest-leverage red on the board and I cannot move either half of it.

**DISPOSITION: DISPATCHED** (e2e half → 01/02: nine acceptance failures at head `ba048dbb`,
all `#1483`-specific, two of them new since 18:09Z) and **ESCALATED** (receipt half → Marco,
escalation #20).

### F3. The wrapper-name question is SETTLED, and a station doc is measurably wrong about it

`docs/pipeline/stations/03-machine-minder.md:234` tells a reader to relaunch via
`C:\po-watcher\watcher-launcher.ps1`. **Measured this run, the live chain is
`watcher-launcher-singlelane.ps1` (pid 30600) → `start-watcher.ps1` (34332) → `node` (28400).**
Both files exist on disk, so a `Test-Path` guard passes on the wrong one and nothing errors —
which is why this survived.

⚠️ **A note for the next run, so this is not re-litigated.** The 00-supervisor station doc §3b
records a 2026-09-01T08:12Z measurement of a chain headed by `watcher-launcher.ps1` (pid 13464).
That was true when taken — during the nine-wrapper crash loop (escalation #19). The machine has
since settled back onto `-singlelane`. **Both measurements are correct; the machine changed.**
The `-singlelane` name is the one to write down, because it is what `ensure-watcher.ps1:10`
sets as `$Launcher`.

**DISPOSITION: ACTIONED** — armed `pr-station-docs-wrong-wrapper-and-false-gitignore-claim`,
which corrects exactly this line plus the false "all gitignored" claim in `04-scanner.md`. Its
remedy was independently confirmed against the live process table before arming, not taken on
the prompt's word.

### F4. The tests-docs auto-merge lane is being exercised deliberately

DOCTRINE §10.3: the lane is live and works (42 PRs), but has not fired since `#1301` because
docs work gets hand-landed instead of armed. The board is at its emptiest in days — **1 open PR,
0 armed, watcher healthy and idle** — so the starvation argument against arming does not apply
this cycle.

The prompt I armed is **docs-only** (`docs/pipeline/stations/03-machine-minder.md` and
`04-scanner.md`), `escalates: false`, so `classifyPolicyFiles` should admit it and the watcher
should auto-merge it **without consuming Marco**. If it instead routes to Marco, that is itself a
finding about the classifier and the next run should say so.

Arming this one also makes `pr-station04-qa-audit-marker-contradiction-HOLD.md` redundant — it
fixes only the `04-scanner.md` half. Do **not** arm both; expect the narrower one to read SPENT
once this lands.

**DISPOSITION: ACTIONED** (armed, read back, index clean, one at a time per RULE 4).

### F5. One dead escalation cleared; two that LOOK dead are not

`status-sweep.ps1` §5 tagged four `[STALE]` entries. Only one is genuinely dead:

- `pr-1477-review-block.md` — `#1477` is merged and its central claim is refuted by a green
  build. **Discharged this run.**
- `ruleset-requires-four-checks-every-pipeline-gate-is-advisory-2026-09-01.md` — tagged `[STALE]`
  because `#1488`/`#1482`/`#1485` merged. 🔴 **DO NOT DISCHARGE IT.** Its PR references are stale;
  the question it carries — **escalation #15, the ruleset requires only four checks, so every
  pipeline gate is advisory** — is wide open and is Marco's. The sweep's heuristic keys on PR
  refs, not on whether the question was answered.
- `pr-subbie-rate-cards-scope-pricing-HOLD.md` (`#212` merged) — a parked prompt, not a review
  block. Binning it is not my call.

**DISPOSITION: ACTIONED** (the one that was dead) **/ DEFERRED** (the other two, with the reason
recorded so the next run does not act on the sweep's tag alone).

### F6. Escalation #15 now has a second victim, and closing it closes CP-26 too

`Approval receipt (CP-26)` is the first instrument that has ever caught an unattributable release
— and it is **advisory**, because its job is not in the ruleset's four required checks. So it
fails loudly on `#1483` and blocks nothing. The same single ruleset change that fixes escalation
#15 also makes CP-26 binding.

**DISPOSITION: ESCALATED** — Marco's, half (ii) of escalation #20 and the whole of #15. One
answer closes both.

## WHAT I DID NOT DO

- **Did not merge anything.** `#1483` is the only open PR; it carries a live `marco:true` verdict
  (RULE 2) and is red on two counts. There was nothing else on the board to drive.
- **Did not author `docs/decisions/merge-approvals/1483.md`.** Standing prohibition: an
  agent-written receipt destroys the only instrument that has ever caught this class of event.
- **Did not restore `#1483`'s `do-not-merge` label.** Applying or removing that label is Marco's,
  and RULE 2 binds on the verdict regardless of the label's state.
- **Did not relaunch or touch the watcher.** Wrapper alive (1), node 28400 stable, clone clean,
  heartbeat stale only because the queue was empty. `wrapper=0` never fired, and I resolved the
  parent chain directly rather than trusting a command-line probe.
- **Did not arm a second prompt.** RULE 4 — one at a time.
- **Did not touch `/sot/`** (Station 05's), Azure/Entra/SharePoint (absolute), the 11 worktree
  registry escapees or the two `/sessions/rcw-*` Linux-path worktrees (Station 03's standing
  clone-hygiene dispatch), or the ~35 `WATCHER-CRASH-LOOP-*` files in `needs-marco/` (escalation
  #19's evidence — they belong to Marco's open decision, not to a cleanup sweep).
- **Did not pick up the two Station 06 carry items** (`check-sot-bytes.mjs` blindness to `sot/03`;
  DOCTRINE §9.4 understating `--jq`). 06 still has **no cadence**, so these have now been carried
  across three runs without an owner. That structural gap is itself an open question for Marco.
