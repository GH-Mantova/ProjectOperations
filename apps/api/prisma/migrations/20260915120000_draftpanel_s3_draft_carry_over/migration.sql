-- DraftPanel S3: carry-over strip -- store what was unfinished when a tender left DRAFT.
-- Additive only: one nullable JSONB column on "tenders". No backfill, no defaults.
-- Shape: { capturedAt: ISO string, rows: [{ step: string, text: string }], dismissedAt?: ISO string }
-- null for tenders that left DRAFT before this shipped, or via the bulk-status action.
-- Rollback: ALTER TABLE "tenders" DROP COLUMN "draft_carry_over";

ALTER TABLE "tenders" ADD COLUMN "draft_carry_over" JSONB;
