-- PLANT_DAYS_RETIRED_V1 — drop the five legacy plant-days columns from
-- "scope_of_works_items".
--
-- IRREVERSIBLE. A git revert of this PR restores the five columns EMPTY.
-- Whatever they held is gone permanently. This ships in the same PR as
-- the code retirement on Marco's explicit instruction (2026-09-05, given
-- twice), having been told that retiring the code is revertible and
-- dropping the columns is not.
--
-- SAFE BECAUSE THE GATE PASSED. Immediately before this migration was
-- written, against the dev database:
--
--   SELECT count(*) FILTER (WHERE excavator_days   IS NOT NULL) AS excavator,
--          count(*) FILTER (WHERE bobcat_days      IS NOT NULL) AS bobcat,
--          count(*) FILTER (WHERE ewp_days         IS NOT NULL) AS ewp,
--          count(*) FILTER (WHERE hook_truck_days  IS NOT NULL) AS hook_truck,
--          count(*) FILTER (WHERE semi_tipper_days IS NOT NULL) AS semi_tipper
--   FROM scope_of_works_items;
--
--   total 23 rows -> excavator 0, bobcat 0, ewp 0, hook_truck 0, semi_tipper 0.
--
-- Every one of the five columns is NULL in every row, so no estimate
-- plant line could be derived from them and no tender price changes.
--
-- BLAST RADIUS: exactly five DROP COLUMN statements on one table. No
-- UPDATE, no data movement, no backfill, no other DDL, no other column.

ALTER TABLE "scope_of_works_items" DROP COLUMN IF EXISTS "excavator_days";
ALTER TABLE "scope_of_works_items" DROP COLUMN IF EXISTS "bobcat_days";
ALTER TABLE "scope_of_works_items" DROP COLUMN IF EXISTS "ewp_days";
ALTER TABLE "scope_of_works_items" DROP COLUMN IF EXISTS "hook_truck_days";
ALTER TABLE "scope_of_works_items" DROP COLUMN IF EXISTS "semi_tipper_days";
