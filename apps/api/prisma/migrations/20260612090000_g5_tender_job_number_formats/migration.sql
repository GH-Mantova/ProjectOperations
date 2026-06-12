-- G5 (pilot blocker) — canonical tender + job number formats.
-- Marco-confirmed spec (pr-77, refreshed 2026-06-12):
--   Tender: T{YYMMDD}-{SLUG}-Rev{N}   e.g. T260612-ACME-Rev1
--   Job:    J{YYMMDD}-{SLUG}-{NNN}    e.g. J260612-ACME-017
-- Supersedes the J-YYYY-NNN canonicalisation (20260519, PR #339) and the
-- free-form IS-T### seed convention.
--
-- Phases:
--   1. New columns (tenders.revision_number / client_slug_snapshot,
--      jobs.client_slug_snapshot).
--   2. Deterministic mapping for KNOWN seed rows (keyed by old number) so
--      the seeds' upsert-by-tenderNumber keys keep matching after the
--      migration runs on an already-seeded DB (CP-08 idempotency).
--   3. Generic backfill for any remaining old-format rows, derived from
--      created_at (Brisbane local) + primary client name. Tenders without
--      a linked client get the XXXX fallback slug.
--
-- JobNumberSequence is intentionally untouched: the table stays (nothing
-- breaks on import) but is no longer read or incremented — per-client
-- sequences are computed from the jobs table on demand.

-- Phase 1 — columns -----------------------------------------------------------

ALTER TABLE "tenders"
  ADD COLUMN "revision_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "client_slug_snapshot" TEXT;

ALTER TABLE "jobs"
  ADD COLUMN "client_slug_snapshot" TEXT;

-- Phase 2 — deterministic seed-row mapping -------------------------------------
-- Old seed numbers -> fixed new literals (must match the literals in
-- apps/api/prisma/seed.ts and seed-initial-services.ts exactly).

UPDATE "tenders" t
SET "tender_number" = m.new_number,
    "revision_number" = 1,
    "client_slug_snapshot" = m.slug
FROM (VALUES
  ('IS-T001', 'T260310-QUEE-Rev1', 'QUEE'),
  ('IS-T002', 'T260317-SUNC-Rev1', 'SUNC'),
  ('IS-T003', 'T260324-BRIS-Rev1', 'BRIS'),
  ('IS-T004', 'T260331-PACI-Rev1', 'PACI'),
  ('IS-T005', 'T260407-GOLD-Rev1', 'GOLD'),
  ('IS-T006', 'T260414-SUNC-Rev1', 'SUNC'),
  ('IS-T007', 'T260421-QUEE-Rev1', 'QUEE'),
  ('IS-T008', 'T260428-BRIS-Rev1', 'BRIS'),
  ('IS-T009', 'T260501-ACME-Rev1', 'ACME'),
  ('IS-T010', 'T260410-ACME-Rev1', 'ACME'),
  ('IS-T011', 'T260505-NORT-Rev1', 'NORT'),
  ('IS-T012', 'T260506-ACME-Rev1', 'ACME'),
  ('IS-T013', 'T260507-NORT-Rev1', 'NORT'),
  ('IS-T014', 'T260508-ACME-Rev1', 'ACME'),
  ('IS-T020', 'T260512-BRIS-Rev1', 'BRIS'),
  ('IS-T100', 'T260520-ACME-Rev1', 'ACME')
) AS m(old_number, new_number, slug)
WHERE t."tender_number" = m.old_number;

UPDATE "jobs" j
SET "job_number" = m.new_number,
    "client_slug_snapshot" = m.slug
FROM (VALUES
  ('J-2025-001', 'J260315-QUEE-001', 'QUEE'),
  ('J-2025-002', 'J260328-BRIS-001', 'BRIS')
) AS m(old_number, new_number, slug)
WHERE j."job_number" = m.old_number;

-- The seeded template quote ref derives from the template tender number.
UPDATE "client_quotes"
SET "quote_ref" = 'T260520-ACME-Rev1-R' || "revision"
WHERE "quote_ref" ~ '^IS-T100-R\d+$';

-- Phase 3a — generic tender backfill -------------------------------------------
-- Primary client = relationship_type ILIKE '%primary%' first, else the
-- earliest-linked client. created_at is stored as UTC (timestamp without
-- time zone), so convert UTC -> Brisbane explicitly.

WITH primary_clients AS (
  SELECT DISTINCT ON (tc."tender_id")
         tc."tender_id",
         c."name" AS client_name
  FROM "tender_clients" tc
  JOIN "clients" c ON c."id" = tc."client_id"
  ORDER BY tc."tender_id",
           (tc."relationship_type" ILIKE '%primary%') DESC,
           tc."created_at" ASC
),
bases AS (
  SELECT t."id",
         'T' || to_char((t."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Australia/Brisbane', 'YYMMDD')
             || '-'
             || COALESCE(
                  NULLIF(substring(upper(regexp_replace(pc.client_name, '[^A-Za-z0-9]', '', 'g')) for 4), ''),
                  'XXXX'
                )
             || '-Rev1' AS base,
         COALESCE(
           NULLIF(substring(upper(regexp_replace(pc.client_name, '[^A-Za-z0-9]', '', 'g')) for 4), ''),
           'XXXX'
         ) AS slug,
         t."created_at"
  FROM "tenders" t
  LEFT JOIN primary_clients pc ON pc."tender_id" = t."id"
  WHERE t."tender_number" !~ '^T\d{6}-'
),
proposed AS (
  SELECT b."id", b.base, b.slug,
         ROW_NUMBER() OVER (PARTITION BY b.base ORDER BY b."created_at", b."id") AS dup_rank
  FROM bases b
)
UPDATE "tenders" t
SET "tender_number" = p.base || CASE WHEN p.dup_rank > 1 THEN '-' || p.dup_rank::text ELSE '' END,
    "revision_number" = 1,
    "client_slug_snapshot" = p.slug
FROM proposed p
WHERE t."id" = p."id";

-- Phase 3b — generic job backfill -----------------------------------------------
-- Jobs link to their client directly. NNN = per-client cumulative sequence by
-- created_at, offset past any jobs already in the new format (the Phase 2
-- seed rows), so e.g. QUEE continues at 002.

WITH counted AS (
  SELECT j."id",
         to_char((j."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Australia/Brisbane', 'YYMMDD') AS stamp,
         COALESCE(
           NULLIF(substring(upper(regexp_replace(c."name", '[^A-Za-z0-9]', '', 'g')) for 4), ''),
           'XXXX'
         ) AS slug,
         (SELECT count(*) FROM "jobs" j2
           WHERE j2."client_id" = j."client_id" AND j2."job_number" ~ '^J\d{6}-') AS preexisting,
         ROW_NUMBER() OVER (PARTITION BY j."client_id" ORDER BY j."created_at", j."id") AS rn
  FROM "jobs" j
  JOIN "clients" c ON c."id" = j."client_id"
  WHERE j."job_number" !~ '^J\d{6}-'
)
UPDATE "jobs" j
SET "job_number" = 'J' || n.stamp || '-' || n.slug || '-' || lpad((n.preexisting + n.rn)::text, 3, '0'),
    "client_slug_snapshot" = n.slug
FROM counted n
WHERE j."id" = n."id";
