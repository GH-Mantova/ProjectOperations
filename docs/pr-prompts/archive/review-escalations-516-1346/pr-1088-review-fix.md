# PR #1088 — Out-of-scope S2 work mixed into S3

**Summary**: PR ships S3 (SoR source + markup) correctly but includes S2 vendor-archive work (rate-archive.service, subcontractor-archive.controller, SubcontractorsPage archive UI, plus two S2/MIG-1 migrations). This violates the S3 scope guard.

**What shipped that should not be there**:
- `apps/api/src/modules/rates/rate-archive.service.ts` (S2 vendor delete safeguard)
- `apps/api/src/modules/rates/subcontractor-archive.controller.ts` (S2 endpoints)
- SubcontractorsPage.tsx archive/unarchive/hard-delete UI and permission logic
- `20260812200000_drop_site_name_unique` (MIG-1, not S3)
- `20260813120000_feat_subcontractor_archived_at` (S2 vendor archive columns, not S3)

**Why it matters**: Single commit mixes two slices (S3 + S2), making rollback, coordination, and re-fire difficult. Schema coupling via migrations means if either slice is delayed, both are tangled. UI on SubcontractorsPage ships vendor-safeguard features not in the S3 scope.

**Action**: Split into two PRs—
1. S3 core: sor-source-markup service, schema changes, controller, web admin page, correct migration only.
2. S2 vendor archive (if wanted in this batch): rate-archive, archive endpoints, SubcontractorsPage UI changes, S2 migrations.

PR is value-correct but scope-dirty; recommend fix-forward split.
