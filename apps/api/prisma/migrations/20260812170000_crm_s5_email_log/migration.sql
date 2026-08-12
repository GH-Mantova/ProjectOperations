-- CRM-5: Comms hub — email integration.
-- Additive only. Layers Outlook / Microsoft Graph email logging on top of
-- the CRM-4 comms sub-module. Reuses the existing M365 seam in
-- apps/api/src/modules/email/**; no Azure / Entra / SharePoint config is
-- touched by this migration.
--
-- Enums:  EmailDirection
-- Tables: email_logs
-- Polymorphic link on (entity_type, entity_id) — matches CommThread/CommTask.
--
-- Rollback:
--   DROP TABLE "email_logs";
--   DROP TYPE  "EmailDirection";

-- Enum
CREATE TYPE "EmailDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- Table: email_logs
CREATE TABLE "email_logs" (
    "id"               TEXT NOT NULL,
    "entity_type"      TEXT NOT NULL,
    "entity_id"        TEXT NOT NULL,
    "direction"        "EmailDirection" NOT NULL,
    "graph_message_id" TEXT NOT NULL,
    "subject"          TEXT NOT NULL,
    "from_address"     TEXT NOT NULL,
    "to_addresses"     JSONB NOT NULL,
    "cc_addresses"     JSONB,
    "snippet"          TEXT,
    "sent_at"          TIMESTAMP(3) NOT NULL,
    "logged_by_id"     TEXT,
    "logged_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_logs_graph_message_id_key"
    ON "email_logs"("graph_message_id");

CREATE INDEX "email_logs_entity_type_entity_id_sent_at_idx"
    ON "email_logs"("entity_type", "entity_id", "sent_at");
CREATE INDEX "email_logs_logged_by_id_idx"
    ON "email_logs"("logged_by_id");
CREATE INDEX "email_logs_sent_at_idx"
    ON "email_logs"("sent_at");

ALTER TABLE "email_logs"
    ADD CONSTRAINT "email_logs_logged_by_id_fkey"
    FOREIGN KEY ("logged_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
