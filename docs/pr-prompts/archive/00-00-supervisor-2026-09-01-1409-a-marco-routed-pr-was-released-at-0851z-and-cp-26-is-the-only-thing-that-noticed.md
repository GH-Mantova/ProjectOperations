# Station 00 — Supervisor | 2026-09-01T14:09Z–14:35Z

## GROUND

```
UTC            2026-09-01T14:09:13Z
origin/main    3f021384  ->  5b08e6ef  (moved this run: my merge of #1494)
dev tree       main @ 3f021384        C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE, so this run was read-write.

## WHAT I MEASURED

- **[MEASURED] Sighted run.** `start_process` shell `powershell.exe` returned a live PS 5.1 on the
  Windows host at 14:09:13Z. Not blind.
- **[MEASURED] The three binding docs were read from a tree proven identical to `origin/main`.**
  `git diff --stat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
  docs/pipeline/STATION-CAPABILITIES.md` -> empty; `git rev-list --left-right --count
  origin/main...HEAD` -> `0	0`. All three read in full (915 / 645 / 224 lines).
- **[MEASURED] Machinery is healthy and the 12:09Z crash loop has held.** `status-sweep.ps1`
  14:10:37Z: watcher node `RUNNING pid 28400` — the same PID the 12:34Z fix left behind, so
  **1h36m stable**; `auto-restart wrapper: alive (1)` (one, not nine); watcher clone
  `branch=main dirty=0`; heartbeat 341 min, which with an empty queue is idle, not wedged.
- **[MEASURED] No locks, no concurrent git.** `git index.lock interactive/clone: False / False`;
  `git processes running: 0`. The device-bridge `index.lock` did **not** recur this run (8th
  consecutive check, 7 lifetime occurrences).
- **[MEASURED] `armed: 0`.** `Get-ChildItem docs\pr-prompts\*-ready.md` returned nothing.
- **[MEASURED] COLLECT: nothing new to disposition from another station.**
  `node scripts/pipeline/check-breadcrumb.mjs --freshness` -> exit **0**, `CLEAN`,
  `structure: 14 checked, 0 malformed`, and every station inside cadence:
  `00 2.0h / 03 15.2h / 04 4.0h / 05 24.0h` — **no station SILENT**. No breadcrumb has been written
  since my own 12:09Z one.
- **[MEASURED] Board at 14:10Z: 3 open.** `#1494` CLEAN 9/0/0 · `#1483` BLOCKED 11 pass/3 fail ·
  `#1477` BLOCKED 12 pass/2 fail. `main` CI on `3f021384`: 4 success / 0 failed (trunk green).
- **[MEASURED] Lane verdicts, with the positive control DOCTRINE §10.1 requires.**
  `Select-String -Path docs\pr-prompts\processed\*.log -Pattern 'merge result for PR #N'`:
  `#1483` -> `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled
  do-not-merge"}`; `#1494` and `#1477` -> **no log names them**. Positive control on the same corpus,
  `-Pattern 'marco.:true'` -> **602** hits, so the probe is alive and the two empties are real
  absences, not a broken query.
- **[MEASURED] Hand-classification of the two lane-less PRs.** `#1494` = one file,
  `docs/runbooks/watcher-identity-github-app.md`, inside `docs/` -> **not Marco's**. `#1477` = three
  files, all under `apps/api/`, outside `^(tests|docs)/` -> **MARCO'S**.
- **[MEASURED] `#1477`'s red was a COMPILE error, not a test failure.** Job log
  `gh run view 33507957609 --job 99856542504 --log`: `FAIL src/modules/estimate-export/
  estimate-export.service.spec.ts / Test suite failed to run`, TS2345 at `:288`, `:309`, `:326` —
  each site replaced a whole discipline bucket with a partial literal and lost
  `provisionalSubtotal` / `provisionalWithMarkup`. Second red, `PR gates`, was
  `FAIL - CP-22 verification-checklist [unchecked: - [ ] CI is the verification ...]`.
- **[MEASURED] `#1483`'s `do-not-merge` label is GONE, and CP-26 caught it.**
  `gh pr view 1483 --json labels` -> empty. `gh run view 33507956039 --job 99856433420 --log` ->
  `FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #1483 was labelled do-not-merge and
  released, but docs/decisions/merge-approvals/1483.md is not in this PR's diff`.
  `gh api .../issues/1483/events` -> `labeled do-not-merge by GH-Mantova 05:46:45Z` /
  **`unlabeled do-not-merge by GH-Mantova 08:51:48Z`**.
- **[MEASURED] A `web-flow` actor merges `main` into open PR branches within ~90s of every merge.**
  `#1494` took `a114930c` at 12:29:14Z (3m32s after `#1495` merged); `#1477` took `ffbadd95` at
  14:19:18Z (**89 seconds** after `#1494` merged), `committer=web-flow`, `author=GH-Mantova`.
- **[MEASURED] Station 05 was running concurrently with me.** Sweep at 14:15Z and again at 14:32Z:
  `LIVE STATION WORKTREE: C:/po-worktrees/sot05-reconcile-20260901 3f021384
  [sot05/reconcile-2026-09-01] dirty=1 age=1 min`.
- **[MEASURED] `#1477`'s post-fix API red was a Docker registry timeout**, not my change:
  `Error response from daemon: Get "https://registry-1.docker.io/v2/": context deadline exceeded`,
  three retries, `Docker pull failed with exit code 1`.
- **[CANNOT MEASURE] Who removed `#1483`'s label, and who called update-branch.** Both acted as
  `GH-Mantova`. One token, four actors — the exact gap `#1494`'s runbook exists to close.

## WHAT CHANGED

- **`#1477` driven from 2 reds to 0 reds-of-mine.** Pushed `4cb7fe72` to
  `test/export-make-summary-helper` from a disposable worktree off the PR head: added an exported
  `bucket()` to `test-support/make-summary.ts` that defaults every bucket field in one place, and
  routed `:288` / `:309` / `:326` through it. Read back: `fae2b777..4cb7fe72` accepted by the remote,
  `git rev-parse FETCH_HEAD` -> `4cb7fe72`.
- **`#1477` PR body**: ticked the CP-22 box and recorded the lane classification, via
  `Set-PrBody -PR 1477` (never `Set-Content`). Read back: `[x] CI is the verification` -> **True**,
  `[ ] CI is the verification` -> **False**. `PR gates` went **fail -> pass** on the next run.
- **`gh run rerun 33518948442 --failed`** after the Docker flake; read back `status=in_progress`
  with a new job id `99894183514`.
- **`#1494` MERGED.** `Assert-SmokedOrEscalate -PR 1494` -> `True`, then `Merge-Pr -PR 1494 -Auto`.
  Read back to `main`, not to "auto-merge enabled": `state=MERGED mergedAt=2026-09-01T14:17:50Z
  mergeCommit=5b08e6ef`, `git rev-parse --short origin/main` -> `5b08e6ef`, and
  `git cat-file -e origin/main:docs/runbooks/watcher-identity-github-app.md` -> **PRESENT**.
- **Worktree hygiene.** `C:\po-worktrees\fix-1477` created for the fix and removed when done
  (`git worktree remove --force` + `git worktree prune`), so it does not seed a false CAUTION for
  the next reader. Verified: the 14:32Z sweep names only Station 05's worktree.
- **Nothing armed. Nothing under `/sot/`. No label added or removed. No prompt renamed.**

## FINDINGS

### 1. A Marco-routed PR's `do-not-merge` label was removed at 08:51:48Z, and the only thing that noticed was a gate that shipped three hours later

`#1483` carries the watcher verdict `"marco":true`. Its `do-not-merge` label was applied by the
watcher at 05:46:45Z and **removed at 08:51:48Z**. STATION-CAPABILITIES §5 says only Marco removes
that label. The actor is recorded as `GH-Mantova`, which is the shared token — so the audit trail
cannot say whether Marco released it or an agent did. Nothing flagged it for **2h23m**, until
`#1492` merged at 11:14Z and its new `Approval receipt (CP-26)` job began failing the PR with
`RELEASED_NO_RECEIPT`. **The gate is working exactly as designed and caught a real release inside
three hours of landing** — that is the good news in this finding.

Two things that must not be blurred: **RULE 2 is untouched by any of this.** The watcher routed
`#1483` to Marco; removing the label does not clear that, and I did not merge it. And **I must not
author `docs/decisions/merge-approvals/1483.md` myself** — the whole point of the receipt is that a
human authored it; an agent writing it would forge the approval and turn a working gate into a
rubber stamp.

**DISPOSITION: ESCALATED.** Marco: `#1483`'s `do-not-merge` was removed at 08:51:48Z and the PR
cannot go green until `docs/decisions/merge-approvals/1483.md` exists on its branch. Applying RULE 1
(complete now **and** in future, without damaging data entry):

- **(A) — complete and additive, and the one I recommend.** You author `1483.md` per
  `docs/decisions/merge-approvals/README.md` if the release was yours, **and** we treat the
  attribution gap as the real defect and land Part 1 of the runbook that merged this run
  (`docs/runbooks/watcher-identity-github-app.md`) so the next release names an actor. Cures the red
  now; makes the next one attributable. Damages nothing — the receipt is a new file.
- **(B) — if the release was NOT yours.** Re-apply `do-not-merge` to `#1483` and treat 08:51:48Z as
  an unauthorised release: an agent removed a gate only you may remove. Fixes the immediate state,
  **fails the future half** — without identity work the same thing happens again unseen.
- **(C) — leave it.** `#1483` stays permanently red and CP-26 keeps failing every future release the
  same way. **Fails both halves.**

### 2. `#1477` was red because the helper it introduces only defends a WHOLE-summary override

The PR exists to stop `ExportPayload["summary"]` literals breaking when the type gains a field.
`makeSummary` does that for `makeSummary({ ... })`. But the three call sites did
`{ ...baseSummary(), DEM: { itemCount, subtotal, withMarkup } }` — replacing a whole bucket with a
partial literal, one level below where the helper defends — and so reintroduced the very breakage
the PR removes. The complete-and-additive fix is a second helper, not a cast or a widened type:
`bucket(overrides)` spreads `zeroBucket()`, so a new bucket field gets its default in exactly one
place and the call sites keep asserting the real numbers. No assertion was weakened, nothing skipped.

**DISPOSITION: ACTIONED.** `4cb7fe72` pushed; `PR gates` fail -> pass; API job re-run after an
unrelated Docker registry timeout. `#1477` is **MARCO'S** by hand-classification
(`[NO LANE VERDICT — hand-classified]`, all three files under `apps/api/`), so it is driven green and
**left for Marco** — I did not merge it.

### 3. `status-sweep.ps1`'s `[STALE]` tag on a `needs-marco/` file is unsound, and I was carrying an instruction built on it

My last two runs carried "retire the four measured-dead `needs-marco/` files". I went to do it and
the instruction is wrong. The sweep tags a `needs-marco/` file `[STALE] ... escalation is DEAD, clear
it` when **every PR number it mentions is merged.** For a needs-marco file the PR references are
usually *evidence* or a *satisfied gate*, not the ask:

- `ruleset-requires-four-checks-...-2026-09-01.md` is tagged STALE because `#1482` / `#1485` /
  `#1488` merged. Those are the *incident it describes*. The question — the branch ruleset requires
  only four checks, so every other gate is advisory — is **open and unanswered by Marco.**
- `pr-subbie-rate-cards-scope-pricing-HOLD.md` is tagged STALE because `#212` / `#213` merged. Those
  are its `requires_merged` gate. A satisfied gate makes a HOLD **eligible**, not dead — and it is
  `escalates: true` subcontractor pricing, still Marco's.

Following the tag would have silently discarded one live question of Marco's and one armable prompt.
This is §9.6 again: the query answers confidently and the thing it measures is not the thing the
label claims.

**DISPOSITION: ACTIONED (the instruction is withdrawn) + DISPATCHED -> 06 (PR Master).** I am not
retiring any `needs-marco/` file, and no future run should on the strength of that tag. Handing 06 a
prompt to stage: `status-sweep.ps1` must tag a `needs-marco/` file `[STALE]` only when the file's own
**ask** is discharged — a `requires_merged`/`requires_file_on_main` gate that is now satisfied should
read `[GATE OPEN — eligible]`, and a file whose PR refs are cited as evidence should not be tagged at
all. Premise for the prompt: the two files above are still in `needs-marco/` and still tagged.

### 4. An unattributed `web-flow` actor merges `main` into every open PR branch within ~90 seconds of a merge

`ffbadd95` landed on `#1477` **89 seconds** after `#1494` merged, `committer=web-flow` — the GitHub
API/UI update-branch path, not a local script. The same shape put `a114930c` on `#1494` after `#1495`
merged. Nothing is broken by it: BEHIND is a rebase, not a failure. But it is a **third actor pushing
to PR branches under the shared identity**, it invalidates any "untouched for a full cadence"
condition a station writes, and it is invisible in `processed/*.log`. It is the same root cause as
finding 1.

**DISPOSITION: DEFERRED.** Real, not urgent — it currently only helps. It becomes urgent the moment a
station conditions an action on "this PR has not been touched", which my own 12:35Z run did. Folded
into finding 1's option (A) as one more thing identity work would make legible.

### 5. `C:\po-watcher\ensure-watcher.ps1` is still not in the repo

Carried from 12:09Z, unchanged: `git ls-files --error-unmatch scripts/pr-watcher/ensure-watcher.ps1`
-> exit 1, while the `PO Watcher Keepalive` scheduled task runs it every 10 minutes and it relaunches
on "node absent" without checking "wrapper present". The 90-cycle loop it caused is fixed and has
held for 1h36m, but **the cause is untouched and no prompt can reach a file outside the repo.**

**DISPOSITION: ESCALATED (carried, unanswered).** Options unchanged: **(A)** move it into
`scripts/pr-watcher/`, repoint the scheduled task, and land the wrapper-present check as a PR —
complete and additive; **(B)** hand-patch in place — fixes now, fails the future half, since the next
box or restore loses it; **(C)** trust its own guard — fails both, it already stood down for 15
minutes on 09-01 and the loop happened anyway. **Never disable the keepalive: it is the only thing
that restarts the watcher.**

### 6. Eleven registry-escapee worktrees and two `/sessions/` orphans

Unchanged from 12:09Z and still Station 03's: `C:\po-worktrees\{fix-followup-notes, ph,
po-scan-1787002207, scan-1787220682, stage-brandtheme-083750, stage-bt-084105}` and `C:\po-wt\
{agentB-out, draft, fix, rescue-drop-corrections, s9files}`, plus two locked worktrees registered
under `/sessions/rcw-.../mnt/po-worktrees/` whose VM no longer exists (`age=-1 min` is the
tell — a negative age is a clock from a destroyed sandbox, not a young worktree).

**DISPOSITION: DISPATCHED -> 03 (machine-minder), third cycle.** Already inside 03's existing
clone-hygiene dispatch. `ph` alone is 914 MB. `git status --short` in each before pruning; never
unsupervised.

## WHAT I DID NOT DO

- **Did not merge `#1483` or `#1477`.** `#1483` carries a live `"marco":true` verdict (RULE 2) and
  `#1477` hand-classifies as Marco's. Both were driven, neither merged.
- **Did not re-apply or remove any label**, and did not author `docs/decisions/merge-approvals/
  1483.md`. Only Marco removes `do-not-merge`; only a human can author the receipt that says he
  released it.
- **Did not arm anything.** `armed: 0` deliberately. The whole open board is Marco's queue; an arm
  that touches anything outside `tests/` or `docs/` only lengthens it, and there is no gate-cleared
  docs/tests HOLD whose premise I verified this run.
- **Did not retire any `needs-marco/` file** — see finding 3. The carried instruction to do so is
  withdrawn, not deferred.
- **Did not touch `/sot/`** (Station 05 was live in `C:/po-worktrees/sot05-reconcile-20260901`
  throughout this run), Azure/Entra/SharePoint, production data, the watcher's git, or the 11
  escapee worktrees.
- **Merged `#1494` under a CAUTION verdict, deliberately, and this is the judgement call to check.**
  The sweep read CAUTION solely because Station 05 held a live worktree. The three mutation signals
  DOCTRINE's single-actor fallback names were all clear — in-progress prompts `0`, `index.lock`
  `False/False`, no PR touched in 2 min — and 05 was on `sot05/reconcile-2026-09-01` touching `sot/`,
  which shares no branch, path or index with a docs-only squash merge. `#1494` had already been
  deferred one cycle and the ACTIVE DRIVE MANDATE exists to stop a green eligible PR rotting on a
  soft signal. If that reasoning is wrong, this is where it is wrong.
