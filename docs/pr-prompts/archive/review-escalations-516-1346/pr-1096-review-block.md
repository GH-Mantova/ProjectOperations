# PR #1096 BLOCKED — S7 depends on S4 (PR #1080) not yet on main

PR #1096 (feat(sor): S7 Agreed Record field capture) is **code-complete and CI-green** but cannot merge to main because it has a hard TypeScript import dependency on `JobSorSnapshotService` (from PR #1080, S4), which is not yet reachable from main.

S7's agreed-records.service.ts imports `JobSorSnapshotService` from `apps/api/src/modules/schedule-of-rates/job-sor-snapshot.service.ts` and calls `snapshots.attach()` on first AR submission (per prompt requirement). This file does not exist on main yet, so the build will fail if PR #1096 is merged before S4.

**Action:** Merge PR #1080 (S4) to main first, then merge PR #1096. No code changes needed — both PRs are correct as-is. This is purely a sequencing issue.

**Verification:** Run `git merge-base --is-ancestor eea9ac05 main` (should return true when S4 is on main).
