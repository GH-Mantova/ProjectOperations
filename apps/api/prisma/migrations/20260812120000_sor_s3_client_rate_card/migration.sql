-- SoR S3 — per-client rate card: two additive tables + indexes/FKs.
--
-- Additive only: no existing tables, columns, or enums are altered.
-- All CREATE TABLE / ALTER TABLE statements are idempotent via IF NOT EXISTS /
-- exception-guard pattern (matching the S1 migration convention).

-- ── 1. Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "sor_client_rate_cards" (
  "id"            TEXT         NOT NULL,
  "client_id"     TEXT         NOT NULL,
  "sor_period_id" TEXT         NOT NULL,
  "status"        TEXT         NOT NULL DEFAULT 'ACTIVE',
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sor_client_rate_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sor_client_rate_entries" (
  "id"           TEXT         NOT NULL,
  "card_id"      TEXT         NOT NULL,
  "sor_rate_id"  TEXT,
  "category"     "SorCategory" NOT NULL,
  "position"     TEXT         NOT NULL,
  "class"        TEXT,
  "unit"         TEXT,
  "ordinary"     DECIMAL(12,2),
  "one_and_half" DECIMAL(12,2),
  "double"       DECIMAL(12,2),
  "is_override"  BOOLEAN      NOT NULL DEFAULT false,
  "is_removed"   BOOLEAN      NOT NULL DEFAULT false,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sor_client_rate_entries_pkey" PRIMARY KEY ("id")
);

-- ── 2. Foreign keys ───────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "sor_client_rate_cards"
    ADD CONSTRAINT "sor_client_rate_cards_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sor_client_rate_cards"
    ADD CONSTRAINT "sor_client_rate_cards_sor_period_id_fkey"
    FOREIGN KEY ("sor_period_id") REFERENCES "sor_periods"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sor_client_rate_entries"
    ADD CONSTRAINT "sor_client_rate_entries_card_id_fkey"
    FOREIGN KEY ("card_id") REFERENCES "sor_client_rate_cards"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sor_client_rate_entries"
    ADD CONSTRAINT "sor_client_rate_entries_sor_rate_id_fkey"
    FOREIGN KEY ("sor_rate_id") REFERENCES "sor_rates"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. Unique constraints ─────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "sor_client_rate_cards_client_id_sor_period_id_key"
  ON "sor_client_rate_cards"("client_id", "sor_period_id");

-- ── 4. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "sor_client_rate_cards_client_id_idx"
  ON "sor_client_rate_cards"("client_id");

CREATE INDEX IF NOT EXISTS "sor_client_rate_cards_sor_period_id_idx"
  ON "sor_client_rate_cards"("sor_period_id");

CREATE INDEX IF NOT EXISTS "sor_client_rate_entries_card_id_idx"
  ON "sor_client_rate_entries"("card_id");

CREATE INDEX IF NOT EXISTS "sor_client_rate_entries_sor_rate_id_idx"
  ON "sor_client_rate_entries"("sor_rate_id");
