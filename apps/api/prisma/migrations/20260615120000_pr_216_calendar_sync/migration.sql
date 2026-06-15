-- GATE-ALLOW: migrations
-- PR-216 — Calendar Sync (mock-mode). Per-(user, source item) ledger
-- of events the calendar adapter has "synced". Mock adapter writes
-- here; live Microsoft Graph adapter (follow-up) will also use it as
-- the idempotency key, with external_event_id pointing at the Graph
-- event id.

CREATE TABLE "calendar_synced_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_synced_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "calendar_synced_events_user_id_source_type_source_id_key"
    ON "calendar_synced_events"("user_id", "source_type", "source_id");

CREATE INDEX "calendar_synced_events_user_id_status_idx"
    ON "calendar_synced_events"("user_id", "status");

ALTER TABLE "calendar_synced_events"
    ADD CONSTRAINT "calendar_synced_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
