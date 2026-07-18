-- Migration: 20260717120000_feat_expenses_slice1
-- D365-parity Tier 1 — expense capture + approval spine.
-- Additive only: no existing tables modified.

-- Expense status enum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REIMBURSED');

-- Year-keyed sequence for EXP-YYYY-NNN numbering
CREATE TABLE "expense_number_sequences" (
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "expense_number_sequences_pkey" PRIMARY KEY ("year")
);

-- Expense table
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "project_id" TEXT,
    "job_id" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "spent_on" DATE NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "gst" DECIMAL(10,2),
    "payment_method" TEXT,
    "receipt_document_id" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on number
CREATE UNIQUE INDEX "expenses_number_key" ON "expenses"("number");

-- Indexes
CREATE INDEX "expenses_submitted_by_id_idx" ON "expenses"("submitted_by_id");
CREATE INDEX "expenses_status_idx" ON "expenses"("status");
CREATE INDEX "expenses_project_id_idx" ON "expenses"("project_id");
CREATE INDEX "expenses_job_id_idx" ON "expenses"("job_id");

-- Foreign keys
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_submitted_by_id_fkey"
    FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_document_id_fkey"
    FOREIGN KEY ("receipt_document_id") REFERENCES "document_links"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
