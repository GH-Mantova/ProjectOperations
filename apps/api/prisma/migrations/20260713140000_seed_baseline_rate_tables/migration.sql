-- Data migration: seed the baseline RateTable / RateColumn / RateRow rows
-- into prod. Mirrors `seedRateTableProjections` in
-- `apps/api/prisma/seed-initial-services.ts` byte-for-byte (same slugs,
-- IDs, column roles, cell contents).
--
-- Why: the RateTable projection lives only in the TS reference seed;
-- deploy.yml runs `prisma migrate deploy` and never runs the seed, so
-- prod has zero rows in rate_tables / rate_columns / rate_rows. The
-- admin Rate tables tab renders empty and `RateResolverService.
-- enumerateRateSet()` snapshots an empty locked-rates set on tender
-- lock. Third instance of the LL-04 / LL-35 trap (see
-- sot/05-decisions-and-lessons.md): #504 (tender-package-disciplines
-- GlobalList), #506/#551 (super-user flag), now the rate tables. The
-- standing guard CP-23 (`seed-without-migration`) exists for exactly
-- this class but landed after the rates seed, so it never gated it.
--
-- Idempotent: every INSERT is guarded by ON CONFLICT DO NOTHING against
-- the existing unique keys:
--   * rate_tables      : slug              (UNIQUE)
--   * rate_columns     : (rate_table_id, name)
--   * rate_rows        : id                (PK)
-- Rerunning the migration is a no-op. Admin edits to existing rows /
-- columns / tables are NEVER overwritten — S3-016 lesson from the
-- estimating rate-library work.
--
-- Does NOT DELETE anything (the seed's cleanup delete for orphan rows
-- is deliberately omitted here; a migration must not touch admin edits).
--
-- Safe on empty DB. Safe on a DB where the seed has already run.
--
-- Reverse (documented, run manually if rolling back):
--   DELETE FROM "rate_rows"    WHERE rate_table_id IN
--     ('rt-lbr','rt-plt','rt-wst-t','rt-wst-m3','rt-cut','rt-ch','rt-fl','rt-en','rt-exc-prod');
--   DELETE FROM "rate_columns" WHERE rate_table_id IN
--     ('rt-lbr','rt-plt','rt-wst-t','rt-wst-m3','rt-cut','rt-ch','rt-fl','rt-en','rt-exc-prod');
--   DELETE FROM "rate_tables"  WHERE id IN
--     ('rt-lbr','rt-plt','rt-wst-t','rt-wst-m3','rt-cut','rt-ch','rt-fl','rt-en','rt-exc-prod');
--
-- Values sourced from `seedEstimateRates` (labour, plant, waste,
-- cutting, core-hole, fuel, enclosure) and the hard-coded
-- `excavatorSizes` block in `seedRateTableProjections`. No rate value
-- was invented; running `pnpm seed` twice after this migration yields
-- the same row set (CP-08).

DO $$
BEGIN
  -- ── labour ─────────────────────────────────────────
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-lbr', 'Labour rates', 'labour', 'Day / night / weekend labour rates by role (projection of EstimateLabourRate).', 'INITIAL_SERVICES', true, false, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-lbr-c-role', 'rt-lbr', 'Role', 'TEXT', 'KEY', NULL, 1, NOW(), NOW()),
    ('rt-lbr-c-day', 'rt-lbr', 'Day rate', 'CURRENCY', 'VALUE', 'day', 2, NOW(), NOW()),
    ('rt-lbr-c-night', 'rt-lbr', 'Night rate', 'CURRENCY', 'VALUE', 'day', 3, NOW(), NOW()),
    ('rt-lbr-c-weekend', 'rt-lbr', 'Weekend rate', 'CURRENCY', 'VALUE', 'day', 4, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-lbr-demolition-labourer', 'rt-lbr', '{"rt-lbr-c-role":"Demolition labourer","rt-lbr-c-day":600,"rt-lbr-c-night":1000,"rt-lbr-c-weekend":900}'::jsonb, true, 1, NOW(), NOW()),
    ('rr-lbr-demolition-supervisor', 'rt-lbr', '{"rt-lbr-c-role":"Demolition supervisor","rt-lbr-c-day":600,"rt-lbr-c-night":1000,"rt-lbr-c-weekend":900}'::jsonb, true, 2, NOW(), NOW()),
    ('rr-lbr-asbestos-labourer', 'rt-lbr', '{"rt-lbr-c-role":"Asbestos labourer","rt-lbr-c-day":600,"rt-lbr-c-night":1000,"rt-lbr-c-weekend":900}'::jsonb, true, 3, NOW(), NOW()),
    ('rr-lbr-asbestos-supervisor', 'rt-lbr', '{"rt-lbr-c-role":"Asbestos supervisor","rt-lbr-c-day":600,"rt-lbr-c-night":1000,"rt-lbr-c-weekend":900}'::jsonb, true, 4, NOW(), NOW()),
    ('rr-lbr-machine-operator', 'rt-lbr', '{"rt-lbr-c-role":"Machine operator","rt-lbr-c-day":600,"rt-lbr-c-night":1000,"rt-lbr-c-weekend":900}'::jsonb, true, 5, NOW(), NOW()),
    ('rr-lbr-project-manager', 'rt-lbr', '{"rt-lbr-c-role":"Project manager","rt-lbr-c-day":850,"rt-lbr-c-night":1400,"rt-lbr-c-weekend":1200}'::jsonb, true, 6, NOW(), NOW()),
    ('rr-lbr-senior-supervisor', 'rt-lbr', '{"rt-lbr-c-role":"Senior supervisor","rt-lbr-c-day":850,"rt-lbr-c-night":1400,"rt-lbr-c-weekend":1200}'::jsonb, true, 7, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── plant ─────────────────────────────────────────
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-plt', 'Plant rates', 'plant', 'Plant hire rates by item (projection of EstimatePlantRate).', 'INITIAL_SERVICES', true, false, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-plt-c-item', 'rt-plt', 'Item', 'TEXT', 'KEY', NULL, 1, NOW(), NOW()),
    ('rt-plt-c-category', 'rt-plt', 'Category', 'TEXT', 'INFO', NULL, 2, NOW(), NOW()),
    ('rt-plt-c-unit', 'rt-plt', 'Unit', 'TEXT', 'INFO', NULL, 3, NOW(), NOW()),
    ('rt-plt-c-rate', 'rt-plt', 'Rate', 'CURRENCY', 'VALUE', NULL, 4, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-plt-excavator-16t-25t-wet-hire', 'rt-plt', '{"rt-plt-c-item":"Excavator 16T-25T (wet hire)","rt-plt-c-category":"Excavator","rt-plt-c-unit":"day","rt-plt-c-rate":1500}'::jsonb, true, 1, NOW(), NOW()),
    ('rr-plt-excavator-01t-03t-dry-hire', 'rt-plt', '{"rt-plt-c-item":"Excavator 01T-03T (dry hire)","rt-plt-c-category":"Excavator","rt-plt-c-unit":"day","rt-plt-c-rate":327.75}'::jsonb, true, 2, NOW(), NOW()),
    ('rr-plt-bobcat', 'rt-plt', '{"rt-plt-c-item":"Bobcat","rt-plt-c-category":"Bobcat","rt-plt-c-unit":"day","rt-plt-c-rate":1000}'::jsonb, true, 3, NOW(), NOW()),
    ('rr-plt-franna-14t', 'rt-plt', '{"rt-plt-c-item":"Franna 14T","rt-plt-c-category":"Crane","rt-plt-c-unit":"day","rt-plt-c-rate":3500}'::jsonb, true, 4, NOW(), NOW()),
    ('rr-plt-hook-truck-10t-concrete-5t-c-d', 'rt-plt', '{"rt-plt-c-item":"Hook truck (10T concrete / 5T C&D)","rt-plt-c-category":"Truck","rt-plt-c-unit":"day","rt-plt-c-rate":1250}'::jsonb, true, 5, NOW(), NOW()),
    ('rr-plt-semi-tipper-20t-concrete-10t-c-d', 'rt-plt', '{"rt-plt-c-item":"Semi tipper (20T concrete / 10T C&D)","rt-plt-c-category":"Truck","rt-plt-c-unit":"day","rt-plt-c-rate":1750}'::jsonb, true, 6, NOW(), NOW()),
    ('rr-plt-plant-float-over-13t', 'rt-plt', '{"rt-plt-c-item":"Plant float — over 13T","rt-plt-c-category":"Other","rt-plt-c-unit":"each way","rt-plt-c-rate":1035}'::jsonb, true, 7, NOW(), NOW()),
    ('rr-plt-plant-float-under-13t', 'rt-plt', '{"rt-plt-c-item":"Plant float — under 13T","rt-plt-c-category":"Other","rt-plt-c-unit":"each way","rt-plt-c-rate":402.5}'::jsonb, true, 8, NOW(), NOW()),
    ('rr-plt-robot-excavator', 'rt-plt', '{"rt-plt-c-item":"Robot excavator","rt-plt-c-category":"Excavator","rt-plt-c-unit":"day","rt-plt-c-rate":4000}'::jsonb, true, 9, NOW(), NOW()),
    ('rr-plt-attachment-16t-25t', 'rt-plt', '{"rt-plt-c-item":"Attachment 16T-25T","rt-plt-c-category":"Other","rt-plt-c-unit":"day","rt-plt-c-rate":281}'::jsonb, true, 10, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── waste-per-tonne ─────────────────────────────────────────
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-wst-t', 'Waste rates (per tonne)', 'waste-per-tonne', 'Waste facility rates priced by tonne (projection of EstimateWasteRate).', 'INITIAL_SERVICES', true, false, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-wst-t-c-facility', 'rt-wst-t', 'Facility', 'TEXT', 'KEY', NULL, 1, NOW(), NOW()),
    ('rt-wst-t-c-type', 'rt-wst-t', 'Waste type', 'TEXT', 'KEY', NULL, 2, NOW(), NOW()),
    ('rt-wst-t-c-group', 'rt-wst-t', 'Group', 'TEXT', 'INFO', NULL, 3, NOW(), NOW()),
    ('rt-wst-t-c-ton', 'rt-wst-t', 'Rate per tonne', 'CURRENCY', 'VALUE', 'tonne', 4, NOW(), NOW()),
    ('rt-wst-t-c-load', 'rt-wst-t', 'Rate per load', 'CURRENCY', 'VALUE', 'load', 5, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-wst-t-bmi-acacia-ridge-c-d-general', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Acacia Ridge","rt-wst-t-c-type":"C&D — general","rt-wst-t-c-group":"General waste","rt-wst-t-c-ton":216,"rt-wst-t-c-load":0}'::jsonb, true, 5, NOW(), NOW()),
    ('rr-wst-t-bmi-acacia-ridge-c-d-non-recyclable', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Acacia Ridge","rt-wst-t-c-type":"C&D — non-recyclable","rt-wst-t-c-group":"General waste","rt-wst-t-c-ton":256,"rt-wst-t-c-load":0}'::jsonb, true, 6, NOW(), NOW()),
    ('rr-wst-t-bmi-acacia-ridge-concrete-clean', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Acacia Ridge","rt-wst-t-c-type":"Concrete — clean","rt-wst-t-c-group":"Rubble","rt-wst-t-c-ton":18,"rt-wst-t-c-load":360}'::jsonb, true, 7, NOW(), NOW()),
    ('rr-wst-t-bmi-acacia-ridge-concrete-dirty', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Acacia Ridge","rt-wst-t-c-type":"Concrete — dirty","rt-wst-t-c-group":"Rubble","rt-wst-t-c-ton":32,"rt-wst-t-c-load":0}'::jsonb, true, 8, NOW(), NOW()),
    ('rr-wst-t-bmi-acacia-ridge-fill-clean', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Acacia Ridge","rt-wst-t-c-type":"Fill — clean","rt-wst-t-c-group":"Soil","rt-wst-t-c-ton":43,"rt-wst-t-c-load":0}'::jsonb, true, 9, NOW(), NOW()),
    ('rr-wst-t-bmi-acacia-ridge-plasterboard', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Acacia Ridge","rt-wst-t-c-type":"Plasterboard","rt-wst-t-c-group":"General waste","rt-wst-t-c-ton":90,"rt-wst-t-c-load":0}'::jsonb, true, 10, NOW(), NOW()),
    ('rr-wst-t-bmi-stapylton-asbestos-levy-applicable', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Stapylton","rt-wst-t-c-type":"Asbestos — Levy Applicable","rt-wst-t-c-group":"Hazmat","rt-wst-t-c-ton":360,"rt-wst-t-c-load":0}'::jsonb, true, 11, NOW(), NOW()),
    ('rr-wst-t-bmi-stapylton-asbestos-levy-exempt', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Stapylton","rt-wst-t-c-type":"Asbestos — Levy Exempt","rt-wst-t-c-group":"Hazmat","rt-wst-t-c-ton":218,"rt-wst-t-c-load":0}'::jsonb, true, 12, NOW(), NOW()),
    ('rr-wst-t-bmi-stapylton-asbestos-in-c-d-nf-levy-applicable', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Stapylton","rt-wst-t-c-type":"Asbestos in C&D — NF Levy Applicable","rt-wst-t-c-group":"Hazmat","rt-wst-t-c-ton":400,"rt-wst-t-c-load":0}'::jsonb, true, 13, NOW(), NOW()),
    ('rr-wst-t-bmi-stapylton-asbestos-in-c-d-friable-levy-exempt', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Stapylton","rt-wst-t-c-type":"Asbestos in C&D — Friable Levy Exempt","rt-wst-t-c-group":"Hazmat","rt-wst-t-c-ton":278,"rt-wst-t-c-load":0}'::jsonb, true, 14, NOW(), NOW()),
    ('rr-wst-t-bmi-hendra-c-d-general', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Hendra","rt-wst-t-c-type":"C&D — general","rt-wst-t-c-group":"General waste","rt-wst-t-c-ton":222,"rt-wst-t-c-load":0}'::jsonb, true, 15, NOW(), NOW()),
    ('rr-wst-t-bmi-hendra-concrete-clean', 'rt-wst-t', '{"rt-wst-t-c-facility":"BMI Hendra","rt-wst-t-c-type":"Concrete — clean","rt-wst-t-c-group":"Rubble","rt-wst-t-c-ton":70,"rt-wst-t-c-load":0}'::jsonb, true, 16, NOW(), NOW()),
    ('rr-wst-t-rowcon-bells-creek-concrete-clean', 'rt-wst-t', '{"rt-wst-t-c-facility":"Rowcon (Bells Creek)","rt-wst-t-c-type":"Concrete — clean","rt-wst-t-c-group":"Rubble","rt-wst-t-c-ton":4.5,"rt-wst-t-c-load":0}'::jsonb, true, 17, NOW(), NOW()),
    ('rr-wst-t-rowcon-bells-creek-c-d-general', 'rt-wst-t', '{"rt-wst-t-c-facility":"Rowcon (Bells Creek)","rt-wst-t-c-type":"C&D — general","rt-wst-t-c-group":"General waste","rt-wst-t-c-ton":263,"rt-wst-t-c-load":0}'::jsonb, true, 18, NOW(), NOW()),
    ('rr-wst-t-rowcon-bells-creek-asphalt-clean', 'rt-wst-t', '{"rt-wst-t-c-facility":"Rowcon (Bells Creek)","rt-wst-t-c-type":"Asphalt — clean","rt-wst-t-c-group":"Asphalt","rt-wst-t-c-ton":4.5,"rt-wst-t-c-load":0}'::jsonb, true, 19, NOW(), NOW()),
    ('rr-wst-t-cleanaway-concrete-clean', 'rt-wst-t', '{"rt-wst-t-c-facility":"Cleanaway","rt-wst-t-c-type":"Concrete — clean","rt-wst-t-c-group":"Rubble","rt-wst-t-c-ton":38,"rt-wst-t-c-load":0}'::jsonb, true, 20, NOW(), NOW()),
    ('rr-wst-t-sunshine-coast-council-green-waste', 'rt-wst-t', '{"rt-wst-t-c-facility":"Sunshine Coast Council","rt-wst-t-c-type":"Green waste","rt-wst-t-c-group":"Vegetation","rt-wst-t-c-ton":63,"rt-wst-t-c-load":0}'::jsonb, true, 23, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── waste-per-m3 ─────────────────────────────────────────
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-wst-m3', 'Waste rates (per m³)', 'waste-per-m3', 'Waste facility rates priced by cubic metre (projection of EstimateWasteRate).', 'INITIAL_SERVICES', true, false, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-wst-m3-c-facility', 'rt-wst-m3', 'Facility', 'TEXT', 'KEY', NULL, 1, NOW(), NOW()),
    ('rt-wst-m3-c-type', 'rt-wst-m3', 'Waste type', 'TEXT', 'KEY', NULL, 2, NOW(), NOW()),
    ('rt-wst-m3-c-group', 'rt-wst-m3', 'Group', 'TEXT', 'INFO', NULL, 3, NOW(), NOW()),
    ('rt-wst-m3-c-m3', 'rt-wst-m3', 'Rate per m³', 'CURRENCY', 'VALUE', 'm³', 4, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-wst-m3-alex-fraser-asphalt-clean', 'rt-wst-m3', '{"rt-wst-m3-c-facility":"Alex Fraser","rt-wst-m3-c-type":"Asphalt — clean","rt-wst-m3-c-group":"Asphalt","rt-wst-m3-c-m3":10}'::jsonb, true, 1, NOW(), NOW()),
    ('rr-wst-m3-alex-fraser-concrete-brick-mixed', 'rt-wst-m3', '{"rt-wst-m3-c-facility":"Alex Fraser","rt-wst-m3-c-type":"Concrete/Brick — mixed","rt-wst-m3-c-group":"Rubble","rt-wst-m3-c-m3":28}'::jsonb, true, 2, NOW(), NOW()),
    ('rr-wst-m3-alex-fraser-concrete-clean', 'rt-wst-m3', '{"rt-wst-m3-c-facility":"Alex Fraser","rt-wst-m3-c-type":"Concrete — clean","rt-wst-m3-c-group":"Rubble","rt-wst-m3-c-m3":14}'::jsonb, true, 3, NOW(), NOW()),
    ('rr-wst-m3-alex-fraser-rock-clean', 'rt-wst-m3', '{"rt-wst-m3-c-facility":"Alex Fraser","rt-wst-m3-c-type":"Rock — clean","rt-wst-m3-c-group":"Soil","rt-wst-m3-c-m3":22}'::jsonb, true, 4, NOW(), NOW()),
    ('rr-wst-m3-moreton-bay-recycling-concrete-clean', 'rt-wst-m3', '{"rt-wst-m3-c-facility":"Moreton Bay Recycling","rt-wst-m3-c-type":"Concrete — clean","rt-wst-m3-c-group":"Rubble","rt-wst-m3-c-m3":16}'::jsonb, true, 21, NOW(), NOW()),
    ('rr-wst-m3-moreton-bay-recycling-concrete-dirty', 'rt-wst-m3', '{"rt-wst-m3-c-facility":"Moreton Bay Recycling","rt-wst-m3-c-type":"Concrete — dirty","rt-wst-m3-c-group":"Rubble","rt-wst-m3-c-m3":25}'::jsonb, true, 22, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── cutting ─────────────────────────────────────────
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-cut', 'Concrete-cutting rates (Cutrite)', 'cutting', 'Equipment × elevation × material × depth rate matrix (projection of EstimateCuttingRate).', 'INITIAL_SERVICES', true, false, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-cut-c-eq', 'rt-cut', 'Equipment', 'TEXT', 'KEY', NULL, 1, NOW(), NOW()),
    ('rt-cut-c-el', 'rt-cut', 'Elevation', 'TEXT', 'KEY', NULL, 2, NOW(), NOW()),
    ('rt-cut-c-mat', 'rt-cut', 'Material', 'TEXT', 'KEY', NULL, 3, NOW(), NOW()),
    ('rt-cut-c-dep', 'rt-cut', 'Depth (mm)', 'NUMBER', 'KEY', 'mm', 4, NOW(), NOW()),
    ('rt-cut-c-rate', 'rt-cut', 'Rate per m', 'CURRENCY', 'VALUE', 'm', 5, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-cut-roadsaw-floor-asphalt-50', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":50,"rt-cut-c-rate":4.3}'::jsonb, true, 1, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-75', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":75,"rt-cut-c-rate":6}'::jsonb, true, 2, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-100', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":100,"rt-cut-c-rate":8}'::jsonb, true, 3, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-125', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":125,"rt-cut-c-rate":9.4}'::jsonb, true, 4, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-150', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":150,"rt-cut-c-rate":12.6}'::jsonb, true, 5, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-175', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":175,"rt-cut-c-rate":14.25}'::jsonb, true, 6, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-200', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":200,"rt-cut-c-rate":16.5}'::jsonb, true, 7, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-225', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":225,"rt-cut-c-rate":18.5}'::jsonb, true, 8, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-250', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":250,"rt-cut-c-rate":21.1}'::jsonb, true, 9, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-275', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":275,"rt-cut-c-rate":23.85}'::jsonb, true, 10, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-300', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":300,"rt-cut-c-rate":27.25}'::jsonb, true, 11, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-325', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":325,"rt-cut-c-rate":31.75}'::jsonb, true, 12, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-350', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":350,"rt-cut-c-rate":35.9}'::jsonb, true, 13, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-375', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":375,"rt-cut-c-rate":37.2}'::jsonb, true, 14, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-400', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":400,"rt-cut-c-rate":41.35}'::jsonb, true, 15, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-450', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":450,"rt-cut-c-rate":70.21}'::jsonb, true, 16, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-asphalt-500', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Asphalt","rt-cut-c-dep":500,"rt-cut-c-rate":78.03}'::jsonb, true, 17, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-50', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":50,"rt-cut-c-rate":4.85}'::jsonb, true, 18, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-75', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":75,"rt-cut-c-rate":8.4}'::jsonb, true, 19, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-100', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":100,"rt-cut-c-rate":11.1}'::jsonb, true, 20, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-125', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":125,"rt-cut-c-rate":13.7}'::jsonb, true, 21, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-150', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":150,"rt-cut-c-rate":14.3}'::jsonb, true, 22, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-175', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":175,"rt-cut-c-rate":16.4}'::jsonb, true, 23, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-200', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":200,"rt-cut-c-rate":18.95}'::jsonb, true, 24, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-225', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":225,"rt-cut-c-rate":21.4}'::jsonb, true, 25, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-250', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":250,"rt-cut-c-rate":25.55}'::jsonb, true, 26, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-275', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":275,"rt-cut-c-rate":30.7}'::jsonb, true, 27, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-300', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":300,"rt-cut-c-rate":39.35}'::jsonb, true, 28, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-325', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":325,"rt-cut-c-rate":42.15}'::jsonb, true, 29, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-350', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":350,"rt-cut-c-rate":51.3}'::jsonb, true, 30, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-375', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":375,"rt-cut-c-rate":54.35}'::jsonb, true, 31, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-400', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":400,"rt-cut-c-rate":58.7}'::jsonb, true, 32, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-450', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":450,"rt-cut-c-rate":82.6}'::jsonb, true, 33, NOW(), NOW()),
    ('rr-cut-roadsaw-floor-concrete-500', 'rt-cut', '{"rt-cut-c-eq":"Roadsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Concrete","rt-cut-c-dep":500,"rt-cut-c-rate":91.8}'::jsonb, true, 34, NOW(), NOW()),
    ('rr-cut-demosaw-floor-any-25', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":25,"rt-cut-c-rate":7.55}'::jsonb, true, 35, NOW(), NOW()),
    ('rr-cut-demosaw-floor-any-50', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":50,"rt-cut-c-rate":10.9}'::jsonb, true, 36, NOW(), NOW()),
    ('rr-cut-demosaw-floor-any-75', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":75,"rt-cut-c-rate":15.35}'::jsonb, true, 37, NOW(), NOW()),
    ('rr-cut-demosaw-floor-any-100', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":100,"rt-cut-c-rate":22.25}'::jsonb, true, 38, NOW(), NOW()),
    ('rr-cut-demosaw-floor-any-125', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":125,"rt-cut-c-rate":24.7}'::jsonb, true, 39, NOW(), NOW()),
    ('rr-cut-demosaw-floor-any-150', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":150,"rt-cut-c-rate":28.4}'::jsonb, true, 40, NOW(), NOW()),
    ('rr-cut-demosaw-wall-brick-block-25', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Brick/Block","rt-cut-c-dep":25,"rt-cut-c-rate":7.9}'::jsonb, true, 41, NOW(), NOW()),
    ('rr-cut-demosaw-wall-brick-block-50', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Brick/Block","rt-cut-c-dep":50,"rt-cut-c-rate":13.95}'::jsonb, true, 42, NOW(), NOW()),
    ('rr-cut-demosaw-wall-brick-block-75', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Brick/Block","rt-cut-c-dep":75,"rt-cut-c-rate":21.4}'::jsonb, true, 43, NOW(), NOW()),
    ('rr-cut-demosaw-wall-brick-block-100', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Brick/Block","rt-cut-c-dep":100,"rt-cut-c-rate":26.8}'::jsonb, true, 44, NOW(), NOW()),
    ('rr-cut-demosaw-wall-brick-block-125', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Brick/Block","rt-cut-c-dep":125,"rt-cut-c-rate":34.55}'::jsonb, true, 45, NOW(), NOW()),
    ('rr-cut-demosaw-wall-brick-block-150', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Brick/Block","rt-cut-c-dep":150,"rt-cut-c-rate":43.1}'::jsonb, true, 46, NOW(), NOW()),
    ('rr-cut-demosaw-wall-concrete-25', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Concrete","rt-cut-c-dep":25,"rt-cut-c-rate":9.95}'::jsonb, true, 47, NOW(), NOW()),
    ('rr-cut-demosaw-wall-concrete-50', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Concrete","rt-cut-c-dep":50,"rt-cut-c-rate":17}'::jsonb, true, 48, NOW(), NOW()),
    ('rr-cut-demosaw-wall-concrete-75', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Concrete","rt-cut-c-dep":75,"rt-cut-c-rate":23.6}'::jsonb, true, 49, NOW(), NOW()),
    ('rr-cut-demosaw-wall-concrete-100', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Concrete","rt-cut-c-dep":100,"rt-cut-c-rate":31.7}'::jsonb, true, 50, NOW(), NOW()),
    ('rr-cut-demosaw-wall-concrete-125', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Concrete","rt-cut-c-dep":125,"rt-cut-c-rate":39.75}'::jsonb, true, 51, NOW(), NOW()),
    ('rr-cut-demosaw-wall-concrete-150', 'rt-cut', '{"rt-cut-c-eq":"Demosaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Concrete","rt-cut-c-dep":150,"rt-cut-c-rate":48.6}'::jsonb, true, 52, NOW(), NOW()),
    ('rr-cut-ringsaw-any-any-175', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Any","rt-cut-c-mat":"Any","rt-cut-c-dep":175,"rt-cut-c-rate":71.3}'::jsonb, true, 53, NOW(), NOW()),
    ('rr-cut-ringsaw-any-any-200', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Any","rt-cut-c-mat":"Any","rt-cut-c-dep":200,"rt-cut-c-rate":84.25}'::jsonb, true, 54, NOW(), NOW()),
    ('rr-cut-ringsaw-any-any-225', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Any","rt-cut-c-mat":"Any","rt-cut-c-dep":225,"rt-cut-c-rate":96.1}'::jsonb, true, 55, NOW(), NOW()),
    ('rr-cut-ringsaw-any-any-250', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Any","rt-cut-c-mat":"Any","rt-cut-c-dep":250,"rt-cut-c-rate":108}'::jsonb, true, 56, NOW(), NOW()),
    ('rr-cut-ringsaw-any-any-275', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Any","rt-cut-c-mat":"Any","rt-cut-c-dep":275,"rt-cut-c-rate":117.7}'::jsonb, true, 57, NOW(), NOW()),
    ('rr-cut-ringsaw-any-any-300', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Any","rt-cut-c-mat":"Any","rt-cut-c-dep":300,"rt-cut-c-rate":126.35}'::jsonb, true, 58, NOW(), NOW()),
    ('rr-cut-ringsaw-any-any-320', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Any","rt-cut-c-mat":"Any","rt-cut-c-dep":320,"rt-cut-c-rate":141.5}'::jsonb, true, 59, NOW(), NOW()),
    ('rr-cut-flush-cut-any-any-25', 'rt-cut', '{"rt-cut-c-eq":"Flush-cut","rt-cut-c-el":"Any","rt-cut-c-mat":"Any","rt-cut-c-dep":25,"rt-cut-c-rate":18}'::jsonb, true, 60, NOW(), NOW()),
    ('rr-cut-tracksaw-any-any-25', 'rt-cut', '{"rt-cut-c-eq":"Tracksaw","rt-cut-c-el":"Any","rt-cut-c-mat":"Any","rt-cut-c-dep":25,"rt-cut-c-rate":18}'::jsonb, true, 61, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── core-hole ─────────────────────────────────────────
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-ch', 'Core-hole rates', 'core-hole', 'Rate per hole by diameter (projection of EstimateCoreHoleRate).', 'INITIAL_SERVICES', true, false, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-ch-c-dia', 'rt-ch', 'Diameter (mm)', 'NUMBER', 'KEY', 'mm', 1, NOW(), NOW()),
    ('rt-ch-c-rate', 'rt-ch', 'Rate per hole', 'CURRENCY', 'VALUE', 'hole', 2, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-ch-32', 'rt-ch', '{"rt-ch-c-dia":32,"rt-ch-c-rate":1.7}'::jsonb, true, 1, NOW(), NOW()),
    ('rr-ch-50', 'rt-ch', '{"rt-ch-c-dia":50,"rt-ch-c-rate":2.05}'::jsonb, true, 2, NOW(), NOW()),
    ('rr-ch-75', 'rt-ch', '{"rt-ch-c-dia":75,"rt-ch-c-rate":2.3}'::jsonb, true, 3, NOW(), NOW()),
    ('rr-ch-100', 'rt-ch', '{"rt-ch-c-dia":100,"rt-ch-c-rate":2.55}'::jsonb, true, 4, NOW(), NOW()),
    ('rr-ch-125', 'rt-ch', '{"rt-ch-c-dia":125,"rt-ch-c-rate":2.75}'::jsonb, true, 5, NOW(), NOW()),
    ('rr-ch-150', 'rt-ch', '{"rt-ch-c-dia":150,"rt-ch-c-rate":3.2}'::jsonb, true, 6, NOW(), NOW()),
    ('rr-ch-175', 'rt-ch', '{"rt-ch-c-dia":175,"rt-ch-c-rate":3.95}'::jsonb, true, 7, NOW(), NOW()),
    ('rr-ch-200', 'rt-ch', '{"rt-ch-c-dia":200,"rt-ch-c-rate":4.85}'::jsonb, true, 8, NOW(), NOW()),
    ('rr-ch-225', 'rt-ch', '{"rt-ch-c-dia":225,"rt-ch-c-rate":5.45}'::jsonb, true, 9, NOW(), NOW()),
    ('rr-ch-250', 'rt-ch', '{"rt-ch-c-dia":250,"rt-ch-c-rate":6.95}'::jsonb, true, 10, NOW(), NOW()),
    ('rr-ch-275', 'rt-ch', '{"rt-ch-c-dia":275,"rt-ch-c-rate":9.4}'::jsonb, true, 11, NOW(), NOW()),
    ('rr-ch-300', 'rt-ch', '{"rt-ch-c-dia":300,"rt-ch-c-rate":10.9}'::jsonb, true, 12, NOW(), NOW()),
    ('rr-ch-350', 'rt-ch', '{"rt-ch-c-dia":350,"rt-ch-c-rate":12.9}'::jsonb, true, 13, NOW(), NOW()),
    ('rr-ch-375', 'rt-ch', '{"rt-ch-c-dia":375,"rt-ch-c-rate":14.5}'::jsonb, true, 14, NOW(), NOW()),
    ('rr-ch-400', 'rt-ch', '{"rt-ch-c-dia":400,"rt-ch-c-rate":17.9}'::jsonb, true, 15, NOW(), NOW()),
    ('rr-ch-450', 'rt-ch', '{"rt-ch-c-dia":450,"rt-ch-c-rate":23.75}'::jsonb, true, 16, NOW(), NOW()),
    ('rr-ch-500', 'rt-ch', '{"rt-ch-c-dia":500,"rt-ch-c-rate":29.15}'::jsonb, true, 17, NOW(), NOW()),
    ('rr-ch-550', 'rt-ch', '{"rt-ch-c-dia":550,"rt-ch-c-rate":34.55}'::jsonb, true, 18, NOW(), NOW()),
    ('rr-ch-600', 'rt-ch', '{"rt-ch-c-dia":600,"rt-ch-c-rate":41}'::jsonb, true, 19, NOW(), NOW()),
    ('rr-ch-650', 'rt-ch', '{"rt-ch-c-dia":650,"rt-ch-c-rate":49.7}'::jsonb, true, 20, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── fuel ─────────────────────────────────────────
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-fl', 'Fuel rates', 'fuel', 'Fuel adjustment rates (projection of EstimateFuelRate).', 'INITIAL_SERVICES', true, false, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-fl-c-item', 'rt-fl', 'Item', 'TEXT', 'KEY', NULL, 1, NOW(), NOW()),
    ('rt-fl-c-unit', 'rt-fl', 'Unit', 'TEXT', 'INFO', NULL, 2, NOW(), NOW()),
    ('rt-fl-c-rate', 'rt-fl', 'Rate', 'CURRENCY', 'VALUE', NULL, 3, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-fl-diesel-fuel-adjustment', 'rt-fl', '{"rt-fl-c-item":"Diesel fuel adjustment","rt-fl-c-unit":"L","rt-fl-c-rate":2.05}'::jsonb, true, 1, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── enclosure ─────────────────────────────────────────
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-en', 'Enclosure rates', 'enclosure', 'Asbestos enclosure / air monitoring rates (projection of EstimateEnclosureRate).', 'INITIAL_SERVICES', true, false, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-en-c-type', 'rt-en', 'Enclosure type', 'TEXT', 'KEY', NULL, 1, NOW(), NOW()),
    ('rt-en-c-unit', 'rt-en', 'Unit', 'TEXT', 'INFO', NULL, 2, NOW(), NOW()),
    ('rt-en-c-rate', 'rt-en', 'Rate', 'CURRENCY', 'VALUE', NULL, 3, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-en-acm-enclosure-class-a-friable', 'rt-en', '{"rt-en-c-type":"ACM enclosure (Class A, friable)","rt-en-c-unit":"m²","rt-en-c-rate":185}'::jsonb, true, 1, NOW(), NOW()),
    ('rr-en-acm-enclosure-class-b-non-friable', 'rt-en', '{"rt-en-c-type":"ACM enclosure (Class B, non-friable)","rt-en-c-unit":"m²","rt-en-c-rate":95}'::jsonb, true, 2, NOW(), NOW()),
    ('rr-en-air-monitoring', 'rt-en', '{"rt-en-c-type":"Air monitoring","rt-en-c-unit":"day","rt-en-c-rate":540}'::jsonb, true, 3, NOW(), NOW()),
    ('rr-en-clearance-certificate', 'rt-en', '{"rt-en-c-type":"Clearance certificate","rt-en-c-unit":"ea","rt-en-c-rate":850}'::jsonb, true, 4, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── excavator-production ─────────────────────────────────────────
  INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at) VALUES
    ('rt-exc-prod', 'Excavator production rates', 'excavator-production', 'Reference production factors (m³/day, 100 m²/day, m³/hr) used by task-time calculators. Not priced — excluded from tender rate-set snapshots.', 'INITIAL_SERVICES', true, true, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-exc-prod-c-size', 'rt-exc-prod', 'Excavator size', 'TEXT', 'KEY', NULL, 1, NOW(), NOW()),
    ('rt-exc-prod-c-slabs', 'rt-exc-prod', 'Demolishing concrete slabs', 'NUMBER', 'VALUE', 'm³/day', 2, NOW(), NOW()),
    ('rt-exc-prod-c-masonry', 'rt-exc-prod', 'Demolishing structures (masonry/concrete)', 'NUMBER', 'VALUE', '100 m²/day', 3, NOW(), NOW()),
    ('rt-exc-prod-c-stud', 'rt-exc-prod', 'Demolishing structures (stud walls)', 'NUMBER', 'VALUE', '100 m²/day', 4, NOW(), NOW()),
    ('rt-exc-prod-c-excavating', 'rt-exc-prod', 'Excavating', 'NUMBER', 'VALUE', 'm³/hr', 5, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-exc-prod-0-8t', 'rt-exc-prod', '{"rt-exc-prod-c-size":"0.8t","rt-exc-prod-c-slabs":1.5,"rt-exc-prod-c-masonry":10,"rt-exc-prod-c-stud":5,"rt-exc-prod-c-excavating":15}'::jsonb, true, 1, NOW(), NOW()),
    ('rr-exc-prod-1-5t', 'rt-exc-prod', '{"rt-exc-prod-c-size":"1.5t","rt-exc-prod-c-slabs":3,"rt-exc-prod-c-masonry":8,"rt-exc-prod-c-stud":4,"rt-exc-prod-c-excavating":20}'::jsonb, true, 2, NOW(), NOW()),
    ('rr-exc-prod-5t', 'rt-exc-prod', '{"rt-exc-prod-c-size":"5t","rt-exc-prod-c-slabs":10,"rt-exc-prod-c-masonry":5,"rt-exc-prod-c-stud":3,"rt-exc-prod-c-excavating":30}'::jsonb, true, 3, NOW(), NOW()),
    ('rr-exc-prod-10t', 'rt-exc-prod', '{"rt-exc-prod-c-size":"10t","rt-exc-prod-c-slabs":20,"rt-exc-prod-c-masonry":4,"rt-exc-prod-c-stud":2.25,"rt-exc-prod-c-excavating":50}'::jsonb, true, 4, NOW(), NOW()),
    ('rr-exc-prod-20t', 'rt-exc-prod', '{"rt-exc-prod-c-size":"20t","rt-exc-prod-c-slabs":40,"rt-exc-prod-c-masonry":3,"rt-exc-prod-c-stud":1.5,"rt-exc-prod-c-excavating":80}'::jsonb, true, 5, NOW(), NOW()),
    ('rr-exc-prod-25t', 'rt-exc-prod', '{"rt-exc-prod-c-size":"25t","rt-exc-prod-c-slabs":45,"rt-exc-prod-c-masonry":2.5,"rt-exc-prod-c-stud":1.25,"rt-exc-prod-c-excavating":100}'::jsonb, true, 6, NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

END $$;
