-- Backfill: where a scope_of_works_item already has material_type matching
-- a density lookup row, stamp the item's density from the lookup table.
-- Uses kg/m³ densities divided by 1000 → t/m³ (the unit the scope item stores).
-- Only updates rows where density IS NULL to avoid overwriting manual entries.

UPDATE "scope_of_works_items" AS i
SET "density" = ROUND(d."density" / 1000, 3)
FROM "estimate_material_density" AS d
WHERE i."material_type" = d."material_name"
  AND i."density" IS NULL
  AND d."is_active" = true;
