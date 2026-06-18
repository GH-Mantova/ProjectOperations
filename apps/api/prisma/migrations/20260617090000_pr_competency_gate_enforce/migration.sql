-- GATE-ALLOW: migrations
-- Competency gate enforcement (block + logged override). See
-- apps/api/src/modules/allocations/allocations.service.ts.

-- CreateTable
CREATE TABLE "competency_overrides" (
    "id" TEXT NOT NULL,
    "allocation_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "worker_profile_id" TEXT NOT NULL,
    "missing_qual_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expired_qual_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reason" TEXT NOT NULL,
    "overridden_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "competency_overrides_allocation_id_idx" ON "competency_overrides"("allocation_id");

-- CreateIndex
CREATE INDEX "competency_overrides_project_id_idx" ON "competency_overrides"("project_id");

-- CreateIndex
CREATE INDEX "competency_overrides_worker_profile_id_idx" ON "competency_overrides"("worker_profile_id");

-- CreateIndex
CREATE INDEX "competency_overrides_overridden_by_id_idx" ON "competency_overrides"("overridden_by_id");

-- AddForeignKey
ALTER TABLE "competency_overrides" ADD CONSTRAINT "competency_overrides_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "project_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_overrides" ADD CONSTRAINT "competency_overrides_overridden_by_id_fkey" FOREIGN KEY ("overridden_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
