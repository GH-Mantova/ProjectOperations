# PR #960 — test harness fix required

ComplianceService constructor was extended with a 4th parameter (NotificationPreferencesService), but the existing compliance test mocks in `compliance.service.spec.ts` and `compliance-competency.service.spec.ts` were not updated. Both test files instantiate ComplianceService with 3 args instead of 4, causing TS2554 compilation failures in CI. Substantive work is complete and scope-correct; this is a mechanical test-mock fix only (add NotificationPreferencesService mock to buildService() and pass it as 4th argument).
