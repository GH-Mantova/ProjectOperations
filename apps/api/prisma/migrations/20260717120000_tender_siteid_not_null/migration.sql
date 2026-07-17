-- Enforce siteId NOT NULL on Tender.
--
-- Rationale (Marco decision 2026-07-15): every tender is captured with a
-- physical site address at wizard time (Geoapify autocomplete, PR #641).
-- Reverses the earlier "Tender stays nullable" policy — the address is now
-- a required part of the tender record so subsequent Job/Project conversion,
-- forms, and reporting can rely on it existing.
--
-- Legacy rows (pre-2026-06-15) may not have a siteId. Rather than delete
-- them, we backfill to a single stable "Unassigned" Site so estimators can
-- reassign each one via the Sites picker after the fact. This is the same
-- Unassigned row the sibling job/project siteId-not-null migration will use.
--
-- Steps:
--   1. Insert-if-absent the Unassigned Site (stable id 'site-unassigned').
--   2. Backfill every Tender.site_id IS NULL → 'site-unassigned'.
--   3. Swap the FK ON DELETE rule from SET NULL → RESTRICT (SET NULL would
--      violate the new NOT NULL constraint if someone deletes a Site).
--   4. ALTER COLUMN site_id SET NOT NULL.
--
-- Idempotent: the INSERT is guarded by ON CONFLICT DO NOTHING against the
-- sites.name unique index, and the backfill only touches rows that are still
-- NULL. Safe to re-run.

-- ── 1. Ensure the "Unassigned" Site exists ─────────────────────────
INSERT INTO "sites" (
  "id",
  "name",
  "notes",
  "created_at",
  "updated_at"
)
VALUES (
  'site-unassigned',
  'Unassigned',
  'System-owned placeholder used to satisfy the NOT NULL siteId constraint on legacy Tender/Job/Project rows. Reassign to a real site via the Sites picker.',
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO NOTHING;

-- ── 2. Backfill NULL tender.site_id → Unassigned ───────────────────
UPDATE "tenders"
SET "site_id" = (SELECT "id" FROM "sites" WHERE "name" = 'Unassigned' LIMIT 1)
WHERE "site_id" IS NULL;

-- ── 3. Swap FK ON DELETE: SET NULL → RESTRICT ──────────────────────
-- With site_id NOT NULL the old SET NULL rule would fail on a site
-- delete. RESTRICT blocks the delete instead — the operator must
-- reassign or delete the tenders first.
ALTER TABLE "tenders"
  DROP CONSTRAINT "tenders_site_id_fkey";

ALTER TABLE "tenders"
  ADD CONSTRAINT "tenders_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. Enforce NOT NULL on site_id ─────────────────────────────────
-- If any tender still has a NULL site_id at this point (e.g. the
-- backfill above found no "Unassigned" row because someone renamed
-- it in prod), this statement fails and the whole migration rolls
-- back. That is the correct outcome — investigate the row before
-- proceeding.
ALTER TABLE "tenders"
  ALTER COLUMN "site_id" SET NOT NULL;
