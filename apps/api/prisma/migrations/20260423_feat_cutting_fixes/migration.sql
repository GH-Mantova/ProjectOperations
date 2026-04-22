-- Cutting sheet additions — Other-rates catalogue + FK on CuttingSheetItem.
-- Dated 20260423 so it sorts after 20260422_feat_scope_redesign (which
-- creates cutting_sheet_items) on fresh-DB replay.

CREATE TABLE "cutting_other_rates" (
  "id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "rate" DECIMAL(10, 2) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "cutting_other_rates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cutting_other_rates_is_active_sort_order_idx"
  ON "cutting_other_rates"("is_active", "sort_order");

ALTER TABLE "cutting_sheet_items" ADD COLUMN "other_rate_id" TEXT;
ALTER TABLE "cutting_sheet_items"
  ADD CONSTRAINT "cutting_sheet_items_other_rate_id_fkey"
  FOREIGN KEY ("other_rate_id") REFERENCES "cutting_other_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
