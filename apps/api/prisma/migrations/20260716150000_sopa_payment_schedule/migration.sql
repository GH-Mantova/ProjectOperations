-- AU Security of Payment Act — payment-schedule response on progress claims.
-- Missing this response can make the FULL claimed amount payable, so a
-- first-class record with a stored, statutory dueBy is required (not
-- computed on read — a later change to sopa_response_days must not
-- retro-mutate the window on an already-issued schedule).

-- ── 1. OperationsSettings — configurable statutory window ───────────
-- Nullable; NULL falls back to SOPA_DEFAULT_RESPONSE_DAYS in the service.
ALTER TABLE "operations_settings"
  ADD COLUMN IF NOT EXISTS "sopa_response_days" INTEGER;

-- ── 2. PaymentSchedule row (1:1 with ProgressClaim) ─────────────────
CREATE TYPE "PaymentScheduleStatus" AS ENUM ('PENDING', 'ISSUED', 'OVERDUE');

CREATE TABLE "payment_schedules" (
  "id"                 TEXT NOT NULL,
  "progress_claim_id"  TEXT NOT NULL,
  "scheduled_amount"   DECIMAL(12, 2) NOT NULL,
  "reasons"            TEXT,
  "status"             "PaymentScheduleStatus" NOT NULL DEFAULT 'PENDING',
  "due_by"             TIMESTAMP(3) NOT NULL,
  "responded_at"       TIMESTAMP(3),
  "created_by_id"      TEXT NOT NULL,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_schedules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_schedules_progress_claim_id_key"
  ON "payment_schedules"("progress_claim_id");

ALTER TABLE "payment_schedules"
  ADD CONSTRAINT "payment_schedules_progress_claim_id_fkey"
  FOREIGN KEY ("progress_claim_id") REFERENCES "progress_claims"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_schedules"
  ADD CONSTRAINT "payment_schedules_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
