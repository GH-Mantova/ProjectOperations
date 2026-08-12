-- S1: Contract soft-archive — add archivedAt + archivedById to contracts.
-- Pattern: reuses JobCloseout.archivedAt / archivedById (schema.prisma:1639-1640).
-- Additive/nullable only. No backfill required.
--
-- Rollback:
--   DROP INDEX "contracts_archived_at_idx";
--   ALTER TABLE "contracts" DROP COLUMN "archived_at";
--   ALTER TABLE "contracts" DROP COLUMN "archived_by_id";

ALTER TABLE "contracts"
    ADD COLUMN "archived_at"   TIMESTAMP(3),
    ADD COLUMN "archived_by_id" TEXT;

CREATE INDEX "contracts_archived_at_idx"
    ON "contracts"("archived_at");

ALTER TABLE "contracts"
    ADD CONSTRAINT "contracts_archived_by_id_fkey"
    FOREIGN KEY ("archived_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
