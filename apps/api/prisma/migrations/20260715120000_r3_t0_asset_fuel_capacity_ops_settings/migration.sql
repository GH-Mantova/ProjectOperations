-- Waste transport cost engine R3 T-0 (2026-07-15) — first slice of
-- docs/architecture/drafts/waste-transport-cost-engine-DRAFT.md.
--
-- Design confirmed by Marco 2026-07-15:
--   * Fuel consumption is a truck property (fleet varies) — lives on Asset.
--   * Load CAPACITY is per-material — lives in a Transport Capacity
--     reference table under Rates & Lists (isReference = true), keyed by
--     (material class × transport type). This table is authoritative: the
--     SoW line pulls a default from it in T-1; a per-line override stays
--     local to the line and does NOT push back to the table.
--   * Asset.nominalLoadTonnes is a fallback used only when no matrix row
--     matches the asset's transport type × line's material class.
--
-- Fully additive, all columns nullable, one new singleton table plus one
-- new reference rate_table row set. Nothing in existing code reads these
-- yet (T-1 wires cost calculation, T-2 refreshes the fuel price).
-- Idempotent: every row insert is guarded by ON CONFLICT DO NOTHING; the
-- migration is safe to re-run against a DB where the seed already ran.

-- ── 1. Asset per-truck fuel + fallback capacity ─────────────────────
ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "fuel_consumption_l_per_100km" DECIMAL(6, 2),
  ADD COLUMN IF NOT EXISTS "nominal_load_tonnes"          DECIMAL(8, 2);

-- ── 2. AssetCategory defaults (fallback for the fallback) ───────────
ALTER TABLE "asset_categories"
  ADD COLUMN IF NOT EXISTS "default_fuel_consumption_l_per_100km" DECIMAL(6, 2),
  ADD COLUMN IF NOT EXISTS "default_nominal_load_tonnes"          DECIMAL(8, 2);

-- ── 3. OperationsSettings singleton (mirrors email_provider_config) ──
CREATE TABLE IF NOT EXISTS "operations_settings" (
  "id"                    TEXT NOT NULL DEFAULT 'singleton',
  "fuel_price_per_litre"  DECIMAL(6, 3),
  "fuel_price_source"     TEXT,
  "fuel_price_fetched_at" TIMESTAMP(3),
  "travel_rate_per_km"    DECIMAL(6, 2),
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_id"         TEXT,

  CONSTRAINT "operations_settings_pkey"        PRIMARY KEY ("id"),
  CONSTRAINT "operations_settings_updated_by_fk"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- Seed the singleton row so the admin UI's GET always resolves without
-- an implicit create. Nullable columns stay NULL until Marco sets them.
INSERT INTO "operations_settings" ("id", "updated_at")
VALUES ('singleton', NOW())
ON CONFLICT ("id") DO NOTHING;

-- ── 4. Transport Capacity reference matrix (Rates & Lists) ──────────
-- One rate_table row (isReference = true) with three KEY columns
-- (material class, waste form, transport type) and two VALUE columns
-- (capacity tonnes, capacity m³). Starter matrix — Marco/admins will
-- extend it in the Rates & Lists UI. Material classes match the
-- wasteGroup values already used by WasteFacilityRate seeds
-- (Rubble, Soil, Asphalt, Vegetation) plus Mixed / Steel for the
-- common demolition mix. Transport types are the four rigs the
-- Initial Services fleet actually runs (Marco to confirm).
--
-- Not priced — excluded from tender rate-set snapshots by
-- RateResolverService.enumerateRateSet (checks isReference).
DO $$
BEGIN
  INSERT INTO "rate_tables"
    (id, name, slug, description, category, is_system, is_reference, created_at, updated_at)
  VALUES
    ('rt-tc',
     'Transport capacity',
     'transport-capacity',
     'Reference load capacity per (material class × transport type). Authoritative for the Scope-of-Works waste-transport line default; per-line overrides stay local. Not priced — excluded from tender rate-set snapshots.',
     'INITIAL_SERVICES',
     true,
     true,
     NOW(),
     NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns"
    (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at)
  VALUES
    ('rt-tc-c-material',  'rt-tc', 'Material class',   'TEXT',   'KEY',   NULL,     1, NOW(), NOW()),
    ('rt-tc-c-transport', 'rt-tc', 'Transport type',   'TEXT',   'KEY',   NULL,     2, NOW(), NOW()),
    ('rt-tc-c-tonnes',    'rt-tc', 'Capacity (tonnes)', 'NUMBER', 'VALUE', 'tonne',  3, NOW(), NOW()),
    ('rt-tc-c-m3',        'rt-tc', 'Capacity (m³)',    'NUMBER', 'VALUE', 'm³',     4, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  -- Starter matrix: 6 material classes × 4 transport types = 24 rows.
  -- Numbers are typical for a Brisbane demolition fleet; admins tune
  -- in the UI. Do NOT edit these values here — that is what the
  -- Rates & Lists tab is for. Row IDs are stable so re-run is a no-op.
  INSERT INTO "rate_rows"
    (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at)
  VALUES
    -- Rubble (concrete, brick, masonry)
    ('rr-tc-rubble-truck',       'rt-tc', '{"rt-tc-c-material":"Rubble","rt-tc-c-transport":"Truck (rigid)","rt-tc-c-tonnes":8,"rt-tc-c-m3":5}'::jsonb,           true, 1,  NOW(), NOW()),
    ('rr-tc-rubble-truck-dog',   'rt-tc', '{"rt-tc-c-material":"Rubble","rt-tc-c-transport":"Truck & dog","rt-tc-c-tonnes":26,"rt-tc-c-m3":16}'::jsonb,           true, 2,  NOW(), NOW()),
    ('rr-tc-rubble-tandem',      'rt-tc', '{"rt-tc-c-material":"Rubble","rt-tc-c-transport":"Tandem tipper","rt-tc-c-tonnes":10,"rt-tc-c-m3":6}'::jsonb,          true, 3,  NOW(), NOW()),
    ('rr-tc-rubble-semi',        'rt-tc', '{"rt-tc-c-material":"Rubble","rt-tc-c-transport":"Semi tipper","rt-tc-c-tonnes":28,"rt-tc-c-m3":18}'::jsonb,           true, 4,  NOW(), NOW()),

    -- Soil (fill, rock, contaminated)
    ('rr-tc-soil-truck',         'rt-tc', '{"rt-tc-c-material":"Soil","rt-tc-c-transport":"Truck (rigid)","rt-tc-c-tonnes":8,"rt-tc-c-m3":5}'::jsonb,             true, 5,  NOW(), NOW()),
    ('rr-tc-soil-truck-dog',     'rt-tc', '{"rt-tc-c-material":"Soil","rt-tc-c-transport":"Truck & dog","rt-tc-c-tonnes":25,"rt-tc-c-m3":15}'::jsonb,             true, 6,  NOW(), NOW()),
    ('rr-tc-soil-tandem',        'rt-tc', '{"rt-tc-c-material":"Soil","rt-tc-c-transport":"Tandem tipper","rt-tc-c-tonnes":10,"rt-tc-c-m3":6}'::jsonb,            true, 7,  NOW(), NOW()),
    ('rr-tc-soil-semi',          'rt-tc', '{"rt-tc-c-material":"Soil","rt-tc-c-transport":"Semi tipper","rt-tc-c-tonnes":27,"rt-tc-c-m3":17}'::jsonb,             true, 8,  NOW(), NOW()),

    -- Asphalt (clean/dirty)
    ('rr-tc-asphalt-truck',      'rt-tc', '{"rt-tc-c-material":"Asphalt","rt-tc-c-transport":"Truck (rigid)","rt-tc-c-tonnes":9,"rt-tc-c-m3":4.5}'::jsonb,        true, 9,  NOW(), NOW()),
    ('rr-tc-asphalt-truck-dog',  'rt-tc', '{"rt-tc-c-material":"Asphalt","rt-tc-c-transport":"Truck & dog","rt-tc-c-tonnes":28,"rt-tc-c-m3":14}'::jsonb,          true, 10, NOW(), NOW()),
    ('rr-tc-asphalt-tandem',     'rt-tc', '{"rt-tc-c-material":"Asphalt","rt-tc-c-transport":"Tandem tipper","rt-tc-c-tonnes":11,"rt-tc-c-m3":5.5}'::jsonb,       true, 11, NOW(), NOW()),
    ('rr-tc-asphalt-semi',       'rt-tc', '{"rt-tc-c-material":"Asphalt","rt-tc-c-transport":"Semi tipper","rt-tc-c-tonnes":30,"rt-tc-c-m3":15}'::jsonb,          true, 12, NOW(), NOW()),

    -- Vegetation (green waste, timber)
    ('rr-tc-veg-truck',          'rt-tc', '{"rt-tc-c-material":"Vegetation","rt-tc-c-transport":"Truck (rigid)","rt-tc-c-tonnes":3,"rt-tc-c-m3":6}'::jsonb,        true, 13, NOW(), NOW()),
    ('rr-tc-veg-truck-dog',      'rt-tc', '{"rt-tc-c-material":"Vegetation","rt-tc-c-transport":"Truck & dog","rt-tc-c-tonnes":9,"rt-tc-c-m3":18}'::jsonb,         true, 14, NOW(), NOW()),
    ('rr-tc-veg-tandem',         'rt-tc', '{"rt-tc-c-material":"Vegetation","rt-tc-c-transport":"Tandem tipper","rt-tc-c-tonnes":4,"rt-tc-c-m3":8}'::jsonb,        true, 15, NOW(), NOW()),
    ('rr-tc-veg-semi',           'rt-tc', '{"rt-tc-c-material":"Vegetation","rt-tc-c-transport":"Semi tipper","rt-tc-c-tonnes":10,"rt-tc-c-m3":20}'::jsonb,        true, 16, NOW(), NOW()),

    -- Mixed demolition
    ('rr-tc-mixed-truck',        'rt-tc', '{"rt-tc-c-material":"Mixed demolition","rt-tc-c-transport":"Truck (rigid)","rt-tc-c-tonnes":6,"rt-tc-c-m3":5}'::jsonb,  true, 17, NOW(), NOW()),
    ('rr-tc-mixed-truck-dog',    'rt-tc', '{"rt-tc-c-material":"Mixed demolition","rt-tc-c-transport":"Truck & dog","rt-tc-c-tonnes":20,"rt-tc-c-m3":16}'::jsonb,  true, 18, NOW(), NOW()),
    ('rr-tc-mixed-tandem',       'rt-tc', '{"rt-tc-c-material":"Mixed demolition","rt-tc-c-transport":"Tandem tipper","rt-tc-c-tonnes":8,"rt-tc-c-m3":6}'::jsonb,  true, 19, NOW(), NOW()),
    ('rr-tc-mixed-semi',         'rt-tc', '{"rt-tc-c-material":"Mixed demolition","rt-tc-c-transport":"Semi tipper","rt-tc-c-tonnes":22,"rt-tc-c-m3":18}'::jsonb,  true, 20, NOW(), NOW()),

    -- Steel / metal recovery
    ('rr-tc-steel-truck',        'rt-tc', '{"rt-tc-c-material":"Steel","rt-tc-c-transport":"Truck (rigid)","rt-tc-c-tonnes":10,"rt-tc-c-m3":4}'::jsonb,           true, 21, NOW(), NOW()),
    ('rr-tc-steel-truck-dog',    'rt-tc', '{"rt-tc-c-material":"Steel","rt-tc-c-transport":"Truck & dog","rt-tc-c-tonnes":30,"rt-tc-c-m3":12}'::jsonb,            true, 22, NOW(), NOW()),
    ('rr-tc-steel-tandem',       'rt-tc', '{"rt-tc-c-material":"Steel","rt-tc-c-transport":"Tandem tipper","rt-tc-c-tonnes":12,"rt-tc-c-m3":5}'::jsonb,           true, 23, NOW(), NOW()),
    ('rr-tc-steel-semi',         'rt-tc', '{"rt-tc-c-material":"Steel","rt-tc-c-transport":"Semi tipper","rt-tc-c-tonnes":32,"rt-tc-c-m3":13}'::jsonb,            true, 24, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;
