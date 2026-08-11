-- WL-1a — Tender outcome capture: structured, OPTIONAL-at-close, append-only.
--
-- Additive only: two new enums, and new nullable columns/FKs/indexes on
-- tender_outcomes. Existing outcome_type/notes columns are untouched, so all
-- existing rows stay valid. Down migration drops the added columns and enums.

-- ── 1. Enums ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "TenderOutcomeResult" AS ENUM ('WON', 'LOST', 'NO_BID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TenderOutcomeReason" AS ENUM (
    'PRICE_TOO_HIGH',
    'LOST_ON_RELATIONSHIP',
    'SCOPE_MISMATCH',
    'TIMING_PROGRAM_CLASH',
    'CAPACITY_CONSTRAINT',
    'CLIENT_WENT_ANOTHER_DIRECTION',
    'PROJECT_CANCELLED',
    'NO_RESPONSE_FROM_CLIENT',
    'DECLINED_TO_BID',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. New nullable columns on tender_outcomes ───────────────────────────
ALTER TABLE "tender_outcomes"
  ADD COLUMN IF NOT EXISTS "result_type"          "TenderOutcomeResult",
  ADD COLUMN IF NOT EXISTS "reason"               "TenderOutcomeReason",
  ADD COLUMN IF NOT EXISTS "tender_value"         DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "our_price"            DECIMAL(14, 2),
  ADD COLUMN IF NOT EXISTS "client_id"            TEXT,
  ADD COLUMN IF NOT EXISTS "scope_summary"        TEXT,
  ADD COLUMN IF NOT EXISTS "competitor_or_winner" TEXT,
  ADD COLUMN IF NOT EXISTS "recorded_by_id"       TEXT,
  ADD COLUMN IF NOT EXISTS "supersedes_id"        TEXT;

-- ── 3. Foreign keys ──────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "tender_outcomes"
    ADD CONSTRAINT "tender_outcomes_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tender_outcomes"
    ADD CONSTRAINT "tender_outcomes_recorded_by_id_fkey"
    FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tender_outcomes"
    ADD CONSTRAINT "tender_outcomes_supersedes_id_fkey"
    FOREIGN KEY ("supersedes_id") REFERENCES "tender_outcomes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. Indexes ───────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "tender_outcomes_supersedes_id_key"
  ON "tender_outcomes"("supersedes_id");

CREATE INDEX IF NOT EXISTS "tender_outcomes_client_id_idx"
  ON "tender_outcomes"("client_id");
