VERDICT: MERGE

## Scope compliance

**In scope:**
- `.github/workflows/ci.yml`: Comment-only addition clarifying that the `pr-gates` job name does not list all gates that run (specifically CP-24, CP-25, CP-26). No behavior change.
- `docs/pipeline/DOCTRINE.md` §10.1: New step 3 (exception) defining how station-lane PRs are classified by the authority matrix instead of `classifyPolicyFiles`. Old step 3 renumbered to step 4.
- `docs/pipeline/STATION-CAPABILITIES.md`: Cross-reference connecting to the new DOCTRINE.md step 3, with guardrails: any new lane outside `tests|docs` requires a CI gate proving its boundary.

**Out of scope:** None. All changes are governance/documentation only.

## Self-verification claims

- [x] `lint-station.mjs → ADMIT, all 8 docs clean, exit 0` — Verified locally
- [x] `pr-gates.mjs run locally: every gate PASS or SKIP, CP-24 included` — Verified: CP-24 (sot-purity) PASSED
- [x] Lane classification self-declared — PR body correctly states: "None. It touches `.github/`, so it's outside `tests|docs` and no station lane covers it. Under the amended §10.1 it classifies at step 2 and is Marco's."

## CI status

- ✅ All gating checks PASSED: PR gates (CP-09–13, 17, 22, 23, 24, 25, 26), pipeline tests (watcher + linter), data model sanity, API suite, Web suite, CodeQL
- ⏳ `tendering-e2e` (Tendering Browser Smoke) still running but not gated for docs-only changes; no blocker
- Note: This PR touches `.github/workflows/ci.yml`, so per the CI filter it correctly triggers full CI despite being governance-only; this is the intended design

## Scope against source prompt

The originating prompt (found at `docs/pr-prompts/rev-1562-ready.md`) asks for a pr-fix-reviewer review of this PR. The PR implements Marco's 2026-09-04 ruling (option a) on escalation `needs-marco/sot-only-pr-merge-authority-conflict-2026-09-03.md`:

- ✅ Complete: one edit settles the conflict and all future station PRs across all lanes
- ✅ Additive: removes no gates, preserves all automation boundaries (do-not-merge label still binds, watcher `marco:true` still binds, migrations untouched, strays still fall through to classifyPolicyFiles)
- ✅ Measured: 05's lane (sot/) already has CP-24 gate proving its boundary; new lanes require the same
- ✅ Safe: the PR itself correctly self-classifies as Marco's (touches .github/), so it cannot merge itself

## Risks Marco should know

**None.** The PR:
- Is governance/documentation only with one clarifying comment in ci.yml
- Adds an exception narrowly scoped to known station lanes with measured CI gates
- Preserves all existing merge gates and automation boundaries
- Self-classifies correctly as Marco's (touches .github/, outside tests|docs)
- Passes all required checks
- Will settle PR #1554 (Station 05's doc-reconcile) once merged, ending the 4-day-old conflict

## Recommendation

Merge. This implements the agreed-upon resolution to the sot-only PR routing conflict and enables Station 05 to merge its pending doc-reconcile PRs within the new framework.
