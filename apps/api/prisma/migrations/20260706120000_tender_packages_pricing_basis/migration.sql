-- CreateEnum
CREATE TYPE "TenderPricingBasis" AS ENUM ('DOCUMENTS', 'CLIENT_REQUEST', 'IDENTIFIED_RISK');

-- AlterTable
ALTER TABLE "tender_clients" ADD COLUMN "submission_date" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "tender_packages" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "discipline_item_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_client_packages" (
    "id" TEXT NOT NULL,
    "tender_client_id" TEXT NOT NULL,
    "tender_package_id" TEXT NOT NULL,
    "pricing_basis" "TenderPricingBasis" NOT NULL DEFAULT 'DOCUMENTS',
    "basis_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_client_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tender_packages_tender_id_idx" ON "tender_packages"("tender_id");

-- CreateIndex
CREATE INDEX "tender_packages_discipline_item_id_idx" ON "tender_packages"("discipline_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "tender_packages_tender_id_discipline_item_id_key" ON "tender_packages"("tender_id", "discipline_item_id");

-- CreateIndex
CREATE INDEX "tender_client_packages_tender_client_id_idx" ON "tender_client_packages"("tender_client_id");

-- CreateIndex
CREATE INDEX "tender_client_packages_tender_package_id_idx" ON "tender_client_packages"("tender_package_id");

-- CreateIndex
CREATE UNIQUE INDEX "tender_client_packages_tender_client_id_tender_package_id_key" ON "tender_client_packages"("tender_client_id", "tender_package_id");

-- AddForeignKey
ALTER TABLE "tender_packages" ADD CONSTRAINT "tender_packages_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_packages" ADD CONSTRAINT "tender_packages_discipline_item_id_fkey" FOREIGN KEY ("discipline_item_id") REFERENCES "global_list_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_client_packages" ADD CONSTRAINT "tender_client_packages_tender_client_id_fkey" FOREIGN KEY ("tender_client_id") REFERENCES "tender_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_client_packages" ADD CONSTRAINT "tender_client_packages_tender_package_id_fkey" FOREIGN KEY ("tender_package_id") REFERENCES "tender_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
