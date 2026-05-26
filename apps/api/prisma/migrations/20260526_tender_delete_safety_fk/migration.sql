-- DropForeignKey
ALTER TABLE "safety_incidents" DROP CONSTRAINT "safety_incidents_tender_id_fkey";

-- DropForeignKey
ALTER TABLE "hazard_observations" DROP CONSTRAINT "hazard_observations_tender_id_fkey";

-- AddForeignKey
ALTER TABLE "safety_incidents" ADD CONSTRAINT "safety_incidents_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hazard_observations" ADD CONSTRAINT "hazard_observations_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
