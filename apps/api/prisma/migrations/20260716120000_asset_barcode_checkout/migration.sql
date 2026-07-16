-- feat(assets): barcode/QR tags + checkout custody chain
--
-- Extends the Asset model with two optional tag fields:
--   barcode  — 1D barcode string (Code128 / any scanner text output)
--   qr_value — canonical QR payload; web UI renders as QR image when set
--
-- Adds the AssetCheckout table to replace the Jotform "Grice Office Key
-- Checkout" form (see docs/architecture/drafts/jotform-forms-gap-analysis.md).
-- Each check-out event records who holds the asset, when it is due back,
-- and when it was returned. A service-layer guard in AssetsService.checkoutAsset
-- enforces "at most one open checkout per asset" (checked_in_at IS NULL).
--
-- Scan lookup endpoint: GET /assets/scan/:code matches barcode OR qr_value
-- OR (fallback) asset_code — AssetTiger parity.

-- AlterTable: add barcode and qr_value columns to assets
ALTER TABLE "assets"
  ADD COLUMN "barcode"  TEXT,
  ADD COLUMN "qr_value" TEXT;

-- Unique indexes for barcode / qr_value
CREATE UNIQUE INDEX "assets_barcode_key"   ON "assets" ("barcode");
CREATE UNIQUE INDEX "assets_qr_value_key"  ON "assets" ("qr_value");

-- CreateTable: asset_checkouts
CREATE TABLE "asset_checkouts" (
  "id"               TEXT        NOT NULL,
  "asset_id"         TEXT        NOT NULL,
  "holder_worker_id" TEXT,
  "holder_user_id"   TEXT,
  "site_id"          TEXT,
  "job_id"           TEXT,
  "checked_out_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "due_back_at"      TIMESTAMP(3),
  "checked_in_at"    TIMESTAMP(3),
  "notes"            TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "asset_checkouts_pkey" PRIMARY KEY ("id")
);

-- Index for fast open-checkout lookup (WHERE checked_in_at IS NULL)
CREATE INDEX "asset_checkouts_asset_id_checked_in_at_idx"
  ON "asset_checkouts" ("asset_id", "checked_in_at");

CREATE INDEX "asset_checkouts_holder_worker_id_idx"
  ON "asset_checkouts" ("holder_worker_id");

CREATE INDEX "asset_checkouts_holder_user_id_idx"
  ON "asset_checkouts" ("holder_user_id");

-- Foreign keys for asset_checkouts
ALTER TABLE "asset_checkouts"
  ADD CONSTRAINT "asset_checkouts_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "assets" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_checkouts"
  ADD CONSTRAINT "asset_checkouts_holder_worker_id_fkey"
    FOREIGN KEY ("holder_worker_id") REFERENCES "workers" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_checkouts"
  ADD CONSTRAINT "asset_checkouts_holder_user_id_fkey"
    FOREIGN KEY ("holder_user_id") REFERENCES "users" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_checkouts"
  ADD CONSTRAINT "asset_checkouts_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_checkouts"
  ADD CONSTRAINT "asset_checkouts_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
