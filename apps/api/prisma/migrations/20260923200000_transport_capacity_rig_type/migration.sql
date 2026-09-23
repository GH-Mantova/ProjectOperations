-- scopecards-s9 (TRANSPORT_CAPACITY_MATRIX_V1)
-- Additive-only migration. All new columns are nullable with no defaults or
-- backfill, so existing rows are byte-identical to their pre-migration state.

-- 1. EstimatePlantRate: record which matrix transport type this rig is.
--    Blank = "no matrix default" -- the estimator must type a capacity manually.
ALTER TABLE "estimate_plant_rates"
  ADD COLUMN "transport_type" TEXT;

-- 2. ScopeWasteItem: record where the stored capacity came from.
--    "matrix" = resolved from the transport-capacity reference table.
--    "manual" = typed by the estimator (overrides the matrix).
--    NULL = row predates this column (unknown provenance).
ALTER TABLE "scope_waste_items"
  ADD COLUMN "capacity_source" TEXT;
