VERDICT: FIX

Scope compliance:
- In scope: apps/api/src/common/permissions/module-registry.ts (clients module added)
- In scope: apps/api/src/common/permissions/permission-registry.ts (clients.view / clients.manage registered with label + description)
- Missing: apps/api/src/common/__tests__/permission-registry-coverage.guard.spec.ts (KNOWN_UNREGISTERED allowlist not updated)

Self-verification claims:
- [GREEN] pnpm --filter @project-ops/api build passes
- [RED] pnpm --filter @project-ops/api test -- permissions passes (test suite runs all API tests, not just permissions; coverage-guard test fails)
- [RED] grep -q "clients.manage" apps/api/src/common/permissions/permission-registry.ts returns 0 (code is registered)
- [RED] grep -q "clients.view" apps/api/src/common/permissions/permission-registry.ts returns 0 (code is registered)

CI status:
- "API — lint, test, compliance smoke" FAILS at permission-registry-coverage.guard.spec.ts
- Test: "KNOWN_UNREGISTERED contains no code that has since been registered (allowlist cannot rot)"
- Error message: "clients.view" and "clients.manage" are now in permission-registry.ts but remain on the KNOWN_UNREGISTERED allowlist at line 28-31

Risks:
- The core registration work (two files) is correct and complete.
- The coverage-guard test is a data-driven check that prevents exactly this scenario: unregistered codes rotting on an allowlist after their fix merges.
- Failure is not a logic error; it's a housekeeping miss.

Recommendation:
Remove "clients.view" and "clients.manage" from the KNOWN_UNREGISTERED Set at line 28-31 in apps/api/src/common/__tests__/permission-registry-coverage.guard.spec.ts, then re-run tests. Then merge.
