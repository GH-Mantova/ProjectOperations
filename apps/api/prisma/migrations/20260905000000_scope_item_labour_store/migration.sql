-- CARD-API SLICE 1 (SCOPE_ITEM_LABOUR_STORE_V1) — per-item labour store
-- and item-level markup override on ScopeOfWorksItem.
--
-- ADDITIVE ONLY. Two NULLABLE columns on one existing table
-- ("scope_of_works_items") and nothing else. No column is dropped,
-- renamed or retyped; no NOT NULL is added; no DEFAULT is applied; no
-- existing row is read or rewritten. There is no data migration and no
-- backfill — `men`, `days` and `shift` keep their meaning and their
-- values, and the pricing fallback (labourItems NULL/[] → scalars) is
-- what makes a backfill unnecessary. Every row that exists before this
-- migration reads both columns NULL afterwards and prices to exactly
-- the same number it did before.
--
-- Rollback: DROP the two columns. Reverting the code alone leaves two
-- unused nullable columns behind, which is inert.
--
-- Safe to leave applied if the run dies mid-flight: each statement is
-- IF NOT EXISTS and neither changes the meaning of any existing row.

-- 1. labour_items — one JSON entry per rendered labour row:
--      [{ rowIdx, labourTypeId, role, shift, qty, days, dayRateOverride }]
--    Same shape and name pattern as the existing "plant_items" column.
ALTER TABLE "scope_of_works_items" ADD COLUMN IF NOT EXISTS "labour_items" JSONB;

-- 2. markup_override — item-level markup %. Null = inherit the card's
--    markup_override, which in turn falls back to TenderEstimate.markup.
--    Same precision as the existing "scope_cards"."markup_override".
ALTER TABLE "scope_of_works_items" ADD COLUMN IF NOT EXISTS "markup_override" DECIMAL(5, 2);
