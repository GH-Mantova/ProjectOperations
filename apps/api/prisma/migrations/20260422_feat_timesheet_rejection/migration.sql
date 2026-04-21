-- Timesheet rejection — returns a SUBMITTED timesheet to DRAFT with a reason
-- so the worker can correct and resubmit.

ALTER TYPE "ProjectActivityAction" ADD VALUE 'TIMESHEET_REJECTED';

ALTER TABLE "timesheets" ADD COLUMN "rejected_reason" TEXT;
ALTER TABLE "timesheets" ADD COLUMN "rejected_by_id" TEXT;
ALTER TABLE "timesheets" ADD COLUMN "rejected_at" TIMESTAMP(3);

ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_rejected_by_id_fkey"
  FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
