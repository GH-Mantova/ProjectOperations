-- Replace simple cutting-rate table with Cutrite-shaped rate matrix.
DROP TABLE IF EXISTS "estimate_cutting_rates";
CREATE TABLE "estimate_cutting_rates" (
  "id" TEXT NOT NULL,
  "equipment" TEXT NOT NULL,
  "elevation" TEXT NOT NULL,
  "material" TEXT NOT NULL,
  "depth_mm" INTEGER NOT NULL,
  "rate_per_m" DECIMAL(10,4) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estimate_cutting_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estimate_cutting_rates_equipment_elevation_material_depth_mm_key"
  ON "estimate_cutting_rates"("equipment", "elevation", "material", "depth_mm");

-- New: core hole rates
CREATE TABLE "estimate_core_hole_rates" (
  "id" TEXT NOT NULL,
  "diameter_mm" INTEGER NOT NULL,
  "rate_per_hole" DECIMAL(10,4) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "estimate_core_hole_rates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estimate_core_hole_rates_diameter_mm_key"
  ON "estimate_core_hole_rates"("diameter_mm");

-- Cutting line: add optional Cutrite + core-hole metadata columns.
ALTER TABLE "estimate_cutting_lines" ADD COLUMN "equipment" TEXT;
ALTER TABLE "estimate_cutting_lines" ADD COLUMN "elevation" TEXT;
ALTER TABLE "estimate_cutting_lines" ADD COLUMN "material" TEXT;
ALTER TABLE "estimate_cutting_lines" ADD COLUMN "depth_mm" INTEGER;
ALTER TABLE "estimate_cutting_lines" ADD COLUMN "diameter_mm" INTEGER;
-- Widen rate precision for four-decimal rates.
ALTER TABLE "estimate_cutting_lines" ALTER COLUMN "rate" TYPE DECIMAL(10,4);

-- Waste rates: add waste_group + unit (default "tonne" preserves existing semantics).
ALTER TABLE "estimate_waste_rates" ADD COLUMN "waste_group" TEXT;
ALTER TABLE "estimate_waste_rates" ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'tonne';
