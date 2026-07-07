-- CreateEnum
CREATE TYPE "ProcurementRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ISSUED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcurementLineCategory" AS ENUM ('CONSUMABLE', 'EQUIPMENT', 'HIRE', 'ASSET', 'SUBCONTRACT');

-- CreateTable
CREATE TABLE "procurement_requests" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "origin_user_id" TEXT NOT NULL,
    "origin_department" TEXT,
    "job_id" TEXT,
    "status" "ProcurementRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "supplier_id" TEXT,
    "approver_user_id" TEXT,
    "requires_escalation" BOOLEAN NOT NULL DEFAULT false,
    "authority_rule_id" TEXT,
    "quote_evidence_ref" TEXT,
    "notes" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_lines" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ProcurementLineCategory" NOT NULL,
    "stock_item_id" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unit_price" DECIMAL(14,2),
    "line_total" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "issued_to_supplier_id" TEXT NOT NULL,
    "issued_by_user_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "document_ref" TEXT,
    "email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_config" (
    "id" TEXT NOT NULL,
    "min_quote_threshold" DECIMAL(14,2) NOT NULL DEFAULT 5000,
    "required_quotes_at_min" INTEGER NOT NULL DEFAULT 3,
    "rfq_threshold" DECIMAL(14,2) NOT NULL DEFAULT 20000,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procurement_requests_reference_key" ON "procurement_requests"("reference");

-- CreateIndex
CREATE INDEX "procurement_requests_status_idx" ON "procurement_requests"("status");

-- CreateIndex
CREATE INDEX "procurement_requests_origin_user_id_idx" ON "procurement_requests"("origin_user_id");

-- CreateIndex
CREATE INDEX "procurement_requests_supplier_id_idx" ON "procurement_requests"("supplier_id");

-- CreateIndex
CREATE INDEX "procurement_requests_job_id_idx" ON "procurement_requests"("job_id");

-- CreateIndex
CREATE INDEX "procurement_lines_request_id_idx" ON "procurement_lines"("request_id");

-- CreateIndex
CREATE INDEX "procurement_lines_stock_item_id_idx" ON "procurement_lines"("stock_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "purchase_orders_request_id_idx" ON "purchase_orders"("request_id");

-- CreateIndex
CREATE INDEX "purchase_orders_issued_to_supplier_id_idx" ON "purchase_orders"("issued_to_supplier_id");

-- AddForeignKey
ALTER TABLE "procurement_lines" ADD CONSTRAINT "procurement_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "procurement_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "procurement_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
