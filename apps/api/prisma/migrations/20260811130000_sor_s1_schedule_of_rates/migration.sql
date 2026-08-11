-- SoR S1 — Schedule of Rates master: two enums + three tables + indexes/FKs.
--
-- Additive only: no existing tables, columns, or enums are altered.
-- All CREATE TYPE / CREATE TABLE / CREATE INDEX statements are idempotent
-- using IF NOT EXISTS / exception-guard pattern.

-- ── 1. Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "SorCategory" AS ENUM ('LABOUR', 'PLANT', 'WASTE', 'SUBCONTRACTOR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SorPeriodHalf" AS ENUM ('H1', 'H2');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Tables ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "sor_periods" (
  "id"           TEXT         NOT NULL,
  "year"         INTEGER      NOT NULL,
  "half"         "SorPeriodHalf" NOT NULL,
  "start_date"   TIMESTAMP(3) NOT NULL,
  "expiry_date"  TIMESTAMP(3) NOT NULL,
  "label"        TEXT         NOT NULL,
  "status"       TEXT         NOT NULL DEFAULT 'ACTIVE',
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sor_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sor_rates" (
  "id"           TEXT         NOT NULL,
  "period_id"    TEXT         NOT NULL,
  "category"     "SorCategory" NOT NULL,
  "name"         TEXT         NOT NULL,
  "class"        TEXT,
  "unit"         TEXT,
  "ordinary"     DECIMAL(12,2),
  "one_and_half" DECIMAL(12,2),
  "double"       DECIMAL(12,2),
  "is_reference" BOOLEAN      NOT NULL DEFAULT false,
  "comments"     TEXT,
  "sort_order"   INTEGER      NOT NULL DEFAULT 0,
  "active"       BOOLEAN      NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sor_rates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sor_change_log_entries" (
  "id"             TEXT         NOT NULL,
  "period_id"      TEXT         NOT NULL,
  "rate_id"        TEXT,
  "field"          TEXT         NOT NULL,
  "old_value"      TEXT,
  "new_value"      TEXT,
  "changed_by_id"  TEXT,
  "changed_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sor_change_log_entries_pkey" PRIMARY KEY ("id")
);

-- ── 3. Foreign keys ───────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "sor_rates"
    ADD CONSTRAINT "sor_rates_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "sor_periods"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sor_change_log_entries"
    ADD CONSTRAINT "sor_change_log_entries_period_id_fkey"
    FOREIGN KEY ("period_id") REFERENCES "sor_periods"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 4. Unique constraints ─────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "sor_periods_year_half_key"
  ON "sor_periods"("year", "half");

-- ── 5. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "sor_rates_period_id_category_idx"
  ON "sor_rates"("period_id", "category");

CREATE INDEX IF NOT EXISTS "sor_change_log_entries_period_id_idx"
  ON "sor_change_log_entries"("period_id");
