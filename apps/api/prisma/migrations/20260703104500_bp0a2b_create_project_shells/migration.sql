-- B-P0a-2b — create Project shells for Jobs with no mapped Project.
-- Plan of record: docs/architecture/job-project-consolidation.md, section 6
-- (every Job must have a Project before slices -4/-5 re-point children).
-- Companion to 20260703071228_bp0a2_backfill_job_attributes, which only
-- backfills EXISTING Projects — verified 2026-07-03 that dev and production
-- have zero Projects, so this slice creates the missing rows.
-- Data steps are INLINE (risk R3 — never a separate seed). No constraint or
-- schema changes here. Same status CASE as the -2 migration.
-- Reversible: shells are tagged with estimate_snapshot marker bp0a2bShell
-- (down-path SQL documented in the PR body).
-- Idempotent by construction: a Job already claimed by a Project (via
-- source_tender_id or legacy_job_id) is excluded, so a re-run inserts nothing.
-- Locked by bp0a2b-project-shells.spec.ts, which re-executes these statements.
-- Statements are semicolon-terminated and contain no semicolons inside
-- literals or comments, so the spec can split on them.

-- Step 1 — candidate set + deterministic IS-P numbering.
-- A Job is unmapped when no Project shares its source_tender_id and no
-- Project carries it as legacy_job_id. Guard rails (skip, never fail):
--   - a Job whose job_number already exists on some Project is excluded
--     (job_number is unique on projects),
--   - legacy_job_id collisions are impossible by construction (the
--     legacy_job_id NOT EXISTS clause is the mapping test itself).
-- Numbering continues from GREATEST(sequence last_number, max existing
-- IS-P number) and orders by Job.created_at (id as tiebreak), so re-runs
-- from the same state number identically. greatest(3, length) prevents
-- lpad truncation past IS-P999.
CREATE TEMP TABLE bp0a2b_shells ON COMMIT DROP AS
WITH unmapped AS (
  SELECT j.*
  FROM jobs j
  WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.legacy_job_id = j.id)
    AND (j.source_tender_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM projects p WHERE p.source_tender_id = j.source_tender_id))
    AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.job_number = j.job_number)
),
base AS (
  SELECT GREATEST(
    COALESCE((SELECT last_number FROM project_number_sequences WHERE id = 1), 0),
    COALESCE((SELECT max((substring(project_number FROM 'IS-P([0-9]+)$'))::int)
              FROM projects WHERE project_number ~ '^IS-P[0-9]+$'), 0)
  ) AS n
)
SELECT
  u.*,
  ((SELECT n FROM base) + row_number() OVER (ORDER BY u.created_at, u.id))::int AS shell_number
FROM unmapped u;

-- Step 2 — insert the shells.
-- Copied from Job: name, client_id, source_tender_id, project_manager_id,
-- supervisor_id, created_at, site_id, job_number, legacy_job_id. Status via
-- the SAME CASE as the -2 migration. siteAddress* resolved from the linked
-- Site (NOT NULL columns — absent means empty string, matching the -2
-- convention). Estimate/contract fields stay at defaults (no estimate
-- snapshot exists for legacy Jobs) — estimate_snapshot carries only the
-- bp0a2bShell marker used for reversal. created_by_id is NOT NULL, so the
-- admin seed user (earliest user as fallback) is used and the whole insert
-- is skipped if the users table is empty (never fail on data quirks).
INSERT INTO projects (
  id, project_number, job_number, legacy_job_id, name, status,
  source_tender_id, client_id, site_id,
  site_address_line1, site_address_suburb, site_address_state, site_address_postcode,
  project_manager_id, supervisor_id,
  estimate_snapshot, created_by_id, created_at, updated_at
)
SELECT
  gen_random_uuid()::text,
  'IS-P' || lpad(sh.shell_number::text, greatest(3, length(sh.shell_number::text)), '0'),
  sh.job_number,
  sh.id,
  sh.name,
  (CASE sh.status
    WHEN 'PLANNING' THEN 'MOBILISING'
    WHEN 'ACTIVE'   THEN 'ACTIVE'
    WHEN 'COMPLETE' THEN 'CLOSED'
    ELSE 'MOBILISING'
  END)::"ProjectStatus",
  sh.source_tender_id,
  sh.client_id,
  sh.site_id,
  COALESCE(s.address_line_1, ''),
  COALESCE(s.suburb, ''),
  COALESCE(s.state, ''),
  COALESCE(s.postcode, ''),
  sh.project_manager_id,
  sh.supervisor_id,
  jsonb_build_object('bp0a2bShell', true),
  (SELECT id FROM users ORDER BY (email = 'admin@projectops.local') DESC, created_at ASC LIMIT 1),
  sh.created_at,
  now()
FROM bp0a2b_shells sh
LEFT JOIN sites s ON s.id = sh.site_id
WHERE EXISTS (SELECT 1 FROM users)
  AND NOT EXISTS (
    SELECT 1 FROM projects p2
    WHERE p2.project_number = 'IS-P' || lpad(sh.shell_number::text, greatest(3, length(sh.shell_number::text)), '0')
  );

-- Step 3 — bump the project_number_sequences singleton so the next
-- ProjectsService allocation continues past the shells instead of colliding
-- with them. GREATEST keeps a re-run (or an already-ahead sequence) safe.
INSERT INTO project_number_sequences (id, last_number)
SELECT 1, (SELECT max(shell_number) FROM bp0a2b_shells)
WHERE EXISTS (SELECT 1 FROM bp0a2b_shells)
  AND EXISTS (SELECT 1 FROM users)
ON CONFLICT (id) DO UPDATE
SET last_number = GREATEST(project_number_sequences.last_number, EXCLUDED.last_number);
