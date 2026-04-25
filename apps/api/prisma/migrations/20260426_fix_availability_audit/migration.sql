-- Worker leave audit trail
ALTER TABLE "worker_leaves"
  ADD COLUMN "requested_by_id" TEXT;

ALTER TABLE "worker_leaves"
  ADD CONSTRAINT "worker_leaves_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve consent withdrawal timestamp
ALTER TABLE "worker_profiles"
  ADD COLUMN "location_consent_revoked_at" TIMESTAMP(3);
