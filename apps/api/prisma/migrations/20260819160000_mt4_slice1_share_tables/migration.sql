-- MT-4 SLICE 1: Explicit share-grant tables (D48 — one table per domain).
--
-- Adds three join tables that record an explicit share grant from an owning
-- tenant to a grantee tenant.  One table per shareable domain so each FK is
-- real and cascade behaviour is configurable per domain.
--
-- Classification (docs/plans/multi-tenant-plan.md, SLICE 1):
--   ClientShare  — shares a Client row with a grantee Tenant
--   WorkerShare  — shares a Worker row with a grantee Tenant
--   ContactShare — shares a Contact row with a grantee Tenant
--
-- These tables are purely additive.  No existing query reads them; the
-- scoping middleware is unchanged.  SLICE 3 adds the OR EXISTS filter.
--
-- Rollback:
--   DROP TABLE "contact_shares";
--   DROP TABLE "worker_shares";
--   DROP TABLE "client_shares";

-- client_shares
CREATE TABLE "client_shares" (
    "id"                TEXT NOT NULL,
    "client_id"         TEXT NOT NULL,
    "grantee_tenant_id" TEXT NOT NULL,
    "granted_by_user_id" TEXT NOT NULL,
    "granted_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note"              TEXT,

    CONSTRAINT "client_shares_pkey" PRIMARY KEY ("id")
);

-- worker_shares
CREATE TABLE "worker_shares" (
    "id"                TEXT NOT NULL,
    "worker_id"         TEXT NOT NULL,
    "grantee_tenant_id" TEXT NOT NULL,
    "granted_by_user_id" TEXT NOT NULL,
    "granted_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note"              TEXT,

    CONSTRAINT "worker_shares_pkey" PRIMARY KEY ("id")
);

-- contact_shares
CREATE TABLE "contact_shares" (
    "id"                TEXT NOT NULL,
    "contact_id"        TEXT NOT NULL,
    "grantee_tenant_id" TEXT NOT NULL,
    "granted_by_user_id" TEXT NOT NULL,
    "granted_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note"              TEXT,

    CONSTRAINT "contact_shares_pkey" PRIMARY KEY ("id")
);

-- Unique indexes (cannot grant same record to same tenant twice)
CREATE UNIQUE INDEX "client_shares_client_id_grantee_tenant_id_key"
    ON "client_shares"("client_id", "grantee_tenant_id");

CREATE UNIQUE INDEX "worker_shares_worker_id_grantee_tenant_id_key"
    ON "worker_shares"("worker_id", "grantee_tenant_id");

CREATE UNIQUE INDEX "contact_shares_contact_id_grantee_tenant_id_key"
    ON "contact_shares"("contact_id", "grantee_tenant_id");

-- Secondary indexes for grantee and grantor lookups
CREATE INDEX "client_shares_grantee_tenant_id_idx"
    ON "client_shares"("grantee_tenant_id");

CREATE INDEX "client_shares_granted_by_user_id_idx"
    ON "client_shares"("granted_by_user_id");

CREATE INDEX "worker_shares_grantee_tenant_id_idx"
    ON "worker_shares"("grantee_tenant_id");

CREATE INDEX "worker_shares_granted_by_user_id_idx"
    ON "worker_shares"("granted_by_user_id");

CREATE INDEX "contact_shares_grantee_tenant_id_idx"
    ON "contact_shares"("grantee_tenant_id");

CREATE INDEX "contact_shares_granted_by_user_id_idx"
    ON "contact_shares"("granted_by_user_id");

-- Foreign keys: client_shares
ALTER TABLE "client_shares"
    ADD CONSTRAINT "client_shares_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "client_shares"
    ADD CONSTRAINT "client_shares_grantee_tenant_id_fkey"
    FOREIGN KEY ("grantee_tenant_id") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_shares"
    ADD CONSTRAINT "client_shares_granted_by_user_id_fkey"
    FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: worker_shares
ALTER TABLE "worker_shares"
    ADD CONSTRAINT "worker_shares_worker_id_fkey"
    FOREIGN KEY ("worker_id") REFERENCES "workers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "worker_shares"
    ADD CONSTRAINT "worker_shares_grantee_tenant_id_fkey"
    FOREIGN KEY ("grantee_tenant_id") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "worker_shares"
    ADD CONSTRAINT "worker_shares_granted_by_user_id_fkey"
    FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: contact_shares
ALTER TABLE "contact_shares"
    ADD CONSTRAINT "contact_shares_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contact_shares"
    ADD CONSTRAINT "contact_shares_grantee_tenant_id_fkey"
    FOREIGN KEY ("grantee_tenant_id") REFERENCES "tenants"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contact_shares"
    ADD CONSTRAINT "contact_shares_granted_by_user_id_fkey"
    FOREIGN KEY ("granted_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
