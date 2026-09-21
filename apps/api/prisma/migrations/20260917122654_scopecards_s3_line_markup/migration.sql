-- SCOPE_LINE_MARKUP_ALL_TYPES_V1 (scopecards-s3)
-- Per-line markup override for waste and cutting lines.
-- Additive migration: two nullable columns added, no defaults, no UPDATE.

ALTER TABLE "scope_waste_items" ADD COLUMN "markup_override" DECIMAL(5,2);
ALTER TABLE "cutting_sheet_items" ADD COLUMN "markup_override" DECIMAL(5,2);
