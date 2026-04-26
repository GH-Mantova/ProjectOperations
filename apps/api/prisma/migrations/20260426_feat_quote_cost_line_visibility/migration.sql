-- PR B FIX 1: per-cost-line visibility toggle on the quote PDF.
-- Hidden lines stay in the editor but are filtered out when the PDF is built.
ALTER TABLE "quote_cost_lines"
  ADD COLUMN "is_visible" BOOLEAN NOT NULL DEFAULT true;
