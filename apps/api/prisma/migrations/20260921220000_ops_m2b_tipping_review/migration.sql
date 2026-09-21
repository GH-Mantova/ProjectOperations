-- Migration: ops_m2b_tipping_review
-- Adds price-review tracking to map_locations (TIP rows only),
-- tender_id to tip_recommendation_logs, and inserts the
-- waste.price_review_due notification trigger row if absent.
-- All columns are additive and nullable; no existing data is rewritten.
-- Existing TipRecommendationLog rows keep tender_id = NULL
-- (tender-stage tips were never recorded before this change).

-- 1. map_locations: add prices_reviewed_at and prices_review_notified_at
ALTER TABLE "map_locations"
  ADD COLUMN IF NOT EXISTS "prices_reviewed_at"          TIMESTAMP(3) NULL,
  ADD COLUMN IF NOT EXISTS "prices_review_notified_at"   TIMESTAMP(3) NULL;

-- 2. tip_recommendation_logs: add tender_id with FK + index
ALTER TABLE "tip_recommendation_logs"
  ADD COLUMN IF NOT EXISTS "tender_id" TEXT NULL;

ALTER TABLE "tip_recommendation_logs"
  ADD CONSTRAINT "tip_recommendation_logs_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id")
  ON DELETE SET NULL
  NOT VALID;

CREATE INDEX IF NOT EXISTS "tip_recommendation_logs_tender_id_idx"
  ON "tip_recommendation_logs"("tender_id");

-- 3. Insert waste.price_review_due trigger row if absent.
-- ON CONFLICT DO NOTHING guarantees idempotency; re-running never overwrites
-- an admin's isEnabled / recipient edits.
INSERT INTO "notification_trigger_configs"
  ("id", "trigger", "label", "description", "is_enabled", "delivery_method",
   "recipient_roles", "recipient_user_ids", "created_at", "updated_at")
VALUES
  ('ntc-waste-price-review-due',
   'waste.price_review_due',
   'Tip price review due',
   'Daily digest: tip facilities whose prices have not been checked in the last six months.',
   TRUE,
   'both',
   ARRAY['Admin'],
   ARRAY[]::text[],
   NOW(),
   NOW())
ON CONFLICT ("trigger") DO NOTHING;
