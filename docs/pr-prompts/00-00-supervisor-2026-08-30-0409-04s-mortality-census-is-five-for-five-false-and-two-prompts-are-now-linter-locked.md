# Station 00 — Supervisor | 2026-08-30T04:09Z–2026-08-30T04:3xZ

## GROUND

```
UTC            2026-08-30T04:09:14Z
origin/main    5e9f52be            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 5e9f52be     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Versions agree — full authority, not read-only.

**SIGHTED.** `start_process` shell `powershell.exe` → PID 22956 at 04:09:14Z. The 02:09Z run was
blind; this one is not. `[MEASURED]`

## WHAT I MEASURED

**Binding docs read at `origin/main`, not from a stale working copy.** `git fetch origin` then
`rev-parse`: `origin/main` and dev-tree `HEAD` are both `5e9f52be`, and neither
`docs/pipeline/DOCTRINE.md`, `docs/pipeline/STATION-CAPABILITIES.md` nor
`docs/pipeline/stations/00-supervisor.md` appears in `git status --short`. Working copies are
therefore byte-equal to `origin/main`. Decided with `git`, not `Compare-Object` (§9.3). `[MEASURED]`

**Sweep.** `scripts\pipeline\status-sweep.ps1` @04:09:53Z — section 0 both positive controls `[LIVE]`,
section 7 **SAFE TO ACT**. OPEN PRs **0** · armed **0** · needs-marco 14 · no-pr-opened 107 ·
failed 41 · watcher node RUNNING pid 26364 with 3 wrappers · main CI 3/3 green · `index.lock`
False/False · git processes 0 · `watcher clone: dirty=35` (the standing `verdict-archive` amber, not
news). `[MEASURED]`

**COLLECT.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN, exit 0**, 115
checked, 0 malformed. No station SILENT: `00` 2.0h/2h · `03` 5.1h/24h · `04` 2.0h/4h · `05` 14.0h/24h ·
`02` dispatch-only. Two breadcrumbs new since my last run, both flagged UNTRACKED by the validator
and both swept up by this run's PR: `00-00-supervisor-…-0209-…` and `00-04-scanner-…-0210-…`.
`[MEASURED]`

🔴 **`06` still does not appear in the freshness output in any form** — re-confirming F3 of the 0209
run from the instrument's own output rather than from the source: the table prints `00 02 03 04 05`
and nothing else. `[MEASURED]`

**OAuth — thirteenth reading, and the first taken with a shell in 36 hours.**
`C:\Users\Marco\.claude\.credentials.json`, read with node:

```
mtime          2026-08-28T16:13:26.909Z
expiresAt      2026-08-28T16:13:35.984Z
now            2026-08-30T04:10:44.010Z
expired        35.95 h
```

The file has not been rewritten since 16:13:26Z on 08-28. The refresher has not run in 36 hours.
**The block stands: arm nothing.** `[MEASURED]`

🔬 **The 9-second lead is now MEASURED, not inferred.** mtime `16:13:26.909Z`, `expiresAt`
`16:13:35.984Z` — **9.075 seconds apart.** The last successful write produced a credential that was
already 9 s from death. That is the signature of a refresh whose *response* was stale on arrival, not
of a refresher process that stopped running. It changes what a fix has to address. `[MEASURED]`

**Verification of Station 04's F1, before acting on it** (its three moves are mine to execute, so its
evidence is mine to re-check):

- `git show origin/main:.gitignore | Select-String no-pr-opened` → `docs/pr-prompts/no-pr-opened/`
  present. So `pr-hygiene-gitignore-no-pr-opened-HOLD`'s premise `! grep -q "no-pr-opened" .gitignore`
  is genuinely **dead**. `[MEASURED]`
- `origin/main:docs/pipeline/DOCTRINE.md` §9.5 reads *"does NOT reject when `git` is missing or
  broken — the binary is `git`, NOT `gh`"* — the correction `pr-doctrine-s9-gh-vs-git-waiver-HOLD`
  exists to make **is already on main** (#1394), while its `done_when` greps for the sentence shape
  the correct fix preserved. Work done, prompt immortal. `[MEASURED]`
- `lint-prompt.mjs:728` is `const DO_NOT_ARM_COMMENT = /<!--\s*watcher:\s*do-not-arm\s*-->/i;`,
  tested at `:738`. The marker 04 specified is the one the linter actually matches. `[MEASURED]`

## WHAT CHANGED

All work in a **disposable worktree** off `origin/main` — `C:\po-worktrees\sup-0409`, branch
`chore/board-2026-08-30-0409-collect`. The shared dev-tree index was checked immediately before
(`git diff --cached --name-status` → 0 lines) and was left untouched. Nothing was armed; nothing was
merged from the board; no `-ready.md` was created at any point.

1. `git mv docs/pr-prompts/pr-doctrine-s9-gh-vs-git-waiver-HOLD.md docs/pr-prompts/superseded/`
2. `git mv docs/pr-prompts/pr-hygiene-gitignore-no-pr-opened-HOLD.md docs/pr-prompts/superseded/`
3. Added `<!-- watcher: do-not-arm -->` plus four lines of rationale to the **body** of
   `docs/pr-prompts/pr-dns-s5-checker-flip-to-fail-HOLD.md` (node, not `Set-Content` — §9.3).
4. Swept up the two untracked breadcrumbs, `docs/pipeline/sweep-rotation.json` (`last_index` 3 → 0,
   which is the correct wrap: 04 ran index 0 and the next run takes index 1), and two untracked
   reviewer verdicts `docs/pr-reviews/pr-1345-review.md` and `pr-1347-review.md`.
5. This breadcrumb.

**Read-back on the only change with a behavioural claim** (DOCTRINE §1), both directions:

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-dns-s5-checker-flip-to-fail-HOLD.md
  -> REJECT [HUMAN_GATE_PRESENT] "line 2 contains <!-- watcher: do-not-arm --> marker"   EXIT=1
     (it returned ADMIT exit 0 on this same file at 02:1xZ)
POSITIVE CONTROL, same linter, same run:
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-station-docs-wrong-wrapper-…-HOLD.md
  -> ADMIT (size 2)                                                                       EXIT=0
```

The linter is not simply rejecting everything. `[MEASURED]`

## FINDINGS

### F1 — Station 04's F2 is REFUTED. The clause it dispatched me to add is already there, and its mortality census is 5-for-5 false positives, not 4-for-5 `[MEASURED]`

04 dispatched a one-line `done_when` edit to `pr-e2e-container-s2-swap-required-job-HOLD`, on the
finding that its `done_when` *"asserts three things the change adds and nothing it removes"* and so
the premise cannot die on landing (LL-54, rated S2 — broken as authored). It quoted the value with
ellipses:

```
done_when: grep -q "^  tendering-e2e:" … && grep -q "playwright:v1.59.1-noble" … && grep -q "@postgres:5432" …
```

`done_when` on that prompt is a **folded block scalar** (`>-`). Folded, it reads:

```
grep -q "^  tendering-e2e:" … && grep -q "playwright:v1.59.1-noble" … && grep -q "@postgres:5432" …
 && ! grep -q "playwright install --with-deps" .github/workflows/playwright.yml
 && ! grep -q "ms-playwright" .github/workflows/playwright.yml
 && grep -q "playwright test tests/e2e/tendering.spec.ts --reporter" …
 && ! test -f .github/workflows/playwright-container-trial.yml
```

**Three negated clauses, and the fourth clause is verbatim the text 04 asked me to append.** Measured
with `C:\po-sup-fix-scripts\sup-0409-verify-f2b.mjs`, a folded-scalar reader with a positive control
(`k: >-\n  aa\n  bb` → `aa bb`) and a negative control (absent key → `null`, absent substring →
`false`):

```
CONTROL_pos = true
CONTROL_neg = true
NEGATION_04_WANTS_ADDED_IS_ALREADY_PRESENT = true
SANITY_absent_string = false
NEGATED_CLAUSE_COUNT = 3
```

Had I transcribed the dispatch as written, the prompt would carry the clause twice.

**Why this matters beyond one prompt.** 04 reported its census instrument as crude, hand-checked the
five flags, found four were parser artefacts from unhandled pipes, and wrote *"One survived — F2
below."* That one does not survive either — by a **different** parser defect (folded block scalars,
not pipes), which is why hand-checking the pipe cases did not catch it. The census produced **zero
true positives out of five**, so the honest reading of that sweep is that it found no premise-mortality
defect at all. This is DOCTRINE §7 exactly: an instrument that could not produce a correct positive,
believed one step short of the control that would have refuted it. The lesson is not "04 was careless"
— it flagged its own instrument and was right to — it is that **a 0-of-5 instrument should be reported
as unproven, not as one confirmed finding.** Block-scalar collapse is already a known defect in this
repo's prompt tooling (04's own 08-28T10:10Z breadcrumb names it); it has now bitten a second harness.

**DISPOSITION: ACTIONED.** The edit was not made; the finding is withdrawn here rather than left to
be re-discovered. `pr-e2e-container-s2-swap-required-job-HOLD` is **not** disqualified from arming on
LL-54 grounds — its `done_when` is already the inverse of its premise. It remains subject to the
OAuth block like everything else.

### F2 — the two prompts that were mechanically indistinguishable from ready work are now held by the linter, not by memory `[MEASURED]`

`pr-doctrine-s9-gh-vs-git-waiver-HOLD` (work shipped in #1394, premise immortal by construction) is
retired to `superseded/`; `pr-hygiene-gitignore-no-pr-opened-HOLD` (premise dead, linter agrees at
STALE exit 3) likewise. `pr-dns-s5-checker-flip-to-fail-HOLD` — which must never be armed, carried
neither literal marker, and passed every mechanical gate at ADMIT exit 0 — now hard-REJECTs at
`HUMAN_GATE_PRESENT` before its premise runs.

That closes the specific hole DOCTRINE §9.5 names: *"held back only by human recall."* Three prompts,
zero remaining that depend on a chat-memory line to stay unarmed.

**DISPOSITION: ACTIONED** — verified by the read-back above, with a positive control.

### F3 — OAuth: 36 hours dark, and the failure is in the refresh RESPONSE, not the refresher `[MEASURED]`

Thirteenth reading, first one taken with a shell since the 08-28T20:09Z run. Expired 35.95 h; file
unwritten since. The new fact is the **9.075-second** gap between the credential's mtime and its
`expiresAt`: whatever last wrote that file received, and stored, a token with nine seconds of life.
A refresher that had simply stopped running would leave a normally-aged token behind it. This one
completed a write and stored something already spent.

Re-authentication needs a real human identity and a browser sign-in — hard stop 3 and 5, mine to
report and not to perform. RULE 1, unchanged from prior runs and restated so the options are in one
place: **(A)** Marco re-authenticates AND we add a startup probe that refuses to consume the queue on
an expired token, failing loudly instead of burning prompts — *complete and additive, passes both
halves*; **(B)** re-authenticate only — fixes today, fails the "future" half, this is the second
outage of this exact shape; **(C)** build the guard only — fails the "immediately" half, the lane
stays down.

**DISPOSITION: ESCALATED** — folded into the standing OAuth escalation, with the 9-second measurement
added as new evidence. No second escalation opened.

### F4 — the brake is held, and everything the board could do this run has been done `[MEASURED]`

OPEN = 0, armed = 0, 61 → 59 depth-1 HOLDs after this PR, dev tree converged, no lock, no interrupted
merge, watcher alive with three wrappers, trunk green. There was nothing to merge and nothing that
may be armed. The collect set was two breadcrumbs and both are now in a PR.

**DISPOSITION: ACTIONED.**

## WHAT I DID NOT DO

- **Armed nothing.** The OAuth block stands at 35.95 h expired; `armed` was 0 before this run and is
  0 after. Every file this PR touches is a `-HOLD.md`, a `superseded/` path, a breadcrumb, a review
  or a JSON — none matches a watcher glob at any point.
- **Merged nothing from the board.** OPEN PRs = 0.
- **Did not make 04's F2 edit** — refuted above, with controls. Reporting the refutation is the
  action; making the edit would have duplicated a clause.
- **Did not arm `pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD`** (04's F5) or any of
  the other 11 gate-open, premise-alive candidates. They are correct arm candidates the moment the
  OAuth block clears, and not before.
- **Did not touch `docs/data-model/metadata-catalog.json`** — its ` M` is a CRLF stat artefact, not a
  change.
- **Did not clear the 13 `[STALE]` dead escalations in `needs-marco/`.** The folder is gitignored, so
  no PR can record the clearing and no reviewer can check it. Still correctly deferred.
- **Did not touch `pr-doctrine-s9-four-false-traps-LOOPING.md`** — untracked in the queue root,
  matches no watcher glob, and renaming a LOOPING file back is a decision, not hygiene.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`, did not restart the watcher** (03's lane,
  and it is healthy), **did not edit `/sot/`, did not write production data, did not touch Azure /
  Entra / SharePoint.**
- **Did not leave this breadcrumb in the worktree.** It is committed inside this run's own PR, which
  the report contract names as the best of the two correct homes.
