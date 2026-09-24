-- scopecards-s8g (GEOAPIFY_ROUTE_TRAVEL_V1)
-- Additive-only migration. All new columns are nullable with no defaults.
-- No backfill. No NOT NULL. Rollback = drop the columns; existing rows are
-- unchanged.

-- 1. ScopeWasteItem: traffic index, planning minutes, total trip km, provenance
ALTER TABLE "scope_waste_items"
  ADD COLUMN "travel_index"                    DECIMAL(4,2),
  ADD COLUMN "travel_index_source"             TEXT,
  ADD COLUMN "travel_planning_minutes_one_way" INTEGER,
  ADD COLUMN "total_trip_km"                   DECIMAL(10,2),
  ADD COLUMN "loads_source"                    TEXT,
  ADD COLUMN "daily_km_source"                 TEXT;

-- 2. OperationsSettings: vehicle mode for the routing provider
ALTER TABLE "operations_settings"
  ADD COLUMN "route_vehicle_mode" TEXT;
