-- F-5 (Signature v2) — role-gated signing + submission sealing.
-- All columns are nullable so no backfill is required; historical rows
-- keep their existing semantics (name-only signatures, no seal).

ALTER TABLE "form_signatures"
  ADD COLUMN "required_role" TEXT,
  ADD COLUMN "signed_by_id"  TEXT;

ALTER TABLE "form_submissions"
  ADD COLUMN "sealed_at" TIMESTAMP(3);
