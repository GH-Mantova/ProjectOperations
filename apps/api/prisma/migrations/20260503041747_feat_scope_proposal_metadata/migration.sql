-- §5A.1 PR 11: scope sub-mode tools — adds metadata JSONB to
-- conversation_messages so tool_call / tool_result rows can carry
-- structured payloads (proposal arrays, tool arguments, status).
--
-- Drift trim per PR #117/#134/#136 protocol: this migration intentionally
-- contains ONLY the new column. Pre-existing main-vs-DB drift
-- (workers.employmentType compat column, FK reshapes, default removals)
-- is excluded.

ALTER TABLE "conversation_messages"
  ADD COLUMN "metadata" JSONB;
