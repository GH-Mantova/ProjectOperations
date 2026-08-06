-- F-4 wave 1: Unique ID field type — atomic sequential counter (PR fv2-unique-id-sequence).
-- Mirrors safety_incident_number_sequences / hazard_number_sequences exactly.
-- A single row (id = 1) is upserted on first use; the FormNumberSequenceService
-- increments it inside a Prisma transaction for row-level serialisation.

-- ─── Sequence ────────────────────────────────────────────────────────────────
CREATE TABLE "form_number_sequences" (
  "id"          INTEGER PRIMARY KEY DEFAULT 1,
  "last_number" INTEGER NOT NULL DEFAULT 0
);
