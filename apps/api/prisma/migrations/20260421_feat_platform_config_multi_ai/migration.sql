-- Multi-provider AI — Gemini + Groq alongside Claude.

ALTER TABLE "platform_config" ADD COLUMN "gemini_api_key" TEXT;
ALTER TABLE "platform_config" ADD COLUMN "gemini_key_updated_at" TIMESTAMP(3);
ALTER TABLE "platform_config" ADD COLUMN "groq_api_key" TEXT;
ALTER TABLE "platform_config" ADD COLUMN "groq_key_updated_at" TIMESTAMP(3);
ALTER TABLE "platform_config" ADD COLUMN "preferred_provider" TEXT;
