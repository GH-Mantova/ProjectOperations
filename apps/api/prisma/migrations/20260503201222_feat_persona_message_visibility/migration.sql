-- §5A.1 multi-turn loop: visibility flag on conversation_messages so
-- internal turns (assistant tool_use, synthesised user tool_result)
-- can be hidden from UI replay while still being kept for model
-- context on follow-up calls.
--
-- Default USER preserves the semantics for every pre-existing row
-- (PR #136 + #137 inserted only user/assistant/tool_call/tool_result
-- rows that should remain visible).
--
-- Drift trim per PR #117/#134/#136/#137/#139 protocol: this migration
-- intentionally contains ONLY the new column. Pre-existing main-vs-DB
-- drift (workers.employmentType compat column, FK reshapes, default
-- removals) is excluded.

ALTER TABLE "conversation_messages"
  ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'USER';
