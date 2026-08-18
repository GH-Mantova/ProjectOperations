-- TFM-S5: Add folder provisioning status + error log to Tender.
-- Both columns are nullable with no default and no constraint.
-- No row mutation: existing rows remain NULL until their next provisioning attempt.
ALTER TABLE "tenders" ADD COLUMN "folder_provisioning_status" TEXT;
ALTER TABLE "tenders" ADD COLUMN "folder_provisioning_errors" JSONB;
