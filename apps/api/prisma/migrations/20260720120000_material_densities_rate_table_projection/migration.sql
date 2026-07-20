-- Material densities: EstimateMaterialDensity → RateTable projection.
--
-- Adds a RateTable/RateColumn/RateRow projection of the existing
-- `estimate_material_density` rows so densities are visible via the
-- flexible Rates surface, and callers can resolve density through
-- `RateResolverService`. Flagged `isReference` so
-- `RateResolverService.enumerateRateSet()` skips it — densities are
-- factors, not priced overrides, and must not appear in a locked
-- tender rate-set snapshot.
--
-- Legacy `estimate_material_density` is retained for THIS PR
-- (deprecate-in-place) — writes still land there and the read seam
-- returns byte-identical values so quoted numbers do not move.
-- Dropping the legacy model is a separate follow-up.
--
-- Idempotent: uses ON CONFLICT DO NOTHING keyed on stable slug / id.

-- 1. RateTable header
INSERT INTO "rate_tables" (
  "id", "name", "slug", "description", "category",
  "is_system", "is_reference", "created_at", "updated_at"
) VALUES (
  'rt-md',
  'Material densities',
  'material-densities',
  'Density lookup by material name (projection of EstimateMaterialDensity). Reference — not priced.',
  'INITIAL_SERVICES',
  TRUE,
  TRUE,
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;

-- 2. Columns (stable IDs so RateRow.cells keyed by column id survive re-seeds)
INSERT INTO "rate_columns" (
  "id", "rate_table_id", "name", "data_type", "role",
  "unit", "required", "sort_order", "created_at", "updated_at"
) VALUES
  ('rt-md-c-material', 'rt-md', 'Material', 'TEXT',   'KEY',   NULL,     FALSE, 1, NOW(), NOW()),
  ('rt-md-c-density',  'rt-md', 'Density',  'NUMBER', 'VALUE', 'kg/m³', FALSE, 2, NOW(), NOW()),
  ('rt-md-c-unit',     'rt-md', 'Unit',     'TEXT',   'INFO',  NULL,     FALSE, 3, NOW(), NOW()),
  ('rt-md-c-kind',     'rt-md', 'Kind',     'TEXT',   'INFO',  NULL,     FALSE, 4, NOW(), NOW()),
  ('rt-md-c-category', 'rt-md', 'Category', 'TEXT',   'INFO',  NULL,     FALSE, 5, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- 3. Rows — one per estimate_material_density row.
-- Row id derived from material name (mirrors seed's rowSlug) so re-runs
-- are no-ops and future overrides survive. Density is stored as a
-- JSON number (float8) matching what `Number(cells[colId])` returns
-- in `RateResolverService`, so resolver output is byte-identical to
-- the legacy Decimal → Number conversion.
INSERT INTO "rate_rows" (
  "id", "rate_table_id", "cells", "is_active", "sort_order",
  "created_at", "updated_at"
)
SELECT
  'rr-md-' || regexp_replace(
    regexp_replace(lower("material_name"), '[^a-z0-9]+', '-', 'g'),
    '(^-+|-+$)', '', 'g'
  ),
  'rt-md',
  jsonb_build_object(
    'rt-md-c-material', "material_name",
    'rt-md-c-density',  "density"::float8,
    'rt-md-c-unit',     "unit",
    'rt-md-c-kind',     "kind"::text,
    'rt-md-c-category', COALESCE("category", '')
  ),
  "is_active",
  COALESCE("sort_order", 0),
  NOW(),
  NOW()
FROM "estimate_material_density"
ON CONFLICT ("id") DO NOTHING;
