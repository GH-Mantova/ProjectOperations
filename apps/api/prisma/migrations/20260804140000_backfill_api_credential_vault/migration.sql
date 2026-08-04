-- SLICE-3: idempotent backfill of ApiCredential vault from three legacy stores.
--   1. Seed 11 built-in ApiKeyType rows (§4c of the plan).
--   2. Copy PlatformConfig.<provider>KeyEncrypted into ApiCredential(scope="company").
--   3. Copy per-user User.<provider>KeyEncrypted into ApiCredential(scope="user").
--   4. Copy IntegrationCredential rows into ApiCredential(scope="company").
--
-- Ciphertext bytes are COPIED as-is (no decrypt, no re-encrypt); same
-- KeyEncryptionService master key stays in use.
--
-- Idempotent + additive:
--   - Types seed via `ON CONFLICT (name) DO NOTHING`.
--   - Credential inserts guard on `NOT EXISTS (typeId, scope, name[, userId])`.
--   - No drops, no alters. Legacy PlatformConfig / IntegrationCredential /
--     per-user AI key columns are left untouched — they remain the fallback
--     path until SLICE-4 retires the old screens.
--
-- Rollback: delete the copied api_credential rows (legacy fallback still
-- resolves every key) and revert the one-line vault-first flip in
-- ApiKeysService.resolve(). Re-running this migration is a no-op.

-- ---------------------------------------------------------------------------
-- Step 1 — seed 11 built-in ApiKeyType rows (per plan §4c).
-- ---------------------------------------------------------------------------
INSERT INTO "api_key_type" ("id", "name", "system_kind", "created_at", "updated_at")
VALUES
  (gen_random_uuid()::text, 'Anthropic (Claude)', 'ai',        now(), now()),
  (gen_random_uuid()::text, 'OpenAI',             'ai',        now(), now()),
  (gen_random_uuid()::text, 'Google Gemini',      'ai',        now(), now()),
  (gen_random_uuid()::text, 'Groq',               'ai',        now(), now()),
  (gen_random_uuid()::text, 'Geoapify',           'geocoding', now(), now()),
  (gen_random_uuid()::text, 'Google Maps',        'geocoding', now(), now()),
  (gen_random_uuid()::text, 'Geocodify',          'geocoding', now(), now()),
  (gen_random_uuid()::text, 'MapTiler',           'geocoding', now(), now()),
  (gen_random_uuid()::text, 'Nominatim (OSM)',    'geocoding', now(), now()),
  (gen_random_uuid()::text, 'Fuel Prices QLD',    NULL,        now(), now()),
  (gen_random_uuid()::text, 'Custom REST',        NULL,        now(), now())
ON CONFLICT ("name") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Step 2 — company AI keys from PlatformConfig singleton (four providers).
--
-- Each block is guarded by NOT EXISTS on (type_id, scope, name) so re-runs
-- are no-ops. ciphertext is copied byte-for-byte.
-- ---------------------------------------------------------------------------

-- 2a. Anthropic
INSERT INTO "api_credential" (
  "id", "name", "type_id", "adapter", "scope",
  "value_encrypted", "validated_at", "enabled", "order",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  'Company anthropic key',
  t."id",
  'anthropic',
  'company',
  pc."anthropic_key_encrypted",
  pc."anthropic_key_validated_at",
  true,
  NULL,
  now(),
  now()
FROM "platform_config" pc
JOIN "api_key_type" t ON t."name" = 'Anthropic (Claude)'
WHERE pc."id" = 'singleton'
  AND pc."anthropic_key_encrypted" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "api_credential" ac
    WHERE ac."type_id" = t."id"
      AND ac."scope"   = 'company'
      AND ac."name"    = 'Company anthropic key'
  );

-- 2b. OpenAI
INSERT INTO "api_credential" (
  "id", "name", "type_id", "adapter", "scope",
  "value_encrypted", "validated_at", "enabled", "order",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  'Company openai key',
  t."id",
  'openai',
  'company',
  pc."openai_key_encrypted",
  pc."openai_key_validated_at",
  true,
  NULL,
  now(),
  now()
FROM "platform_config" pc
JOIN "api_key_type" t ON t."name" = 'OpenAI'
WHERE pc."id" = 'singleton'
  AND pc."openai_key_encrypted" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "api_credential" ac
    WHERE ac."type_id" = t."id"
      AND ac."scope"   = 'company'
      AND ac."name"    = 'Company openai key'
  );

-- 2c. Google Gemini
INSERT INTO "api_credential" (
  "id", "name", "type_id", "adapter", "scope",
  "value_encrypted", "validated_at", "enabled", "order",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  'Company gemini key',
  t."id",
  'gemini',
  'company',
  pc."gemini_key_encrypted",
  pc."gemini_key_validated_at",
  true,
  NULL,
  now(),
  now()
FROM "platform_config" pc
JOIN "api_key_type" t ON t."name" = 'Google Gemini'
WHERE pc."id" = 'singleton'
  AND pc."gemini_key_encrypted" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "api_credential" ac
    WHERE ac."type_id" = t."id"
      AND ac."scope"   = 'company'
      AND ac."name"    = 'Company gemini key'
  );

-- 2d. Groq
INSERT INTO "api_credential" (
  "id", "name", "type_id", "adapter", "scope",
  "value_encrypted", "validated_at", "enabled", "order",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  'Company groq key',
  t."id",
  'groq',
  'company',
  pc."groq_key_encrypted",
  pc."groq_key_validated_at",
  true,
  NULL,
  now(),
  now()
FROM "platform_config" pc
JOIN "api_key_type" t ON t."name" = 'Groq'
WHERE pc."id" = 'singleton'
  AND pc."groq_key_encrypted" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "api_credential" ac
    WHERE ac."type_id" = t."id"
      AND ac."scope"   = 'company'
      AND ac."name"    = 'Company groq key'
  );

-- ---------------------------------------------------------------------------
-- Step 3 — per-user AI keys from the users table (four providers).
--
-- One row per (user, provider) that has a non-null encrypted value.
-- Idempotency key: (type_id, scope='user', user_id, name).
-- ---------------------------------------------------------------------------

-- 3a. Anthropic per-user
INSERT INTO "api_credential" (
  "id", "name", "type_id", "adapter", "scope", "user_id",
  "value_encrypted", "validated_at", "enabled", "order",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  'Personal anthropic key',
  t."id",
  'anthropic',
  'user',
  u."id",
  u."anthropic_key_encrypted",
  u."anthropic_key_validated_at",
  true,
  NULL,
  now(),
  now()
FROM "users" u
JOIN "api_key_type" t ON t."name" = 'Anthropic (Claude)'
WHERE u."anthropic_key_encrypted" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "api_credential" ac
    WHERE ac."type_id" = t."id"
      AND ac."scope"   = 'user'
      AND ac."user_id" = u."id"
      AND ac."name"    = 'Personal anthropic key'
  );

-- 3b. OpenAI per-user
INSERT INTO "api_credential" (
  "id", "name", "type_id", "adapter", "scope", "user_id",
  "value_encrypted", "validated_at", "enabled", "order",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  'Personal openai key',
  t."id",
  'openai',
  'user',
  u."id",
  u."openai_key_encrypted",
  u."openai_key_validated_at",
  true,
  NULL,
  now(),
  now()
FROM "users" u
JOIN "api_key_type" t ON t."name" = 'OpenAI'
WHERE u."openai_key_encrypted" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "api_credential" ac
    WHERE ac."type_id" = t."id"
      AND ac."scope"   = 'user'
      AND ac."user_id" = u."id"
      AND ac."name"    = 'Personal openai key'
  );

-- 3c. Google Gemini per-user
INSERT INTO "api_credential" (
  "id", "name", "type_id", "adapter", "scope", "user_id",
  "value_encrypted", "validated_at", "enabled", "order",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  'Personal gemini key',
  t."id",
  'gemini',
  'user',
  u."id",
  u."gemini_key_encrypted",
  u."gemini_key_validated_at",
  true,
  NULL,
  now(),
  now()
FROM "users" u
JOIN "api_key_type" t ON t."name" = 'Google Gemini'
WHERE u."gemini_key_encrypted" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "api_credential" ac
    WHERE ac."type_id" = t."id"
      AND ac."scope"   = 'user'
      AND ac."user_id" = u."id"
      AND ac."name"    = 'Personal gemini key'
  );

-- 3d. Groq per-user
INSERT INTO "api_credential" (
  "id", "name", "type_id", "adapter", "scope", "user_id",
  "value_encrypted", "validated_at", "enabled", "order",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  'Personal groq key',
  t."id",
  'groq',
  'user',
  u."id",
  u."groq_key_encrypted",
  u."groq_key_validated_at",
  true,
  NULL,
  now(),
  now()
FROM "users" u
JOIN "api_key_type" t ON t."name" = 'Groq'
WHERE u."groq_key_encrypted" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "api_credential" ac
    WHERE ac."type_id" = t."id"
      AND ac."scope"   = 'user'
      AND ac."user_id" = u."id"
      AND ac."name"    = 'Personal groq key'
  );

-- ---------------------------------------------------------------------------
-- Step 4 — integration keys from IntegrationCredential.
--
-- geoapify → 'Geoapify' type, adapter='geoapify', order=1 (head-of-chain
--   per plan §4c so the seeded row wins in the geocoding failover).
-- fuelpricesqld → 'Fuel Prices QLD' type, adapter='fuelpricesqld',
--   order NULL (not part of the geocoding chain).
-- ---------------------------------------------------------------------------

-- 4a. Geoapify
INSERT INTO "api_credential" (
  "id", "name", "type_id", "adapter", "scope",
  "value_encrypted", "enabled", "order",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  ic."label",
  t."id",
  'geoapify',
  'company',
  ic."value_encrypted",
  true,
  1,
  now(),
  now()
FROM "integration_credentials" ic
JOIN "api_key_type" t ON t."name" = 'Geoapify'
WHERE ic."slug" = 'geoapify'
  AND ic."value_encrypted" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "api_credential" ac
    WHERE ac."type_id" = t."id"
      AND ac."scope"   = 'company'
      AND ac."name"    = ic."label"
  );

-- 4b. Fuel Prices QLD
INSERT INTO "api_credential" (
  "id", "name", "type_id", "adapter", "scope",
  "value_encrypted", "enabled", "order",
  "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  ic."label",
  t."id",
  'fuelpricesqld',
  'company',
  ic."value_encrypted",
  true,
  NULL,
  now(),
  now()
FROM "integration_credentials" ic
JOIN "api_key_type" t ON t."name" = 'Fuel Prices QLD'
WHERE ic."slug" = 'fuelpricesqld'
  AND ic."value_encrypted" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "api_credential" ac
    WHERE ac."type_id" = t."id"
      AND ac."scope"   = 'company'
      AND ac."name"    = ic."label"
  );
