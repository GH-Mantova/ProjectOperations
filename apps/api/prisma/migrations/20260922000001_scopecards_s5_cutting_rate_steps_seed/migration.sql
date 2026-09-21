-- CHARGE_STEPS_PRICE_CUTTING_V1 (scopecards-s5) - rate step seed
--
-- Idempotent upsert (ON CONFLICT DO NOTHING or DO UPDATE for steps/fields).
-- ADD ROWS only - never removes or rewrites existing rows.
-- No UPDATE on existing rate rows.

-- ── 1. Update cutting table: chargeSteps + lineFields ─────────────────────
-- chargeSteps for cutting:
--   (1) start: Rate per m
--   (2) multiply 1.25 when method is "High-Freq"
--   (3) multiply 1.25 when method is "Low-emission"
--   (4) multiply line field "metres"
--
-- lineFields: method (text), metres (number)

UPDATE "rate_tables"
SET
    charge_steps = '[
        {"op":"start","field":"Rate per m"},
        {"op":"multiply","field":1.25,"when":{"field":"method","cmp":"is","value":"High-Freq"}},
        {"op":"multiply","field":1.25,"when":{"field":"method","cmp":"is","value":"Low-emission"}},
        {"op":"multiply","field":"metres"}
    ]'::jsonb,
    line_fields = '[
        {"name":"method","kind":"text","options":["Fuel","High-Freq","Low-emission"],"sample":"Fuel"},
        {"name":"metres","kind":"number","unit":"m","sample":1}
    ]'::jsonb,
    updated_at = NOW()
WHERE slug = 'cutting';


-- ── 2. Add Ringsaw Wall rows (idempotent) ─────────────────────────────────
-- Wall premium is a PRICED ROW at today's x1.1 figures to the cent.
-- Deleting the ELEVATION_MULTIPLIER moves no price.
INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-cut-ringsaw-wall-any-175', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Any","rt-cut-c-dep":175,"rt-cut-c-rate":78.43}'::jsonb, true, 62, NOW(), NOW()),
    ('rr-cut-ringsaw-wall-any-200', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Any","rt-cut-c-dep":200,"rt-cut-c-rate":92.68}'::jsonb, true, 63, NOW(), NOW()),
    ('rr-cut-ringsaw-wall-any-225', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Any","rt-cut-c-dep":225,"rt-cut-c-rate":105.71}'::jsonb, true, 64, NOW(), NOW()),
    ('rr-cut-ringsaw-wall-any-250', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Any","rt-cut-c-dep":250,"rt-cut-c-rate":118.80}'::jsonb, true, 65, NOW(), NOW()),
    ('rr-cut-ringsaw-wall-any-300', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Any","rt-cut-c-dep":300,"rt-cut-c-rate":138.99}'::jsonb, true, 66, NOW(), NOW()),
    ('rr-cut-ringsaw-wall-any-320', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Wall","rt-cut-c-mat":"Any","rt-cut-c-dep":320,"rt-cut-c-rate":155.65}'::jsonb, true, 67, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Add Ringsaw Floor rows matching Any row values (today's figures).
-- Floor rows are new (existing seeded rows use "Any" elevation).
INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-cut-ringsaw-floor-any-175', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":175,"rt-cut-c-rate":71.30}'::jsonb, true, 68, NOW(), NOW()),
    ('rr-cut-ringsaw-floor-any-200', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":200,"rt-cut-c-rate":84.25}'::jsonb, true, 69, NOW(), NOW()),
    ('rr-cut-ringsaw-floor-any-225', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":225,"rt-cut-c-rate":96.10}'::jsonb, true, 70, NOW(), NOW()),
    ('rr-cut-ringsaw-floor-any-250', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":250,"rt-cut-c-rate":108.00}'::jsonb, true, 71, NOW(), NOW()),
    ('rr-cut-ringsaw-floor-any-275', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":275,"rt-cut-c-rate":117.70}'::jsonb, true, 72, NOW(), NOW()),
    ('rr-cut-ringsaw-floor-any-300', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":300,"rt-cut-c-rate":126.35}'::jsonb, true, 73, NOW(), NOW()),
    ('rr-cut-ringsaw-floor-any-320', 'rt-cut', '{"rt-cut-c-eq":"Ringsaw","rt-cut-c-el":"Floor","rt-cut-c-mat":"Any","rt-cut-c-dep":320,"rt-cut-c-rate":141.50}'::jsonb, true, 74, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;


-- ── 3. Create cutting-mm table (NEW) ─────────────────────────────────────
-- Keys: Equipment, Elevation. Value: Rate per m.
-- chargeSteps: start rate -> multiply depthMm -> divide 25 -> floor 18 -> multiply metres
-- lineFields: depthMm (number), metres (number), method (text)

INSERT INTO "rate_tables" (id, name, slug, description, category, is_system, is_reference, created_at, updated_at)
VALUES (
    'rt-cut-mm',
    'Cutting (depth-scaled, per mm)',
    'cutting-mm',
    'Tracksaw and Flush-cut depth-scaled rates. Formula: (depthMm/25) * floor_rate, min floor_rate.',
    'INITIAL_SERVICES',
    true,
    false,
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- Set chargeSteps and lineFields (idempotent update)
UPDATE "rate_tables"
SET
    charge_steps = '[
        {"op":"start","field":"Rate per m"},
        {"op":"multiply","field":"depthMm"},
        {"op":"divide","field":25},
        {"op":"floor","value":18},
        {"op":"multiply","field":"metres"}
    ]'::jsonb,
    line_fields = '[
        {"name":"depthMm","kind":"number","unit":"mm","sample":25},
        {"name":"metres","kind":"number","unit":"m","sample":1},
        {"name":"method","kind":"text","options":["Fuel","High-Freq"],"sample":"Fuel"}
    ]'::jsonb,
    updated_at = NOW()
WHERE slug = 'cutting-mm';

-- Columns for cutting-mm
INSERT INTO "rate_columns" (id, rate_table_id, name, data_type, role, unit, sort_order, created_at, updated_at) VALUES
    ('rt-cut-mm-c-eq',   'rt-cut-mm', 'Equipment',  'TEXT',     'KEY',   NULL, 1, NOW(), NOW()),
    ('rt-cut-mm-c-el',   'rt-cut-mm', 'Elevation',  'TEXT',     'KEY',   NULL, 2, NOW(), NOW()),
    ('rt-cut-mm-c-rate', 'rt-cut-mm', 'Rate per m', 'CURRENCY', 'VALUE', 'm',  3, NOW(), NOW())
ON CONFLICT (rate_table_id, name) DO NOTHING;

-- Rows for cutting-mm
-- Tracksaw Floor $18.00, Tracksaw Wall $19.80, Flush-cut Floor $18.00, Flush-cut Wall $19.80
INSERT INTO "rate_rows" (id, rate_table_id, cells, is_active, sort_order, created_at, updated_at) VALUES
    ('rr-cut-mm-tracksaw-floor', 'rt-cut-mm',
     '{"rt-cut-mm-c-eq":"Tracksaw","rt-cut-mm-c-el":"Floor","rt-cut-mm-c-rate":18.00}'::jsonb,
     true, 1, NOW(), NOW()),
    ('rr-cut-mm-tracksaw-wall', 'rt-cut-mm',
     '{"rt-cut-mm-c-eq":"Tracksaw","rt-cut-mm-c-el":"Wall","rt-cut-mm-c-rate":19.80}'::jsonb,
     true, 2, NOW(), NOW()),
    ('rr-cut-mm-flush-cut-floor', 'rt-cut-mm',
     '{"rt-cut-mm-c-eq":"Flush-cut","rt-cut-mm-c-el":"Floor","rt-cut-mm-c-rate":18.00}'::jsonb,
     true, 3, NOW(), NOW()),
    ('rr-cut-mm-flush-cut-wall', 'rt-cut-mm',
     '{"rt-cut-mm-c-eq":"Flush-cut","rt-cut-mm-c-el":"Wall","rt-cut-mm-c-rate":19.80}'::jsonb,
     true, 4, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;


-- ── 4. Update core-hole table: chargeSteps + lineFields ───────────────────
-- chargeSteps for core-hole:
--   start depthMm -> divide 10 -> round nearest 1 -> floor 1
--   -> multiply Rate per hole -> multiply 1.1 when elevation is "Wall"
--   -> multiply 2 when elevation is "Inverted" -> multiply holes
--
-- lineFields: depthMm (number), elevation (text), holes (number)

UPDATE "rate_tables"
SET
    charge_steps = '[
        {"op":"start","field":"depthMm"},
        {"op":"divide","field":10},
        {"op":"round","direction":"nearest","interval":1},
        {"op":"floor","value":1},
        {"op":"multiply","field":"Rate per hole"},
        {"op":"multiply","field":1.1,"when":{"field":"elevation","cmp":"is","value":"Wall"}},
        {"op":"multiply","field":2,"when":{"field":"elevation","cmp":"is","value":"Inverted"}},
        {"op":"multiply","field":"holes"}
    ]'::jsonb,
    line_fields = '[
        {"name":"depthMm","kind":"number","unit":"mm","sample":30},
        {"name":"elevation","kind":"text","options":["Floor","Wall","Inverted"],"sample":"Floor"},
        {"name":"holes","kind":"number","sample":1}
    ]'::jsonb,
    updated_at = NOW()
WHERE slug = 'core-hole';
