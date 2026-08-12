-- CRM-1: Account foundation — Account spine + Client backfill.
-- Additive only. Idempotent on clientId (INSERT ... WHERE NOT EXISTS).
--
-- Enums: AccountLifecycleStatus, AccountType, AccountSource
-- Table: accounts (id, client_id UNIQUE, lifecycle_status, account_type,
--         source, owner_id, notes, archived_at, archived_by_id,
--         created_at, updated_at)
-- Indexes: lifecycle_status, archived_at, owner_id
-- FKs: client_id → clients(id) SET NULL, owner_id → users(id) SET NULL,
--      archived_by_id → users(id) SET NULL
-- Backfill: one Account per existing Client (idempotent, insert-only)
--
-- Rollback:
--   DROP TABLE "accounts";
--   DROP TYPE "AccountLifecycleStatus";
--   DROP TYPE "AccountType";
--   DROP TYPE "AccountSource";

-- Enums
CREATE TYPE "AccountLifecycleStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'PAST');
CREATE TYPE "AccountType" AS ENUM ('CLIENT', 'PROSPECT', 'HEAD_CONTRACTOR', 'SUBCONTRACTOR', 'PARTNER', 'OTHER');
CREATE TYPE "AccountSource" AS ENUM ('REFERRAL', 'DIRECT', 'TENDER_PORTAL', 'COLD_OUTREACH', 'REPEAT_BUSINESS', 'OTHER');

-- Table
CREATE TABLE "accounts" (
    "id"               TEXT NOT NULL,
    "client_id"        TEXT,
    "lifecycle_status" "AccountLifecycleStatus" NOT NULL DEFAULT 'PROSPECT',
    "account_type"     "AccountType"            NOT NULL DEFAULT 'CLIENT',
    "source"           "AccountSource"          NOT NULL DEFAULT 'OTHER',
    "owner_id"         TEXT,
    "notes"            TEXT,
    "archived_at"      TIMESTAMP(3),
    "archived_by_id"   TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on clientId (1:1 with Client)
CREATE UNIQUE INDEX "accounts_client_id_key"
    ON "accounts"("client_id");

-- Indexes
CREATE INDEX "accounts_lifecycle_status_idx"
    ON "accounts"("lifecycle_status");

CREATE INDEX "accounts_archived_at_idx"
    ON "accounts"("archived_at");

CREATE INDEX "accounts_owner_id_idx"
    ON "accounts"("owner_id");

-- Foreign keys
ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounts"
    ADD CONSTRAINT "accounts_archived_by_id_fkey"
    FOREIGN KEY ("archived_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one ACTIVE Account per existing Client (idempotent — safe to re-run)
-- Uses gen_random_uuid() converted to text as a cuid-compatible id for backfill rows.
-- Each Client that has is_active = true gets lifecycleStatus = ACTIVE;
-- inactive clients get PAST.
INSERT INTO "accounts" (
    "id",
    "client_id",
    "lifecycle_status",
    "account_type",
    "source",
    "created_at",
    "updated_at"
)
SELECT
    -- Use gen_random_uuid() as a stable, unique id for each backfill row.
    -- Prisma cuid() is only used by the app layer; SQL backfills may use uuid.
    gen_random_uuid()::text,
    c."id",
    CASE WHEN c."is_active" THEN 'ACTIVE'::"AccountLifecycleStatus"
         ELSE 'PAST'::"AccountLifecycleStatus"
    END,
    'CLIENT'::"AccountType",
    'OTHER'::"AccountSource",
    c."created_at",
    c."updated_at"
FROM "clients" c
WHERE NOT EXISTS (
    SELECT 1 FROM "accounts" a WHERE a."client_id" = c."id"
);
