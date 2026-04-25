-- Unified Contact model (PR #75)
-- Reshapes the existing `contacts` table in-place (keeps existing IDs so
-- TenderClient.contact_id FKs remain valid) and migrates rows from
-- `subcontractor_contacts`. Old `subcontractor_contacts` table is retained —
-- it will be dropped in a follow-up tech-debt PR.

-- ─── 1. Add new polymorphic columns to contacts ──────────────────────────
ALTER TABLE "contacts"
  ADD COLUMN "organisation_type"   TEXT,
  ADD COLUMN "organisation_id"     TEXT,
  ADD COLUMN "role"                TEXT,
  ADD COLUMN "is_accounts_contact" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "is_active"           BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN "created_by_id"       TEXT;

-- ─── 2. Backfill existing rows as CLIENT contacts ────────────────────────
UPDATE "contacts"
   SET "organisation_type" = 'CLIENT',
       "organisation_id"   = "client_id",
       "role"              = "position";

-- Enforce NOT NULL now that all rows are backfilled.
ALTER TABLE "contacts"
  ALTER COLUMN "organisation_type" SET NOT NULL,
  ALTER COLUMN "organisation_id"   SET NOT NULL;

-- ─── 3. Copy subcontractor_contacts into contacts ────────────────────────
INSERT INTO "contacts" (
  "id", "organisation_type", "organisation_id",
  "first_name", "last_name", "role",
  "email", "phone", "mobile",
  "is_primary", "has_portal_access", "is_active",
  "notes", "created_at", "updated_at"
)
SELECT
  "id", 'SUBCONTRACTOR', "subcontractor_id",
  "first_name", "last_name", "role",
  "email", "phone", "mobile",
  "is_primary", "has_portal_access", TRUE,
  "notes", "created_at", "updated_at"
FROM "subcontractor_contacts"
ON CONFLICT ("id") DO NOTHING;

-- ─── 4. Drop old client_id FK + columns on contacts ──────────────────────
ALTER TABLE "contacts" DROP CONSTRAINT IF EXISTS "contacts_client_id_fkey";
DROP INDEX IF EXISTS "contacts_client_id_idx";
ALTER TABLE "contacts"
  DROP COLUMN "client_id",
  DROP COLUMN "position";

-- ─── 5. Add FK from contacts.created_by_id → users.id ────────────────────
ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL;

-- ─── 6. New indexes on polymorphic columns ───────────────────────────────
CREATE INDEX "contacts_organisation_type_organisation_id_idx"
  ON "contacts" ("organisation_type", "organisation_id");
CREATE INDEX "contacts_email_idx"     ON "contacts" ("email");
CREATE INDEX "contacts_is_active_idx" ON "contacts" ("is_active");

-- ─── 7. Swap Client.claim_cutoff_contact_id → claim_reminder_user_id ─────
ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_claim_cutoff_contact_id_fkey";
ALTER TABLE "clients" DROP COLUMN "claim_cutoff_contact_id";

ALTER TABLE "clients"
  ADD COLUMN "claim_reminder_user_id" TEXT,
  ADD CONSTRAINT "clients_claim_reminder_user_id_fkey"
    FOREIGN KEY ("claim_reminder_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
