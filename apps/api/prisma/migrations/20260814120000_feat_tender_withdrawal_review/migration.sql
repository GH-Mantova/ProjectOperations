-- Tender withdrawn-review workflow. Additive & nullable — every existing
-- tender row remains untouched. See docs/architecture/drafts/tender-pipeline-register-plan.md
-- section 8 slice 2/3, and CLAUDE.md incident ledger for the pattern.

-- 1. New nullable column on tenders: tracks the withdrawn-review sub-state
--    (PENDING_REVIEW / CONFIRMED). NULL for every non-withdrawn tender.
ALTER TABLE "tenders" ADD COLUMN "withdrawal_state" TEXT;

-- 2. Append-only review-decision log. One row per Withdraw / Reopen / Confirm
--    action. The tender.withdrawal_state mirror is derived from the latest
--    row here; nothing else joins to this table today.
CREATE TABLE "tender_withdrawal_reviews" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_withdrawal_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tender_withdrawal_reviews_tender_id_idx"
    ON "tender_withdrawal_reviews"("tender_id");
CREATE INDEX "tender_withdrawal_reviews_reviewer_id_idx"
    ON "tender_withdrawal_reviews"("reviewer_id");

ALTER TABLE "tender_withdrawal_reviews"
    ADD CONSTRAINT "tender_withdrawal_reviews_tender_id_fkey"
    FOREIGN KEY ("tender_id") REFERENCES "tenders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tender_withdrawal_reviews"
    ADD CONSTRAINT "tender_withdrawal_reviews_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
