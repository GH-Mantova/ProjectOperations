-- Drop 8 dead PlatformConfig columns (BYOK migration cleanup, scoped 12 → 8).
--
-- *ApiKey + *KeyUpdatedAt for all 4 providers — verified dead via static
-- scan in PR #139 investigation. *Model columns retained: live feature
-- (per-provider model override) tracked separately in PHASE 6.
--
-- Drift trim per PR #117/#134/#136/#137 protocol: this migration intentionally
-- contains ONLY the intended drops. Pre-existing main-vs-DB drift (workers.
-- employmentType compat column, FK reshapes, default removals) is excluded.

ALTER TABLE "platform_config"
  DROP COLUMN "anthropic_api_key",
  DROP COLUMN "anthropic_key_updated_at",
  DROP COLUMN "openai_api_key",
  DROP COLUMN "openai_key_updated_at",
  DROP COLUMN "gemini_api_key",
  DROP COLUMN "gemini_key_updated_at",
  DROP COLUMN "groq_api_key",
  DROP COLUMN "groq_key_updated_at";
