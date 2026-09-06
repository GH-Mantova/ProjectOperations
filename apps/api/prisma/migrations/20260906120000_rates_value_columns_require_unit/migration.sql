-- Data migration: give the three unit-less seeded VALUE columns a unit ('day').
--
-- Why: RateValidationService.assertStructure throws
--   VALUE column "<name>" requires a unit (e.g. hr, m, tonne).
-- for any VALUE column whose unit is null or blank, and both
-- RateTablesService.createColumn and .updateColumn run it over the MERGED
-- column set. So one unit-less column blocks EVERY column add and EVERY
-- column edit on that table, not just an edit of the offending column.
-- Three seeded tables ship in that state: plant / fuel / enclosure, each with
-- a CURRENCY VALUE column named 'Rate' and no unit. They were written by
-- 20260713140000_seed_baseline_rate_tables (plant/fuel/enclosure) and
-- re-asserted by 20260813120000_slice-11a-enclosure-otherrates-densities
-- (enclosure), both with unit = NULL. `labour`, the closest analogue, uses
-- unit = 'day' on all three of its VALUE columns; plant rows carry the literal
-- "day" in their own INFO Unit cell; fuel and enclosure are likewise per-day.
--
-- Why a migration and not just the seed: deploy.yml runs `prisma migrate
-- deploy` and NEVER runs the TypeScript seed (CP-23; same reasoning written
-- into 20260713140000_seed_baseline_rate_tables and
-- 20260804120000_grant_field_worker_expenses). A seed-only change never
-- reaches production.
--
-- KEYED ON (rate_tables.slug, rate_columns.name, rate_columns.role), NOT on
-- the literal column ids 'rt-plt-c-rate' / 'rt-fl-c-rate' / 'rt-en-c-rate'.
-- The seed's column upsert matches on the unique (rate_table_id, name) and
-- stamps the literal id only in its `create` branch, so a rate_columns row
-- created by any other path -- the admin UI's createColumn, most obviously --
-- carries a cuid under that same name. A migration keyed on the literal id
-- would silently update nothing, exit 0, and leave the table's column
-- operations broken behind a green deploy.
--
-- The INFO 'Unit' column on these tables is untouched: it is per-row free
-- text, the VALUE column's `unit` is per-column metadata, and both are wanted.
--
-- Idempotent: the UPDATE is guarded on (unit IS NULL OR btrim(unit) = ''), so
-- a second application changes nothing and still passes. btrim() rather than
-- the bare `= ''` comparison because assertStructure rejects on
-- `!v.unit.trim()`, i.e. a whitespace-only unit is just as broken as a blank
-- one and must also be repaired.
--
-- Loud on a wrong assumption, quiet on an already-correct database. The
-- checks are deliberately NOT "rows updated > 0": an operator can already fix
-- these three columns through the admin UI (editing the offending column to
-- add a unit makes the merged set valid, so that one edit is permitted), and
-- a production database where all three were fixed by hand must not take the
-- deploy down. What is asserted instead:
--   * at least one target column must exist -- zero means the (slug, name,
--     role) key is wrong and this migration is a no-op that only LOOKS
--     applied. That is the failure worth a red deploy.
--   * after the UPDATE, no target column may still have a null/blank unit.
--   * fewer than three targets is a WARNING, not an error: deleteColumn is a
--     supported admin operation, so a legitimately deleted column must not
--     block `prisma migrate deploy`.
--
-- Reverse (documented; run manually if rolling back):
--   UPDATE "rate_columns" c SET unit = NULL, updated_at = NOW()
--   FROM "rate_tables" t
--   WHERE c.rate_table_id = t.id
--     AND t.slug IN ('plant', 'fuel', 'enclosure')
--     AND c.name = 'Rate'
--     AND c.role = 'VALUE';
-- Nothing reads the value (it is validation metadata only), so leaving it
-- applied is harmless.

DO $$
DECLARE
  v_targets   INTEGER;
  v_updated   INTEGER;
  v_remaining INTEGER;
BEGIN
  SELECT count(*) INTO v_targets
  FROM "rate_columns" c
  JOIN "rate_tables" t ON t.id = c.rate_table_id
  WHERE t.slug IN ('plant', 'fuel', 'enclosure')
    AND c.name = 'Rate'
    AND c.role = 'VALUE';

  IF v_targets = 0 THEN
    RAISE EXCEPTION
      'rates_value_columns_require_unit: found no VALUE column named "Rate" in any of the plant/fuel/enclosure rate tables. The (slug, name, role) key this migration is written against no longer holds, so it would silently update nothing. Refusing to report success.';
  END IF;

  IF v_targets < 3 THEN
    RAISE WARNING
      'rates_value_columns_require_unit: expected 3 target columns (plant, fuel, enclosure), found %. Proceeding on the ones that exist.', v_targets;
  END IF;

  UPDATE "rate_columns" c
  SET unit = 'day', updated_at = NOW()
  FROM "rate_tables" t
  WHERE c.rate_table_id = t.id
    AND t.slug IN ('plant', 'fuel', 'enclosure')
    AND c.name = 'Rate'
    AND c.role = 'VALUE'
    AND (c.unit IS NULL OR btrim(c.unit) = '');
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT count(*) INTO v_remaining
  FROM "rate_columns" c
  JOIN "rate_tables" t ON t.id = c.rate_table_id
  WHERE t.slug IN ('plant', 'fuel', 'enclosure')
    AND c.name = 'Rate'
    AND c.role = 'VALUE'
    AND (c.unit IS NULL OR btrim(c.unit) = '');

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION
      'rates_value_columns_require_unit: % target column(s) still have a null or blank unit after the update. Column operations on that table would stay blocked.', v_remaining;
  END IF;

  RAISE NOTICE
    'rates_value_columns_require_unit: % of % target column(s) set to unit = ''day''; none left unit-less.', v_updated, v_targets;
END $$;
