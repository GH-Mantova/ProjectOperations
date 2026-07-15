-- Third-party integration API keys (Geoapify, fuelpricesqld, future).
-- Moves manually-entered keys out of Azure App Service config into the ERP
-- so they can be rotated from the UI. Encrypted at rest with AES-256-GCM
-- via KeyEncryptionService (BYOK_ENCRYPTION_KEY master), same format used
-- by the AI provider columns:
--   "<iv-base64>:<authTag-base64>:<ciphertext-base64>"
-- Additive migration — no drops, no data changes.

CREATE TABLE "integration_credentials" (
    "slug"             TEXT         NOT NULL,
    "label"            TEXT         NOT NULL,
    "value_encrypted"  TEXT,
    "meta"             JSONB,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    "updated_by_id"    TEXT,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("slug")
);
