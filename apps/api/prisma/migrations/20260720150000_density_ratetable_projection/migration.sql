-- Migration: density_ratetable_projection
-- Copies every EstimateMaterialDensity row into the RateTable / RateColumn / RateRow
-- flexible model as a reference table (isReference = true, isSystem = true).
-- The legacy EstimateMaterialDensity table is LEFT INTACT — this PR is
-- deprecate-in-place only. Dropping is a separate follow-up so this PR
-- remains fully reversible.
--
-- Stable IDs:
--   RateTable  : rt-density
--   RateColumn : rt-density-c-material (KEY), rt-density-c-density (VALUE), rt-density-c-unit (INFO)
--   RateRow    : rr-density-<cuid of source row>  (carries the source id as the suffix)
--
-- Idempotent: all INSERTs use ON CONFLICT DO UPDATE so re-applying is safe.

-- 1. Upsert the reference table.
INSERT INTO rate_tables (id, name, slug, description, category, is_system, is_reference, created_at, updated_at)
VALUES (
  'rt-density',
  'Material densities',
  'material-density',
  'Reference density values (kg/m3 or kg/m2) for bulk / sheet materials. Projection of EstimateMaterialDensity.',
  'INITIAL_SERVICES',
  true,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system   = EXCLUDED.is_system,
  is_reference= EXCLUDED.is_reference,
  updated_at  = NOW();

-- 2. Upsert columns.
INSERT INTO rate_columns (id, rate_table_id, name, data_type, role, unit, sort_order)
VALUES
  ('rt-density-c-material', 'rt-density', 'Material',  'TEXT',   'KEY',   NULL,   1),
  ('rt-density-c-density',  'rt-density', 'Density',   'NUMBER', 'VALUE', NULL,   2),
  ('rt-density-c-unit',     'rt-density', 'Unit',      'TEXT',   'INFO',  NULL,   3),
  ('rt-density-c-kind',     'rt-density', 'Kind',      'TEXT',   'INFO',  NULL,   4),
  ('rt-density-c-category', 'rt-density', 'Category',  'TEXT',   'INFO',  NULL,   5)
ON CONFLICT (rate_table_id, name) DO UPDATE SET
  data_type  = EXCLUDED.data_type,
  role       = EXCLUDED.role,
  sort_order = EXCLUDED.sort_order;

-- 3. Copy rows from estimate_material_density, deriving a stable row ID.
--    Cells are stored as JSON keyed by column ID (matching the seed pattern).
INSERT INTO rate_rows (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at)
SELECT
  'rr-density-' || d.id AS id,
  'rt-density'           AS rate_table_id,
  jsonb_build_object(
    'rt-density-c-material', d.material_name,
    'rt-density-c-density',  d.density::float8,
    'rt-density-c-unit',     d.unit,
    'rt-density-c-kind',     d.kind::text,
    'rt-density-c-category', COALESCE(d.category, '')
  )                      AS cells,
  d.is_active            AS is_active,
  d.sort_order           AS sort_order,
  NOW()                  AS created_at,
  NOW()                  AS updated_at
FROM estimate_material_density d
ON CONFLICT (id) DO UPDATE SET
  cells      = EXCLUDED.cells,
  is_active  = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();
