-- Three-way match (PR-629 slice 3): VendorInvoice + VendorInvoiceLine +
-- PoReconcileAudit. Compares PO (ordered) vs receipt (received) vs vendor
-- invoice (billed) per line; flags variances; routes out-of-tolerance
-- approval through the AuthorityService seam; writes a reconcile/close
-- audit trail per PO for the project-close audit.

-- ── 1. InvoiceMatchStatus enum ───────────────────────────────────────
CREATE TYPE "InvoiceMatchStatus" AS ENUM (
  'PENDING',
  'MATCHED',
  'HELD',
  'APPROVED',
  'REJECTED'
);

-- ── 2. vendor_invoices ───────────────────────────────────────────────
-- One per supplier invoice received against a PurchaseOrder.
CREATE TABLE "vendor_invoices" (
  "id"                TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "invoice_number"    TEXT NOT NULL,
  "supplier_id"       TEXT NOT NULL,
  "invoice_date"      DATE NOT NULL,
  "due_date"          DATE,
  "currency_code"     TEXT NOT NULL DEFAULT 'AUD',
  "invoiced_total"    DECIMAL(14, 2) NOT NULL,
  "match_status"      "InvoiceMatchStatus" NOT NULL DEFAULT 'PENDING',
  "approved_by_id"    TEXT,
  "approved_at"       TIMESTAMP(3),
  "authority_rule_id" TEXT,
  "notes"             TEXT,
  "created_by_id"     TEXT NOT NULL,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "vendor_invoices_pkey" PRIMARY KEY ("id")
);

-- Composite unique: one invoice number per PO (same supplier could send
-- the same invoice number to different POs if they split a big order).
CREATE UNIQUE INDEX "vendor_invoices_purchase_order_id_invoice_number_key"
  ON "vendor_invoices" ("purchase_order_id", "invoice_number");

CREATE INDEX "vendor_invoices_purchase_order_id_idx" ON "vendor_invoices" ("purchase_order_id");
CREATE INDEX "vendor_invoices_supplier_id_idx"        ON "vendor_invoices" ("supplier_id");
CREATE INDEX "vendor_invoices_match_status_idx"       ON "vendor_invoices" ("match_status");

ALTER TABLE "vendor_invoices"
  ADD CONSTRAINT "vendor_invoices_purchase_order_id_fkey"
  FOREIGN KEY ("purchase_order_id")
  REFERENCES "purchase_orders" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 3. vendor_invoice_lines ──────────────────────────────────────────
-- Per-line breakdown; carries the three-way ordered/received/billed figures.
CREATE TABLE "vendor_invoice_lines" (
  "id"                    TEXT NOT NULL,
  "invoice_id"            TEXT NOT NULL,
  "procurement_line_id"   TEXT,
  "description"           TEXT NOT NULL,
  -- Three-way figures
  "ordered_qty"           DECIMAL(14, 4),
  "received_qty"          DECIMAL(14, 4),
  "billed_qty"            DECIMAL(14, 4) NOT NULL,
  "ordered_unit_price"    DECIMAL(14, 4),
  "billed_unit_price"     DECIMAL(14, 4) NOT NULL,
  "billed_line_total"     DECIMAL(14, 2) NOT NULL,
  -- Computed variance columns (populated by the match run)
  "qty_variance"          DECIMAL(14, 4),
  "price_variance"        DECIMAL(14, 4),
  "within_tolerance"      BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "vendor_invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vendor_invoice_lines_invoice_id_idx"           ON "vendor_invoice_lines" ("invoice_id");
CREATE INDEX "vendor_invoice_lines_procurement_line_id_idx"  ON "vendor_invoice_lines" ("procurement_line_id");

ALTER TABLE "vendor_invoice_lines"
  ADD CONSTRAINT "vendor_invoice_lines_invoice_id_fkey"
  FOREIGN KEY ("invoice_id")
  REFERENCES "vendor_invoices" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 4. po_reconcile_audits ───────────────────────────────────────────
-- One per PO; written when the PO is fully reconciled and closed.
-- Feeds the project-close audit trail required by the procurement spec.
CREATE TABLE "po_reconcile_audits" (
  "id"               TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "reconciled_by_id"  TEXT NOT NULL,
  "reconciled_at"     TIMESTAMP(3) NOT NULL,
  "po_total"          DECIMAL(14, 2) NOT NULL,
  "invoiced_total"    DECIMAL(14, 2) NOT NULL,
  "net_variance"      DECIMAL(14, 2) NOT NULL,
  "notes"             TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "po_reconcile_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "po_reconcile_audits_purchase_order_id_key" ON "po_reconcile_audits" ("purchase_order_id");
CREATE INDEX "po_reconcile_audits_purchase_order_id_idx"        ON "po_reconcile_audits" ("purchase_order_id");

ALTER TABLE "po_reconcile_audits"
  ADD CONSTRAINT "po_reconcile_audits_purchase_order_id_fkey"
  FOREIGN KEY ("purchase_order_id")
  REFERENCES "purchase_orders" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 5. ProcurementConfig — tolerance band columns ────────────────────
-- Config-driven: 0 % default means exact match required (strictest).
-- Director sets per-site tolerance via the admin config surface.
ALTER TABLE "procurement_config"
  ADD COLUMN IF NOT EXISTS "match_qty_tolerance_pct"   DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "match_price_tolerance_pct" DECIMAL(5, 2) NOT NULL DEFAULT 0;
