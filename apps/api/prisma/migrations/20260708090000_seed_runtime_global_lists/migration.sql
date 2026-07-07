-- Data migration: seed the runtime-required GlobalLists into prod.
--
-- Why: deploy.yml only runs `prisma migrate deploy`; it never runs the TS
-- reference seed, so prod DBs have no GlobalList rows and the New Tender
-- wizard 404s on GET /lists/tender-package-disciplines/items. Same story
-- for the two other slugs the running app fetches at runtime:
--   * tender-package-disciplines (NewTenderWizard)
--   * measurement-units          (ScopeRowPills)
--   * subcontractor-categories   (SubcontractorsPage)
--
-- Semantics: insert-if-absent ONLY. These lists are Director-configurable;
-- we MUST NOT overwrite a renamed list or a re-labelled item on subsequent
-- deploys. Every INSERT is guarded by ON CONFLICT DO NOTHING against the
-- existing unique keys (global_lists.slug, global_list_items(list_id,value)).
--
-- Idempotent: running twice is a no-op.
-- Safe on empty DB: skips cleanly if no user exists yet.
-- Reverse (documented, run manually if rolling back):
--   DELETE FROM "global_list_items" WHERE list_id IN (
--     SELECT id FROM "global_lists"
--     WHERE slug IN ('tender-package-disciplines','measurement-units','subcontractor-categories')
--   );
--   DELETE FROM "global_lists"
--   WHERE slug IN ('tender-package-disciplines','measurement-units','subcontractor-categories');

DO $$
DECLARE
  admin_id TEXT;
  v_list_id TEXT;
BEGIN
  SELECT COALESCE(
    (SELECT id FROM "users" WHERE id = 'user-admin' LIMIT 1),
    (SELECT id FROM "users" ORDER BY "created_at" ASC LIMIT 1)
  ) INTO admin_id;

  IF admin_id IS NULL THEN
    RAISE NOTICE 'seed_runtime_global_lists: no users present, skipping.';
    RETURN;
  END IF;

  ----------------------------------------------------------------------
  -- tender-package-disciplines
  ----------------------------------------------------------------------
  INSERT INTO "global_lists"
    (id, name, slug, description, type, is_system, created_by_id, created_at, updated_at)
  VALUES
    ('gl-tender-package-disciplines',
     'Tender package disciplines',
     'tender-package-disciplines',
     'Disciplines used to categorise per-tender pricing packages (asbestos, demolition, cutting, civil, …). Director-configurable.',
     'STATIC', true, admin_id, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_list_id FROM "global_lists" WHERE slug = 'tender-package-disciplines';

  INSERT INTO "global_list_items"
    (id, list_id, value, label, sort_order, is_archived, created_by_id, created_at, updated_at)
  VALUES
    ('gli-tpd-asbestos',         v_list_id, 'asbestos',         'Asbestos',         0, false, admin_id, NOW(), NOW()),
    ('gli-tpd-demolition',       v_list_id, 'demolition',       'Demolition',       1, false, admin_id, NOW(), NOW()),
    ('gli-tpd-concrete-cutting', v_list_id, 'concrete-cutting', 'Concrete Cutting', 2, false, admin_id, NOW(), NOW()),
    ('gli-tpd-civil',            v_list_id, 'civil',            'Civil',            3, false, admin_id, NOW(), NOW()),
    ('gli-tpd-other',            v_list_id, 'other',            'Other',            4, false, admin_id, NOW(), NOW())
  ON CONFLICT (list_id, value) DO NOTHING;

  ----------------------------------------------------------------------
  -- measurement-units
  ----------------------------------------------------------------------
  INSERT INTO "global_lists"
    (id, name, slug, description, type, is_system, created_by_id, created_at, updated_at)
  VALUES
    ('gl-measurement-units',
     'Measurement units',
     'measurement-units',
     'Units used across scope, cutting and waste lines.',
     'STATIC', true, admin_id, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_list_id FROM "global_lists" WHERE slug = 'measurement-units';

  INSERT INTO "global_list_items"
    (id, list_id, value, label, sort_order, is_archived, created_by_id, created_at, updated_at)
  VALUES
    ('gli-mu-lm',    v_list_id, 'lm',    'Lm',    0, false, admin_id, NOW(), NOW()),
    ('gli-mu-sqm',   v_list_id, 'sqm',   'Sqm',   1, false, admin_id, NOW(), NOW()),
    ('gli-mu-m3',    v_list_id, 'm3',    'M³',    2, false, admin_id, NOW(), NOW()),
    ('gli-mu-kg',    v_list_id, 'kg',    'Kg',    3, false, admin_id, NOW(), NOW()),
    ('gli-mu-unit',  v_list_id, 'unit',  'Unit',  4, false, admin_id, NOW(), NOW()),
    ('gli-mu-tonne', v_list_id, 'tonne', 'Tonne', 5, false, admin_id, NOW(), NOW()),
    ('gli-mu-each',  v_list_id, 'each',  'Each',  6, false, admin_id, NOW(), NOW()),
    ('gli-mu-rl',    v_list_id, 'rl',    'RL',    7, false, admin_id, NOW(), NOW()),
    ('gli-mu-hr',    v_list_id, 'hr',    'Hr',    8, false, admin_id, NOW(), NOW())
  ON CONFLICT (list_id, value) DO NOTHING;

  ----------------------------------------------------------------------
  -- subcontractor-categories
  ----------------------------------------------------------------------
  INSERT INTO "global_lists"
    (id, name, slug, description, type, is_system, created_by_id, created_at, updated_at)
  VALUES
    ('gl-subcontractor-categories',
     'Subcontractor & supplier categories',
     'subcontractor-categories',
     'Trade categories for directory entries — mirrors the IS SharePoint folder structure.',
     'STATIC', true, admin_id, NOW(), NOW())
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_list_id FROM "global_lists" WHERE slug = 'subcontractor-categories';

  INSERT INTO "global_list_items"
    (id, list_id, value, label, sort_order, is_archived, created_by_id, created_at, updated_at)
  VALUES
    ('gli-sc-arborist',            v_list_id, 'arborist',            'Arborist',           0,  false, admin_id, NOW(), NOW()),
    ('gli-sc-asbestos-removal',    v_list_id, 'asbestos-removal',    'Asbestos Removal',   1,  false, admin_id, NOW(), NOW()),
    ('gli-sc-concrete-cutting',    v_list_id, 'concrete-cutting',    'Concrete Cutting',   2,  false, admin_id, NOW(), NOW()),
    ('gli-sc-credit-applications', v_list_id, 'credit-applications', 'Credit Applications',3,  false, admin_id, NOW(), NOW()),
    ('gli-sc-engineering',         v_list_id, 'engineering',         'Engineering',        4,  false, admin_id, NOW(), NOW()),
    ('gli-sc-geotech-testing',     v_list_id, 'geotech-testing',     'Geotech Testing',    5,  false, admin_id, NOW(), NOW()),
    ('gli-sc-hygienists',          v_list_id, 'hygienists',          'Hygienists',         6,  false, admin_id, NOW(), NOW()),
    ('gli-sc-labour-hire',         v_list_id, 'labour-hire',         'Labour Hire',        7,  false, admin_id, NOW(), NOW()),
    ('gli-sc-petrol-station',      v_list_id, 'petrol-station',      'Petrol Station',     8,  false, admin_id, NOW(), NOW()),
    ('gli-sc-plant-hire',          v_list_id, 'plant-hire',          'Plant Hire',         9,  false, admin_id, NOW(), NOW()),
    ('gli-sc-service-scanning',    v_list_id, 'service-scanning',    'Service Scanning',   10, false, admin_id, NOW(), NOW()),
    ('gli-sc-site-protections',    v_list_id, 'site-protections',    'Site Protections',   11, false, admin_id, NOW(), NOW()),
    ('gli-sc-survey',              v_list_id, 'survey',              'Survey',             12, false, admin_id, NOW(), NOW()),
    ('gli-sc-traffic-control',     v_list_id, 'traffic-control',     'Traffic Control',    13, false, admin_id, NOW(), NOW()),
    ('gli-sc-truck-hire',          v_list_id, 'truck-hire',          'Truck Hire',         14, false, admin_id, NOW(), NOW()),
    ('gli-sc-vacuum-excavation',   v_list_id, 'vacuum-excavation',   'Vacuum Excavation',  15, false, admin_id, NOW(), NOW()),
    ('gli-sc-waste-facilities',    v_list_id, 'waste-facilities',    'Waste Facilities',   16, false, admin_id, NOW(), NOW())
  ON CONFLICT (list_id, value) DO NOTHING;
END $$;
