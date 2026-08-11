-- F-3: repeating sections — per-value entry index.
-- Adds `entry_index` to form_submission_values so a single submission can
-- carry N entries' worth of values for a repeating FormSection. Additive and
-- non-null with a default of 0, so all existing rows keep their current
-- (implicit single-entry) semantics with no backfill required.

ALTER TABLE "form_submission_values" ADD COLUMN "entry_index" INTEGER NOT NULL DEFAULT 0;
