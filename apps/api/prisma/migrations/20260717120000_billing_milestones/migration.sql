-- Billing rigor (D365-parity Tier 3): milestones + pro-forma marker.
-- Milestones sit ALONGSIDE the existing progress-claim flow; the flow
-- itself is untouched. Pro-forma claims are DRAFTs flagged with the
-- new is_pro_forma column so the UI can render them as previews and the
-- Xero push can ignore them.

-- ── 1. Milestone enums ────────────────────────────────────────────────
CREATE TYPE "BillingMilestoneTrigger" AS ENUM ('DATE', 'PERCENT_COMPLETE', 'EVENT');
CREATE TYPE "BillingMilestoneAmountType" AS ENUM ('FIXED', 'PERCENT_OF_CONTRACT');
CREATE TYPE "BillingMilestoneStatus" AS ENUM ('PENDING', 'DUE', 'CLAIMED');

-- ── 2. BillingMilestone table ─────────────────────────────────────────
CREATE TABLE "billing_milestones" (
  "id"              TEXT NOT NULL,
  "contract_id"     TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "description"     TEXT,
  "trigger_type"    "BillingMilestoneTrigger" NOT NULL,
  "trigger_date"    TIMESTAMP(3),
  "trigger_percent" DECIMAL(5, 2),
  "trigger_event"   TEXT,
  "amount_type"     "BillingMilestoneAmountType" NOT NULL,
  "amount"          DECIMAL(12, 2),
  "amount_percent"  DECIMAL(5, 2),
  "status"          "BillingMilestoneStatus" NOT NULL DEFAULT 'PENDING',
  "claim_id"        TEXT,
  "sort_order"      INTEGER NOT NULL DEFAULT 0,
  "created_by_id"   TEXT NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_milestones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "billing_milestones_contract_id_status_idx"
  ON "billing_milestones"("contract_id", "status");

ALTER TABLE "billing_milestones"
  ADD CONSTRAINT "billing_milestones_contract_id_fkey"
  FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "billing_milestones"
  ADD CONSTRAINT "billing_milestones_claim_id_fkey"
  FOREIGN KEY ("claim_id") REFERENCES "progress_claims"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "billing_milestones"
  ADD CONSTRAINT "billing_milestones_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3. Pro-forma flag on progress_claims ──────────────────────────────
ALTER TABLE "progress_claims"
  ADD COLUMN "is_pro_forma" BOOLEAN NOT NULL DEFAULT false;
