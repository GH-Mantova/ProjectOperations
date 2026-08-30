-- CRM-S3: Backfill contacts.account_id and opportunities.account_id
-- from their client relation where an Account now exists.
--
-- Depends on 20260831010000_crm_s3_backfill_missing_accounts running first
-- (all Clients now have an Account). Apply in migration order.
--
-- Idempotent: both UPDATE statements are guarded by WHERE account_id IS NULL
-- so re-running changes no row a second time.
-- Additive only: only the two nullable FK columns are written; no other
-- column on any row is touched.
--
-- Rollback: UPDATE "contacts" SET "account_id" = NULL WHERE <filter by
-- updated_at>; same for "opportunities". No structural change is made.

-- 1. Backfill contacts.account_id
--    Contacts with organisation_type = 'CLIENT' are linked via
--    organisation_id to a Client row. If that Client has an Account, set
--    contact.account_id to the Account's id.
UPDATE "contacts" ct
SET    "account_id" = a."id"
FROM   "accounts" a
WHERE  ct."account_id" IS NULL
  AND  ct."organisation_type" = 'CLIENT'
  AND  a."client_id" = ct."organisation_id";

-- 2. Backfill opportunities.account_id via client_id
--    Opportunities carry a direct client_id FK. Join to the Account that
--    wraps the same Client. This is the most reliable join: does not depend
--    on contact linkage having been completed first.
UPDATE "opportunities" opp
SET    "account_id" = a."id"
FROM   "accounts" a
WHERE  opp."account_id" IS NULL
  AND  opp."client_id" IS NOT NULL
  AND  a."client_id" = opp."client_id";
