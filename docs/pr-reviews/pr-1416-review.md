VERDICT: MERGE

Scope compliance:
- In scope: All four required functions in crm-api.ts (createAccount, patchAccount, archiveAccount, unarchiveAccount); diff builders (buildPatchAccountBody, validateCreateAccountForm); NewAccountModal in AccountsListPage with client-link dropdown (required), lifecycle, type, source, notes fields; AccountDetailPage inline editing for lifecycle, type, source, notes; Archive with confirm and Unarchive affordances; empty-state false-copy removal and replacement with "Create your first account" button.
- Out of scope: None detected. No API route changes, no getAccount360 touches, no account delete, no API modifications.

Self-verification claims:
- [✓] patchAccount exported from crm-api.ts (line 242 confirmed in diff)
- [✓] pnpm web build passed (13s, stated in PR body; Web — lint, logic tests, vitest, build job COMPLETED SUCCESS)
- [✓] pnpm lint passed (0 errors stated in PR body)
- [✓] buildPatchAccountBody logic tests: 9 cases covering unchanged fields, only-changed-fields, multiple changes, null clearing—all present
- [✓] Negative control: clientId never emitted by buildPatchAccountBody (2 test cases explicitly verify this)
- [✓] validateCreateAccountForm tests: 6 cases covering valid clientId, null, empty string, whitespace, missing, non-empty
- [✓] Archive/unarchive DTO contract: 3 cases verifying empty body round-trip and distinct URL segments
- [✓] STOP AND REPORT condition handled correctly: Owner field omitted from edit form; marked read-only in detail view with inline note "(Owner editing requires users.view permission — available in a future slice)" — matches prompt requirement to ship without owner control and explain why

Risks Marco should know:
- Two CI jobs still IN_PROGRESS at snapshot time (tendering-e2e, API — lint, test, compliance smoke), but all completed web-related jobs PASSED; web build, lint, vitest all green. No failure risk to web code.
- PR body notes pre-existing xero.service.ts + Prisma client errors on main that block full suite—not introduced by this PR.
- The patch builder's intentional omission of clientId from the type signature is a deliberate design choice to prevent silent re-linking; this is correct per the prompt's negative control requirement.
- All 23 test assertions are pure logic (no mocks), testing only the helper functions exported from crm-api.ts; no integration or API contract tests, but prompt explicitly cites DropReasonAdminPage.test.ts pattern as the model ("pure helpers").

Recommendation: Safe to merge once remaining CI jobs complete with no failures. No changes needed.
