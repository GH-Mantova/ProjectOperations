-- GATE-ALLOW: migrations
-- RC-1 — SubcontractorRate model (additive, 2026-08-11).
-- Append-only supersede rule: rate/unit/discipline are never mutated on an
-- existing row. Editing = new row + flip old row isActive=false in one tx.
-- One new table (subcontractor_rates) + one FK to subcontractor_suppliers.
-- No columns added to any existing table. Zero blast radius on RateResolverService.

-- CreateTable
CREATE TABLE "subcontractor_rates" (
    "id" TEXT NOT NULL,
    "subcontractor_supplier_id" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(10,2) NOT NULL,
    "valid_from" DATE,
    "valid_to" DATE,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "updated_by_id" TEXT,

    CONSTRAINT "subcontractor_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subcontractor_rates_subcontractor_supplier_id_idx"
    ON "subcontractor_rates"("subcontractor_supplier_id");

-- CreateIndex
CREATE INDEX "subcontractor_rates_subcontractor_supplier_id_discipline_is_active_idx"
    ON "subcontractor_rates"("subcontractor_supplier_id", "discipline", "is_active");

-- AddForeignKey
ALTER TABLE "subcontractor_rates"
    ADD CONSTRAINT "subcontractor_rates_subcontractor_supplier_id_fkey"
    FOREIGN KEY ("subcontractor_supplier_id")
    REFERENCES "subcontractor_suppliers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_rates"
    ADD CONSTRAINT "subcontractor_rates_created_by_id_fkey"
    FOREIGN KEY ("created_by_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcontractor_rates"
    ADD CONSTRAINT "subcontractor_rates_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
