-- SLICE-1: Unified API-key vault — ApiKeyType + ApiCredential
-- Additive migration: two new tables, no drops, no alters, no data.
-- Rollback: DROP TABLE "api_credential"; DROP TABLE "api_key_type"; DELETE the migration dir.
-- Forward-only safe until dependent code (SLICE-2 resolve seam) lands.

-- ApiKeyType: lookup table for credential types (e.g. geocoding, xero, email)
CREATE TABLE "api_key_type" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_kind" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_key_type_pkey" PRIMARY KEY ("id")
);

-- ApiCredential: encrypted credential store with scope + provider binding
CREATE TABLE "api_credential" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "adapter" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'company',
    "user_id" TEXT,
    "value_encrypted" TEXT,
    "validated_at" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER,
    "config" JSONB,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_credential_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on ApiKeyType.name
CREATE UNIQUE INDEX "api_key_type_name_key" ON "api_key_type"("name");

-- Indexes on ApiCredential
CREATE INDEX "api_credential_type_id_idx" ON "api_credential"("type_id");
CREATE INDEX "api_credential_scope_user_id_idx" ON "api_credential"("scope", "user_id");

-- Foreign key: ApiCredential.typeId -> ApiKeyType.id
ALTER TABLE "api_credential" ADD CONSTRAINT "api_credential_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "api_key_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
