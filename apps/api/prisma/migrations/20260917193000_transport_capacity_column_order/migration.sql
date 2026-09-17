-- Migration: transport_capacity_column_order
-- Rewrites sort_order on the four columns of the rt-tc (transport-capacity) rate table
-- so that Transport type is the outer group (sort_order 1) and Material class is inner
-- (sort_order 2), and so that Capacity (m³) shows before Capacity (tonnes) (3 and 4).
-- Decision: docs/pr-prompts/BACKLOG-DECISIONS.md §D (Marco, 2026-08-20).
-- This migration is idempotent: it guards on the current sort_order values before
-- updating, so a re-run when rows are already at the target order updates 0 rows (no-op).
-- Matching is on (rate_table_id, name), not on literal column ids, for consistency with
-- the rest of this cluster (slice 1 uses the same rule for UI-created rows).

DO $$ DECLARE
  rows_updated INTEGER;
BEGIN
  UPDATE rate_columns
  SET sort_order = CASE name
    WHEN 'Transport type'    THEN 1
    WHEN 'Material class'    THEN 2
    WHEN 'Capacity (m³)'     THEN 3
    WHEN 'Capacity (tonnes)' THEN 4
  END
  WHERE rate_table_id = 'rt-tc'
    AND name IN ('Material class', 'Transport type', 'Capacity (m³)', 'Capacity (tonnes)')
    AND (
      (name = 'Transport type'    AND sort_order = 2) OR
      (name = 'Material class'    AND sort_order = 1) OR
      (name = 'Capacity (m³)'     AND sort_order = 4) OR
      (name = 'Capacity (tonnes)' AND sort_order = 3)
    );

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  IF rows_updated NOT IN (0, 4) THEN
    RAISE EXCEPTION
      'transport_capacity_column_order: expected 0 (re-run) or 4 rows updated, got %. '
      'The seeding migration may have drifted — aborting to avoid a partial reorder.',
      rows_updated;
  END IF;
END $$;
