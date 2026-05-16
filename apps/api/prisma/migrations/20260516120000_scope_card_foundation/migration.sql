-- PR A2 (2026-05-16) — ScopeCard schema foundation
-- Adds scope_cards table + card_id FK on three child tables.
-- Then backfills: one card per (tender_id, discipline) pair, with all
-- existing items in that discipline linked to it.
-- Idempotent: re-running is safe (uses IF NOT EXISTS / WHERE NOT EXISTS).

-- 1. Create the scope_cards table
CREATE TABLE IF NOT EXISTS scope_cards (
  id              TEXT      PRIMARY KEY,
  tender_id       TEXT      NOT NULL,
  name            TEXT      NOT NULL,
  discipline      TEXT      NOT NULL,
  sort_order      INTEGER   NOT NULL DEFAULT 0,
  created_by_id   TEXT      NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT scope_cards_tender_id_fkey
    FOREIGN KEY (tender_id) REFERENCES tenders(id) ON DELETE CASCADE,
  CONSTRAINT scope_cards_created_by_id_fkey
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS scope_cards_tender_id_sort_order_idx
  ON scope_cards(tender_id, sort_order);

-- 2. Add card_id column to scope_of_works_items
ALTER TABLE scope_of_works_items
  ADD COLUMN IF NOT EXISTS card_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scope_of_works_items_card_id_fkey'
  ) THEN
    ALTER TABLE scope_of_works_items
      ADD CONSTRAINT scope_of_works_items_card_id_fkey
      FOREIGN KEY (card_id) REFERENCES scope_cards(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS scope_of_works_items_card_id_idx
  ON scope_of_works_items(card_id);

-- 3. Add card_id column to scope_waste_items
ALTER TABLE scope_waste_items
  ADD COLUMN IF NOT EXISTS card_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scope_waste_items_card_id_fkey'
  ) THEN
    ALTER TABLE scope_waste_items
      ADD CONSTRAINT scope_waste_items_card_id_fkey
      FOREIGN KEY (card_id) REFERENCES scope_cards(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS scope_waste_items_card_id_idx
  ON scope_waste_items(card_id);

-- 4. Add card_id column to cutting_sheet_items
ALTER TABLE cutting_sheet_items
  ADD COLUMN IF NOT EXISTS card_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cutting_sheet_items_card_id_fkey'
  ) THEN
    ALTER TABLE cutting_sheet_items
      ADD CONSTRAINT cutting_sheet_items_card_id_fkey
      FOREIGN KEY (card_id) REFERENCES scope_cards(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS cutting_sheet_items_card_id_idx
  ON cutting_sheet_items(card_id);

-- 5. Backfill — create one card per (tender_id, discipline) pair found in
--    scope_of_works_items. Card name uses the discipline's friendly label.
--    The created_by_id is sourced from the earliest scope item's creator
--    (best-effort attribution). Deterministic UUID via md5() so re-running
--    is idempotent.
INSERT INTO scope_cards (id, tender_id, name, discipline, sort_order, created_by_id, created_at, updated_at)
SELECT
  CONCAT(
    SUBSTR(MD5(s.tender_id || ':' || s.discipline), 1, 8), '-',
    SUBSTR(MD5(s.tender_id || ':' || s.discipline), 9, 4), '-',
    SUBSTR(MD5(s.tender_id || ':' || s.discipline), 13, 4), '-',
    SUBSTR(MD5(s.tender_id || ':' || s.discipline), 17, 4), '-',
    SUBSTR(MD5(s.tender_id || ':' || s.discipline), 21, 12)
  ) AS id,
  s.tender_id,
  CASE s.discipline
    WHEN 'DEM'   THEN 'Demolition'
    WHEN 'CIV'   THEN 'Civil works'
    WHEN 'ASB'   THEN 'Asbestos removal'
    WHEN 'Other' THEN 'Other'
    ELSE s.discipline
  END AS name,
  s.discipline,
  CASE s.discipline
    WHEN 'DEM'   THEN 0
    WHEN 'CIV'   THEN 1
    WHEN 'ASB'   THEN 2
    WHEN 'Other' THEN 3
    ELSE 99
  END AS sort_order,
  (SELECT created_by_id FROM scope_of_works_items s2
   WHERE s2.tender_id = s.tender_id AND s2.discipline = s.discipline
   ORDER BY created_at ASC LIMIT 1) AS created_by_id,
  NOW() AS created_at,
  NOW() AS updated_at
FROM (
  SELECT DISTINCT tender_id, discipline
  FROM scope_of_works_items
) s
WHERE NOT EXISTS (
  SELECT 1 FROM scope_cards sc
  WHERE sc.tender_id = s.tender_id AND sc.discipline = s.discipline
);

-- 6. Backfill scope_of_works_items.card_id
UPDATE scope_of_works_items soi
SET card_id = sc.id
FROM scope_cards sc
WHERE sc.tender_id = soi.tender_id
  AND sc.discipline = soi.discipline
  AND soi.card_id IS NULL;

-- 7. Backfill scope_waste_items.card_id (match on tender_id + discipline).
UPDATE scope_waste_items swi
SET card_id = sc.id
FROM scope_cards sc
WHERE sc.tender_id = swi.tender_id
  AND sc.discipline = swi.discipline
  AND swi.card_id IS NULL;

-- 8. Backfill cutting_sheet_items.card_id via the parent scope item lookup
--    (cutting items reference a scope item by wbs_ref; the parent's card_id
--    is the one to inherit).
UPDATE cutting_sheet_items csi
SET card_id = soi.card_id
FROM scope_of_works_items soi
WHERE soi.tender_id = csi.tender_id
  AND soi.wbs_code = csi.wbs_ref
  AND csi.card_id IS NULL
  AND soi.card_id IS NOT NULL;
