-- B-P0a-4-i — re-point JobConversion onto the surviving Project (Job folds
-- into Project per B-P0a). Additive + reversible: adds a nullable project_id,
-- backfills from the survivor-spine map (Project.source_job_id -> Job.id),
-- and keeps job_id (dropped later in B-P0a-8).

ALTER TABLE "job_conversions" ADD COLUMN "project_id" TEXT;

UPDATE "job_conversions" jc
SET "project_id" = p."id"
FROM "projects" p
WHERE p."source_job_id" = jc."job_id";

CREATE UNIQUE INDEX "job_conversions_project_id_key" ON "job_conversions"("project_id");

ALTER TABLE "job_conversions" ADD CONSTRAINT "job_conversions_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
