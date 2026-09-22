-- CUTTING_ONE_TOTAL_V1 (scopecards-s7) - migration 2 of 3
-- Backfill line_total = ROUND(qty * rate, 2) for existing rows.
-- Multiplies the rate each row already stores - no figure re-resolved.

UPDATE "estimate_cutting_lines"
SET "line_total" = ROUND("qty" * "rate", 2)
WHERE "line_total" IS NULL;
