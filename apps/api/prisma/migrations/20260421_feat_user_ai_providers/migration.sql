-- Per-user personal AI provider accounts + last-used preference.
-- Mirrors the aes-256-gcm encryption envelope used by platform_config for
-- company-level keys; each row is owned by one user and cascade-deletes
-- when the user is removed.

CREATE TABLE "user_ai_providers" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "label" TEXT,
  "api_key" TEXT NOT NULL,
  "model" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_ai_providers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_ai_providers_user_id_idx" ON "user_ai_providers"("user_id");
CREATE INDEX "user_ai_providers_user_id_provider_idx" ON "user_ai_providers"("user_id", "provider");

ALTER TABLE "user_ai_providers"
  ADD CONSTRAINT "user_ai_providers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "user_ai_preferences" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "last_used_provider_id" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_ai_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_ai_preferences_user_id_key" ON "user_ai_preferences"("user_id");

ALTER TABLE "user_ai_preferences"
  ADD CONSTRAINT "user_ai_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
