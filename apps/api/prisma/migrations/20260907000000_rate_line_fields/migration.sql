-- feat(rates): add nullable line_fields column to rate_tables (RATE_LINE_FIELDS_V1)
--
-- Stores the values an estimator enters on the line — the operands a charge
-- step can name that are NOT stored in a rate-table column — as a JSONB array
-- of { name, kind: "number" | "text", unit?, options?, sample? }.
--
-- Additive, nullable, and it writes NO row data: every read is
-- `table.lineFields ?? []`, so the column is inert until a table declares one.
-- IF NOT EXISTS makes a re-run a no-op rather than an error.
--
-- Loud on a false assumption: this migration assumes the table "rate_tables"
-- exists (it has since the initial rates migration). If it does not, the guard
-- below aborts with a message that says so, instead of ALTER TABLE's bare
-- "relation does not exist".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'rate_tables'
  ) THEN
    RAISE EXCEPTION
      'RATE_LINE_FIELDS_V1: table "rate_tables" not found in schema %; refusing to add line_fields.',
      current_schema();
  END IF;
END
$$;

ALTER TABLE "rate_tables" ADD COLUMN IF NOT EXISTS "line_fields" JSONB;
