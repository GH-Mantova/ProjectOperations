-- 2026-05-16 — PR A1 discipline code rename SO/Str/Asb/Civ/Prv -> DEM/CIV/ASB/Other
-- Pure data migration; the `discipline` column type (String) is unchanged.
-- Idempotent: running twice is a no-op (DEM stays DEM on the second pass).
--
-- Tables affected (5 total — every model with a `discipline` column):
--   1. scope_of_works_items    (String  NOT NULL)
--   2. scope_waste_items       (String  NOT NULL)
--   3. scope_view_configs      (String  NOT NULL, with @@unique(tender_id, discipline))
--   4. claim_line_items        (String? NULL)
--   5. gantt_tasks             (String? NULL)
--
-- Investigation step before writing this migration confirmed zero existing
-- (tender_id) tuples in scope_view_configs that have BOTH 'SO' and 'Str'
-- rows, so the bulk UPDATE WHERE discipline IN ('SO','Str') -> 'DEM' on
-- scope_view_configs cannot violate the unique constraint. If that ever
-- changes, prepend a deduplicate-by-deletion block ("SO wins") before the
-- UPDATE on scope_view_configs.

-- ────────────────────────────────────────────────────────────────────────
-- scope_of_works_items
UPDATE "scope_of_works_items" SET discipline = 'DEM'   WHERE discipline IN ('SO', 'Str');
UPDATE "scope_of_works_items" SET discipline = 'ASB'   WHERE discipline = 'Asb';
UPDATE "scope_of_works_items" SET discipline = 'CIV'   WHERE discipline = 'Civ';
UPDATE "scope_of_works_items" SET discipline = 'Other' WHERE discipline = 'Prv';

-- ────────────────────────────────────────────────────────────────────────
-- scope_waste_items
UPDATE "scope_waste_items" SET discipline = 'DEM'   WHERE discipline IN ('SO', 'Str');
UPDATE "scope_waste_items" SET discipline = 'ASB'   WHERE discipline = 'Asb';
UPDATE "scope_waste_items" SET discipline = 'CIV'   WHERE discipline = 'Civ';
UPDATE "scope_waste_items" SET discipline = 'Other' WHERE discipline = 'Prv';

-- ────────────────────────────────────────────────────────────────────────
-- scope_view_configs (has @@unique(tender_id, discipline) — see header note)
UPDATE "scope_view_configs" SET discipline = 'DEM'   WHERE discipline IN ('SO', 'Str');
UPDATE "scope_view_configs" SET discipline = 'ASB'   WHERE discipline = 'Asb';
UPDATE "scope_view_configs" SET discipline = 'CIV'   WHERE discipline = 'Civ';
UPDATE "scope_view_configs" SET discipline = 'Other' WHERE discipline = 'Prv';

-- ────────────────────────────────────────────────────────────────────────
-- claim_line_items (nullable discipline)
UPDATE "claim_line_items" SET discipline = 'DEM'   WHERE discipline IN ('SO', 'Str');
UPDATE "claim_line_items" SET discipline = 'ASB'   WHERE discipline = 'Asb';
UPDATE "claim_line_items" SET discipline = 'CIV'   WHERE discipline = 'Civ';
UPDATE "claim_line_items" SET discipline = 'Other' WHERE discipline = 'Prv';

-- ────────────────────────────────────────────────────────────────────────
-- gantt_tasks (nullable discipline)
UPDATE "gantt_tasks" SET discipline = 'DEM'   WHERE discipline IN ('SO', 'Str');
UPDATE "gantt_tasks" SET discipline = 'ASB'   WHERE discipline = 'Asb';
UPDATE "gantt_tasks" SET discipline = 'CIV'   WHERE discipline = 'Civ';
UPDATE "gantt_tasks" SET discipline = 'Other' WHERE discipline = 'Prv';
