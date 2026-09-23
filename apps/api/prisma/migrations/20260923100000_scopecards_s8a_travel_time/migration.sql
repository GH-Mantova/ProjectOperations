-- scopecards-s8a (TRAVEL_TIME_PORT_V1)
-- Additive-only migration. All new columns are nullable with no defaults,
-- so existing rows are byte-identical to their pre-migration state and no
-- backfill is needed.

-- 1. ScopeWasteItem: point at a tip + travel snapshot
ALTER TABLE "scope_waste_items"
  ADD COLUMN "map_location_id"        TEXT,
  ADD COLUMN "travel_km"              DECIMAL(8,2),
  ADD COLUMN "travel_minutes_one_way" INTEGER,
  ADD COLUMN "travel_source"          TEXT,
  ADD COLUMN "travel_detail"          TEXT,
  ADD COLUMN "travel_resolved_at"     TIMESTAMP(3);

-- FK + index for the tip link
ALTER TABLE "scope_waste_items"
  ADD CONSTRAINT "scope_waste_items_map_location_id_fkey"
  FOREIGN KEY ("map_location_id") REFERENCES "map_locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "scope_waste_items_map_location_id_idx"
  ON "scope_waste_items"("map_location_id");

-- 2. OperationsSettings: three new cycle-computation settings (all nullable)
ALTER TABLE "operations_settings"
  ADD COLUMN "road_distance_factor"  DECIMAL(4,2),
  ADD COLUMN "avg_truck_speed_kmh"   INTEGER,
  ADD COLUMN "tip_turnaround_minutes" INTEGER;
