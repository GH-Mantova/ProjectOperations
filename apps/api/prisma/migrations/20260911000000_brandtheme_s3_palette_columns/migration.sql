-- Brand & theme S3: widen BrandColorScheme to the full mockup palette.
-- Thirteen additive nullable columns with no defaults and no backfill.
-- NULL means "fall back to the tokens.css value", which is the behaviour
-- on main today, so no existing row changes appearance.

ALTER TABLE "brand_color_scheme" ADD COLUMN "sidebar_bg_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "sidebar_text_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "sidebar_text_active_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "surface_page_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "surface_card_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "text_primary_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "text_secondary_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "text_muted_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "status_active_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "status_warning_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "status_danger_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "status_info_hex" TEXT;
ALTER TABLE "brand_color_scheme" ADD COLUMN "status_neutral_hex" TEXT;
