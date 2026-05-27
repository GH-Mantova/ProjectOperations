-- AlterTable — add card-header summary override fields to scope_cards
ALTER TABLE "scope_cards" ADD COLUMN "peak_crew_override" INTEGER;
ALTER TABLE "scope_cards" ADD COLUMN "total_person_days_override" DECIMAL(10, 2);
ALTER TABLE "scope_cards" ADD COLUMN "plant_summary_override" TEXT;
ALTER TABLE "scope_cards" ADD COLUMN "duration_override" DECIMAL(10, 2);
