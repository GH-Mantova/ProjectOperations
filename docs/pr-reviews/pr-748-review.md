VERDICT: MERGE

Scope compliance:
- In scope: All 5 files within rates module (dto, service, controller, module) + RatesListsAdminPage web component. No schema changes. No package.json changes (exceljs already present from pr-rates-export).
- Out of scope: None detected. Does not touch estimates module (correctly delegates to existing service layer).

Self-verification claims:
- [x] pnpm build green (API + web)
- [x] pnpm lint green
- [x] grep -rEq "rates/import|importRates" apps/api/src/modules confirmed (POST endpoints registered in controller)
- [x] prerequisite met: pr-rates-export merged to main (commit 90b8ecd2)
- [x] GATE-ALLOW: dependencies in PR body
- [x] Single commit on feat/rates-import branch

Risks Marco should know:
- None identified. Implementation is defensively coded:
  - Preview reads only (findMany queries, no writes)
  - Apply is fully idempotent via upsert on natural keys (wasteType_facility for waste, materialName for density, item for plant)
  - Diff operations computed before apply, not during
  - POA/TBC cells handled gracefully (null rate returned, warning surfaced to user, row skipped if both tonRate and loadRate are POA)
  - Em-dash normalisation correctly implemented (normalises ' — ', ' - ', ' – ' to ' — ' in natural keys)
  - Per-load and EACH weights follow Marco's merge rules
  - Permission guard ("rates.manage") on both endpoints
  - Web UI disables Apply button if no changes detected (line 543)

All CI checks passing: API lint/test/smoke, Web lint/build, data model sanity, PR gates, CodeQL, tendering e2e.

Recommendation: Merge. Completes the round-trip cleanly and ships production-ready idempotent import logic with preview safeguards.
