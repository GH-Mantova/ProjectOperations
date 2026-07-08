-- Additive: per-tender rate set (lock + override) — TenderRateSet / TenderRateEntry.

CREATE TABLE IF NOT EXISTS "tender_rate_sets" (
  "id" TEXT NOT NULL,
  "tender_id" TEXT NOT NULL,
  "locked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_by_id" TEXT,
  "source_label" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tender_rate_sets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tender_rate_sets_tender_id_key"
  ON "tender_rate_sets"("tender_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tender_rate_sets_tender_id_fkey'
  ) THEN
    ALTER TABLE "tender_rate_sets"
      ADD CONSTRAINT "tender_rate_sets_tender_id_fkey"
      FOREIGN KEY ("tender_id") REFERENCES "tenders"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tender_rate_sets_locked_by_id_fkey'
  ) THEN
    ALTER TABLE "tender_rate_sets"
      ADD CONSTRAINT "tender_rate_sets_locked_by_id_fkey"
      FOREIGN KEY ("locked_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tender_rate_entries" (
  "id" TEXT NOT NULL,
  "tender_rate_set_id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "rate_table_id" TEXT,
  "rate_table_slug" TEXT,
  "label" TEXT NOT NULL,
  "unit" TEXT,
  "original_value" DECIMAL(18,6) NOT NULL,
  "override_value" DECIMAL(18,6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tender_rate_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tender_rate_entries_tender_rate_set_id_key_key"
  ON "tender_rate_entries"("tender_rate_set_id", "key");

CREATE INDEX IF NOT EXISTS "tender_rate_entries_tender_rate_set_id_idx"
  ON "tender_rate_entries"("tender_rate_set_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tender_rate_entries_tender_rate_set_id_fkey'
  ) THEN
    ALTER TABLE "tender_rate_entries"
      ADD CONSTRAINT "tender_rate_entries_tender_rate_set_id_fkey"
      FOREIGN KEY ("tender_rate_set_id") REFERENCES "tender_rate_sets"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
