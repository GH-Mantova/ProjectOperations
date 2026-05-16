-- PR B1.7 — shared subtable notes on ScopeCard.
-- Pure additive; both columns are NULLABLE so no backfill is needed.
-- Existing rows in scope_cards keep NULL and the UI treats null/"" the same.

ALTER TABLE "scope_cards" ADD COLUMN IF NOT EXISTS "cutting_notes" TEXT;
ALTER TABLE "scope_cards" ADD COLUMN IF NOT EXISTS "waste_notes"   TEXT;
