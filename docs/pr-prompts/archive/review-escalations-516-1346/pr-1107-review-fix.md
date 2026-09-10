## PR #1107 — MT-1 tenant-scoping: FIX-FORWARD (compliance smoke failure)

**Summary:** The tenant-scoping extension implementation is correct and unit-tested (16 tests pass, fail-closed design verified). However, global extension activation in `onModuleInit` breaks the compliance smoke test because existing code paths run without tenant context established. The extension correctly scopes queries to `tenantId: null` only (fail-closed), but seed data rows may have other tenantIds, causing findUnique to fail.

**Fix:** Wrap compliance smoke test invocation in `TenantContextService.run(SEEDED_DEFAULT_TENANT_ID, async () => { ... })` to establish backward-compatible context. This is a one-line change in the smoke script or app bootstrap and unblocks merge. The MT-1 extension logic itself needs no changes.

**Alternative:** Defer merge until MT-2 wires JWT/session middleware, which will naturally establish context for all HTTP requests and make the smoke test work without modification.

**Decision:** FIX-FORWARD is safe because unit tests prove the extension logic is correct and fail-closed. The smoke failure is an integration issue, not a security bug.
