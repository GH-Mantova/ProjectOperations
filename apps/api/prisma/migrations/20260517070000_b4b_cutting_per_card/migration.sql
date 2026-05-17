-- PR B4b — per-card cutting subtable. Adds `auto_copied` flag to
-- CuttingSheetItem so the new "Copy from above" aggregator can
-- distinguish regenerable rows (autoCopied=true; replaced on each
-- regenerate) from manually-added rows (autoCopied=false; preserved).
-- Mirrors ScopeWasteItem.auto_summed from B3. Pure additive — existing
-- rows default to FALSE (manual).

ALTER TABLE "cutting_sheet_items"
  ADD COLUMN IF NOT EXISTS "auto_copied" BOOLEAN NOT NULL DEFAULT FALSE;
