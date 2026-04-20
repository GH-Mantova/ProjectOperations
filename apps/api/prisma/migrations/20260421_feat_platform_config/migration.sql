-- Platform-wide configuration (singleton row) — stores encrypted Anthropic API key
CREATE TABLE "platform_config" (
  "id" TEXT NOT NULL,
  "anthropic_api_key" TEXT,
  "anthropic_key_updated_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  "updated_by_id" TEXT,
  CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);
