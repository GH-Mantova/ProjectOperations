-- S1: Add vendorTypeId FK on subcontractor_suppliers → global_list_items.
-- Additive only: nullable column, no UPDATE, no DROP, no backfill required.
-- Vendors with no vendorTypeId appear in the "Untyped" group on the hub tab.

ALTER TABLE "subcontractor_suppliers"
  ADD COLUMN "vendor_type_id" TEXT;

-- FK: CASCADE=SetNull so archiving/deleting a GlobalListItem does not orphan the vendor.
ALTER TABLE "subcontractor_suppliers"
  ADD CONSTRAINT "subcontractor_suppliers_vendor_type_id_fkey"
  FOREIGN KEY ("vendor_type_id")
  REFERENCES "global_list_items"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "subcontractor_suppliers_vendor_type_id_idx"
  ON "subcontractor_suppliers"("vendor_type_id");
