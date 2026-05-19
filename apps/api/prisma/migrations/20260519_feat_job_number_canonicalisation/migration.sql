-- PR B05 — Job ID canonicalisation + JobNumberSequence
--
-- Consolidates three coexisting Job ID formats to canonical J-YYYY-NNN:
--   J-YYYY-NNN        (already canonical — seed rows)
--   JOB-YYYY-NNN      (legacy runtime format) -> strip "OB"
--   JOB-COMP-<epoch>  (compliance harness)    -> assign next free
--                                                J-2026-NNN
--
-- Phase 3 assigns JOB-COMP-* numbers starting AFTER the max already-used
-- 2026 sequence number (post-Phase-2). This avoids a collision when a
-- JOB-2026-NNN row already exists and Phase 2 rewrote it to J-2026-NNN.

-- Phase 1: Create JobNumberSequence table
CREATE TABLE "job_number_sequences" (
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "job_number_sequences_pkey" PRIMARY KEY ("year")
);

-- Phase 2: Normalise existing JOB-YYYY-NNN rows to J-YYYY-NNN.
-- Regex-safe substring rewrite.
UPDATE "jobs"
SET "job_number" = 'J-' || SUBSTRING("job_number" FROM 5)
WHERE "job_number" ~ '^JOB-\d{4}-\d{3}$';

-- Phase 3: Normalise JOB-COMP-<epoch> rows to J-2026-NNN.
-- These are compliance harness rows. We assign sequence numbers in
-- insertion order (oldest first by created_at), starting from
-- MAX(existing J-2026-NNN) + 1 so we don't collide with the rows
-- already promoted to J-2026-NNN in Phase 2. Year hard-coded to
-- 2026 per locked decision D4.
WITH base AS (
  SELECT COALESCE(MAX(
    CAST(SUBSTRING("job_number" FROM 8 FOR 3) AS INTEGER)
  ), 0) AS start_at
  FROM "jobs"
  WHERE "job_number" ~ '^J-2026-\d{3}$'
),
numbered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "created_at" ASC) AS seq
  FROM "jobs"
  WHERE "job_number" ~ '^JOB-COMP-\d+$'
)
UPDATE "jobs" j
SET "job_number" = 'J-2026-' || LPAD((b.start_at + n.seq)::text, 3, '0')
FROM numbered n, base b
WHERE j."id" = n."id";

-- Phase 4: Seed the 2026 sequence row to MAX(seq) of all J-2026-NNN
-- rows post-normalisation. If there were no 2026 rows at all, this
-- inserts last_number=0.
INSERT INTO "job_number_sequences" ("year", "last_number")
SELECT 2026, COALESCE(MAX(
  CAST(SUBSTRING("job_number" FROM 8 FOR 3) AS INTEGER)
), 0)
FROM "jobs"
WHERE "job_number" ~ '^J-2026-\d{3}$'
ON CONFLICT ("year") DO UPDATE
  SET "last_number" = EXCLUDED."last_number";

-- Phase 5: Seed sequence rows for any other historical years present
-- (e.g. the seed's J-2025-001/002 plus any J-2025-NNN promoted from
-- JOB-2025-NNN in Phase 2). GREATEST guards against the 2026 row from
-- Phase 4 being clobbered by a stale max.
INSERT INTO "job_number_sequences" ("year", "last_number")
SELECT
  CAST(SUBSTRING("job_number" FROM 3 FOR 4) AS INTEGER) AS year,
  MAX(CAST(SUBSTRING("job_number" FROM 8 FOR 3) AS INTEGER)) AS last_number
FROM "jobs"
WHERE "job_number" ~ '^J-\d{4}-\d{3}$'
GROUP BY CAST(SUBSTRING("job_number" FROM 3 FOR 4) AS INTEGER)
ON CONFLICT ("year") DO UPDATE
  SET "last_number" = GREATEST("job_number_sequences"."last_number", EXCLUDED."last_number");

-- Phase 6: Assert no non-canonical job numbers remain. If this fails,
-- there's a format we didn't anticipate — STOP and report.
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM "jobs"
  WHERE "job_number" !~ '^J-\d{4}-\d{3}$';

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'Job ID canonicalisation incomplete: % rows still non-canonical', bad_count;
  END IF;
END $$;
