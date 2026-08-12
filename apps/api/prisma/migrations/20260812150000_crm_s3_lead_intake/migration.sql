-- CRM-3: Lead front door — multi-source capture + Account linkage.
-- Additive only. Nullable columns + new enum; safe to leave on main
-- even if the code lands later. No destructive changes.
--
-- Changes:
--   1. Enum: LeadCaptureChannel (email | phone | portal | referral | cold_outreach | other)
--   2. opportunities.capture_channel  LeadCaptureChannel? (nullable)
--   3. opportunities.capture_detail   TEXT?               (nullable)
--   4. opportunities.account_id       TEXT?  FK → accounts(id) SET NULL (nullable)
--   5. Index: opportunities(account_id)
--
-- Rollback:
--   ALTER TABLE "opportunities" DROP COLUMN "account_id";
--   ALTER TABLE "opportunities" DROP COLUMN "capture_detail";
--   ALTER TABLE "opportunities" DROP COLUMN "capture_channel";
--   DROP TYPE "LeadCaptureChannel";

-- 1. Enum
CREATE TYPE "LeadCaptureChannel" AS ENUM (
  'email',
  'phone',
  'portal',
  'referral',
  'cold_outreach',
  'other'
);

-- 2. capture_channel column (nullable — existing rows get NULL)
ALTER TABLE "opportunities"
  ADD COLUMN "capture_channel" "LeadCaptureChannel";

-- 3. capture_detail column (nullable free-text)
ALTER TABLE "opportunities"
  ADD COLUMN "capture_detail" TEXT;

-- 4. account_id FK → accounts
ALTER TABLE "opportunities"
  ADD COLUMN "account_id" TEXT;

ALTER TABLE "opportunities"
  ADD CONSTRAINT "opportunities_account_id_fkey"
  FOREIGN KEY ("account_id")
  REFERENCES "accounts"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 5. Index for efficient account → opportunities look-ups
CREATE INDEX "opportunities_account_id_idx" ON "opportunities"("account_id");
