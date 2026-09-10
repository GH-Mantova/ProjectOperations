# PR #663 — blocker: missing GATE-ALLOW declaration

PR #663 (feat(platform): configurable automation engine) fails CI on **CP-11 migrations gate**. The prompt explicitly requires `GATE-ALLOW: migrations` in the PR body (line 23 of pr-ux-automation-engine-HOLD.md), but the PR was pushed without this marker.

**CI log (line 164):**
```
FAIL - CP-11 migrations [undeclared: apps/api/prisma/migrations/20260717130000_feat_automation_engine/migration.sql]
```

**Fix:** Add `GATE-ALLOW: migrations` as a new line in the PR body, or re-fire the prompt with instructions to include the gate marker before pushing. The substantive work (schema, engine, admin UI, action whitelist) is complete and correct; only the body declaration is missing.

One-line fix: edit PR body to add the marker, then re-run CI (close/reopen PR or empty commit to re-trigger).
