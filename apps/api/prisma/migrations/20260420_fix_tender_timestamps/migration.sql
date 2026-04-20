-- Tender lifecycle timestamps — enables clean follow-up / win-rate queries
ALTER TABLE "tenders" ADD COLUMN "submitted_at" TIMESTAMP(3);
ALTER TABLE "tenders" ADD COLUMN "won_at" TIMESTAMP(3);
ALTER TABLE "tenders" ADD COLUMN "lost_at" TIMESTAMP(3);

-- Backfill from existing updated_at based on current status
UPDATE "tenders"
SET "submitted_at" = "updated_at"
WHERE "status" IN ('SUBMITTED', 'AWARDED', 'LOST', 'CONVERTED', 'CONTRACT_ISSUED');

UPDATE "tenders"
SET "won_at" = "updated_at"
WHERE "status" IN ('AWARDED', 'CONVERTED', 'CONTRACT_ISSUED');

UPDATE "tenders"
SET "lost_at" = "updated_at"
WHERE "status" = 'LOST';
