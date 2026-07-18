-- PR feat/scope-each-factor: additive, nullable columns on scope_of_works_items.
-- materialKind stores the material's kind label (VOLUME/AREA/EACH/FACTOR) for
-- the row-1 material so the calc can branch without joining EstimateMaterialDensity.
-- quantity holds the item count for EACH kind (tonnes = qty × perItemWeightKg/1000).
-- factor holds the user multiplier for FACTOR kind (tonnes = sqm × factor).
-- All nullable; existing rows keep NULL and continue using VOLUME behaviour.

ALTER TABLE "scope_of_works_items"
  ADD COLUMN IF NOT EXISTS "material_kind" TEXT,
  ADD COLUMN IF NOT EXISTS "quantity"      DECIMAL(12, 3),
  ADD COLUMN IF NOT EXISTS "factor"        DECIMAL(12, 6);
