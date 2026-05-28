-- AlterTable: rename override column to match the new "Labour days" semantics
ALTER TABLE "scope_cards" RENAME COLUMN "total_person_days_override" TO "labour_days_override";
