-- ============================================================================
-- §5A.3 — Team-as-estimator + client-filtered activity (backend, PR-63a)
-- ============================================================================
-- Adds two nullable columns:
--   * tenders.assigned_estimator_id        → user assigned via the Team panel
--   * tender_clarification_notes.client_id → optional client link so the
--                                            Activity sidebar can filter
-- Both columns are nullable with no backfill — existing rows default to NULL.
-- ============================================================================

ALTER TABLE "tenders"
  ADD COLUMN "assigned_estimator_id" TEXT;

ALTER TABLE "tenders"
  ADD CONSTRAINT "tenders_assigned_estimator_id_fkey"
  FOREIGN KEY ("assigned_estimator_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tenders_assigned_estimator_id_idx"
  ON "tenders"("assigned_estimator_id");

ALTER TABLE "tender_clarification_notes"
  ADD COLUMN "client_id" TEXT;

ALTER TABLE "tender_clarification_notes"
  ADD CONSTRAINT "tender_clarification_notes_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tender_clarification_notes_client_id_idx"
  ON "tender_clarification_notes"("client_id");
