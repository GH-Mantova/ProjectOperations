# PR #798 — E2E test update needed before merge

**Issue:** The E2E smoke test (batch6-projects-jobs.spec.ts, line 178) is failing because it expects the old API error message "Tender status must be AWARDED to convert", but the API now correctly returns "Tender status must be AWARDED or CONTRACT_ISSUED to convert" (the spec drift documented in PR #242 has been fixed by PR #798's status guard extension).

**Action:** Update line 201–202 of tests/e2e/pr-acceptance/batch6-projects-jobs.spec.ts to match the new error message. The test was verifying a spec drift (UI button visible but API refusing conversion); that drift is now closed, so the test's expected error string must be updated.

**Why:** PR-798 correctly extends ProjectsService.convertFromTender to accept CONTRACT_ISSUED in addition to AWARDED. This fixes the drift but breaks a test that was documenting the old broken behavior. The implementation is sound; only the test assertion needs updating.
