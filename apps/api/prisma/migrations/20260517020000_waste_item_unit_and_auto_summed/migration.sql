-- PR B3 — Waste summary subtable columns on ScopeWasteItem.
-- `unit` drives facility filtering (m²/m³/t/ea). `auto_summed` marks
-- rows created by "Sum from above" so they can be regenerated without
-- destroying manual user-added rows. Both columns are additive and
-- safe to add to existing tables; existing rows get NULL unit and
-- auto_summed=false (treated as manual rows).

ALTER TABLE "scope_waste_items" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "scope_waste_items" ADD COLUMN IF NOT EXISTS "auto_summed" BOOLEAN NOT NULL DEFAULT false;
