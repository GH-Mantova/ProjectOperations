-- MT-0: Multi-tenant FOUNDATION — additive only.
--
-- Adds the `tenants` table, seeds the one default Tenant row for the existing
-- company, and adds a NULLABLE `tenant_id` FK to each of the five pilot models
-- (clients, workers, contacts, tenders, jobs). Nothing is backfilled, nothing
-- is made NOT NULL, no behaviour changes here.
--
-- Locked decisions (docs/plans/multi-tenant-plan.md, 2026-08-04):
--   * Model A row-level `tenantId` scoping (MT-1).
--   * Backfill + enforcement of NOT NULL is MT-3, not MT-0.
--   * Default tenant id = 'tenant-initial-services-001'
--     (SEEDED_DEFAULT_TENANT_ID in apps/api/src/common/tenancy/tenant.constants.ts).
--
-- Rollback:
--   ALTER TABLE "jobs"      DROP COLUMN "tenant_id";
--   ALTER TABLE "tenders"   DROP COLUMN "tenant_id";
--   ALTER TABLE "contacts"  DROP COLUMN "tenant_id";
--   ALTER TABLE "workers"   DROP COLUMN "tenant_id";
--   ALTER TABLE "clients"   DROP COLUMN "tenant_id";
--   DROP TABLE  "tenants";

-- Table: tenants
CREATE TABLE "tenants" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "code"       TEXT,
    "is_active"  BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");

-- Seed the one default Tenant for the existing company. Idempotent (matches
-- the upsert in apps/api/prisma/seed.ts). MT-3 backfill will point existing
-- clients/workers/contacts/tenders/jobs at this row.
INSERT INTO "tenants" ("id", "name", "code", "is_active", "created_at", "updated_at")
VALUES (
    'tenant-initial-services-001',
    'Initial Services',
    'INITIAL',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

-- Nullable tenant_id FKs on the five pilot models. ON DELETE SET NULL so
-- deleting a Tenant demotes rows to the shared bucket rather than cascading.
ALTER TABLE "clients"  ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "workers"  ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "contacts" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "tenders"  ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "jobs"     ADD COLUMN "tenant_id" TEXT;

CREATE INDEX "clients_tenant_id_idx"  ON "clients"("tenant_id");
CREATE INDEX "workers_tenant_id_idx"  ON "workers"("tenant_id");
CREATE INDEX "contacts_tenant_id_idx" ON "contacts"("tenant_id");
CREATE INDEX "tenders_tenant_id_idx"  ON "tenders"("tenant_id");
CREATE INDEX "jobs_tenant_id_idx"     ON "jobs"("tenant_id");

ALTER TABLE "clients"
    ADD CONSTRAINT "clients_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workers"
    ADD CONSTRAINT "workers_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "contacts"
    ADD CONSTRAINT "contacts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenders"
    ADD CONSTRAINT "tenders_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "jobs"
    ADD CONSTRAINT "jobs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
