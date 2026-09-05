-- SCOPE_OPERATIONAL_COSTS_V1 -- other operational costs on a scope card.
--
-- ADDITIVE ONLY. One NEW table ("scope_operational_cost_lines"), its two
-- foreign keys and its two indexes, and nothing else. NO existing table
-- gains, loses, renames or retypes a column. There is no UPDATE, no INSERT,
-- no DELETE and no backfill anywhere in this file -- not one existing row is
-- read or rewritten by it.
--
-- Nothing reads the new table yet. No pricing path, card subtotal or
-- discipline roll-up joins to it, so no tender price can move: the set of
-- rows every existing query sees is byte-identical before and after.
--
-- The line total is deliberately NOT stored. It is qty x (rate_override ??
-- rate); a stored copy would be a second source of truth that drifts.
--
-- Rollback:
--   DROP TABLE "scope_operational_cost_lines";
-- Reverting the code alone leaves an empty, unreferenced table behind,
-- which is inert.

-- 1. The table. Column types mirror the sibling card-child
--    ("scope_waste_items"): TEXT cuid id, snake_case names, DECIMAL money
--    and quantity columns at the precision the sibling already uses --
--    qty DECIMAL(10, 3) from "scope_waste_items"."qty", rate and
--    rate_override DECIMAL(10, 2) from "scope_waste_items"."rate_per_tonne"
--    and "estimate_plant_rates"."rate", days DECIMAL(8, 2) from the
--    "scope_of_works_items" plant-day columns.
CREATE TABLE "scope_operational_cost_lines" (
    "id"             TEXT NOT NULL,
    "card_id"        TEXT NOT NULL,
    "description"    TEXT NOT NULL,
    "qty"            DECIMAL(10, 3),
    "unit"           TEXT,
    "days"           DECIMAL(8, 2),
    "rate"           DECIMAL(10, 2),
    "rate_override"  DECIMAL(10, 2),
    "plant_rate_id"  TEXT,
    "sort_order"     INTEGER NOT NULL DEFAULT 0,
    "created_by_id"  TEXT NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scope_operational_cost_lines_pkey" PRIMARY KEY ("id")
);

-- 2. Indexes. Listing is always "the lines on this card, in order", so one
--    composite index covers it; the FK column gets its own.
CREATE INDEX "scope_operational_cost_lines_card_id_sort_order_idx"
    ON "scope_operational_cost_lines"("card_id", "sort_order");

CREATE INDEX "scope_operational_cost_lines_plant_rate_id_idx"
    ON "scope_operational_cost_lines"("plant_rate_id");

-- 3. Foreign keys.
--    card_id       CASCADE  -- deleting a scope card removes its cost lines,
--                              matching "scope_waste_items"."card_id".
--    plant_rate_id SET NULL -- removing a rate-library row leaves the cost
--                              line intact with an empty picker, matching
--                              "scope_waste_items"."transport_rate_id".
--    created_by_id RESTRICT -- matching every other card-child.
ALTER TABLE "scope_operational_cost_lines"
    ADD CONSTRAINT "scope_operational_cost_lines_card_id_fkey"
    FOREIGN KEY ("card_id") REFERENCES "scope_cards"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scope_operational_cost_lines"
    ADD CONSTRAINT "scope_operational_cost_lines_plant_rate_id_fkey"
    FOREIGN KEY ("plant_rate_id") REFERENCES "estimate_plant_rates"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "scope_operational_cost_lines"
    ADD CONSTRAINT "scope_operational_cost_lines_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
