-- Foundation for EACH/FACTOR material behaviours: add explicit `kind` so we
-- do not overload the `unit` string in the scope-of-works calculator.
-- Additive, non-destructive. Backfill is deterministic from the existing
-- `unit` value: kg/m² -> AREA, everything else -> VOLUME (matches the
-- current calc branching on `unit`).

-- CreateEnum
CREATE TYPE "MaterialKind" AS ENUM ('VOLUME', 'AREA', 'EACH', 'FACTOR');

-- AlterTable
ALTER TABLE "estimate_material_density"
  ADD COLUMN "kind" "MaterialKind" NOT NULL DEFAULT 'VOLUME';

-- Backfill: sheet materials priced by area currently carry unit = 'kg/m²'.
UPDATE "estimate_material_density"
SET "kind" = 'AREA'
WHERE "unit" = 'kg/m²';
