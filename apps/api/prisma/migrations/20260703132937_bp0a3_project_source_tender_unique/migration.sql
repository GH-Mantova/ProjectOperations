-- B-P0a-3: one tender = one delivery record.
-- Duplicate audit runs first: the migration aborts (RAISE EXCEPTION) if any
-- source_tender_id maps to more than one Project. NULLs are exempt — Postgres
-- permits multiple NULLs under a unique index, so tender-less shells are fine.

DO $$
DECLARE
  dup_ids TEXT;
BEGIN
  SELECT string_agg(source_tender_id || ' (x' || cnt || ')', ', ')
  INTO dup_ids
  FROM (
    SELECT source_tender_id, count(*) AS cnt
    FROM projects
    WHERE source_tender_id IS NOT NULL
    GROUP BY source_tender_id
    HAVING count(*) > 1
  ) dups;

  IF dup_ids IS NOT NULL THEN
    RAISE EXCEPTION 'bp0a3 aborted: duplicate Project.source_tender_id values remain: %', dup_ids;
  END IF;
END $$;

-- Unique index supersedes the plain index from 20260421_feat_projects.
DROP INDEX IF EXISTS "projects_source_tender_id_idx";

CREATE UNIQUE INDEX "projects_source_tender_id_key" ON "projects"("source_tender_id");
