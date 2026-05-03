-- §5A.1 PR 10: persona conversation persistence.
-- Adds two tables: conversations (one per user/persona/subMode/contextKey
-- thread) and conversation_messages (ordered messages within a thread).
-- Cascade delete from user → conversation → messages so user removal
-- cleans up automatically.
--
-- Drift trim per PR #117/#134 protocol: this migration intentionally
-- contains ONLY the new conversation tables. Pre-existing main-vs-DB
-- drift (workers.employmentType compat column, FK reshapes, default
-- removals) is excluded — that's tracked separately in roadmap PHASE 6
-- "Audit migration history vs current schema".

CREATE TABLE "conversations" (
  "id"            TEXT NOT NULL,
  "user_id"       TEXT NOT NULL,
  "persona_slug"  TEXT NOT NULL,
  "sub_mode"      TEXT NOT NULL,
  "context_key"   TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_user_id_persona_slug_sub_mode_context_key_upd_idx"
  ON "conversations" ("user_id", "persona_slug", "sub_mode", "context_key", "updated_at" DESC);

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "conversation_messages" (
  "id"               TEXT NOT NULL,
  "conversation_id"  TEXT NOT NULL,
  "role"             TEXT NOT NULL,
  "content"          TEXT NOT NULL,
  "model"            TEXT,
  "provider_source"  TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversation_messages_conversation_id_created_at_idx"
  ON "conversation_messages" ("conversation_id", "created_at");

ALTER TABLE "conversation_messages"
  ADD CONSTRAINT "conversation_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
