-- SCOPE_QUOTE_DESTINATION_V1 (scopecards-s2a) -- DDL only: enum + four columns + one index.
-- Additive; no existing data is modified. The companion backfill migration derives
-- values from is_provisional, scope_cards.discipline, and priced_by_sub_item_id.

-- CreateEnum
CREATE TYPE "QuoteDestination" AS ENUM ('PRICE', 'PROVISIONAL', 'OPTION', 'INTERNAL');

-- AlterTable: scope_of_works_items
ALTER TABLE "scope_of_works_items" ADD COLUMN "quote_destination" "QuoteDestination" NOT NULL DEFAULT 'PRICE';

-- AlterTable: scope_waste_items
ALTER TABLE "scope_waste_items" ADD COLUMN "quote_destination" "QuoteDestination" NOT NULL DEFAULT 'PRICE';

-- AlterTable: cutting_sheet_items
ALTER TABLE "cutting_sheet_items" ADD COLUMN "quote_destination" "QuoteDestination" NOT NULL DEFAULT 'PRICE';

-- AlterTable: scope_operational_cost_lines
ALTER TABLE "scope_operational_cost_lines" ADD COLUMN "quote_destination" "QuoteDestination" NOT NULL DEFAULT 'PRICE';

-- CreateIndex: summary query filters scope_of_works_items by (tenderId, quoteDestination)
CREATE INDEX "scope_of_works_items_tender_id_quote_destination_idx" ON "scope_of_works_items"("tender_id", "quote_destination");
