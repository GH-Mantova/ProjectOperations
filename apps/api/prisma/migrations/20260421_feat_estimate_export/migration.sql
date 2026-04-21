-- Estimate export audit trail — one row per generated PDF / Excel export.

CREATE TABLE "estimate_exports" (
  "id"           TEXT         NOT NULL,
  "tender_id"    TEXT         NOT NULL,
  "type"         TEXT         NOT NULL,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generated_by" TEXT         NOT NULL,
  "file_path"    TEXT,
  "version"      INTEGER      NOT NULL DEFAULT 1,
  CONSTRAINT "estimate_exports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "estimate_exports_tender_id_idx" ON "estimate_exports"("tender_id");

ALTER TABLE "estimate_exports" ADD CONSTRAINT "estimate_exports_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "estimate_exports" ADD CONSTRAINT "estimate_exports_generated_by_fkey"
  FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
