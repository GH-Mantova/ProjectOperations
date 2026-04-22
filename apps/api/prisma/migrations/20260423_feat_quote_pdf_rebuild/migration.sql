-- Rate snapshot: pinned when the tender first transitions to SUBMITTED so
-- the Quote tab can display "Rates as of [date]" and admins have an audit
-- trail for rate-library changes that landed after submission.
ALTER TABLE "tenders" ADD COLUMN "rates_snapshot_at" TIMESTAMP(3);
