-- GATE-ALLOW: migrations
-- PR-452 Day-grain ScheduleAllocation (additive). See apps/api/src/modules/scheduler/schedule-allocation.service.ts.

-- CreateEnum
CREATE TYPE "ScheduleTargetType" AS ENUM ('WORKER', 'ASSET');

-- CreateTable
CREATE TABLE "schedule_allocations" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "project_id" TEXT NOT NULL,
    "target_type" "ScheduleTargetType" NOT NULL,
    "worker_profile_id" TEXT,
    "asset_id" TEXT,
    "job_role_id" TEXT,
    "note" TEXT,
    "override_reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_allocations_date_project_id_worker_profile_id_job_role_id_key"
    ON "schedule_allocations"("date", "project_id", "worker_profile_id", "job_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_allocations_date_project_id_asset_id_key"
    ON "schedule_allocations"("date", "project_id", "asset_id");

-- CreateIndex
CREATE INDEX "schedule_allocations_date_idx" ON "schedule_allocations"("date");

-- CreateIndex
CREATE INDEX "schedule_allocations_project_id_date_idx" ON "schedule_allocations"("project_id", "date");

-- CreateIndex
CREATE INDEX "schedule_allocations_worker_profile_id_date_idx" ON "schedule_allocations"("worker_profile_id", "date");

-- CreateIndex
CREATE INDEX "schedule_allocations_asset_id_date_idx" ON "schedule_allocations"("asset_id", "date");

-- AddForeignKey
ALTER TABLE "schedule_allocations" ADD CONSTRAINT "schedule_allocations_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_allocations" ADD CONSTRAINT "schedule_allocations_worker_profile_id_fkey"
    FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_allocations" ADD CONSTRAINT "schedule_allocations_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_allocations" ADD CONSTRAINT "schedule_allocations_job_role_id_fkey"
    FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_allocations" ADD CONSTRAINT "schedule_allocations_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
