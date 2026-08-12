-- SLICE 11a — enclosure / other-rates / material-densities into RateTable
--
-- Context: the RateTable projections for enclosure (rt-en), other-rates (rt-or),
-- and material-densities (rt-md) were all seeded by earlier seed scripts and
-- migrations, but the seed script (not a migration) seeded other-rates and some
-- tests run with a clean DB will miss that data. This migration ensures all three
-- tables exist in prod via migration (not just seed) so deploy.yml
-- `prisma migrate deploy` establishes them correctly (CP-23 compliance).
--
-- Enclosure (rt-en) already covered by 20260713140000_seed_baseline_rate_tables.
-- Material-densities (rt-md) already covered by 20260720120000_material_densities_rate_table_projection.
-- Other-rates (rt-or) was ONLY seeded via seed-initial-services.ts — this migration
-- adds the missing migration path (CP-23: no seed-without-migration).
--
-- Idempotent:
--   * rate_tables  keyed on slug (UNIQUE) — ON CONFLICT DO NOTHING
--   * rate_columns keyed on (rate_table_id, name) — ON CONFLICT DO NOTHING
--   * rate_rows    keyed on id (PK) — ON CONFLICT DO NOTHING
-- Rerunning is a no-op. Admin edits are never overwritten.
--
-- Does NOT drop anything (11b/11c handle removal).
-- Does NOT change any rate value — faithful copy only from CuttingOtherRate seed.
--
-- Reverse (run manually if rolling back):
--   DELETE FROM "rate_rows"    WHERE rate_table_id = 'rt-or';
--   DELETE FROM "rate_columns" WHERE rate_table_id = 'rt-or';
--   DELETE FROM "rate_tables"  WHERE id = 'rt-or';

DO $$
BEGIN

  -- ── enclosure (idempotent guard — already covered by 20260713) ──────────
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-en', 'Enclosure rates', 'enclosure',
     'Asbestos enclosure / air monitoring rates (projection of EstimateEnclosureRate).',
     'INITIAL_SERVICES', true, false, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-en-c-type', 'rt-en', 'Enclosure type', 'TEXT',     'KEY',   NULL, 1, NOW(), NOW()),
    ('rt-en-c-unit', 'rt-en', 'Unit',           'TEXT',     'INFO',  NULL, 2, NOW(), NOW()),
    ('rt-en-c-rate', 'rt-en', 'Rate',           'CURRENCY', 'VALUE', NULL, 3, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-en-acm-enclosure-class-a-friable',    'rt-en', '{"rt-en-c-type":"ACM enclosure (Class A, friable)","rt-en-c-unit":"m²","rt-en-c-rate":185}'::jsonb,  true, 1, NOW(), NOW()),
    ('rr-en-acm-enclosure-class-b-non-friable','rt-en', '{"rt-en-c-type":"ACM enclosure (Class B, non-friable)","rt-en-c-unit":"m²","rt-en-c-rate":95}'::jsonb,   true, 2, NOW(), NOW()),
    ('rr-en-air-monitoring',                   'rt-en', '{"rt-en-c-type":"Air monitoring","rt-en-c-unit":"day","rt-en-c-rate":540}'::jsonb,                            true, 3, NOW(), NOW()),
    ('rr-en-clearance-certificate',            'rt-en', '{"rt-en-c-type":"Clearance certificate","rt-en-c-unit":"ea","rt-en-c-rate":850}'::jsonb,                      true, 4, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── material-densities (idempotent guard — already covered by 20260720) ─
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-md', 'Material densities', 'material-densities',
     'Density lookup by material name (projection of EstimateMaterialDensity). Reference — not priced.',
     'INITIAL_SERVICES', true, true, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, required, sort_order, created_at, updated_at) VALUES
    ('rt-md-c-material', 'rt-md', 'Material', 'TEXT',   'KEY',   NULL,     FALSE, 1, NOW(), NOW()),
    ('rt-md-c-density',  'rt-md', 'Density',  'NUMBER', 'VALUE', 'kg/m³', FALSE, 2, NOW(), NOW()),
    ('rt-md-c-unit',     'rt-md', 'Unit',     'TEXT',   'INFO',  NULL,     FALSE, 3, NOW(), NOW()),
    ('rt-md-c-kind',     'rt-md', 'Kind',     'TEXT',   'INFO',  NULL,     FALSE, 4, NOW(), NOW()),
    ('rt-md-c-category', 'rt-md', 'Category', 'TEXT',   'INFO',  NULL,     FALSE, 5, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  -- Density rows are seeded dynamically from estimate_material_density in 20260720.
  -- New rows added via admin UI write to both tables (deprecate-in-place).
  -- The dynamic INSERT ... SELECT from 20260720 is idempotent (ON CONFLICT DO NOTHING)
  -- so we re-run it here to ensure any densities added after 20260720 are projected.
  INSERT INTO "rate_rows" (
    "id", "rate_table_id", "cells", "is_active", "sort_order", "created_at", "updated_at"
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

  -- ── other-rates (CP-23 migration path — was seed-only before SLICE 11a) ─
  -- Flat-rate cutting-sheet catalogue: establishment fees, wet-vac hire,
  -- stand-down time, etc. Priced (isReference=false) — included in tender snapshots.
  -- ID rt-or / columns rt-or-c-* / rows rr-or-* match what seed-initial-services.ts
  -- creates so re-seeding after this migration is idempotent.
  -- Values are byte-faithful to seed-initial-services.ts:otherRates (Cutrite 01/04/2026).
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-or', 'Other rates', 'other-rates',
     'Cutting-sheet flat-rate catalogue (projection of CuttingOtherRate). Priced — included in tender rate-set snapshots.',
     'INITIAL_SERVICES', true, false, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-or-c-desc', 'rt-or', 'Description', 'TEXT',     'KEY',   NULL, 1, NOW(), NOW()),
    ('rt-or-c-unit', 'rt-or', 'Unit',        'TEXT',     'INFO',  NULL, 2, NOW(), NOW()),
    ('rt-or-c-rate', 'rt-or', 'Rate',        'CURRENCY', 'VALUE', NULL, 3, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-or-establishment-fee-bne-up-to-80km',          'rt-or', '{"rt-or-c-desc":"Establishment fee (BNE up to 80km)","rt-or-c-unit":"per visit","rt-or-c-rate":120}'::jsonb,       true,  1, NOW(), NOW()),
    ('rr-or-establishment-fee-toowoomba-sunshine-coast', 'rt-or', '{"rt-or-c-desc":"Establishment fee (Toowoomba/Sunshine Coast)","rt-or-c-unit":"per visit","rt-or-c-rate":680}'::jsonb, true,  2, NOW(), NOW()),
    ('rr-or-wet-vacuum',                                 'rt-or', '{"rt-or-c-desc":"Wet vacuum","rt-or-c-unit":"p/day","rt-or-c-rate":65}'::jsonb,                                     true,  3, NOW(), NOW()),
    ('rr-or-hepa-vac',                                   'rt-or', '{"rt-or-c-desc":"HEPA vac","rt-or-c-unit":"p/day","rt-or-c-rate":100}'::jsonb,                                      true,  4, NOW(), NOW()),
    ('rr-or-extra-man',                                  'rt-or', '{"rt-or-c-desc":"Extra man","rt-or-c-unit":"p/hr","rt-or-c-rate":135}'::jsonb,                                      true,  5, NOW(), NOW()),
    ('rr-or-stand-down-time',                            'rt-or', '{"rt-or-c-desc":"Stand-down time","rt-or-c-unit":"p/hr","rt-or-c-rate":125}'::jsonb,                               true,  6, NOW(), NOW()),
    ('rr-or-clean-up-time',                              'rt-or', '{"rt-or-c-desc":"Clean-up time","rt-or-c-unit":"p/hr/man","rt-or-c-rate":135}'::jsonb,                             true,  7, NOW(), NOW()),
    ('rr-or-set-out-time',                               'rt-or', '{"rt-or-c-desc":"Set-out time","rt-or-c-unit":"p/hr/man","rt-or-c-rate":135}'::jsonb,                              true,  8, NOW(), NOW()),
    ('rr-or-relocation',                                 'rt-or', '{"rt-or-c-desc":"Relocation","rt-or-c-unit":"each","rt-or-c-rate":45}'::jsonb,                                     true,  9, NOW(), NOW()),
    ('rr-or-gpr-concrete-scanning',                      'rt-or', '{"rt-or-c-desc":"GPR Concrete scanning","rt-or-c-unit":"p/hr (min 2hrs)","rt-or-c-rate":225}'::jsonb,              true, 10, NOW(), NOW()),
    ('rr-or-gpr-concrete-scan-report',                   'rt-or', '{"rt-or-c-desc":"GPR Concrete scan report","rt-or-c-unit":"each","rt-or-c-rate":120}'::jsonb,                      true, 11, NOW(), NOW()),
    ('rr-or-minimum-weekday-charge',                     'rt-or', '{"rt-or-c-desc":"Minimum weekday charge","rt-or-c-unit":"per visit","rt-or-c-rate":360}'::jsonb,                   true, 12, NOW(), NOW()),
    ('rr-or-minimum-night-charge',                       'rt-or', '{"rt-or-c-desc":"Minimum night charge","rt-or-c-unit":"per visit","rt-or-c-rate":1900}'::jsonb,                    true, 13, NOW(), NOW()),
    ('rr-or-stand-down-night',                           'rt-or', '{"rt-or-c-desc":"Stand-down night","rt-or-c-unit":"per visit","rt-or-c-rate":990}'::jsonb,                         true, 14, NOW(), NOW()),
    ('rr-or-minimum-saturday-charge',                    'rt-or', '{"rt-or-c-desc":"Minimum Saturday charge","rt-or-c-unit":"per visit","rt-or-c-rate":1200}'::jsonb,                 true, 15, NOW(), NOW()),
    ('rr-or-minimum-sunday-charge',                      'rt-or', '{"rt-or-c-desc":"Minimum Sunday charge","rt-or-c-unit":"per visit","rt-or-c-rate":1900}'::jsonb,                   true, 16, NOW(), NOW()),
    ('rr-or-mini-mobile-scaffold',                       'rt-or', '{"rt-or-c-desc":"Mini mobile scaffold","rt-or-c-unit":"per visit","rt-or-c-rate":170}'::jsonb,                     true, 17, NOW(), NOW()),
    ('rr-or-jack-hammer-hire',                           'rt-or', '{"rt-or-c-desc":"Jack hammer hire","rt-or-c-unit":"per visit","rt-or-c-rate":90}'::jsonb,                          true, 18, NOW(), NOW()),
    ('rr-or-jack-hammer-labour',                         'rt-or', '{"rt-or-c-desc":"Jack hammer labour","rt-or-c-unit":"p/hr","rt-or-c-rate":150}'::jsonb,                            true, 19, NOW(), NOW()),
    ('rr-or-grinding-scabbling',                         'rt-or', '{"rt-or-c-desc":"Grinding/scabbling","rt-or-c-unit":"p/hr","rt-or-c-rate":165}'::jsonb,                            true, 20, NOW(), NOW()),
    ('rr-or-3-phase-grinding-scabbling',                 'rt-or', '{"rt-or-c-desc":"3-phase grinding/scabbling","rt-or-c-unit":"p/hr","rt-or-c-rate":260}'::jsonb,                   true, 21, NOW(), NOW()),
    ('rr-or-generator-8kva',                             'rt-or', '{"rt-or-c-desc":"Generator 8KVA","rt-or-c-unit":"p/day","rt-or-c-rate":110}'::jsonb,                              true, 22, NOW(), NOW()),
    ('rr-or-generator-12-5kva',                          'rt-or', '{"rt-or-c-desc":"Generator 12.5KVA","rt-or-c-unit":"p/day","rt-or-c-rate":125}'::jsonb,                           true, 23, NOW(), NOW()),
    ('rr-or-water-tank',                                 'rt-or', '{"rt-or-c-desc":"Water tank","rt-or-c-unit":"per visit","rt-or-c-rate":120}'::jsonb,                               true, 24, NOW(), NOW()),
    ('rr-or-water-recycling-slurry-truck',               'rt-or', '{"rt-or-c-desc":"Water/recycling slurry truck","rt-or-c-unit":"p/day + disposal","rt-or-c-rate":160}'::jsonb,      true, 25, NOW(), NOW()),
    ('rr-or-water-recycling-slurry-icb',                 'rt-or', '{"rt-or-c-desc":"Water/recycling slurry ICB","rt-or-c-unit":"p/day + disposal","rt-or-c-rate":85}'::jsonb,         true, 26, NOW(), NOW()),
    ('rr-or-excess-steel',                               'rt-or', '{"rt-or-c-desc":"Excess steel","rt-or-c-unit":"per 6mm bar diameter","rt-or-c-rate":3.2}'::jsonb,                  true, 27, NOW(), NOW()),
    ('rr-or-overtime-hourly-charge-beyond-minimum',      'rt-or', '{"rt-or-c-desc":"Overtime hourly charge beyond minimum","rt-or-c-unit":"p/hr/man (min 4hrs)","rt-or-c-rate":75}'::jsonb, true, 28, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

END $$;
