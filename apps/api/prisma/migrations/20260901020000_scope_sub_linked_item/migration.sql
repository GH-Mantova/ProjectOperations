-- Migration: scope_sub_linked_item (scope-subcontracted order 4)
-- Additive only. Adds:
--   1. priced_by_sub_item_id nullable self-FK on scope_of_works_items
--   2. sub_line_quotes table with a partial unique index enforcing
--      at most one selected quote per SUB line.
-- Rollback: drop sub_line_quotes, then drop the column + FK.
-- Safe to leave applied mid-flight: every existing row has the FK null
-- (current behaviour unchanged), and an empty table is inert.

-- 1. Add self-FK column to scope_of_works_items
ALTER TABLE "scope_of_works_items"
  ADD COLUMN "priced_by_sub_item_id" TEXT;

ALTER TABLE "scope_of_works_items"
  ADD CONSTRAINT "scope_of_works_items_priced_by_sub_item_id_fkey"
  FOREIGN KEY ("priced_by_sub_item_id")
  REFERENCES "scope_of_works_items"("id")
  ON DELETE SET NULL;

CREATE INDEX "scope_of_works_items_priced_by_sub_item_id_idx"
  ON "scope_of_works_items" ("priced_by_sub_item_id");

-- 2. Create sub_line_quotes table
CREATE TABLE "sub_line_quotes" (
  "id"                         TEXT NOT NULL,
  "scope_item_id"              TEXT NOT NULL,
  "subcontractor_supplier_id"  TEXT,
  "supplier_name_fallback"     TEXT,
  "amount"                     DECIMAL(12,2) NOT NULL,
  "is_selected"                BOOLEAN NOT NULL DEFAULT false,
  "received_at"                TIMESTAMP(3),
  "notes"                      TEXT,
  "tender_document_link_id"    TEXT,
  "created_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                 TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sub_line_quotes_pkey" PRIMARY KEY ("id")
);

-- FK: scope_item_id → scope_of_works_items (cascade on delete)
ALTER TABLE "sub_line_quotes"
  ADD CONSTRAINT "sub_line_quotes_scope_item_id_fkey"
  FOREIGN KEY ("scope_item_id")
  REFERENCES "scope_of_works_items"("id")
  ON DELETE CASCADE;

-- FK: subcontractor_supplier_id → subcontractor_suppliers (set null on delete)
ALTER TABLE "sub_line_quotes"
  ADD CONSTRAINT "sub_line_quotes_subcontractor_supplier_id_fkey"
  FOREIGN KEY ("subcontractor_supplier_id")
  REFERENCES "subcontractor_suppliers"("id")
  ON DELETE SET NULL;

-- FK: tender_document_link_id → tender_document_links (set null on delete)
ALTER TABLE "sub_line_quotes"
  ADD CONSTRAINT "sub_line_quotes_tender_document_link_id_fkey"
  FOREIGN KEY ("tender_document_link_id")
  REFERENCES "tender_document_links"("id")
  ON DELETE SET NULL;

-- Standard index on scope_item_id for efficient listing
CREATE INDEX "sub_line_quotes_scope_item_id_idx"
  ON "sub_line_quotes" ("scope_item_id");

-- Partial unique index: at most one selected quote per SUB line.
-- Prisma cannot express partial unique indexes in schema.prisma; this index
-- is hand-written here and documented in the SubLineQuote model comment so
-- future migrate dev runs do not attempt to recreate it.
CREATE UNIQUE INDEX "uq_sub_line_quotes_selected"
  ON "sub_line_quotes" ("scope_item_id")
  WHERE "is_selected";
