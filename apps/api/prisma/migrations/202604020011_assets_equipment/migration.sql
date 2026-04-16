CREATE TABLE "asset_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "assets"
ADD COLUMN "asset_category_id" TEXT,
ADD COLUMN "current_location" TEXT;

CREATE UNIQUE INDEX "asset_categories_name_key" ON "asset_categories"("name");
CREATE UNIQUE INDEX "asset_categories_code_key" ON "asset_categories"("code");
CREATE INDEX "asset_categories_is_active_idx" ON "asset_categories"("is_active");
CREATE INDEX "assets_asset_category_id_idx" ON "assets"("asset_category_id");

ALTER TABLE "assets"
ADD CONSTRAINT "assets_asset_category_id_fkey"
FOREIGN KEY ("asset_category_id") REFERENCES "asset_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
