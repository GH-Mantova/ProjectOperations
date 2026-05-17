-- PR B4a — Scope item dimensions + waste subtable m³ column.
--
-- Adds 7 dimension fields to scope_of_works_items (length, height, depth,
-- density, tonnes, charge_by, cutting_included) plus 1 column on
-- scope_waste_items (m3). Pure additive — existing rows keep their
-- current values; new fields default to NULL (or FALSE for the
-- cutting_included boolean). Legacy fields (scope_of_works_items.unit,
-- scope_of_works_items.value, scope_of_works_items.waste_m3) are kept
-- but deprecated; cleanup PR drops them once we've confirmed nothing
-- depends on them.

-- ── scope_of_works_items ────────────────────────────────────────────
ALTER TABLE "scope_of_works_items" ADD COLUMN IF NOT EXISTS "length"          DECIMAL(10, 3);
ALTER TABLE "scope_of_works_items" ADD COLUMN IF NOT EXISTS "height"          DECIMAL(10, 3);
ALTER TABLE "scope_of_works_items" ADD COLUMN IF NOT EXISTS "depth"           DECIMAL(10, 3);
ALTER TABLE "scope_of_works_items" ADD COLUMN IF NOT EXISTS "density"         DECIMAL(5, 3);
ALTER TABLE "scope_of_works_items" ADD COLUMN IF NOT EXISTS "tonnes"          DECIMAL(10, 2);
ALTER TABLE "scope_of_works_items" ADD COLUMN IF NOT EXISTS "charge_by"       TEXT;
ALTER TABLE "scope_of_works_items" ADD COLUMN IF NOT EXISTS "cutting_included" BOOLEAN NOT NULL DEFAULT FALSE;

-- ── scope_waste_items ───────────────────────────────────────────────
ALTER TABLE "scope_waste_items" ADD COLUMN IF NOT EXISTS "m3" DECIMAL(10, 2);
