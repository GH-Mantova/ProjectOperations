-- PR B-followup — orphan cleanup + cardId NOT NULL guards on per-card
-- subtables. Cutting had 2 known test orphans on IS-T020 (created
-- pre-B4b, before card-scoping shipped); delete them. Waste had 0
-- orphans at promotion time. Then enforce NOT NULL on both cardId
-- columns so the per-card structure is a DB-level invariant rather
-- than just convention.
--
-- The FK ON DELETE rule changes from SET NULL → CASCADE on both
-- tables: SET NULL would violate the new NOT NULL constraint when a
-- scope card is deleted. Cascade matches per-card-subtable semantics
-- (deleting the card removes its rows).

-- ── 1. Delete pre-B4b cutting orphans ──────────────────────────────
-- Filtered by created_at < B4b merge time (2026-05-17 07:30:39 UTC).
-- Defensive: any post-B4b orphan must NOT match this filter — if it
-- exists, the ALTER COLUMN below fails and the whole migration rolls
-- back, surfacing the unexpected row for investigation.
DELETE FROM "cutting_sheet_items"
WHERE "card_id" IS NULL
  AND "created_at" < TIMESTAMP WITH TIME ZONE '2026-05-17 07:30:00+00';

-- ── 2. Swap FK ON DELETE: SET NULL → CASCADE on cutting ────────────
ALTER TABLE "cutting_sheet_items"
  DROP CONSTRAINT "cutting_sheet_items_card_id_fkey";

ALTER TABLE "cutting_sheet_items"
  ADD CONSTRAINT "cutting_sheet_items_card_id_fkey"
  FOREIGN KEY ("card_id") REFERENCES "scope_cards"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. Swap FK ON DELETE: SET NULL → CASCADE on waste ──────────────
ALTER TABLE "scope_waste_items"
  DROP CONSTRAINT "scope_waste_items_card_id_fkey";

ALTER TABLE "scope_waste_items"
  ADD CONSTRAINT "scope_waste_items_card_id_fkey"
  FOREIGN KEY ("card_id") REFERENCES "scope_cards"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4. Enforce NOT NULL on both card_id columns ────────────────────
-- If any cardless row survives step 1, these statements fail. That's
-- the correct outcome — investigate before letting this proceed.
ALTER TABLE "cutting_sheet_items"
  ALTER COLUMN "card_id" SET NOT NULL;

ALTER TABLE "scope_waste_items"
  ALTER COLUMN "card_id" SET NOT NULL;

-- ────────────────────────────────────────────────────────────
-- LESSON (added 2026-05-18 via PR docs/discipline-codes-and-lessons-learned)
--
-- The date filter above uses 2026-05-17 07:30:00+00 as the
-- pre-B4b cutoff. B4b's actual merge was 2026-05-17 07:30:39 UTC
-- (merge SHA fe39e27). The 39-second slack is a defect: a
-- post-B4b orphan created in that window would be silently
-- deleted instead of blocking the migration via the NOT NULL
-- ALTER below, which was the whole point of the safety filter.
--
-- No data was harmed (dev had 2 orphans both from 2026-05-16;
-- CI shadow DB was empty). Migration is already applied and
-- not being retroactively edited.
--
-- If you're copying this migration as a template for another
-- date-bounded delete: use the exact merge timestamp of the
-- gating PR, never a rounded-down minute. Full write-up at
-- docs/lessons-learned/2026-05-17-migration-date-filter-precision.md
-- ────────────────────────────────────────────────────────────
