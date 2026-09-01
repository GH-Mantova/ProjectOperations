-- scope-subcontracted order 3 — per-line provisional flag
-- Additive only: adds one boolean column with DEFAULT false.
-- Every existing row reads false, which is exactly current behaviour.
-- Safe to leave applied if the run dies mid-flight (no data loss, no
-- semantic change to any row).
ALTER TABLE "scope_of_works_items" ADD COLUMN "is_provisional" BOOLEAN NOT NULL DEFAULT false;
