-- CRM-4: Comms hub — internal threads + To-Do (decoupled sub-module).
-- Additive only. Ships WITHOUT Azure — internal threads + tasks only.
--
-- Enums:  CommTaskStatus
-- Tables: comm_threads, comm_messages, comm_tasks
-- Polymorphic link on (entity_type, entity_id) — matches the existing
-- InternalMessage / ApprovalDecision / SearchEntry pattern in this schema.
--
-- Rollback:
--   DROP TABLE "comm_tasks";
--   DROP TABLE "comm_messages";
--   DROP TABLE "comm_threads";
--   DROP TYPE  "CommTaskStatus";

-- Enum
CREATE TYPE "CommTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- Table: comm_threads
CREATE TABLE "comm_threads" (
    "id"             TEXT NOT NULL,
    "entity_type"    TEXT NOT NULL,
    "entity_id"      TEXT NOT NULL,
    "subject"        TEXT,
    "created_by_id"  TEXT NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at"    TIMESTAMP(3),
    CONSTRAINT "comm_threads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comm_threads_entity_type_entity_id_idx"
    ON "comm_threads"("entity_type", "entity_id");
CREATE INDEX "comm_threads_created_by_id_idx"
    ON "comm_threads"("created_by_id");
CREATE INDEX "comm_threads_archived_at_idx"
    ON "comm_threads"("archived_at");

ALTER TABLE "comm_threads"
    ADD CONSTRAINT "comm_threads_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Table: comm_messages
CREATE TABLE "comm_messages" (
    "id"         TEXT NOT NULL,
    "thread_id"  TEXT NOT NULL,
    "author_id"  TEXT NOT NULL,
    "body"       TEXT NOT NULL,
    "mentions"   JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at"  TIMESTAMP(3),
    CONSTRAINT "comm_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comm_messages_thread_id_created_at_idx"
    ON "comm_messages"("thread_id", "created_at");
CREATE INDEX "comm_messages_author_id_idx"
    ON "comm_messages"("author_id");

ALTER TABLE "comm_messages"
    ADD CONSTRAINT "comm_messages_thread_id_fkey"
    FOREIGN KEY ("thread_id") REFERENCES "comm_threads"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "comm_messages"
    ADD CONSTRAINT "comm_messages_author_id_fkey"
    FOREIGN KEY ("author_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Table: comm_tasks
CREATE TABLE "comm_tasks" (
    "id"            TEXT NOT NULL,
    "thread_id"     TEXT,
    "entity_type"   TEXT NOT NULL,
    "entity_id"     TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "description"   TEXT,
    "status"        "CommTaskStatus" NOT NULL DEFAULT 'OPEN',
    "assignee_id"   TEXT,
    "created_by_id" TEXT NOT NULL,
    "due_at"        TIMESTAMP(3),
    "completed_at"  TIMESTAMP(3),
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comm_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comm_tasks_entity_type_entity_id_idx"
    ON "comm_tasks"("entity_type", "entity_id");
CREATE INDEX "comm_tasks_assignee_id_status_idx"
    ON "comm_tasks"("assignee_id", "status");
CREATE INDEX "comm_tasks_thread_id_idx"
    ON "comm_tasks"("thread_id");
CREATE INDEX "comm_tasks_due_at_idx"
    ON "comm_tasks"("due_at");

ALTER TABLE "comm_tasks"
    ADD CONSTRAINT "comm_tasks_thread_id_fkey"
    FOREIGN KEY ("thread_id") REFERENCES "comm_threads"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "comm_tasks"
    ADD CONSTRAINT "comm_tasks_assignee_id_fkey"
    FOREIGN KEY ("assignee_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "comm_tasks"
    ADD CONSTRAINT "comm_tasks_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
