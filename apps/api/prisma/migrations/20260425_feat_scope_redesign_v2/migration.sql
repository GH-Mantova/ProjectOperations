-- ── Scope row: multi-plant + multi-measurement JSON columns ─────────
ALTER TABLE "scope_of_works_items"
  ADD COLUMN "plant_items" JSONB,
  ADD COLUMN "measurements" JSONB;

-- ── ScopeWasteItem — separate waste rows per tender × discipline ────
CREATE TABLE "scope_waste_items" (
  "id"              TEXT NOT NULL,
  "tender_id"       TEXT NOT NULL,
  "discipline"      TEXT NOT NULL,
  "wbs_ref"         TEXT,
  "description"     TEXT NOT NULL,
  "waste_group"     TEXT,
  "waste_type"      TEXT,
  "waste_facility"  TEXT,
  "waste_tonnes"    DECIMAL(10,3),
  "waste_loads"     INTEGER,
  "truck_days"      DECIMAL(5,1),
  "rate_per_tonne"  DECIMAL(10,2),
  "rate_per_load"   DECIMAL(10,2),
  "line_total"      DECIMAL(12,2),
  "notes"           TEXT,
  "sort_order"      INTEGER NOT NULL DEFAULT 0,
  "created_by_id"   TEXT NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scope_waste_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scope_waste_items_tender_id_discipline_idx"
  ON "scope_waste_items"("tender_id", "discipline");

ALTER TABLE "scope_waste_items"
  ADD CONSTRAINT "scope_waste_items_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scope_waste_items"
  ADD CONSTRAINT "scope_waste_items_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── QuoteScopeItem — client-facing scope editable per quote ─────────
CREATE TABLE "quote_scope_items" (
  "id"                TEXT NOT NULL,
  "quote_id"          TEXT NOT NULL,
  "source_item_id"    TEXT,
  "source_item_type"  TEXT,
  "label"             TEXT,
  "description"       TEXT NOT NULL,
  "qty"               TEXT,
  "unit"              TEXT,
  "notes"             TEXT,
  "is_visible"        BOOLEAN NOT NULL DEFAULT TRUE,
  "sort_order"        INTEGER NOT NULL DEFAULT 0,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "quote_scope_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quote_scope_items_quote_id_idx"
  ON "quote_scope_items"("quote_id");

ALTER TABLE "quote_scope_items"
  ADD CONSTRAINT "quote_scope_items_quote_id_fkey"
  FOREIGN KEY ("quote_id") REFERENCES "client_quotes"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ClientQuote: new detail_level column (simple | detailed) ────────
ALTER TABLE "client_quotes"
  ADD COLUMN "detail_level" TEXT NOT NULL DEFAULT 'simple';

-- ── Data migration: backfill ScopeWasteItem from legacy scope rows ──
-- Any scope row that had waste data recorded on it gets a matching waste
-- item on the same tender+discipline. Legacy columns are retained on
-- scope_of_works_items (backward compat) but will no longer be written.
INSERT INTO "scope_waste_items" (
  "id", "tender_id", "discipline", "wbs_ref", "description",
  "waste_type", "waste_facility", "waste_tonnes", "waste_loads", "truck_days",
  "notes", "sort_order", "created_by_id", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text || '-wmig',
  s."tender_id",
  s."discipline",
  s."wbs_code",
  CASE
    WHEN s."description" ILIKE '%waste%' OR s."description" ILIKE '%disposal%'
      THEN s."description"
    ELSE 'Waste disposal — ' || s."description"
  END,
  s."waste_type",
  s."waste_facility",
  s."waste_tonnes",
  s."waste_loads",
  CASE WHEN s."waste_loads" IS NOT NULL
    THEN CEIL(s."waste_loads"::decimal / 3 * 2) / 2
    ELSE NULL END,
  s."notes",
  s."sort_order",
  s."created_by_id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "scope_of_works_items" s
WHERE s."waste_tonnes" IS NOT NULL OR s."waste_loads" IS NOT NULL;
