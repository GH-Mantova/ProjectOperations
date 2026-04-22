-- Contracts module — one Contract per Project plus Variations, ProgressClaims,
-- and ClaimLineItems. Adds isSuperUser to User, claim cut-off fields to Client.

ALTER TABLE "users" ADD COLUMN "is_super_user" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "clients" ADD COLUMN "claim_cutoff_day" INTEGER;
ALTER TABLE "clients" ADD COLUMN "claim_cutoff_contact_id" TEXT;
ALTER TABLE "clients"
  ADD CONSTRAINT "clients_claim_cutoff_contact_id_fkey"
  FOREIGN KEY ("claim_cutoff_contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'PRACTICAL_COMPLETION', 'DEFECTS', 'CLOSED');
CREATE TYPE "VariationStatus" AS ENUM ('RECEIVED', 'PRICED', 'SUBMITTED', 'APPROVED');
CREATE TYPE "ClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID');

CREATE TABLE "contracts" (
  "id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "contract_number" TEXT NOT NULL,
  "contract_value" DECIMAL(12, 2) NOT NULL,
  "retention_pct" DECIMAL(5, 2) NOT NULL DEFAULT 0,
  "retention_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "contracts_project_id_key" ON "contracts"("project_id");
CREATE UNIQUE INDEX "contracts_contract_number_key" ON "contracts"("contract_number");
CREATE INDEX "contracts_status_idx" ON "contracts"("status");
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "variations" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "variation_number" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "VariationStatus" NOT NULL DEFAULT 'RECEIVED',
  "requested_by" TEXT,
  "priced_amount" DECIMAL(12, 2),
  "approved_amount" DECIMAL(12, 2),
  "received_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "priced_date" TIMESTAMP(3),
  "submitted_date" TIMESTAMP(3),
  "approved_date" TIMESTAMP(3),
  "notes" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "variations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "variations_variation_number_key" ON "variations"("variation_number");
CREATE INDEX "variations_contract_id_idx" ON "variations"("contract_id");
ALTER TABLE "variations" ADD CONSTRAINT "variations_contract_id_fkey"
  FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "variations" ADD CONSTRAINT "variations_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "progress_claims" (
  "id" TEXT NOT NULL,
  "contract_id" TEXT NOT NULL,
  "claim_number" TEXT NOT NULL,
  "claim_month" TIMESTAMP(3) NOT NULL,
  "submission_date" TIMESTAMP(3),
  "status" "ClaimStatus" NOT NULL DEFAULT 'DRAFT',
  "total_claimed" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "total_approved" DECIMAL(12, 2),
  "total_paid" DECIMAL(12, 2),
  "paid_date" TIMESTAMP(3),
  "retention_held" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "progress_claims_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "progress_claims_claim_number_key" ON "progress_claims"("claim_number");
CREATE UNIQUE INDEX "progress_claims_contract_id_claim_month_key"
  ON "progress_claims"("contract_id", "claim_month");
CREATE INDEX "progress_claims_contract_id_status_idx"
  ON "progress_claims"("contract_id", "status");
ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_contract_id_fkey"
  FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progress_claims" ADD CONSTRAINT "progress_claims_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "claim_line_items" (
  "id" TEXT NOT NULL,
  "claim_id" TEXT NOT NULL,
  "discipline" TEXT,
  "description" TEXT NOT NULL,
  "contract_value" DECIMAL(12, 2) NOT NULL,
  "previously_claimed" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "this_claim_pct" DECIMAL(5, 2),
  "this_claim_amount" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  "variation_id" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "claim_line_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "claim_line_items_claim_id_idx" ON "claim_line_items"("claim_id");
ALTER TABLE "claim_line_items" ADD CONSTRAINT "claim_line_items_claim_id_fkey"
  FOREIGN KEY ("claim_id") REFERENCES "progress_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "claim_line_items" ADD CONSTRAINT "claim_line_items_variation_id_fkey"
  FOREIGN KEY ("variation_id") REFERENCES "variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "contract_number_sequences" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "contract_number_sequences_pkey" PRIMARY KEY ("id")
);
INSERT INTO "contract_number_sequences" ("id","last_number") VALUES (1,0);

CREATE TABLE "variation_number_sequences" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "variation_number_sequences_pkey" PRIMARY KEY ("id")
);
INSERT INTO "variation_number_sequences" ("id","last_number") VALUES (1,0);

CREATE TABLE "claim_number_sequences" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "claim_number_sequences_pkey" PRIMARY KEY ("id")
);
INSERT INTO "claim_number_sequences" ("id","last_number") VALUES (1,0);
