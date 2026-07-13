-- Data migration: apply the `is_super_user` flag to prod for the two accounts
-- the reference seed already declares as super-users.
--
-- Why: `apps/api/prisma/seed-users-prod.ts` (lines ~50-77) declares
-- sean@initialservices.net and marco@initialservices.net as super-users, but
-- deploy.yml only runs `prisma migrate deploy` — it never runs the TS seed.
-- Result: the flag has never been applied in prod for either user, so the
-- frontend `can()` short-circuit on `isSuperUser` never fires and permission
-- checks like `rates.manage` bounce them out of admin surfaces.
--
-- This is a second occurrence of the LL-04 / #504 trap
-- (see sot/05-decisions-and-lessons.md): seed-only auth changes never reach
-- prod. Fix pattern is the same: pair the seed change with a data migration.
--
-- Scope: EXACTLY the two emails the seed declares as super-users. This is
-- not a new authorization decision — it makes prod match the seed.
--
-- Idempotent: the `is_super_user = false` guard turns the second run into a
-- no-op. Safe to re-run.
--
-- Reverse (documented, run manually if rolling back):
--   UPDATE "users" SET "is_super_user" = false
--   WHERE "email" IN ('marco@initialservices.net', 'sean@initialservices.net');

UPDATE "users"
SET "is_super_user" = true
WHERE "email" IN ('marco@initialservices.net', 'sean@initialservices.net')
  AND "is_super_user" = false;
