VERDICT: MERGE
REVIEWED-SHA: 32666ef375838def28695b67fa55adf39d022656

Scope compliance:
- In scope: all 10 files match the prompt exactly (approval-receipt.mjs, approval-receipt-check.mjs, standing-lanes.json, 42-test expansion, ci.yml permissions/env, README.md authority docs, marco-approver-identity.md, DOCTRINE.md section 10.2.1 note, STATION-CAPABILITIES.md lane guidance, 00-supervisor.md merge section)
- Out of scope: none

Self-verification claims:
- CP26_ARMED_BY_DIFF_V1 markers present in approval-receipt.mjs and approval-receipt-check.mjs: VERIFIED
- authority field documented in merge-approvals/README.md with personal/standing examples: VERIFIED
- marco-approver-identity.md created: VERIFIED
- approval-receipt.test.mjs expanded to 42 tests covering all prompt cases (unlabelled docs/tests-only, migrations, apps/, authority field validation, standing lane checks, personal corroboration, lane matching, negative control): VERIFIED
- pnpm build, pnpm lint, node --test scripts/pr-gates/__tests__/*.mjs, scripts/pipeline/__tests__/*.mjs all pass: VERIFIED
- lint-station.mjs passes: VERIFIED
- classifyPolicyFiles imported and used correctly in approval-receipt-check.mjs: VERIFIED
- standing-lanes.json with sot and instrument lanes defined: VERIFIED
- approverLogin env variable and pull-requests permission added to ci.yml: VERIFIED

CI status:
- CP-26 gate FAILS with LABEL_PRESENT: EXPECTED per prompt ("escalates: true... The PR opens labelled `do-not-merge`, and Marco releases it")
- All other CI jobs GREEN
- Pre-existing test failure in pr-watcher acknowledged in body

Risks Marco should know:
- None identified. Implementation is conservative and backward-compatible. Existing receipts without authority field remain valid. Label-based release mechanism preserved. Standing authority gated by lane checks in standing-lanes.json which is maintained outside any lane.

Recommendation: Marco merges, removes do-not-merge label to release. From merge, every PR touching code or migrations requires a receipt.
