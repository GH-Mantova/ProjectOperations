-- Rate-Hub S3: SoR line source enum + markup fields.
-- Additive-only. Existing SorRate rows default to sourceType = MANUAL (matches
-- current behaviour — no linkage to hub or vendor). Existing SorPeriod rows
-- have categoryMarkups = NULL, which the service treats as "no default markup".

-- CreateEnum
CREATE TYPE "SorRateSourceType" AS ENUM ('INTERNAL', 'SUBBIE', 'SUPPLIER', 'MANUAL');

-- AlterTable
ALTER TABLE "sor_periods" ADD COLUMN "category_markups" JSONB;

-- AlterTable
ALTER TABLE "sor_rates"
    ADD COLUMN "source_type" "SorRateSourceType" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN "source_rate_row_id" TEXT,
    ADD COLUMN "source_sub_rate_id" TEXT,
    ADD COLUMN "markup_pct" DECIMAL(6,2);

-- CreateIndex
CREATE INDEX "sor_rates_source_rate_row_id_idx" ON "sor_rates"("source_rate_row_id");

-- CreateIndex
CREATE INDEX "sor_rates_source_sub_rate_id_idx" ON "sor_rates"("source_sub_rate_id");

-- AddForeignKey
ALTER TABLE "sor_rates" ADD CONSTRAINT "sor_rates_source_rate_row_id_fkey"
    FOREIGN KEY ("source_rate_row_id") REFERENCES "rate_rows"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sor_rates" ADD CONSTRAINT "sor_rates_source_sub_rate_id_fkey"
    FOREIGN KEY ("source_sub_rate_id") REFERENCES "subcontractor_rates"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
