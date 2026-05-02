-- §5A.1 PR 9: BYOK encryption infrastructure.
-- Adds per-user encrypted AI provider key columns on `users`, and the
-- parallel encrypted-company-key columns on `platform_config`. Both use
-- AES-256-GCM via KeyEncryptionService with master key BYOK_ENCRYPTION_KEY.
-- Storage format: "<iv-base64>:<authTag-base64>:<ciphertext-base64>".
--
-- The legacy *_api_key + *_key_updated_at columns on platform_config are
-- intentionally NOT dropped here — kept for backward compatibility with
-- pre-PR-9 dev databases. Cleanup PR will drop them once verified.
--
-- Drift trim per PR #117 protocol: this migration intentionally contains
-- ONLY the new BYOK columns. Pre-existing drift (workers.employmentType,
-- FK reshapes, default removals) is excluded — that's tracked separately
-- in roadmap PHASE 6 "Audit migration history vs current schema".

ALTER TABLE "users"
  ADD COLUMN "anthropic_key_encrypted"     TEXT,
  ADD COLUMN "anthropic_key_validated_at"  TIMESTAMP(3),
  ADD COLUMN "openai_key_encrypted"        TEXT,
  ADD COLUMN "openai_key_validated_at"     TIMESTAMP(3),
  ADD COLUMN "gemini_key_encrypted"        TEXT,
  ADD COLUMN "gemini_key_validated_at"     TIMESTAMP(3),
  ADD COLUMN "groq_key_encrypted"          TEXT,
  ADD COLUMN "groq_key_validated_at"       TIMESTAMP(3);

ALTER TABLE "platform_config"
  ADD COLUMN "anthropic_key_encrypted"     TEXT,
  ADD COLUMN "anthropic_key_validated_at"  TIMESTAMP(3),
  ADD COLUMN "openai_key_encrypted"        TEXT,
  ADD COLUMN "openai_key_validated_at"     TIMESTAMP(3),
  ADD COLUMN "gemini_key_encrypted"        TEXT,
  ADD COLUMN "gemini_key_validated_at"     TIMESTAMP(3),
  ADD COLUMN "groq_key_encrypted"          TEXT,
  ADD COLUMN "groq_key_validated_at"       TIMESTAMP(3);
