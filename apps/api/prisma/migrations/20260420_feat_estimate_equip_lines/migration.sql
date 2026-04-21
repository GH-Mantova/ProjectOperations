-- Equipment hire & subcontractors line items
CREATE TABLE "estimate_equip_lines" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "qty" DECIMAL(8,2) NOT NULL,
  "duration" DECIMAL(8,2) NOT NULL,
  "period" TEXT NOT NULL DEFAULT 'Day',
  "rate" DECIMAL(10,2) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "estimate_equip_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "estimate_equip_lines_item_id_idx" ON "estimate_equip_lines"("item_id");
ALTER TABLE "estimate_equip_lines" ADD CONSTRAINT "estimate_equip_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "estimate_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
