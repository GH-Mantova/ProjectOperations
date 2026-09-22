-- CUTTING_ONE_TOTAL_V1 (scopecards-s7) - migration 3 of 3
-- Set line_total NOT NULL now that all rows are backfilled.

ALTER TABLE "estimate_cutting_lines"
ALTER COLUMN "line_total" SET NOT NULL;
