-- S2: Vendor delete safeguard — add archivedAt + archivedById to
-- subcontractor_suppliers (rate-hub-sor-integration-plan.md).
-- Pattern mirrors 20260812130000_s1_contract_archive.
-- Additive/nullable only. No backfill required.
--
-- Rollback:
--   DROP INDEX "subcontractor_suppliers_archived_at_idx";
--   ALTER TABLE "subcontractor_suppliers" DROP CONSTRAINT "subcontractor_suppliers_archived_by_id_fkey";
--   ALTER TABLE "subcontractor_suppliers" DROP COLUMN "archived_at";
--   ALTER TABLE "subcontractor_suppliers" DROP COLUMN "archived_by_id";

ALTER TABLE "subcontractor_suppliers"
    ADD COLUMN "archived_at"    TIMESTAMP(3),
    ADD COLUMN "archived_by_id" TEXT;

CREATE INDEX "subcontractor_suppliers_archived_at_idx"
    ON "subcontractor_suppliers"("archived_at");

ALTER TABLE "subcontractor_suppliers"
    ADD CONSTRAINT "subcontractor_suppliers_archived_by_id_fkey"
    FOREIGN KEY ("archived_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
