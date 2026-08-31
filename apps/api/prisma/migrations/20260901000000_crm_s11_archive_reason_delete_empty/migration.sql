-- CRM-S11: Archive with a governed reason; delete only when empty.
-- Additive only: four nullable columns on opportunities.
-- Zero rows written, renamed, or deleted. No existing column altered.
--
-- Decision (Marco 2026-08-27, rule #8):
--   Archive requires a DropReason (same governed list as dont-pursue).
--   Delete is permitted only on an entry that carries no content
--   (description, contact, account, estimatedValue, dropReason,
--    convertedTender, or an anchored comms thread).
--
-- Changes:
--   1. opportunities.archive_reason_id   String? FK -> drop_reasons.id  (SetNull)
--   2. opportunities.archive_reason_detail String?
--   3. opportunities.archived_at          DateTime?
--   4. opportunities.archived_by_id       String? FK -> users.id         (SetNull)
--
-- Rollback (before any consumer ships):
--   ALTER TABLE "opportunities"
--     DROP COLUMN "archive_reason_id",
--     DROP COLUMN "archive_reason_detail",
--     DROP COLUMN "archived_at",
--     DROP COLUMN "archived_by_id";

-- 1. archive_reason_id (FK to drop_reasons, SetNull on delete)
ALTER TABLE "opportunities"
  ADD COLUMN "archive_reason_id" TEXT,
  ADD CONSTRAINT "opportunities_archive_reason_id_fkey"
    FOREIGN KEY ("archive_reason_id")
    REFERENCES "drop_reasons"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. archive_reason_detail (free-text, optional)
ALTER TABLE "opportunities"
  ADD COLUMN "archive_reason_detail" TEXT;

-- 3. archived_at (timestamp)
ALTER TABLE "opportunities"
  ADD COLUMN "archived_at" TIMESTAMP(3);

-- 4. archived_by_id (FK to users, SetNull on delete)
ALTER TABLE "opportunities"
  ADD COLUMN "archived_by_id" TEXT,
  ADD CONSTRAINT "opportunities_archived_by_id_fkey"
    FOREIGN KEY ("archived_by_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
