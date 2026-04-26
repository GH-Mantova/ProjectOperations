-- PR B FIX 2: per-section visibility flags on a client quote.
-- showProvisional and showCostOptions already exist; this fills out the
-- remaining sections so each block of the PDF can be toggled independently.
ALTER TABLE "client_quotes"
  ADD COLUMN "show_scope_table" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "show_assumptions" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "show_exclusions" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "show_referenced_drawings" BOOLEAN NOT NULL DEFAULT true;
