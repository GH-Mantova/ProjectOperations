-- Provisional sum amount on ScopeOfWorksItem. Applies to discipline=Prv
-- only; final price = provisional_amount exactly (no markup, no cost
-- line-items). Ignored for other disciplines.

ALTER TABLE "scope_of_works_items" ADD COLUMN "provisional_amount" DECIMAL(12,2);
