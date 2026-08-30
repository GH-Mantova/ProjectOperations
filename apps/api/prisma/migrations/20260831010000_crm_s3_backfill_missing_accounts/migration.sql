-- CRM-S3: Backfill missing Account rows — one PROSPECT Account per Client
-- that has no Account yet.
--
-- Idempotent: guarded by WHERE NOT EXISTS so re-running changes no row a
-- second time. Additive only: creates Account rows and sets no other column.
-- Lifecycle is PROSPECT for all — no inference. Marco reviews lifecycle
-- upgrade per row in S4.
--
-- Rollback: archive or DELETE the inserted rows by filtering on created_at
-- >= the migration timestamp. No structural change is made.

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
  gen_random_uuid()::text,
  c."id",
  'PROSPECT'::"AccountLifecycleStatus",
  'CLIENT'::"AccountType",
  'OTHER'::"AccountSource",
  now(),
  now()
FROM "clients" c
WHERE NOT EXISTS (
  SELECT 1 FROM "accounts" a WHERE a."client_id" = c."id"
);
