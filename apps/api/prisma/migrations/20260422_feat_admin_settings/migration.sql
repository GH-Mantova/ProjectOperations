-- Admin Settings — one row per notification trigger + a singleton email
-- provider config row.

CREATE TABLE "notification_trigger_configs" (
  "id" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT false,
  "delivery_method" TEXT NOT NULL DEFAULT 'both',
  "recipient_roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "recipient_user_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_trigger_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_trigger_configs_trigger_key"
  ON "notification_trigger_configs"("trigger");

CREATE TABLE "email_provider_config" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "provider" TEXT NOT NULL DEFAULT 'outlook',
  "sender_address" TEXT NOT NULL DEFAULT 'marco@initialservices.net',
  "sender_name" TEXT NOT NULL DEFAULT 'Initial Services',
  "is_configured" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "updated_by_id" TEXT,

  CONSTRAINT "email_provider_config_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "email_provider_config"
  ADD CONSTRAINT "email_provider_config_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
