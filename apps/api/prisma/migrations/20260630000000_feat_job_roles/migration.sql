-- GATE-ALLOW: migrations
-- Job Roles catalogue (additive). See apps/api/src/modules/job-roles/.

-- CreateTable
CREATE TABLE "job_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "colour" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_role_requirements" (
    "id" TEXT NOT NULL,
    "job_role_id" TEXT NOT NULL,
    "competency_id" TEXT NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "min_months_experience" INTEGER,
    "notes" TEXT,

    CONSTRAINT "job_role_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_roles_name_key" ON "job_roles"("name");

-- CreateIndex
CREATE INDEX "job_role_requirements_competency_id_idx" ON "job_role_requirements"("competency_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_role_requirements_job_role_id_competency_id_key" ON "job_role_requirements"("job_role_id", "competency_id");

-- AddForeignKey
ALTER TABLE "job_role_requirements" ADD CONSTRAINT "job_role_requirements_job_role_id_fkey" FOREIGN KEY ("job_role_id") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_role_requirements" ADD CONSTRAINT "job_role_requirements_competency_id_fkey" FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
