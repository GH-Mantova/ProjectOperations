---
premise: '! grep -q "P2002" apps/api/src/modules/platform/user-dashboards.service.ts'
premise_means: >
  The user-dashboards create path has no duplicate-key handling yet - the check-then-create race
  is live on main and failing tendering-e2e on EVERY open PR. Dies when the P2002 handling lands.
scope:
  - apps/api/src/modules/platform/user-dashboards.service.ts
  - apps/api/src/modules/platform/user-dashboards.service.spec.ts
size: 2
escalates: false
done_when: >
  grep -q "P2002" apps/api/src/modules/platform/user-dashboards.service.ts AND the new
  concurrent-create spec passes AND the PR is open with all required checks green including
  tendering-e2e.
---

# PRIORITY FIX: user-dashboards check-then-create race is failing e2e on EVERY open PR

## STATUS - this blocks the whole board

Since 2026-07-24 ~04:27Z, tendering-e2e fails on every PR-derived run (verified on 4 PRs incl a
DOCS-ONLY one, #793 - proof the regression is on MAIN, not in any PR's diff). Job logs show
repeated: `POST /api/v1/user-dashboards - PrismaClientKnownRequestError: Unique constraint failed
on the fields: (user_id, slug, is_system)`.

Root cause class: `apps/web/src/dashboards/DashboardCanvas.tsx` (~line 87) GETs
`/user-dashboards?slug=...` and POSTs a create when absent. Parallel e2e workers race: both read
absent, both create, second one violates `@@unique([userId, slug, isSystem])` and 500s. The
server must be the arbiter, not the client.

## THE WORK

In `user-dashboards.service.ts`, make the create path idempotent per
`docs/architecture/drafts/idempotency-pattern.md` Case A: create FIRST and catch Prisma P2002
(unique violation); on P2002, fetch and RETURN the existing row (same user_id + slug + is_system)
with a 200-shaped response instead of throwing. Do NOT pre-check-then-create, do NOT add a
transaction around a single create, do NOT change the schema or the unique constraint.

Add a spec to `user-dashboards.service.spec.ts`: create throwing P2002 -> service returns the
existing row and does not throw. Follow the existing spec file's mock patterns.

First, read the failing job log yourself to confirm nothing has drifted:
`gh run view --job 89399311924 --repo GH-Mantova/ProjectOperations --log-failed` (doctrine: the
log, never the diff). If the failing signature has CHANGED since this prompt was written, fix
what the log actually shows and say so in the PR body.

## DO NOT

- No schema/migration changes. No client-side (web) changes. No new endpoints.
- Do not weaken, skip, or retry any e2e spec - this is a server fix.
- Two files only.

## VERIFY

- `pnpm --filter api test -- user-dashboards` (or the repo's equivalent scoped run) exits 0.
- `pnpm lint` clean on touched files.
- PR body needle: `P2002` (newly added artifact).

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED. It does not mean "wait for
approval before starting". There is no human in this run. Finishing the work and then asking
for permission is indistinguishable from failing - the work is discarded either way.
