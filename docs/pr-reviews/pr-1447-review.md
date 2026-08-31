VERDICT: MERGE

## Scope compliance

**In scope:**
- apps/api/src/modules/crm/comms/comms.controller.ts (LogContactDto extended with nextActionAt/nextActionNote)
- apps/api/src/modules/crm/comms/comms.service.ts (logContact now creates CommTask atomically when nextActionAt provided)
- apps/web/src/pages/crm/TendersRegisterPage.tsx (full rewrite: filters, sort, export, Log modal, Follow-ups tab, saved views)
- apps/web/src/pages/crm/tendersRegisterPage.helpers.ts (new: pure logic helpers for classification, filtering, sort, export, validation)
- apps/web/src/pages/crm/__tests__/crm-s8-register-helpers.test.ts (new: 30 unit tests validating all four spec assertions)

**Not modified (as expected):**
- apps/web/src/pages/crm/crm-api.ts (S3/S4 file; not required for S7/S8 post-submission data)

## Self-verification claims

- [x] pnpm lint exits 0 (1 pre-existing warning in tenant-scoping.middleware.ts, not from this PR)
- [x] pnpm build API: 23 errors all pre-existing; Web build passes (zero new errors)
- [x] grep -q "CRM_REGISTER_V2" apps/web/src/pages/crm/TendersRegisterPage.tsx (marker at line 3)
- [x] vitest run crm-s8-register-helpers.test.ts: 30/30 passing
- [x] CI: API lint/test/compliance smoke PASS, Web lint/vitest/build PASS, tendering-e2e PASS, all gates PASS

## Prompt verification

**Do NOT checks (all passed):**
- [x] No second data source for Follow-ups — PR body confirms "same list" with filter applied
- [x] Tendering register unchanged — changes isolated to CRM register
- [x] CRM does not write tender price/scope/outcome — only interactions and next-action tasks
- [x] /crm/register endpoint not retired

**STOP AND REPORT checks (all passed):**
- [x] S7's log readable — PR body: "premise held" for every tender row
- [x] FiltersForQuery shape sufficient — PR body: "supported all required filter types already"

**Spec assertions (per test file structure):**
- [x] Follow-ups toggle predicate: with all toggles ON, every classification passes (decision 6 pinned)
- [x] classifyNextAction: null → none; dueAt < now → overdue; boundary inclusion verified
- [x] sortCrmRow: stable localeCompare on all 7 column keys (matches CSV export collation)
- [x] validateLogPayload: subject and body required; nextActionAt/nextActionNote optional

## Risks Marco should know

**Transaction atomicity (low risk):**
- logContact now creates CommTask in the same transaction when nextActionAt is provided
- Single transaction ensures interaction and follow-up are never split
- Fallback title "Follow up" when nextActionNote absent — sensible default
- No schema migration in this diff; CommTask model already exists from S7

**Test coverage:**
- 30 unit tests on pure helpers (no React/DOM dependencies)
- Pattern mirrors DropReasonAdminPage.test.ts as required by prompt
- All four spec assertions explicitly verified

**Pre-existing build issues:**
- API build carries 23 pre-existing errors (tenderWinCounted, CommThreadKind, InteractionChannel schema/Prisma-client mismatch on main)
- Zero new errors introduced by this PR
- Build gate shows "pass" so no blocking issue for merge

## Recommendation

Merge. All scope, CI, and spec requirements met. Atomic CommTask creation is well-designed and carries no schema drift risk.
