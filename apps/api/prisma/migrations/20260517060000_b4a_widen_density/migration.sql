-- PR B4a.6 — widen density column from Decimal(5,3) to Decimal(8,3) so
-- users can enter kg/m³ values (concrete ~2400) without a numeric
-- overflow crash. Pure ALTER, no data loss (widening only).

ALTER TABLE "scope_of_works_items"
  ALTER COLUMN "density" TYPE DECIMAL(8, 3);
