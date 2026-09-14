-- Brand & theme S4: Harbour and Graphite as named BrandColorScheme preset rows.
--
-- Why a migration: deploy.yml runs only `prisma migrate deploy`, which never runs
-- the TypeScript seed (seed-company-profile.ts). Presets added only to the seed
-- would therefore never reach production (CP-23 seed-without-migration). The
-- Default row itself was written to prod by 20260716120000_brand_color_scheme_and_asset
-- the same way; this file follows that precedent for the two S4 presets.
--
-- Values are byte-for-byte the HARBOUR_PRESET / GRAPHITE_PRESET constants in
-- apps/api/prisma/seed-company-profile.ts (lifted from the approved
-- theme-system-mockup.html). Keep the two in sync if either ever changes.
--
-- Prereqs that already hold in production:
--   * "brand_color_scheme" exists with the thirteen S3 palette columns
--     (20260911000000_brandtheme_s3_palette_columns).
--   * "name" is UNIQUE (brand_color_scheme_name_key).
--
-- Semantics: insert-if-absent ONLY, keyed on the unique name. ON CONFLICT DO
-- NOTHING covers both the name key and the primary key, so a company that
-- already created (or edited) a scheme called Harbour or Graphite keeps its row
-- untouched. No UPDATE, no DELETE. company_profile.active_color_scheme_id is
-- NOT touched - presets are choices, never the active scheme. Re-running is a no-op.
--
-- Reverse (documented; run manually if rolling back):
--   DELETE FROM "brand_color_scheme" WHERE "id" IN ('brand-scheme-harbour', 'brand-scheme-graphite')
--     AND "id" NOT IN (SELECT "active_color_scheme_id" FROM "company_profile" WHERE "active_color_scheme_id" IS NOT NULL);

INSERT INTO "brand_color_scheme" (
  "id", "name", "primary_color_hex", "secondary_color_hex",
  "sidebar_bg_hex", "sidebar_text_hex", "sidebar_text_active_hex",
  "surface_page_hex", "surface_card_hex",
  "text_primary_hex", "text_secondary_hex", "text_muted_hex",
  "status_active_hex", "status_warning_hex", "status_danger_hex", "status_info_hex", "status_neutral_hex",
  "updated_at"
)
VALUES (
  'brand-scheme-harbour', 'Harbour', '#2F5FD0', '#16B1C9',
  '#1E2A4A', '#8B96AC', '#FFFFFF',
  '#F5F7FB', '#FFFFFF',
  '#131A2B', '#6B7793', '#9BA3BA',
  '#12876F', '#9A5A13', '#C33B34', '#2F5FD0', '#5F6B85',
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;

INSERT INTO "brand_color_scheme" (
  "id", "name", "primary_color_hex", "secondary_color_hex",
  "sidebar_bg_hex", "sidebar_text_hex", "sidebar_text_active_hex",
  "surface_page_hex", "surface_card_hex",
  "text_primary_hex", "text_secondary_hex", "text_muted_hex",
  "status_active_hex", "status_warning_hex", "status_danger_hex", "status_info_hex", "status_neutral_hex",
  "updated_at"
)
VALUES (
  'brand-scheme-graphite', 'Graphite', '#2F3237', '#E8A33D',
  '#17191C', '#848487', '#F2F2EF',
  '#EEEEEA', '#FFFFFF',
  '#101114', '#6B6F76', '#9C9FA5',
  '#2F6B33', '#7A5310', '#9C2B20', '#2C5AA0', '#5B5F63',
  CURRENT_TIMESTAMP
)
ON CONFLICT DO NOTHING;
