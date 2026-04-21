-- Quote tab — per-tender editable T&C clauses, assumptions, and exclusions.
-- T&C clauses seed from tc-text.const.ts on first read at the service layer.

CREATE TABLE "tender_tandc" (
  "id" TEXT NOT NULL,
  "tender_id" TEXT NOT NULL,
  "clauses" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tender_tandc_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tender_tandc_tender_id_key" ON "tender_tandc"("tender_id");

ALTER TABLE "tender_tandc"
  ADD CONSTRAINT "tender_tandc_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tender_assumptions" (
  "id" TEXT NOT NULL,
  "tender_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tender_assumptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tender_assumptions_tender_id_sort_order_idx"
  ON "tender_assumptions"("tender_id", "sort_order");

ALTER TABLE "tender_assumptions"
  ADD CONSTRAINT "tender_assumptions_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tender_exclusions" (
  "id" TEXT NOT NULL,
  "tender_id" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tender_exclusions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tender_exclusions_tender_id_sort_order_idx"
  ON "tender_exclusions"("tender_id", "sort_order");

ALTER TABLE "tender_exclusions"
  ADD CONSTRAINT "tender_exclusions_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
