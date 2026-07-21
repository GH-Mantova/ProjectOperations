-- CRM slice 1 — Lead + Opportunity models.
-- Lightweight sales pipeline that sits BEFORE a Tender. A Lead is early,
-- untriaged interest; an Opportunity is a qualified pipeline record with a
-- stage, probability, and estimated value. Firming up converts the
-- Opportunity into a Tender via convertedTenderId (no data re-keying).

-- Enums
CREATE TYPE "LeadStatus" AS ENUM ('new', 'contacted', 'qualified', 'disqualified', 'converted');
CREATE TYPE "OpportunityStage" AS ENUM ('new', 'qualified', 'quoting', 'won', 'lost');
CREATE TYPE "OpportunitySource" AS ENUM ('referral', 'direct', 'tender_portal', 'cold', 'repeat_client', 'other');

-- Opportunities table (created first because leads.converted_opportunity_id references it)
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'new',
    "probability" INTEGER NOT NULL DEFAULT 20,
    "estimated_value" DECIMAL(14,2),
    "source" "OpportunitySource" NOT NULL DEFAULT 'other',
    "client_id" TEXT NOT NULL,
    "contact_id" TEXT,
    "owner_id" TEXT,
    "expected_close_date" TIMESTAMP(3),
    "next_action_at" TIMESTAMP(3),
    "next_action_note" TEXT,
    "won_at" TIMESTAMP(3),
    "lost_at" TIMESTAMP(3),
    "lost_reason" TEXT,
    "converted_tender_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- Leads table
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "source" "OpportunitySource" NOT NULL DEFAULT 'other',
    "company_name" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "client_id" TEXT,
    "contact_id" TEXT,
    "owner_id" TEXT,
    "notes" TEXT,
    "next_action_at" TIMESTAMP(3),
    "next_action_note" TEXT,
    "converted_opportunity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- Unique constraints (1:1 back-links)
CREATE UNIQUE INDEX "opportunities_converted_tender_id_key" ON "opportunities"("converted_tender_id");
CREATE UNIQUE INDEX "leads_converted_opportunity_id_key" ON "leads"("converted_opportunity_id");

-- Indexes for opportunities
CREATE INDEX "opportunities_stage_idx" ON "opportunities"("stage");
CREATE INDEX "opportunities_owner_id_idx" ON "opportunities"("owner_id");
CREATE INDEX "opportunities_client_id_idx" ON "opportunities"("client_id");
CREATE INDEX "opportunities_expected_close_date_idx" ON "opportunities"("expected_close_date");
CREATE INDEX "opportunities_next_action_at_idx" ON "opportunities"("next_action_at");

-- Indexes for leads
CREATE INDEX "leads_status_idx" ON "leads"("status");
CREATE INDEX "leads_owner_id_idx" ON "leads"("owner_id");
CREATE INDEX "leads_client_id_idx" ON "leads"("client_id");
CREATE INDEX "leads_next_action_at_idx" ON "leads"("next_action_at");

-- Foreign keys for opportunities
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_converted_tender_id_fkey" FOREIGN KEY ("converted_tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for leads
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_opportunity_id_fkey" FOREIGN KEY ("converted_opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
