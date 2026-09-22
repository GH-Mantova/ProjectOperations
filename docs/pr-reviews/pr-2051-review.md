VERDICT: FIX-FORWARD

Scope compliance:
- In scope: All changes to apps/api/prisma/{schema.prisma,migrations/,seed-reference.ts}, apps/api/src/modules/map-locations/**, apps/web/src/pages/{admin/MapLocationsTab.tsx,projects/ProjectDetailPage.tsx,projects/ProjectTippingTab.tsx}, docs/data-model/metadata-catalog.json match the prompt's scope exactly.
- Out of scope: None.

Self-verification claims:
- [PASS] pnpm build and pnpm lint (premise verified by prompt)
- [PASS] Migration is fully additive: three nullable columns, one FK, one index, one insert-if-absent trigger row
- [PASS] OPS_M2B_TIPPING_V1 exported in tip-recommendations.service.ts
- [PASS] Test file added with comprehensive test cases for tenderId storage, list endpoint merging, digest sending, and PATCH guard
- [PASS] Seed row added for waste.price_review_due notification trigger
- [FAIL] hex-ratchet lint gate: var(--token, #hex) fallbacks used throughout MapLocationsTab.tsx and ProjectTippingTab.tsx. House rule requires bare var(--token) without fallback hex colors.
- [FAIL] API test suite: pnpm test:api:serial exited with code 1. Cause must be diagnosed from jest output.

Risks Marco should know:
- [MEASURED] Hex-ratchet gate failure: 20+ instances of var(--color, #hex) patterns in new code. All fallback hex values must be removed; must use bare var(--token) only. This blocks CI until corrected.
- [MEASURED] API test failure: jest test suite failed exit 1 during pnpm test:api:serial. Root cause not identified in log (jest output truncated or not parseable from run log). Likely cause: new test file has assertions that fail or the new service code breaks an existing test. Requires local reproduction or full jest output inspection.
- Escalates: true — PR has do-not-merge label and will not merge until Marco manually removes it after reviewing the fixes.

Recommendation: FIX-FORWARD — the prompt's substantive work is complete (endpoints, UI, migration, tests exist), but two regressions block CI. Push a fix commit removing hex fallbacks and diagnosing/fixing the API test failure. Do not merge until both gates pass green.
