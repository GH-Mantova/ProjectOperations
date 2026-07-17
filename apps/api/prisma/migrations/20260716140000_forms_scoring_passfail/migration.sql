-- Migration: 20260716140000_forms_scoring_passfail
-- Forms engine — inspection scoring + pass/fail response sets (this PR).
-- Adds computed score / outcome columns to form_submissions. Response sets
-- and per-field scoreConfig are stored in the existing config JSON columns
-- (FormField.config + FormTemplate.settings) and need no schema change.

ALTER TABLE "form_submissions"
  ADD COLUMN "score"     DECIMAL(10, 2),
  ADD COLUMN "max_score" DECIMAL(10, 2),
  ADD COLUMN "score_pct" DECIMAL(5, 2),
  ADD COLUMN "outcome"   TEXT;

CREATE INDEX "form_submissions_outcome_idx" ON "form_submissions"("outcome");
