-- CUTTING_ONE_TOTAL_V1 (scopecards-s7) - migration 1 of 3
-- Add nullable line_total column to estimate_cutting_lines.
-- DDL only - data stays in migration 2.

ALTER TABLE "estimate_cutting_lines"
ADD COLUMN "line_total" DECIMAL(12,2);
