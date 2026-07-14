-- feat(sharepoint): folder mappings as CONFIG DATA, not env vars.
--
-- Before: which SharePoint folder a tender's documents live in was
-- SHAREPOINT_TENDERS_ROOT — an env var — and jobs had no root at all
-- (their documents were unaddressable). Adding a new mapping meant an
-- Azure portal trip AND a code change per env var. Same shape as the
-- authorization-limits-in-code trap (sot/05, "authorization is a config
-- layer"): a business decision was locked in the deploy manifest.
--
-- After: mappings live in the DB. Super-user edits folderPath in the
-- admin UI; the change takes effect immediately (cache invalidated on
-- edit). Credentials stay in env vars; folder paths become data.
--
-- Seed values match today's live SharePoint tree (Marco confirmed
-- 2026-07-13):
--   https://initialservices.sharepoint.com/sites/Initialservices
--   → Documents / 1. Operations / 1. Tenders
--   → Documents / 1. Operations / 2. Jobs won
--
-- Insert-if-absent (ON CONFLICT DO NOTHING) — same discipline as the
-- role-permission seed bug S3-016: an admin's edit outranks the seed,
-- so re-running the migration or `pnpm seed` must never overwrite a
-- manually-changed mapping.

CREATE TYPE "SharePointMappingEntityType" AS ENUM ('TENDER', 'JOB');

CREATE TABLE "sharepoint_folder_mappings" (
  "id"            TEXT NOT NULL,
  "entity_type"   "SharePointMappingEntityType" NOT NULL,
  "folder_path"   TEXT NOT NULL,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" TEXT,
  "updated_by_id" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sharepoint_folder_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sharepoint_folder_mappings_entity_type_key"
  ON "sharepoint_folder_mappings" ("entity_type");

-- Seed the two mappings that describe today's live SharePoint tree.
-- Fixed IDs (not cuid()) so the row is idempotent — re-running the
-- migration cannot produce a second copy under a new id. ON CONFLICT
-- DO NOTHING preserves any admin edit that has already happened.
INSERT INTO "sharepoint_folder_mappings"
  ("id", "entity_type", "folder_path", "is_active", "created_at", "updated_at")
VALUES
  ('spfm_seed_tender', 'TENDER', '1. Operations/1. Tenders', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('spfm_seed_job',    'JOB',    '1. Operations/2. Jobs won', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("entity_type") DO NOTHING;
