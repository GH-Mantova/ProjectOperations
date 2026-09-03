VERDICT: MERGE

## Scope compliance

This is a follow-up to the 2026-08-20 standing-authority detector work (PR #1521). The originating detector prompt required a WARN-only check. This PR upgrades it to REJECT (exit 1) based on measured evidence that the reason to delay is no longer valid.

In scope (as originally committed):
- scripts/pipeline/lint-prompt.mjs — moved check from early (WARN-only) to late position and changed from fail() to hard exit-1
- scripts/pipeline/test-lint-prompt.mjs — rewritten 3 test cases from exit-0 to exit-1 expectations

Minor scope expansion (justified):
- scripts/pipeline/__tests__/lint-prompt.standing-authority.test.mjs — NEW, 104 lines. Dedicated test file for REJECT behavior with 6 test cases, including two critical ordering guards (STALE wins, gate wins over grant check). Required to prevent regressions on a hard semantic change.

## Self-verification claims (from PR body)

- [PASS] Measured impact: re-run over 130 prompts (76 top-level HOLDs + 54 parked) yields exactly 2 hits, both must-reject
- [PASS] One hit (tfm-s11-copy-recursive-preserve) changes exit 0 → exit 1; it carries no STANDING AUTHORITY grant
- [PASS] Other hit (production SharePoint writer) correctly rejected; should not arm silently
- [PASS] Placement deliberate: check runs LAST, after premise evaluation, so STALE prompts still report STALE (exit 3), not MISSING_STANDING_AUTHORITY
- [PASS] No new prompts malformed: baseline at 38 of 75. Net newly blocked work that would otherwise run: zero (tfm-s10 is already STALE exit 3)
- [PASS] Tests: 98/98 in __tests__, 85/85 in test-lint-prompt.mjs (all passing per CI)

## CI status

All 14 checks passed (completed 2026-09-03 05:42):
- Pipeline — watcher + linter tests: SUCCESS
- Pipeline — arm-prompt tests (Windows): SUCCESS
- API — lint, test, compliance smoke: SUCCESS
- Web — lint, logic tests, vitest, build: SUCCESS
- Tendering Browser Smoke (e2e): SUCCESS
- All gates (CP-26, raw-error-envelope, PR gates): SUCCESS
- CodeQL: SUCCESS

## Risks Marco should know

1. **Semantic change**: WARN-only → REJECT is irreversible and gates 2 prompts at merge time. The measured data is solid (130-prompt sweep, 2 hits) and both prompts should be rejected, but once this lands, any new prompt without the grant will fail linting immediately. No agent can arm it (queue-sync.ps1 honors lint exit codes).

2. **Prompt body fix required**: The two newly-rejected prompts (tfm-s11 and the escalates:true SharePoint writer) will need their authors to add the STANDING AUTHORITY grant sentence. This is not a prompt failure, but a tooling improvement that exposes an existing condition.

3. **Ordering correctness**: The implementation correctly places the check last, after `PREMISE_ALREADY_SATISFIED` return at line 1581. STALE prompts will still report STALE (exit 3) and will not be masked by this check. Two ordering tests in the new test file guard against future regressions.

4. **Test coverage**: Ordering guardrails are in place for both STALE (exit 3 wins) and unreleased gates (gate message wins over grant check).

## Recommendation

Merge. Implementation is correct, CI is green, measured impact is zero net newly-blocked work, and all self-verification claims check out. The semantic upgrade from WARN to REJECT is justified by the corpus measurement and is gated appropriately by placement.

The two affected prompts (tfm-s11, escalates-true SharePoint writer) will need standup fixes to add the grant to their bodies before they can arm again, but that is the intended behaviour and is not a regression.
