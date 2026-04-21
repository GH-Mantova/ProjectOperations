-- Resource Allocation — WorkerProfile (HR/compliance roster) + ProjectAllocation (worker/asset → project over time).

CREATE TYPE "AllocationTargetType" AS ENUM ('WORKER', 'ASSET');

ALTER TYPE "ProjectActivityAction" ADD VALUE 'WORKER_ALLOCATED';
ALTER TYPE "ProjectActivityAction" ADD VALUE 'ASSET_ALLOCATED';

CREATE TABLE "worker_profiles" (
  "id"                      TEXT         NOT NULL,
  "first_name"              TEXT         NOT NULL,
  "last_name"               TEXT         NOT NULL,
  "preferred_name"          TEXT,
  "role"                    TEXT         NOT NULL,
  "phone"                   TEXT,
  "email"                   TEXT,
  "emergency_contact_name"  TEXT,
  "emergency_contact_phone" TEXT,
  "licence_number"          TEXT,
  "licence_class"           TEXT,
  "ticket_numbers"          TEXT,
  "has_mobile_access"       BOOLEAN      NOT NULL DEFAULT false,
  "internal_user_id"        TEXT,
  "is_active"               BOOLEAN      NOT NULL DEFAULT true,
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3) NOT NULL,
  CONSTRAINT "worker_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "worker_profiles_email_key" ON "worker_profiles"("email");
CREATE UNIQUE INDEX "worker_profiles_internal_user_id_key" ON "worker_profiles"("internal_user_id");
CREATE INDEX "worker_profiles_is_active_idx" ON "worker_profiles"("is_active");
CREATE INDEX "worker_profiles_last_name_first_name_idx" ON "worker_profiles"("last_name", "first_name");
ALTER TABLE "worker_profiles" ADD CONSTRAINT "worker_profiles_internal_user_id_fkey"
  FOREIGN KEY ("internal_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "project_allocations" (
  "id"                TEXT                    NOT NULL,
  "project_id"        TEXT                    NOT NULL,
  "type"              "AllocationTargetType"  NOT NULL,
  "worker_profile_id" TEXT,
  "asset_id"          TEXT,
  "role_on_project"   TEXT,
  "start_date"        TIMESTAMP(3)            NOT NULL,
  "end_date"          TIMESTAMP(3),
  "notes"             TEXT,
  "created_by_id"     TEXT                    NOT NULL,
  "created_at"        TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3)            NOT NULL,
  CONSTRAINT "project_allocations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_allocations_project_id_type_idx" ON "project_allocations"("project_id", "type");
CREATE INDEX "project_allocations_worker_profile_id_start_date_idx" ON "project_allocations"("worker_profile_id", "start_date");
CREATE INDEX "project_allocations_asset_id_start_date_idx" ON "project_allocations"("asset_id", "start_date");
ALTER TABLE "project_allocations" ADD CONSTRAINT "project_allocations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_allocations" ADD CONSTRAINT "project_allocations_worker_profile_id_fkey"
  FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_allocations" ADD CONSTRAINT "project_allocations_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_allocations" ADD CONSTRAINT "project_allocations_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
