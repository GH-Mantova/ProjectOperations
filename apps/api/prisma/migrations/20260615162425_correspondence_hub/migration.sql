-- GATE-ALLOW: migrations
-- PR #215 — Correspondence Hub (mock-mode first).
-- Adds two tables for threading email correspondence against clients,
-- tenders, and jobs. Live Microsoft Graph inbound polling is a follow-up
-- (requires additional Entra Mail.Read permissions).

CREATE TABLE "correspondence_threads" (
  "id" TEXT NOT NULL,
  "client_id" TEXT,
  "tender_id" TEXT,
  "job_id" TEXT,
  "subject" TEXT NOT NULL,
  "reference_key" TEXT NOT NULL,
  "participants" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "correspondence_threads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "correspondence_threads_reference_key_key" ON "correspondence_threads"("reference_key");
CREATE INDEX "correspondence_threads_client_id_idx" ON "correspondence_threads"("client_id");
CREATE INDEX "correspondence_threads_tender_id_idx" ON "correspondence_threads"("tender_id");
CREATE INDEX "correspondence_threads_job_id_idx" ON "correspondence_threads"("job_id");
CREATE INDEX "correspondence_threads_last_message_at_idx" ON "correspondence_threads"("last_message_at");

ALTER TABLE "correspondence_threads"
  ADD CONSTRAINT "correspondence_threads_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "correspondence_threads"
  ADD CONSTRAINT "correspondence_threads_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "correspondence_threads"
  ADD CONSTRAINT "correspondence_threads_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE "correspondence_messages" (
  "id" TEXT NOT NULL,
  "thread_id" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "from_address" TEXT NOT NULL,
  "to_addresses" TEXT[] NOT NULL,
  "cc_addresses" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "subject" TEXT NOT NULL,
  "body_text" TEXT NOT NULL,
  "body_html" TEXT,
  "external_id" TEXT,
  "sent_at" TIMESTAMP(3),
  "received_at" TIMESTAMP(3),
  "sent_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "correspondence_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "correspondence_messages_external_id_key" ON "correspondence_messages"("external_id");
CREATE INDEX "correspondence_messages_thread_id_created_at_idx" ON "correspondence_messages"("thread_id", "created_at");

ALTER TABLE "correspondence_messages"
  ADD CONSTRAINT "correspondence_messages_thread_id_fkey"
  FOREIGN KEY ("thread_id") REFERENCES "correspondence_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "correspondence_messages"
  ADD CONSTRAINT "correspondence_messages_sent_by_id_fkey"
  FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
