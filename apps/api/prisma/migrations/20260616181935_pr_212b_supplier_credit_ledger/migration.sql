-- CreateTable
CREATE TABLE "supplier_credit_entries" (
    "id" TEXT NOT NULL,
    "subcontractor_id" TEXT NOT NULL,
    "entry_date" TIMESTAMP(3) NOT NULL,
    "entry_type" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "supplier_credit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_credit_entries_subcontractor_id_idx" ON "supplier_credit_entries"("subcontractor_id");

-- CreateIndex
CREATE INDEX "supplier_credit_entries_entry_date_idx" ON "supplier_credit_entries"("entry_date");

-- AddForeignKey
ALTER TABLE "supplier_credit_entries" ADD CONSTRAINT "supplier_credit_entries_subcontractor_id_fkey" FOREIGN KEY ("subcontractor_id") REFERENCES "subcontractor_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_entries" ADD CONSTRAINT "supplier_credit_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
