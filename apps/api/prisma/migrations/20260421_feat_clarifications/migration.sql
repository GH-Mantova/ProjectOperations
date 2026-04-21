-- Tender clarification notes — simple sent/received log for the Overview
-- tab. Parallel to the existing tender_clarifications table, which is a
-- Q&A model used by the follow-up queue and therefore kept unchanged.

CREATE TABLE "tender_clarification_notes" (
  "id" TEXT NOT NULL,
  "tender_id" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tender_clarification_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tender_clarification_notes_tender_id_occurred_at_idx"
  ON "tender_clarification_notes"("tender_id", "occurred_at");

ALTER TABLE "tender_clarification_notes"
  ADD CONSTRAINT "tender_clarification_notes_tender_id_fkey"
  FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tender_clarification_notes"
  ADD CONSTRAINT "tender_clarification_notes_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
