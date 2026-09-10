# PR #672 — Review block: CI failures (gates + test)

Two blocking issues prevent merge:

1. **PR gates CP-11 (migrations)**: The migration file exists but is not declared at column 0 in the PR body. The marker `GATE-ALLOW: migrations` is indented (inside a bullet point). Fix: move to column 0 as a standalone line.

2. **API test suite failure**: `this.prisma.activityEntry` is undefined at jobs.service.ts:788 because the new migration hasn't been applied to the test database before tests run. The generated Prisma client doesn't have the ActivityEntry model yet. The code tries to write an ActivityEntry when JobsService.createIssue() is called (in the new system entry logic), but the test DB schema is stale.

Both are CI/setup issues, not code correctness issues. The feature itself is in scope and well-scoped. Code quality looks sound.

**Next step**: Either have the agent re-fire with correct PR body formatting and a CI fix (run `pnpm prisma migrate deploy` before test:api:serial), or manually fix the PR body + ensure CI runs the migration beforehand, then re-run checks.
