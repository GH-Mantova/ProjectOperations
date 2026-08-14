-- CRM-2: Relationship intelligence
-- Additive only: two nullable columns on contacts, new relationship_notes table.
-- No existing row is touched; no constraint is tightened; no data is migrated.

-- 1. Extend contacts: optional account link + lastContactedAt tracking.
ALTER TABLE "contacts"
  ADD COLUMN "account_id"         TEXT     NULL REFERENCES "accounts"("id") ON DELETE SET NULL,
  ADD COLUMN "last_contacted_at"  TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS "contacts_account_id_idx"        ON "contacts"("account_id");
CREATE INDEX IF NOT EXISTS "contacts_last_contacted_at_idx" ON "contacts"("last_contacted_at");

-- 2. New table: relationship_notes — free-text entries logged by a user against an account/contact.
CREATE TABLE "relationship_notes" (
  "id"          TEXT        NOT NULL,
  "account_id"  TEXT        NULL REFERENCES "accounts"("id") ON DELETE SET NULL,
  "contact_id"  TEXT        NULL REFERENCES "contacts"("id") ON DELETE SET NULL,
  "author_id"   TEXT        NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body"        TEXT        NOT NULL,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "relationship_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "relationship_notes_account_id_idx"  ON "relationship_notes"("account_id");
CREATE INDEX IF NOT EXISTS "relationship_notes_contact_id_idx"  ON "relationship_notes"("contact_id");
CREATE INDEX IF NOT EXISTS "relationship_notes_author_id_idx"   ON "relationship_notes"("author_id");
CREATE INDEX IF NOT EXISTS "relationship_notes_created_at_idx"  ON "relationship_notes"("created_at");
