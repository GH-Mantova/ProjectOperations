VERDICT: MERGE

Scope compliance:
- In scope: All five files match the prompt exactly:
  - apps/web/src/pages/crm/TendersPage.tsx (removed inline tab bar; passes CrmTabDef[] to TendersRegisterPage)
  - apps/web/src/pages/crm/TendersRegisterPage.tsx (migrated to s7 kit, CrmTabs, filter chips, "None set" / "Stalled" display rule)
  - apps/web/src/pages/crm/tendersRegisterPage.helpers.ts (added isStalled + STALLED_AFTER_DAYS constant)
  - apps/web/src/pages/crm/crm.css (added crm-filter-chip--active, crm-filter-search styles)
  - apps/web/src/pages/crm/__tests__/crm-uifix-s1.test.ts (updated to reflect new CrmTabs pattern)
  - apps/web/src/pages/crm/__tests__/crmvis-s4-register.test.ts (new, 12 unit tests for isStalled and hex compliance)
- Out of scope: None. No migrations, API changes, /sot/ edits, or schema.prisma modifications.

Self-verification claims (done_when):
- [PASS] pnpm --filter @project-ops/web build (9.94s, zero errors)
- [PASS] pnpm lint (web passes, API lint has pre-existing warning unrelated to this PR)
- [PASS] pnpm --filter @project-ops/web test (3257 tests pass, 155 suites, includes new crmvis-s4-register.test.ts 12 tests and updated crm-uifix-s1.test.ts)
- [PASS] grep -q "CRM_PARITY_REGISTER_V1" apps/web/src/pages/crm/TendersRegisterPage.tsx
- [PASS] grep -q "None set" apps/web/src/pages/crm/TendersRegisterPage.tsx
- [PASS] grep -q "isStalled" apps/web/src/pages/crm/tendersRegisterPage.helpers.ts
- [PASS] ! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/TendersRegisterPage.tsx (no 6-digit hex literals)
- [PASS] ! grep -qE '#[0-9a-fA-F]{3,6}\b' apps/web/src/pages/crm/crm.css (no 3-6 digit hex literals)

CI status:
- Web build: PASS
- Web lint: PASS
- Web vitest (3257 tests): PASS
- PR gates (CP-26 do-not-merge): Expected failure — label is applied by prompt because escalates: true. Marco must review and approve.
- Approval receipt (CP-26): Expected failure — same do-not-merge label escalation gate. No human approval yet.
- All other checks: PASS

Risks Marco should know:
- Escalation label present: The prompt specifies `escalates: true`, so the do-not-merge label was automatically added and both CP-26 checks fail as intended. This is expected — Marco must remove the label once reviewed and approved.
- Design token compliance: All colour literals replaced with var(--…) tokens. The filter chip styling uses color-mix() to compute tint backgrounds from tokens, avoiding any hex fallback.
- Tab bar architecture: The tab bar moved from TendersPage inline to CrmTabs component (via TendersRegisterPage), same pattern as AccountsPage → AccountsListPage. The one-tab-bar invariant is preserved; the test was updated to assert the new structural pattern.
- Test pin: The existing classifyNextAction() helper (used by sidebar badge overdue classification) is unchanged; all S2 test results verified to hold. The new isStalled() function is pure, exported, and unit-tested with 9 test cases covering boundary conditions (never logged, threshold-exactly, threshold-beyond, open task suppression, unparseable dates).
- Prerequisite: requires_on_main checks AccountDetailPage.tsx for CRM_PARITY_ACCOUNT360_V1 — confirmed present on main.

Recommendation: Clear the do-not-merge label after visual acceptance review and merge. All substantive work is complete and passing; the CI gate failures are the expected escalation signal.
