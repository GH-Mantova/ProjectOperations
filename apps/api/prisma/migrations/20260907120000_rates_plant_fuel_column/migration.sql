-- PLANT_FUEL_COLUMN_V1 — give the plant rate table a second VALUE column,
-- "Fuel rate", and backfill a fuel cell into every existing plant rate_row.
--
-- Why: the plant RateTable projection has ONE VALUE column ("Rate"), but plant
-- is priced on two figures. `lookupPlant` returns `fuelRateAud`
-- (lookup-rate.handler.ts) and `tendering.persona.ts` instructs the model to
-- report it because "the hire rate alone understates the all-in plant cost".
-- Without this column the figure disappears the moment RATES_CANONICAL_SOURCE
-- flips to `ratetable`. Marco ruled on 2026-09-07: add it as a second VALUE
-- column, shaped like the `waste` table's existing "Rate per tonne" /
-- "Rate per load" pair (two VALUE columns, different units, one table).
--
-- Why a migration and not just the seed: deploy.yml runs `prisma migrate
-- deploy` and NEVER runs the TypeScript seed (CP-23; same reasoning written
-- into 20260713140000_seed_baseline_rate_tables,
-- 20260804120000_grant_field_worker_expenses and
-- 20260906120000_rates_value_columns_require_unit). A seed-only change never
-- reaches production. `seed-initial-services.ts` is updated in the same PR so
-- a freshly seeded developer database and production agree.
--
-- KEYED ON (rate_tables.slug, rate_columns.name), NOT on the literal column id
-- 'rt-plt-c-fuel'. The seed's column upsert matches on the unique
-- (rate_table_id, name) and stamps the literal id only in its `create` branch,
-- so a rate_columns row created by any other path -- the admin UI's
-- createColumn, most obviously -- carries a cuid under that same name. An
-- id-keyed migration would silently insert a duplicate or update nothing, exit
-- 0, and leave the fuel figure invisible behind a green deploy. That is a
-- mistake this repo made once and corrected in
-- 20260906120000_rates_value_columns_require_unit; not remaking it.
--
-- The same reasoning applies to the CELL KEY. `RateRow.cells` is keyed by
-- column id (`upsertTable` in seed-initial-services.ts: "Cells key by *column
-- id*"), and the reader tolerates both id and name. So the cell key written
-- below is whatever id the resolved column actually has -- read back after the
-- upsert -- never the hard-coded 'rt-plt-c-fuel'. Likewise the Item cell is
-- read through the resolved id of the column NAMED 'Item'.
--
-- UNIT. 'day', the same unit the "Rate" column carries (set by
-- 20260906120000). `EstimatePlantRate.fuelRate` is billed on the same basis as
-- the hire rate -- estimates.dto.ts:51, "Unit defaults to 'day' and fuelRate
-- to 0 when omitted server-side", and `lookupPlant` returns `fuelRateAud` with
-- no unit of its own, i.e. implicitly the row's hire-rate unit. Two seeded
-- plant rows carry the INFO Unit 'each way' rather than 'day'; that pre-exists
-- on the "Rate" column and is not introduced here. A VALUE column with a null
-- or blank unit would block EVERY column add and edit on the table
-- (RateValidationService.assertStructure runs over the merged column set), so
-- a unit is mandatory, not cosmetic.
--
-- VALUES. Each row's fuel cell is taken from the matching EstimatePlantRate
-- (by item, matched case-insensitively and trimmed, the same way `lookupPlant`
-- matches) and DEFAULTS TO 0 when there is no match. 0 is correct, not a
-- guess: `estimate_plant_rates.fuel_rate` is `NOT NULL DEFAULT 0` and
-- estimates.service.ts writes `dto.fuelRate ?? "0"`, so the legacy path can
-- never report anything but a number for a plant item, and reports 0 for one
-- with no fuel cost recorded. Writing 0 is what keeps the two paths in
-- agreement at cutover. Note that NO migration has ever inserted into
-- `estimate_plant_rates` (checked across all 244 migration.sql files) -- the
-- rt-plt rate_rows were written from hard-coded literals by
-- 20260713140000_seed_baseline_rate_tables -- so on a production database that
-- has never run the TypeScript seed the LEFT JOIN may match nothing at all and
-- every cell will be 0. That is the correct outcome, and it is reported as a
-- NOTICE rather than assumed.
--
-- ADDITIVE AND IDEMPOTENT. The column INSERT is ON CONFLICT DO NOTHING on
-- (rate_table_id, name); the cell UPDATE is guarded on the key being absent
-- under BOTH the column id and the column name (the reader accepts either
-- keying, so a row already carrying "Fuel rate" is left alone rather than
-- given a second, competing key). Nothing existing is altered and no row is
-- deleted, with one deliberate exception documented at its check below: a
-- pre-existing "Fuel rate" VALUE column with a null/blank unit is repaired to
-- 'day', because that state breaks every column operation on the table and is
-- exactly what 20260906120000 exists to prevent.
--
-- Reverse (documented; run manually if rolling back):
--   UPDATE "rate_rows" r SET cells = r.cells - c.id, updated_at = NOW()
--   FROM "rate_columns" c JOIN "rate_tables" t ON t.id = c.rate_table_id
--   WHERE r.rate_table_id = t.id AND t.slug = 'plant' AND c.name = 'Fuel rate';
--   DELETE FROM "rate_columns" c USING "rate_tables" t
--   WHERE c.rate_table_id = t.id AND t.slug = 'plant' AND c.name = 'Fuel rate';
-- Safe to leave applied: a column nothing reads is inert, and the resolver
-- change reverts with the code.

DO $$
DECLARE
  v_table_id    TEXT;
  v_fuel_col_id TEXT;
  v_fuel_role   TEXT;
  v_fuel_unit   TEXT;
  v_item_col_id TEXT;
  v_rows        INTEGER;
  v_updated     INTEGER;
  v_matched     INTEGER;
  v_nonzero     INTEGER;
  v_remaining   INTEGER;
BEGIN
  -- ── 1. The plant rate table ──────────────────────────────────────────
  SELECT id INTO v_table_id FROM "rate_tables" WHERE slug = 'plant';

  IF v_table_id IS NULL THEN
    RAISE EXCEPTION
      'rates_plant_fuel_column: no rate_tables row with slug = ''plant''. 20260713140000_seed_baseline_rate_tables creates it, so its absence means the slug this migration is written against no longer holds and the migration would silently do nothing. Refusing to report success.';
  END IF;

  -- ── 2. The "Fuel rate" VALUE column, keyed on (rate_table_id, name) ──
  INSERT INTO "rate_columns"
    (id, rate_table_id, name, data_type, role, unit, required, sort_order, created_at, updated_at)
  VALUES
    (v_table_id || '-c-fuel', v_table_id, 'Fuel rate', 'CURRENCY', 'VALUE', 'day', false, 5, NOW(), NOW())
  ON CONFLICT (rate_table_id, name) DO NOTHING;

  -- Read the id BACK rather than assuming the one just offered: on a database
  -- where the admin UI already created a column of this name, ON CONFLICT DO
  -- NOTHING kept theirs and its id is a cuid.
  SELECT id, role::TEXT, unit
    INTO v_fuel_col_id, v_fuel_role, v_fuel_unit
  FROM "rate_columns"
  WHERE rate_table_id = v_table_id AND name = 'Fuel rate';

  IF v_fuel_col_id IS NULL THEN
    RAISE EXCEPTION
      'rates_plant_fuel_column: the "Fuel rate" column is absent from rate table % immediately after an INSERT ... ON CONFLICT DO NOTHING. The (rate_table_id, name) unique key this migration depends on is not behaving as expected.', v_table_id;
  END IF;

  -- A pre-existing column of this name in the wrong ROLE cannot be silently
  -- adopted: RateResolverService looks the fuel figure up among VALUE columns,
  -- so an INFO or KEY column named "Fuel rate" would leave every row reporting
  -- fuelRate = null behind a green deploy. Not altered here -- changing a role
  -- an operator chose is a data decision, not a migration's call -- so this is
  -- raised for a human instead.
  IF v_fuel_role <> 'VALUE' THEN
    RAISE EXCEPTION
      'rates_plant_fuel_column: rate table % already has a column named "Fuel rate" with role % (expected VALUE). PLANT_FUEL_COLUMN_V1 requires a VALUE column; refusing to alter an existing column or to report success without one.', v_table_id, v_fuel_role;
  END IF;

  -- The one deliberate repair. A VALUE column with a null or blank unit makes
  -- RateValidationService.assertStructure throw over the MERGED column set,
  -- which blocks every column add and every column edit on the whole table --
  -- the exact breakage 20260906120000_rates_value_columns_require_unit was
  -- written to clear. btrim(), not `= ''`, because assertStructure rejects on
  -- `!v.unit.trim()`.
  IF v_fuel_unit IS NULL OR btrim(v_fuel_unit) = '' THEN
    UPDATE "rate_columns" SET unit = 'day', updated_at = NOW() WHERE id = v_fuel_col_id;
    RAISE NOTICE
      'rates_plant_fuel_column: pre-existing "Fuel rate" column % had a null/blank unit; set to ''day'' so column operations on the plant table are not blocked.', v_fuel_col_id;
  ELSIF v_fuel_unit <> 'day' THEN
    -- Not an error: the unit is per-column metadata, ListedRate.unit comes
    -- from the FIRST value column, and an operator may have had a reason.
    RAISE WARNING
      'rates_plant_fuel_column: pre-existing "Fuel rate" column % carries unit % rather than ''day''. Left as-is; PLANT_FUEL_COLUMN_V1 assumes the fuel rate is billed on the same basis as the hire rate.', v_fuel_col_id, v_fuel_unit;
  END IF;

  -- ── 3. The Item KEY column, used to correlate rows to EstimatePlantRate ─
  SELECT id INTO v_item_col_id
  FROM "rate_columns"
  WHERE rate_table_id = v_table_id AND name = 'Item';

  SELECT count(*) INTO v_rows FROM "rate_rows" WHERE rate_table_id = v_table_id;

  IF v_rows = 0 THEN
    -- A WARNING, not an EXCEPTION: deleteRow is a supported admin operation,
    -- an empty plant table is a legitimate (if unlikely) state, and the
    -- column -- the part production actually needs -- has already been
    -- created. There is simply nothing to backfill.
    RAISE WARNING
      'rates_plant_fuel_column: rate table % has no rate_rows, so no fuel cells were backfilled. The "Fuel rate" column exists; any row added later gets its cell from the admin UI or the seed.', v_table_id;
  END IF;

  IF v_item_col_id IS NULL AND v_rows > 0 THEN
    -- Without the Item column the rows cannot be correlated to
    -- EstimatePlantRate at all. Writing 0 everywhere is harmless only if
    -- there is no real fuel figure to lose.
    SELECT count(*) INTO v_nonzero FROM "estimate_plant_rates" WHERE fuel_rate <> 0;
    IF v_nonzero > 0 THEN
      RAISE EXCEPTION
        'rates_plant_fuel_column: rate table % has no column named "Item", so its rows cannot be correlated to estimate_plant_rates, and % plant rate(s) carry a non-zero fuel_rate that would be silently replaced by 0. Refusing to write fabricated values.', v_table_id, v_nonzero;
    END IF;
    RAISE WARNING
      'rates_plant_fuel_column: rate table % has no column named "Item"; rows cannot be correlated to estimate_plant_rates. No plant rate carries a non-zero fuel_rate, so every cell is written as 0 -- the same value the legacy path reports for those items.', v_table_id;
  END IF;

  -- ── 4. Backfill the fuel cell ────────────────────────────────────────
  -- Guarded on the key being absent under BOTH the column id and the column
  -- name: RateResolverService reads `cells[col.id] ?? cells[col.name]`, so a
  -- row already carrying either keying already has a fuel figure and must not
  -- be given a second, competing one. Re-running this migration therefore
  -- updates 0 rows and still passes.
  --
  -- The value comes from a scalar sub-select rather than a join so a
  -- pathological pair of estimate_plant_rates rows differing only in case
  -- (item is UNIQUE on the exact string) cannot multiply the update; an exact
  -- match is preferred over a case-insensitive one.
  UPDATE "rate_rows" r
  SET cells = r.cells || jsonb_build_object(
        v_fuel_col_id,
        to_jsonb(
          COALESCE(
            (
              SELECT p.fuel_rate
              FROM "estimate_plant_rates" p
              WHERE v_item_col_id IS NOT NULL
                AND lower(btrim(p.item)) = lower(btrim(r.cells ->> v_item_col_id))
              ORDER BY (p.item = (r.cells ->> v_item_col_id)) DESC, p.item ASC
              LIMIT 1
            ),
            0::numeric(10, 2)
          )
        )
      ),
      updated_at = NOW()
  WHERE r.rate_table_id = v_table_id
    AND NOT (r.cells ? v_fuel_col_id)
    AND NOT (r.cells ? 'Fuel rate');
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- How many of the table's rows actually correlate to a legacy plant rate.
  -- Reported, never asserted: on a production database that has never run the
  -- TypeScript seed this is legitimately 0 (no migration has ever inserted
  -- into estimate_plant_rates) and every cell is a correct 0.
  SELECT count(*) INTO v_matched
  FROM "rate_rows" r
  WHERE r.rate_table_id = v_table_id
    AND v_item_col_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM "estimate_plant_rates" p
      WHERE lower(btrim(p.item)) = lower(btrim(r.cells ->> v_item_col_id))
    );

  -- ── 5. Post-conditions ───────────────────────────────────────────────
  SELECT count(*) INTO v_remaining
  FROM "rate_rows" r
  WHERE r.rate_table_id = v_table_id
    AND NOT (r.cells ? v_fuel_col_id)
    AND NOT (r.cells ? 'Fuel rate');

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION
      'rates_plant_fuel_column: % plant rate_row(s) still carry no fuel cell after the backfill. Those rows would report fuelRate = null and the persona would lose the figure for them.', v_remaining;
  END IF;

  RAISE NOTICE
    'rates_plant_fuel_column: column % ("Fuel rate", VALUE, unit day) present on rate table %; % of % row(s) backfilled, % row(s) matched an estimate_plant_rates item, none left without a fuel cell.',
    v_fuel_col_id, v_table_id, v_updated, v_rows, v_matched;
END $$;
