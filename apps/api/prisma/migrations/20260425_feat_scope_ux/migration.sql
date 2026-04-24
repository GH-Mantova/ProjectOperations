-- ── TenderClarificationNote: note_type column ──────────────────────
-- Extends the comms log so entries can be categorised as call / email /
-- meeting / note / response in the unified clarifications UI. RFIs are
-- still a separate model (TenderClarification); existing rows default
-- to "note".
ALTER TABLE "tender_clarification_notes"
  ADD COLUMN "note_type" TEXT NOT NULL DEFAULT 'note';
