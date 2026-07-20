-- Universal activity Timeline (D365 parity)
-- Polymorphic activity stream — one row per note/status-change/attachment/
-- system event on any host record (Job, Tender, Client, Contact, ...).
-- Merged read-side stitches these rows with existing signals
-- (correspondence, JobStatusHistory, JobProgressEntry, DocumentLink) so
-- this table itself only stores things that have no other home:
-- user-authored notes and auto-generated system entries.

CREATE TABLE "activity_entries" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "author_id" TEXT,
    "document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "activity_entries_entity_type_entity_id_created_at_idx"
    ON "activity_entries"("entity_type", "entity_id", "created_at");

CREATE INDEX "activity_entries_author_id_idx"
    ON "activity_entries"("author_id");

ALTER TABLE "activity_entries"
    ADD CONSTRAINT "activity_entries_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
