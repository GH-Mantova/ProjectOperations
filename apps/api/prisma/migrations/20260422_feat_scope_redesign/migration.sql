-- Scope of Works redesign — generic measurement/material/plant columns
-- on ScopeOfWorksItem, plus the new ScopeViewConfig (per-discipline column
-- visibility) and CuttingSheetItem (standalone cutting sheet per tender).

ALTER TABLE "scope_of_works_items" ADD COLUMN "waste_group" TEXT;
ALTER TABLE "scope_of_works_items" ADD COLUMN "measurement_qty" DECIMAL(12,3);
ALTER TABLE "scope_of_works_items" ADD COLUMN "measurement_unit" TEXT;
ALTER TABLE "scope_of_works_items" ADD COLUMN "material" TEXT;
ALTER TABLE "scope_of_works_items" ADD COLUMN "plant_asset_id" TEXT;

ALTER TABLE "scope_of_works_items"
  ADD CONSTRAINT "scope_of_works_items_plant_asset_id_fkey"
  FOREIGN KEY ("plant_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "scope_view_configs" (
  "id" TEXT NOT NULL,
  "tender_id" TEXT NOT NULL,
  "discipline" TEXT NOT NULL,
  "columns" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scope_view_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "scope_view_configs_tender_id_discipline_key"
  ON "scope_view_configs"("tender_id", "discipline");

ALTER TABLE "scope_view_configs"
  ADD CONSTRAINT "scope_view_configs_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cutting_sheet_items" (
  "id" TEXT NOT NULL,
  "tender_id" TEXT NOT NULL,
  "wbs_ref" TEXT NOT NULL,
  "description" TEXT,
  "item_type" TEXT NOT NULL,
  "equipment" TEXT,
  "elevation" TEXT,
  "material" TEXT,
  "depth_mm" INTEGER,
  "diameter_mm" INTEGER,
  "quantity_lm" DECIMAL(10,2),
  "quantity_each" INTEGER,
  "rate_per_m" DECIMAL(10,4),
  "rate_per_hole" DECIMAL(10,4),
  "line_total" DECIMAL(12,2),
  "shift" TEXT,
  "shift_loading" DECIMAL(10,2),
  "notes" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cutting_sheet_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cutting_sheet_items_tender_id_item_type_sort_order_idx"
  ON "cutting_sheet_items"("tender_id", "item_type", "sort_order");

ALTER TABLE "cutting_sheet_items"
  ADD CONSTRAINT "cutting_sheet_items_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cutting_sheet_items"
  ADD CONSTRAINT "cutting_sheet_items_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
