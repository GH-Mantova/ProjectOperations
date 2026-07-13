-- Editable permissions matrix (Marco, 2026-07-13).
--
-- Additive: adds human labels + high-risk flag to permissions and a
-- separate lookup table for module display names. Existing rows keep
-- their code + description. Seed refreshes labels on next run.

ALTER TABLE "permissions"
  ADD COLUMN IF NOT EXISTS "label" TEXT NOT NULL DEFAULT '';

ALTER TABLE "permissions"
  ADD COLUMN IF NOT EXISTS "is_high_risk" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "permission_modules" (
  "name"       TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "permission_modules_pkey" PRIMARY KEY ("name")
);
