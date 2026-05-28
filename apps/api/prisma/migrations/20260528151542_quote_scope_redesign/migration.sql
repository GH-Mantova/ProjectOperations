-- AlterTable: add quoteDiscipline to quote_scope_items
ALTER TABLE "quote_scope_items" ADD COLUMN "quote_discipline" TEXT;

-- AlterTable: add displayDescription to quote_cost_lines
ALTER TABLE "quote_cost_lines" ADD COLUMN "display_description" TEXT;
