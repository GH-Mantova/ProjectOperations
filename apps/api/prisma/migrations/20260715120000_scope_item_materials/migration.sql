-- PR feat/scope-multi-material — additional material rows on ScopeOfWorksItem.
-- Row 1 remains stored on the flat materialType + length/height/depth/density/
-- sqm/m3/tonnes columns; rows 2..N live in this new nullable JSON column as
-- an array of { material, length, height, depth, density, sqm, m3, tonnes }.
-- Additive nullable column — existing rows read back materials=NULL and the
-- UI treats that as "no extra materials", identical to prior behaviour.
ALTER TABLE "scope_of_works_items" ADD COLUMN "materials" JSONB;
