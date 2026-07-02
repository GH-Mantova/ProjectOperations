-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "job_number" TEXT,
ADD COLUMN     "legacy_job_id" TEXT,
ADD COLUMN     "site_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "projects_job_number_key" ON "projects"("job_number");

-- CreateIndex
CREATE UNIQUE INDEX "projects_legacy_job_id_key" ON "projects"("legacy_job_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "schedule_allocations_date_project_id_worker_profile_id_job_role" RENAME TO "schedule_allocations_date_project_id_worker_profile_id_job__key";

