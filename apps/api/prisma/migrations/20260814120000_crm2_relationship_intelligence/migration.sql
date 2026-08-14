-- CRM-2: Relationship intelligence
-- Additive migration: adds accountId + lastContactedAt to contacts,
-- back-reference contacts[] on accounts, and new relationship_notes table.

-- 1. Add nullable accountId FK on contacts (links a Contact to a CRM Account)
ALTER TABLE "contacts" ADD COLUMN "account_id" TEXT;
ALTER TABLE "contacts" ADD COLUMN "last_contacted_at" TIMESTAMP(3);
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "contacts_account_id_idx" ON "contacts"("account_id");

-- 2. Create relationship_notes table
CREATE TABLE "relationship_notes" (
  "id"         TEXT NOT NULL,
  "account_id" TEXT,
  "contact_id" TEXT,
  "author_id"  TEXT NOT NULL,
  "body"       TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "relationship_notes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "relationship_notes" ADD CONSTRAINT "relationship_notes_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "relationship_notes" ADD CONSTRAINT "relationship_notes_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "relationship_notes" ADD CONSTRAINT "relationship_notes_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "relationship_notes_account_id_created_at_idx" ON "relationship_notes"("account_id", "created_at");
CREATE INDEX "relationship_notes_contact_id_created_at_idx" ON "relationship_notes"("contact_id", "created_at");
CREATE INDEX "relationship_notes_author_id_idx" ON "relationship_notes"("author_id");
