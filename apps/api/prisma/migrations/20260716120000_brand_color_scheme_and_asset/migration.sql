-- Branding manager: BrandColorScheme + BrandAsset. Purely additive — the
-- legacy string columns on company_profile (primary_color_hex,
-- secondary_color_hex, logo_light_url, logo_dark_url, favicon_url,
-- pdf_letterhead_url) stay in place as fallback and are backfilled into the
-- new tables. A later contract PR will drop them once every reader has been
-- repointed to the FKs.

-- ── Enum ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BrandAssetKind') THEN
    CREATE TYPE "BrandAssetKind" AS ENUM (
      'LOGO_LIGHT', 'LOGO_DARK', 'FAVICON', 'PDF_LETTERHEAD'
    );
  END IF;
END $$;

-- ── BrandColorScheme ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "brand_color_scheme" (
  "id"                  TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "primary_color_hex"   TEXT NOT NULL,
  "secondary_color_hex" TEXT NOT NULL,
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_color_scheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "brand_color_scheme_name_key"
  ON "brand_color_scheme" ("name");

-- ── BrandAsset ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "brand_asset" (
  "id"         TEXT NOT NULL,
  "profile_id" TEXT NOT NULL DEFAULT 'singleton',
  "kind"       "BrandAssetKind" NOT NULL,
  "url"        TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "brand_asset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "brand_asset_profile_id_kind_key"
  ON "brand_asset" ("profile_id", "kind");

ALTER TABLE "brand_asset"
  DROP CONSTRAINT IF EXISTS "brand_asset_profile_id_fkey";
ALTER TABLE "brand_asset"
  ADD CONSTRAINT "brand_asset_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "company_profile" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── CompanyProfile FK to active scheme (nullable) ────────────────────────
ALTER TABLE "company_profile"
  ADD COLUMN IF NOT EXISTS "active_color_scheme_id" TEXT;

ALTER TABLE "company_profile"
  DROP CONSTRAINT IF EXISTS "company_profile_active_color_scheme_id_fkey";
ALTER TABLE "company_profile"
  ADD CONSTRAINT "company_profile_active_color_scheme_id_fkey"
  FOREIGN KEY ("active_color_scheme_id") REFERENCES "brand_color_scheme" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Backfill from the legacy string columns ──────────────────────────────
-- One BrandColorScheme row per distinct (primary, secondary) pair currently
-- on a CompanyProfile row, named "Default". Then point active_color_scheme_id
-- at it. Skips if a "Default" scheme is already present so re-running the
-- backfill (or seed following it) is idempotent.
DO $$
DECLARE
  scheme_id TEXT;
  cp_primary TEXT;
  cp_secondary TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM "company_profile" WHERE "id" = 'singleton') THEN
    SELECT "primary_color_hex", "secondary_color_hex"
      INTO cp_primary, cp_secondary
      FROM "company_profile" WHERE "id" = 'singleton';

    SELECT "id" INTO scheme_id FROM "brand_color_scheme" WHERE "name" = 'Default';
    IF scheme_id IS NULL THEN
      scheme_id := 'brand-scheme-default';
      INSERT INTO "brand_color_scheme" ("id", "name", "primary_color_hex", "secondary_color_hex", "updated_at")
        VALUES (scheme_id, 'Default', cp_primary, cp_secondary, CURRENT_TIMESTAMP);
    END IF;

    UPDATE "company_profile"
       SET "active_color_scheme_id" = scheme_id
     WHERE "id" = 'singleton'
       AND "active_color_scheme_id" IS NULL;
  END IF;
END $$;

-- Backfill BrandAsset rows for each non-null legacy asset URL.
INSERT INTO "brand_asset" ("id", "profile_id", "kind", "url", "updated_at")
SELECT 'brand-asset-logo-light', 'singleton', 'LOGO_LIGHT', "logo_light_url", CURRENT_TIMESTAMP
  FROM "company_profile"
 WHERE "id" = 'singleton' AND "logo_light_url" IS NOT NULL
ON CONFLICT ("profile_id", "kind") DO NOTHING;

INSERT INTO "brand_asset" ("id", "profile_id", "kind", "url", "updated_at")
SELECT 'brand-asset-logo-dark', 'singleton', 'LOGO_DARK', "logo_dark_url", CURRENT_TIMESTAMP
  FROM "company_profile"
 WHERE "id" = 'singleton' AND "logo_dark_url" IS NOT NULL
ON CONFLICT ("profile_id", "kind") DO NOTHING;

INSERT INTO "brand_asset" ("id", "profile_id", "kind", "url", "updated_at")
SELECT 'brand-asset-favicon', 'singleton', 'FAVICON', "favicon_url", CURRENT_TIMESTAMP
  FROM "company_profile"
 WHERE "id" = 'singleton' AND "favicon_url" IS NOT NULL
ON CONFLICT ("profile_id", "kind") DO NOTHING;

INSERT INTO "brand_asset" ("id", "profile_id", "kind", "url", "updated_at")
SELECT 'brand-asset-pdf-letterhead', 'singleton', 'PDF_LETTERHEAD', "pdf_letterhead_url", CURRENT_TIMESTAMP
  FROM "company_profile"
 WHERE "id" = 'singleton' AND "pdf_letterhead_url" IS NOT NULL
ON CONFLICT ("profile_id", "kind") DO NOTHING;
