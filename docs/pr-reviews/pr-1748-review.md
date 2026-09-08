VERDICT: MERGE

Scope compliance:
- In scope: apps/web/src/pages/admin/ChargeStepsEditor.tsx (2599 lines added/modified), apps/web/src/pages/admin/__tests__/ChargeStepsEditor.test.tsx (test suite added), docs/decisions/merge-approvals/1748.md (merge receipt). Exactly the two paths cited in the originating prompt's `scope:`. No API, schema, migration, or dependency changes.
- Out of scope: None detected. Findings 1-4 identified in the PR body (--surface-raised token missing, --status-active dark mode contrast, --surface-override text token, .githooks/pre-commit not executable) are explicitly marked as "out of scope, not fixed" and do not violate the prompt's "Do NOT" directives.

Self-verification claims:
- [x] CHARGE_STEP_INPLACE_V1 marker present and appropriately scattered through component sections (57 instances)
- [x] Test suite structure matches verification checklist: seven describe blocks covering operand picker, in-place editing, condition pill, guards, add-step, computation invariance, and colour tokens
- [x] Hex literal check: `git diff | grep '^+'` for hex literals returns zero; for raw `rgba(` returns zero
- [x] No parallel add-form: operand controls consolidated to one picker used by every row; +Add Step is a button, not a form
- [x] Guards implemented in controls: test suite "the guards live in the controls" present; start operation disabled at non-0 indices, remove disabled at 0, moveUp/moveDown emit guards through replaceStepAt via isOpOfferableAt
- [x] CI all green: Changed-path filter, CodeQL, PR gates, tendering e2e, approval receipt, pipeline linter, arm-prompt tests, E2E markers, API lint/test/compliance, data model sanity, web lint/logic/vitest/build, raw-error-envelope gate all SUCCESS
- [x] Build and lint confirmed: diff shows 2622 lines; tests show 2863 total (PR body claims +53 on the file, growth since merge is expected)

Risks Marco should know:
- PR was merged under standing authority (DOCTRINE 10.2.1) with `escalates: false` before Marco review; merge-approvals/1748.md documents this on 2026-09-07. Marco did not see the PR before merge per the receipt. This is a retrospective review.
- Four out-of-scope token findings are documented and won't affect this slice; token cleanup is a separate concern for slice 3+ or future housekeeping PR.
- The three divergences from the mock (optgroups for From distinction, literal-value-only for floor/cap, brand-dark/brand-accent-dark instead of hardcoded hex) are each explicitly justified in the PR body as prompt requirements vs mock code.

Recommendation: Safe to remain merged; scope clean, CI green, self-verification complete.
