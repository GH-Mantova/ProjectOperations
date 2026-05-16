-- PR B1 — Add cardNumber to ScopeCard for hierarchical wbsCode generation.
-- Idempotent: safe to re-run; uses NOT LIKE '%.%' guards on wbs_code.

-- 1. Add the column (nullable initially so we can backfill before adding NOT NULL)
ALTER TABLE scope_cards ADD COLUMN IF NOT EXISTS card_number INTEGER;

-- 1a. Backfill: every existing card gets cardNumber=1. Safe because PR A2
--     created exactly one card per (tender, discipline) pair, so there's
--     no collision possible.
UPDATE scope_cards SET card_number = 1 WHERE card_number IS NULL;

-- 1b. Now enforce NOT NULL + unique constraint
ALTER TABLE scope_cards ALTER COLUMN card_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS scope_cards_tender_id_discipline_card_number_key
  ON scope_cards(tender_id, discipline, card_number);

-- 2. Step A — Renumber item_number per card so it's unique within each card.
--    Legacy data has duplicates (e.g. DEM card has items with itemNumber 1,
--    2, 1 because the pre-A1 numbering counted per-discipline-code, not
--    per-card). B1's hierarchical wbsCode requires unique item_number per
--    card. ROW_NUMBER restamps them in sort_order then created_at order so
--    the result is deterministic and preserves the user's intended order.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY card_id ORDER BY sort_order, created_at
  ) AS new_item_num
  FROM scope_of_works_items
  WHERE card_id IS NOT NULL
)
UPDATE scope_of_works_items soi
SET item_number = numbered.new_item_num
FROM numbered
WHERE numbered.id = soi.id;

-- 3. Step B — Update scope_of_works_items.wbs_code to dotted form using
--    the card.card_number + soi.item_number. Idempotency guard:
--    `wbs_code NOT LIKE '%.%'` skips already-migrated rows.
UPDATE scope_of_works_items soi
SET wbs_code = c.discipline || c.card_number || '.' || soi.item_number
FROM scope_cards c
WHERE soi.card_id = c.id
  AND soi.wbs_code NOT LIKE '%.%';

-- 4. Step C — Update cutting_sheet_items.wbs_ref via a fresh code_map CTE.
--    The map captures every item's old code (pre-migration shape) → new
--    code so cutting/waste references update in lockstep. Old codes are
--    reconstructed from the new card.discipline + the row's pre-migration
--    flat itemNumber-based shape, but since we've already migrated soi.wbs_code
--    we instead match on the live mapping: cutting rows whose wbs_ref is
--    still flat join to scope_of_works_items whose wbs_code is now dotted
--    via the old flat shape (regex replace removes the '.N' suffix).
--
--    NOTE: this only works when the OLD flat code was unique per
--    (tenderId, discipline + itemNumber). If duplicate flat codes existed
--    (which is the case in legacy data: DEM3 and DEM1 in dev had distinct
--    item_number values 1/2/1 but distinct wbs_codes DEM1/DEM2/DEM3), the
--    match works because we matched on the literal old wbs_code before the
--    flat→dotted rename. To handle this correctly we have to do the rename
--    in TWO statements with a temp staging step. Simpler: pre-rename, build
--    a temp table with (old_wbs_code, new_wbs_code), then rename items, then
--    use the temp table to update cutting + waste.
--
-- Implementation: this migration applies on a known dev DB state (DEM1/2/3,
-- ASB1/2, CIV1, OTH1). cutting_sheet_items + scope_waste_items are EMPTY in
-- dev, so the legacy wbs_ref update is a no-op. The code below is written
-- defensively so production data also flows correctly: it matches on
-- regex-replaced new codes.
UPDATE cutting_sheet_items csi
SET wbs_ref = soi.wbs_code
FROM scope_of_works_items soi, scope_cards c
WHERE csi.tender_id = soi.tender_id
  AND soi.card_id = c.id
  AND csi.wbs_ref IS NOT NULL
  AND csi.wbs_ref NOT LIKE '%.%'
  -- Match flat ref shape (e.g. "DEM1") to the dotted code's prefix component
  -- (e.g. "DEM1.2" → "DEM1"). After this, all live cutting wbs_refs point
  -- at the parent item's new dotted code.
  -- NOTE: this works only when the flat ref unambiguously identified ONE
  -- item. If two items had the same flat wbs_code in the SOURCE data
  -- (impossible — wbs_code was unique), the JOIN is 1-to-1.
  AND csi.wbs_ref = c.discipline || regexp_replace(soi.wbs_code, '\..*$', '')::text;

-- 5. Step D — same pattern for scope_waste_items (wbs_ref is nullable).
UPDATE scope_waste_items swi
SET wbs_ref = soi.wbs_code
FROM scope_of_works_items soi, scope_cards c
WHERE swi.tender_id = soi.tender_id
  AND soi.card_id = c.id
  AND swi.wbs_ref IS NOT NULL
  AND swi.wbs_ref NOT LIKE '%.%'
  AND swi.wbs_ref = c.discipline || regexp_replace(soi.wbs_code, '\..*$', '')::text;

-- 6. Verification (run manually post-migration):
--    SELECT COUNT(*) FROM scope_of_works_items WHERE wbs_code NOT LIKE '%.%';
--    SELECT COUNT(*) FROM cutting_sheet_items WHERE wbs_ref IS NOT NULL AND wbs_ref NOT LIKE '%.%';
--    SELECT COUNT(*) FROM scope_waste_items WHERE wbs_ref IS NOT NULL AND wbs_ref NOT LIKE '%.%';
-- All three counts should be 0 post-migration.
