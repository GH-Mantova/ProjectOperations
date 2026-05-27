-- AlterTable — add cost-line appropriation fields to quote_cost_lines
ALTER TABLE "quote_cost_lines" ADD COLUMN "base_value" DECIMAL(14, 2) NOT NULL DEFAULT 0;
ALTER TABLE "quote_cost_lines" ADD COLUMN "override_amount" DECIMAL(14, 2);

-- Backfill: set base_value = price for existing rows
UPDATE "quote_cost_lines" SET "base_value" = "price" WHERE "base_value" = 0 AND "price" != 0;
