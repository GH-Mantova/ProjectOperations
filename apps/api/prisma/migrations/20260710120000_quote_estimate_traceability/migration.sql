-- Additive traceability link from client quotes back to the internal tender
-- estimate: nullable FK on client_quotes and a nullable polymorphic pointer
-- on quote_cost_lines. No pricing/rollup logic changes here.

ALTER TABLE "client_quotes"
  ADD COLUMN IF NOT EXISTS "source_tender_estimate_id" TEXT;

CREATE INDEX IF NOT EXISTS "client_quotes_source_tender_estimate_id_idx"
  ON "client_quotes"("source_tender_estimate_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_quotes_source_tender_estimate_id_fkey'
  ) THEN
    ALTER TABLE "client_quotes"
      ADD CONSTRAINT "client_quotes_source_tender_estimate_id_fkey"
      FOREIGN KEY ("source_tender_estimate_id") REFERENCES "tender_estimates"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "quote_cost_lines"
  ADD COLUMN IF NOT EXISTS "source_estimate_line_type" TEXT,
  ADD COLUMN IF NOT EXISTS "source_estimate_line_id"   TEXT;

CREATE INDEX IF NOT EXISTS "quote_cost_lines_source_estimate_line_type_source_estimate_l_idx"
  ON "quote_cost_lines"("source_estimate_line_type", "source_estimate_line_id");
