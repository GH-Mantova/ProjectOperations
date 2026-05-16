-- PR A2.5 (2026-05-16) — Drop ScopeOfWorksItem.discipline column.
-- card.discipline is now authoritative; all service reads have been
-- migrated to read via the card relation.
--
-- Idempotent: re-running is safe (uses IF EXISTS / IF NOT EXISTS).

-- 1. Drop the composite index that references the column
DROP INDEX IF EXISTS scope_of_works_items_tender_id_discipline_item_number_idx;

-- 2. Add the replacement index (without discipline)
CREATE INDEX IF NOT EXISTS scope_of_works_items_tender_id_item_number_idx
  ON scope_of_works_items(tender_id, item_number);

-- 3. Drop the column
ALTER TABLE scope_of_works_items DROP COLUMN IF EXISTS discipline;
