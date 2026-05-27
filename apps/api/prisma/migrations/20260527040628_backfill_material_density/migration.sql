-- Backfill: where a scope_of_works_item already has material_type matching
-- a known material, stamp the item's density from inline values.
-- kg/m³ densities are divided by 1000 → t/m³ (the unit the scope item
-- density field stores). kg/m² densities are stored as-is.
-- Only updates rows where density IS NULL to avoid overwriting manual entries.
-- Values are inlined rather than joined from estimate_material_density
-- because the lookup table is empty at migration time (seed runs later).

UPDATE "scope_of_works_items"
SET "density" = v."density_val"
FROM (VALUES
  ('Concrete',             2.400),
  ('Reinforced concrete',  2.500),
  ('Brick',                1.900),
  ('Block (concrete)',      2.100),
  ('Asphalt',              2.300),
  ('Soil (dry)',            1.500),
  ('Soil (wet)',            1.900),
  ('Sand',                 1.600),
  ('Steel',                7.850),
  ('Timber (softwood)',     0.600),
  ('Plasterboard',         0.850),
  ('Carpet',               2.000),
  ('Glass',                2.500)
) AS v("material_name", "density_val")
WHERE "scope_of_works_items"."material_type" = v."material_name"
  AND "scope_of_works_items"."density" IS NULL;
