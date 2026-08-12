-- CRM S1: Fold Lead into Opportunity; add DropReason lookup table.
-- See: docs/plans/crm-leads-collapse-plan.md §SLICE 1
--
-- IMPORTANT: Take a full database backup before applying this migration.
-- The `leads` table is dropped at the end of this migration; it is not
-- recoverable without a restore. Use `prisma migrate resolve --rolled-back`
-- to reset migration state if the migration is aborted mid-flight.
--
-- Execution order:
--   1. Create drop_reasons lookup table.
--   2. Add new columns to opportunities.
--   3. (enum values open / not_pursued / archived are added by the prior
--       migration 20260812139000_opportunitystage_add_values; only USED here).
--   4. Copy leads rows into opportunities.
--   5. Remap existing Opportunity stages to unified stage set.
--   6. Carry lostReason text into dropReasonDetail.
--   7. Drop lost_reason column.
--   8. Drop leads table.
--   converted_tender_id is never touched.

-- Step 1: Create drop_reasons lookup table
CREATE TABLE "drop_reasons" (
    "id"         TEXT NOT NULL,
    "label"      TEXT NOT NULL,
    "is_active"  BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drop_reasons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "drop_reasons_label_key" ON "drop_reasons"("label");

-- Step 2: Add new columns to opportunities
ALTER TABLE "opportunities"
    ADD COLUMN "is_lead"            BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "drop_reason_id"     TEXT,
    ADD COLUMN "drop_reason_detail" TEXT,
    ADD COLUMN "notes"              TEXT;

ALTER TABLE "opportunities"
    ADD CONSTRAINT "opportunities_drop_reason_id_fkey"
    FOREIGN KEY ("drop_reason_id") REFERENCES "drop_reasons"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 3: OpportunityStage enum values (open / not_pursued / archived) are
-- added by the prior migration 20260812139000_opportunitystage_add_values.
-- Postgres forbids referencing a new enum value in the same transaction that
-- adds it, so they are committed there before being USED below.

-- Step 4: Copy leads rows into opportunities.
-- Leads have free-text company/contact fields that Opportunity does not; those
-- are dropped (the linked clientId/contactId carry the structured data).
-- clientId is required on Opportunity (NOT NULL) — only copy leads that have
-- a clientId; leads without a client are skipped (they were never qualifiable).
INSERT INTO "opportunities" (
    "id", "title", "stage", "source", "is_lead",
    "client_id", "contact_id", "owner_id", "notes",
    "next_action_at", "next_action_note", "created_at", "updated_at"
)
SELECT
    l."id",
    l."title",
    'open'::"OpportunityStage",
    l."source",
    true,
    l."client_id",
    l."contact_id",
    l."owner_id",
    l."notes",
    l."next_action_at",
    l."next_action_note",
    l."created_at",
    l."updated_at"
FROM "leads" l
WHERE l."client_id" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

-- Step 5: Remap existing Opportunity stages to unified stage set.
UPDATE "opportunities" SET "stage" = 'open'        WHERE "stage" IN ('new', 'qualified', 'quoting');
UPDATE "opportunities" SET "stage" = 'not_pursued'  WHERE "stage" = 'lost';
UPDATE "opportunities" SET "stage" = 'archived'     WHERE "stage" = 'won';

-- Step 6: Carry lostReason text into dropReasonDetail.
UPDATE "opportunities"
SET "drop_reason_detail" = "lost_reason"
WHERE "lost_reason" IS NOT NULL;

-- Step 7: Drop lost_reason column from opportunities.
ALTER TABLE "opportunities" DROP COLUMN "lost_reason";

-- Step 8: Drop the leads table (and its indexes/constraints implicitly).
DROP TABLE "leads";
