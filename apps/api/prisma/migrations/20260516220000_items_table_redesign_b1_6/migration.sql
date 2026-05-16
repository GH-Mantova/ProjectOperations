-- PR B1.6 — items table redesign per docs/Designs/scope-of-works-redesign.md
-- Pure additive: 4 new columns on scope_of_works_items + 1 on scope_cards.
-- No backfill needed; defaults handle existing rows.

ALTER TABLE scope_of_works_items
  ADD COLUMN IF NOT EXISTS unit TEXT;

ALTER TABLE scope_of_works_items
  ADD COLUMN IF NOT EXISTS value DECIMAL(12, 3);

ALTER TABLE scope_of_works_items
  ADD COLUMN IF NOT EXISTS waste_item TEXT;

ALTER TABLE scope_of_works_items
  ADD COLUMN IF NOT EXISTS waste_included BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE scope_cards
  ADD COLUMN IF NOT EXISTS plant_column_count INTEGER NOT NULL DEFAULT 1;
