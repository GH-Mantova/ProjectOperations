# PR-546 Blocker: Test Expectations Stale After Seed Logic Change

## Issue

The PR changes the seed from deleting-and-rebuilding to additive-only (correct for S3-016), but the new seed logic automatically assigns ALL `.view` permissions to Viewer via a blanket filter (`permissions.filter((p) => p.code.endsWith(".view"))`). This includes `projects.view` and `audit.view`.

Two test cases in `permission-matrix.spec.ts` now fail because they expect Viewer to NOT have these permissions. The tests are testing the contract that Viewer holds only 17 specific `.view` codes, but the seed now gives Viewer all of them.

## Decision Required

Is the Viewer role's expanded permission set intentional? If yes: update the test expectations at lines 104 and 117 of `permission-matrix.spec.ts`. If no: revise the seed logic to use an allowlist instead of the blanket `.view` filter (line 270 of `seed-reference.ts`).

## Failing Test Output

```
FAIL src/common/auth/__tests__/permission-matrix.spec.ts
  ● Permission matrix — role × endpoint authorization › projects: GET /projects/next-number [projects.view] — viewer → 403
  ● Permission matrix — role × endpoint authorization › long-tail: GET /audit-logs [audit.view] — viewer → 403
```

See full details in `docs/pr-reviews/pr-546-review.md`.
