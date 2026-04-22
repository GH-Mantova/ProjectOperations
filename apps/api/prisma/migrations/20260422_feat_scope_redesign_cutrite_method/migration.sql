-- Cutrite rates overhaul — adds the method column to cutting_sheet_items so
-- rate lookups can apply the ×1.25 multiplier for High-Freq / Low-emission
-- work. All rate data itself is reseeded at the application layer (no
-- schema changes to the rate tables).

ALTER TABLE "cutting_sheet_items" ADD COLUMN "method" TEXT;
