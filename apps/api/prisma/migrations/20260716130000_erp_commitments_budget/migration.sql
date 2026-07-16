-- ERP gap A: Commitment (subcontract / PO) cost tracking against job budget.
--
-- Adds CommitmentType, CommitmentStatus, CommitmentChangeStatus enums plus
-- Commitment, CommitmentItem, and CommitmentChange tables. A Commitment is
-- budget-facing (tracks committed spend against a Job) and is distinct from
-- ProcurementRequest (an internal purchase-requisition workflow). The two
-- are linked optionally via purchase_order_id.
--
-- Back-relations added to: jobs.commitments, subcontractor_suppliers.commitments,
-- users.commitmentsCreated / commitmentChangesCreated / commitmentChangesApproved.

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommitmentType') THEN
    CREATE TYPE "CommitmentType" AS ENUM (
      'SUBCONTRACT',
      'PURCHASE_ORDER',
      'HIRE',
      'OTHER'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommitmentStatus') THEN
    CREATE TYPE "CommitmentStatus" AS ENUM (
      'DRAFT',
      'APPROVED',
      'CLOSED',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommitmentChangeStatus') THEN
    CREATE TYPE "CommitmentChangeStatus" AS ENUM (
      'DRAFT',
      'PENDING',
      'APPROVED',
      'REJECTED'
    );
  END IF;
END $$;

-- ── commitments ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "commitments" (
  "id"               TEXT          NOT NULL,
  "job_id"           TEXT          NOT NULL,
  "type"             "CommitmentType" NOT NULL,
  "supplier_id"      TEXT,
  "reference"        TEXT          NOT NULL,
  "description"      TEXT          NOT NULL,
  "value"            DECIMAL(14,2) NOT NULL,
  "status"           "CommitmentStatus" NOT NULL DEFAULT 'DRAFT',
  "purchase_order_id" TEXT,
  "created_by_id"    TEXT          NOT NULL,
  "created_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "commitments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "commitments_purchase_order_id_key"
  ON "commitments" ("purchase_order_id");

CREATE INDEX IF NOT EXISTS "commitments_job_id_status_idx"
  ON "commitments" ("job_id", "status");

CREATE INDEX IF NOT EXISTS "commitments_supplier_id_idx"
  ON "commitments" ("supplier_id");

ALTER TABLE "commitments"
  ADD CONSTRAINT "commitments_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commitments"
  ADD CONSTRAINT "commitments_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "subcontractor_suppliers" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commitments"
  ADD CONSTRAINT "commitments_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── commitment_items ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "commitment_items" (
  "id"              TEXT          NOT NULL,
  "commitment_id"   TEXT          NOT NULL,
  "description"     TEXT          NOT NULL,
  "cost_category"   TEXT,
  "quantity"        DECIMAL(14,4) NOT NULL DEFAULT 1,
  "unit"            TEXT          NOT NULL DEFAULT 'lump',
  "rate"            DECIMAL(14,2),
  "amount"          DECIMAL(14,2) NOT NULL,
  "created_at"      TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "commitment_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "commitment_items_commitment_id_idx"
  ON "commitment_items" ("commitment_id");

ALTER TABLE "commitment_items"
  ADD CONSTRAINT "commitment_items_commitment_id_fkey"
    FOREIGN KEY ("commitment_id") REFERENCES "commitments" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ── commitment_changes ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "commitment_changes" (
  "id"              TEXT                   NOT NULL,
  "commitment_id"   TEXT                   NOT NULL,
  "reference"       TEXT                   NOT NULL,
  "description"     TEXT                   NOT NULL,
  "value_change"    DECIMAL(14,2)          NOT NULL,
  "status"          "CommitmentChangeStatus" NOT NULL DEFAULT 'DRAFT',
  "approved_by_id"  TEXT,
  "created_by_id"   TEXT                   NOT NULL,
  "created_at"      TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3)           NOT NULL,

  CONSTRAINT "commitment_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "commitment_changes_commitment_id_status_idx"
  ON "commitment_changes" ("commitment_id", "status");

ALTER TABLE "commitment_changes"
  ADD CONSTRAINT "commitment_changes_commitment_id_fkey"
    FOREIGN KEY ("commitment_id") REFERENCES "commitments" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commitment_changes"
  ADD CONSTRAINT "commitment_changes_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commitment_changes"
  ADD CONSTRAINT "commitment_changes_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
