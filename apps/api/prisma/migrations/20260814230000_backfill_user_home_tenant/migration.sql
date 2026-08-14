-- GATE-ALLOW: migrations
-- Backfill user.home_tenant_id so every existing login is linked to its company.
--
-- Context: the multi-tenant rollout (MT-1..MT-3, 2026-08-14) turned on row-level
-- tenant scoping. Tender and Job are ENFORCED-scoped: when the caller's JWT carries
-- no tenant, those queries return nothing, so tenders / jobs / clients appear to
-- vanish from the UI even though every row still exists. In production no user's
-- home_tenant_id was ever set, because the production deploy runs only
-- `prisma migrate deploy` and never the seed (the seed is where dev/e2e users get
-- their home tenant). This migration closes that gap for existing users.
--
-- Behaviour: assign every user whose home_tenant_id IS NULL to the single existing
-- tenant. GUARDED to run only when exactly one tenant exists, so it can never guess
-- among multiple companies -- a future multi-company install is a no-op here and must
-- assign users explicitly. Additive, idempotent (re-running touches nothing once set),
-- no DDL, no data destroyed.
--
-- Rollback:
--   UPDATE "users" SET "home_tenant_id" = NULL
--   WHERE "home_tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" ASC LIMIT 1);

UPDATE "users"
SET "home_tenant_id" = (SELECT "id" FROM "tenants" ORDER BY "created_at" ASC LIMIT 1)
WHERE "home_tenant_id" IS NULL
  AND (SELECT COUNT(*) FROM "tenants") = 1;
