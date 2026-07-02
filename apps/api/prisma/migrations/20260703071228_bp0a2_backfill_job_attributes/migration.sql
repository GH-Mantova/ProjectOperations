-- B-P0a-2 — backfill Job attributes onto Project.
-- Plan of record: docs/architecture/job-project-consolidation.md, section 6 row B-P0a-2.
-- Data steps are INLINE (risk R3 — never a separate seed). No constraint changes here.
-- Reversible: null the backfilled columns (down-path SQL documented in the PR body).
-- Idempotent by construction: every UPDATE guards on the target still being at its
-- default (NULL / MOBILISING), so a re-run is a no-op. Locked by bp0a2-backfill.spec.ts,
-- which re-executes these statements. Statements are semicolon-terminated and contain
-- no semicolons inside literals or comments, so the spec can split on them.

-- Step 1 — build the Job -> Project map.
-- Priority (a): shared source_tender_id (both non-null).
-- Priority (b): tender-less Jobs matched on (client_id, lower(name)), excluding
--   any Job or Project already claimed by a tender pair.
-- Ambiguous pairs (one Job matching many Projects, or two Jobs matching one
-- Project) are dropped by the HAVING count = 1 filter — skipped, never guessed
-- (counted in the PR readiness report, not here). Unmapped Jobs are left alone.
-- No Projects are created in this slice.
CREATE TEMP TABLE bp0a2_map ON COMMIT DROP AS
WITH tender_pairs AS (
  SELECT j.id AS job_id, p.id AS project_id
  FROM jobs j
  JOIN projects p ON p.source_tender_id = j.source_tender_id
  WHERE j.source_tender_id IS NOT NULL
),
name_pairs AS (
  SELECT j.id AS job_id, p.id AS project_id
  FROM jobs j
  JOIN projects p ON p.client_id = j.client_id AND lower(p.name) = lower(j.name)
  WHERE j.source_tender_id IS NULL
    AND j.id NOT IN (SELECT job_id FROM tender_pairs)
    AND p.id NOT IN (SELECT project_id FROM tender_pairs)
),
combined AS (
  SELECT job_id, project_id FROM tender_pairs
  UNION
  SELECT job_id, project_id FROM name_pairs
)
SELECT job_id, project_id
FROM combined
WHERE job_id IN (SELECT job_id FROM combined GROUP BY job_id HAVING count(*) = 1)
  AND project_id IN (SELECT project_id FROM combined GROUP BY project_id HAVING count(*) = 1);

-- Step 2 — legacy_job_id back-pointer (anchor for every later statement and for
-- slices -4/-5). Guarded: target null, and the Job not already claimed by
-- another Project (legacy_job_id is unique — skip instead of failing).
UPDATE projects p
SET legacy_job_id = m.job_id
FROM bp0a2_map m
WHERE p.id = m.project_id
  AND p.legacy_job_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM projects p2 WHERE p2.legacy_job_id = m.job_id);

-- Step 3 — jobNumber. Guarded: target null, row anchored via legacy_job_id, and
-- the number not already present on another Project (job_number is unique —
-- collision rows are skipped and counted in the PR report, never a hard failure).
UPDATE projects p
SET job_number = j.job_number
FROM bp0a2_map m
JOIN jobs j ON j.id = m.job_id
WHERE p.id = m.project_id
  AND p.legacy_job_id = m.job_id
  AND p.job_number IS NULL
  AND NOT EXISTS (SELECT 1 FROM projects p2 WHERE p2.job_number = j.job_number);

-- Step 4 — status. Explicit CASE over every legacy value present on the dev DB
-- at authoring time (SELECT DISTINCT status FROM jobs -> ACTIVE, COMPLETE) plus
-- PLANNING, the code-level default (jobs.service.ts). Mapping:
--   PLANNING -> MOBILISING (Project default — no write needed)
--   ACTIVE   -> ACTIVE
--   COMPLETE -> CLOSED (Job COMPLETE is only set by closeout ARCHIVED/CLOSED)
-- Any other value falls through to MOBILISING (risk R5) and is recorded in
-- step 5. Only Projects still at the default MOBILISING are touched — a
-- Project whose status has already progressed is never clobbered.
UPDATE projects p
SET status = (CASE j.status
    WHEN 'PLANNING' THEN 'MOBILISING'
    WHEN 'ACTIVE'   THEN 'ACTIVE'
    WHEN 'COMPLETE' THEN 'CLOSED'
    ELSE 'MOBILISING'
  END)::"ProjectStatus"
FROM bp0a2_map m
JOIN jobs j ON j.id = m.job_id
WHERE p.id = m.project_id
  AND p.legacy_job_id = m.job_id
  AND p.status = 'MOBILISING'::"ProjectStatus"
  AND (CASE j.status
    WHEN 'PLANNING' THEN 'MOBILISING'
    WHEN 'ACTIVE'   THEN 'ACTIVE'
    WHEN 'COMPLETE' THEN 'CLOSED'
    ELSE 'MOBILISING'
  END) <> 'MOBILISING';

-- Step 5 — audit trail for unmapped legacy statuses (risk R5). One
-- ProjectActivityLog row per coerced Project, attributed to the admin seed user
-- (falling back to the earliest user). NOT EXISTS on the note keeps re-runs
-- from duplicating rows. Skipped entirely if the users table is empty.
INSERT INTO project_activity_logs (id, project_id, user_id, action, details, created_at)
SELECT
  gen_random_uuid()::text,
  m.project_id,
  (SELECT id FROM users ORDER BY (email = 'admin@projectops.local') DESC, created_at ASC LIMIT 1),
  'STATUS_CHANGED'::"ProjectActivityAction",
  jsonb_build_object('note', 'bp0a2 backfill: unmapped legacy status ''' || j.status || ''''),
  now()
FROM bp0a2_map m
JOIN jobs j ON j.id = m.job_id
JOIN projects p ON p.id = m.project_id
WHERE p.legacy_job_id = m.job_id
  AND p.status = 'MOBILISING'::"ProjectStatus"
  AND j.status NOT IN ('PLANNING', 'ACTIVE', 'COMPLETE')
  AND EXISTS (SELECT 1 FROM users)
  AND NOT EXISTS (
    SELECT 1 FROM project_activity_logs pal
    WHERE pal.project_id = m.project_id
      AND pal.action = 'STATUS_CHANGED'::"ProjectActivityAction"
      AND pal.details->>'note' = 'bp0a2 backfill: unmapped legacy status ''' || j.status || ''''
  );

-- Step 6 — normalised Site link. Only where the Project has none.
UPDATE projects p
SET site_id = j.site_id
FROM bp0a2_map m
JOIN jobs j ON j.id = m.job_id
WHERE p.id = m.project_id
  AND p.legacy_job_id = m.job_id
  AND p.site_id IS NULL
  AND j.site_id IS NOT NULL;

-- Step 7 — resolve the linked Site row into the siteAddress* columns.
-- These columns are NOT NULL in the DB, so "absent" means empty string in
-- practice (NULLIF treats '' as missing). Non-empty Project address data is
-- never overwritten. site_address_line2 has no Site-side source (sites has no
-- line-2 column) and is left untouched.
UPDATE projects p
SET
  site_address_line1    = COALESCE(NULLIF(p.site_address_line1, ''), s.address_line_1, p.site_address_line1),
  site_address_suburb   = COALESCE(NULLIF(p.site_address_suburb, ''), s.suburb, p.site_address_suburb),
  site_address_state    = COALESCE(NULLIF(p.site_address_state, ''), s.state, p.site_address_state),
  site_address_postcode = COALESCE(NULLIF(p.site_address_postcode, ''), s.postcode, p.site_address_postcode)
FROM sites s
WHERE s.id = p.site_id
  AND p.legacy_job_id IS NOT NULL
  AND (
    (NULLIF(p.site_address_line1, '') IS NULL AND s.address_line_1 IS NOT NULL)
    OR (NULLIF(p.site_address_suburb, '') IS NULL AND s.suburb IS NOT NULL)
    OR (NULLIF(p.site_address_state, '') IS NULL AND s.state IS NOT NULL)
    OR (NULLIF(p.site_address_postcode, '') IS NULL AND s.postcode IS NOT NULL)
  );
