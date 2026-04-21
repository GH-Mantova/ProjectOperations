-- Multi-provider AI pt 2 — OpenAI key + per-provider model name columns.

ALTER TABLE "platform_config" ADD COLUMN "anthropic_model" TEXT;
ALTER TABLE "platform_config" ADD COLUMN "gemini_model" TEXT;
ALTER TABLE "platform_config" ADD COLUMN "groq_model" TEXT;
ALTER TABLE "platform_config" ADD COLUMN "openai_api_key" TEXT;
ALTER TABLE "platform_config" ADD COLUMN "openai_key_updated_at" TIMESTAMP(3);
ALTER TABLE "platform_config" ADD COLUMN "openai_model" TEXT;
