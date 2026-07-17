-- Enforce site_id NOT NULL on jobs and projects.
--
-- Marco 2026-07-15: Job and Project must always resolve to a Site. Rows that
-- currently have site_id IS NULL are backfilled to a stable "Unassigned" Site
-- (created here if absent) so the ALTER … SET NOT NULL cannot fail. Rows can
-- be moved off "Unassigned" later; this migration only removes the null state.
--
-- Tender and FormSubmission siteId are handled elsewhere and are intentionally
-- untouched by this migration.
--
-- Idempotent: the Unassigned site is upserted by unique (name); backfill only
-- touches rows still NULL; ALTER … SET NOT NULL is a no-op if already NOT NULL.

DO $$
DECLARE
  unassigned_site_id TEXT;
  jobs_backfilled    BIGINT;
  projects_backfilled BIGINT;
BEGIN
  -- 1. Ensure the Unassigned site exists (unique on name).
  INSERT INTO "sites" (id, name, code, notes, created_at, updated_at)
  VALUES (
    'site-unassigned',
    'Unassigned',
    'UNASSIGNED',
    'System-managed placeholder used when a Job or Project has no assigned site. Reassign to a real site once known.',
    NOW(),
    NOW()
  )
  ON CONFLICT (name) DO NOTHING;

  SELECT id INTO unassigned_site_id FROM "sites" WHERE name = 'Unassigned' LIMIT 1;

  IF unassigned_site_id IS NULL THEN
    RAISE EXCEPTION 'site_id_not_null_backfill: could not resolve Unassigned site id';
  END IF;

  -- 2. Backfill NULL site_id on jobs.
  UPDATE "jobs" SET site_id = unassigned_site_id WHERE site_id IS NULL;
  GET DIAGNOSTICS jobs_backfilled = ROW_COUNT;
  RAISE NOTICE 'site_id_not_null_backfill: jobs backfilled = %', jobs_backfilled;

  -- 3. Backfill NULL site_id on projects.
  UPDATE "projects" SET site_id = unassigned_site_id WHERE site_id IS NULL;
  GET DIAGNOSTICS projects_backfilled = ROW_COUNT;
  RAISE NOTICE 'site_id_not_null_backfill: projects backfilled = %', projects_backfilled;
END $$;

-- 4. Enforce NOT NULL now that every row has a site.
ALTER TABLE "jobs"     ALTER COLUMN "site_id" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "site_id" SET NOT NULL;

-- 5. Replace the FK constraints. SetNull is not valid on a NOT NULL column,
--    so the FK behaviour flips to Restrict (matches schema.prisma). Restrict
--    is the safer default here: an accidental delete of a Site now fails loudly
--    instead of silently detaching Jobs / Projects.
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_site_id_fkey";
ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects" DROP CONSTRAINT "projects_site_id_fkey";
ALTER TABLE "projects"
  ADD CONSTRAINT "projects_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
