-- F-8: add usage-based maintenance interval columns to asset_maintenance_plans.
-- All new columns are nullable or have a safe default (usage_warning_pct = 90)
-- so existing plans are unaffected.

ALTER TABLE "asset_maintenance_plans"
  ADD COLUMN "interval_usage"        DECIMAL(12,1),
  ADD COLUMN "usage_unit"            TEXT,
  ADD COLUMN "last_completed_reading" DECIMAL(12,1),
  ADD COLUMN "next_due_reading"      DECIMAL(12,1),
  ADD COLUMN "usage_warning_pct"     INTEGER NOT NULL DEFAULT 90;
