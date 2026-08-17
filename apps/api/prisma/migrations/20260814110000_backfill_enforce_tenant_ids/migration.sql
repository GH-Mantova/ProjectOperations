-- MT-3: Backfill + enforce tenantId on company-owned pilot tables.
--
-- Classification (docs/plans/multi-tenant-plan.md, 2026-08-04):
--   Company-owned (backfill + NOT NULL): tenders, jobs
--   Shared master data (stay nullable, NOT touched): clients, workers, contacts
--
-- Locked tenant id constant:
--   SEEDED_DEFAULT_TENANT_ID = 'tenant-initial-services-001'
--   (apps/api/src/common/tenancy/tenant.constants.ts, MT-0)
--
-- IMPORTANT — PRODUCTION-DATA MIGRATION.
-- This migration must be reviewed and run by Marco.
-- Do NOT apply to production automatically. See PR body for the siteId
-- backfill precedent (docs/pr-prompts/pr-siteid-notnull-backfill-HOLD.md).
--
-- Rollback (before NOT NULL is added):
--   UPDATE tenders SET tenant_id = NULL WHERE tenant_id = 'tenant-initial-services-001';
--   UPDATE jobs    SET tenant_id = NULL WHERE tenant_id = 'tenant-initial-services-001';
--
-- Rollback (after NOT NULL is added — must drop constraint first):
--   ALTER TABLE "tenders" ALTER COLUMN "tenant_id" DROP NOT NULL;
--   ALTER TABLE "jobs"    ALTER COLUMN "tenant_id" DROP NOT NULL;
--   UPDATE tenders SET tenant_id = NULL WHERE tenant_id = 'tenant-initial-services-001';
--   UPDATE jobs    SET tenant_id = NULL WHERE tenant_id = 'tenant-initial-services-001';

-- Step 1: Backfill NULL tenant_id rows on tenders to the default tenant.
--         WHERE clause makes this idempotent — safe to re-run.
UPDATE "tenders"
SET "tenant_id" = 'tenant-initial-services-001'
WHERE "tenant_id" IS NULL;

-- Step 2: Backfill NULL tenant_id rows on jobs to the default tenant.
--         WHERE clause makes this idempotent — safe to re-run.
UPDATE "jobs"
SET "tenant_id" = 'tenant-initial-services-001'
WHERE "tenant_id" IS NULL;

-- Step 3: Enforce NOT NULL on tenders.tenant_id.
--         All rows are now non-null (backfilled above).
ALTER TABLE "tenders" ALTER COLUMN "tenant_id" SET NOT NULL;

-- Step 4: Enforce NOT NULL on jobs.tenant_id.
--         All rows are now non-null (backfilled above).
ALTER TABLE "jobs" ALTER COLUMN "tenant_id" SET NOT NULL;
