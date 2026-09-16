-- SCOPE_QUOTE_DESTINATION_V1 (scopecards-s2a) -- UPDATE-only backfill.
-- Runs on scope_of_works_items only. Every statement is guarded by
-- AND quote_destination = 'PRICE' so a re-run moves nothing twice (idempotent).
-- Waste, cutting and operational-cost rows need no backfill: they were all
-- priced into the total as PRICE and that is the column default.
--
-- Statement 1: the is_provisional flag becomes PROVISIONAL.
UPDATE "scope_of_works_items"
   SET "quote_destination" = 'PROVISIONAL'
 WHERE "is_provisional" = true
   AND "quote_destination" = 'PRICE';

-- Statement 2: the Other discipline OR-rule becomes data.
-- An item on a card whose discipline is 'Other' was always provisional by
-- the server rule; writing PROVISIONAL here means the code can stop carrying
-- the "Other" special-case after SCOPE_QUOTE_DESTINATION_V1 is on main.
UPDATE "scope_of_works_items" i
   SET "quote_destination" = 'PROVISIONAL'
  FROM "scope_cards" c
 WHERE c."id" = i."card_id"
   AND c."discipline" = 'Other'
   AND i."quote_destination" = 'PRICE';

-- Statement 3: Rule A (linked items zeroed by pricedBySubItemId) becomes INTERNAL.
-- A covered item contributed $0 to its bucket via Rule A; writing INTERNAL
-- means the same money stays out of the tender price so pre-migration tenders
-- read identically to the cent. Without this, every linked tender's price
-- would rise on merge because Rule A is removed in the service layer.
UPDATE "scope_of_works_items"
   SET "quote_destination" = 'INTERNAL'
 WHERE "priced_by_sub_item_id" IS NOT NULL
   AND "quote_destination" = 'PRICE';
