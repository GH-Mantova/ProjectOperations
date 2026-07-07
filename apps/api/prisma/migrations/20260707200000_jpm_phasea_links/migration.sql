-- Job/Project merge Phase A: additive nullable links + reversible backfill.
-- Survivor = Project. This migration adds Job.surviving_project_id and
-- Project.source_job_id, both nullable + unique + FK ON DELETE SET NULL,
-- then backfills the two columns for pairs that share a source_tender_id.
--
-- Reverse (documented, run manually if rolling back):
--   UPDATE "projects" SET "source_job_id" = NULL;
--   UPDATE "jobs"     SET "surviving_project_id" = NULL;
--   ALTER TABLE "projects" DROP CONSTRAINT "projects_source_job_id_fkey";
--   ALTER TABLE "jobs"     DROP CONSTRAINT "jobs_surviving_project_id_fkey";
--   DROP INDEX "projects_source_job_id_key";
--   DROP INDEX "projects_source_job_id_idx";
--   DROP INDEX "jobs_surviving_project_id_key";
--   DROP INDEX "jobs_surviving_project_id_idx";
--   ALTER TABLE "projects" DROP COLUMN "source_job_id";
--   ALTER TABLE "jobs"     DROP COLUMN "surviving_project_id";

ALTER TABLE "jobs"     ADD COLUMN "surviving_project_id" TEXT;
ALTER TABLE "projects" ADD COLUMN "source_job_id"        TEXT;

CREATE UNIQUE INDEX "jobs_surviving_project_id_key"    ON "jobs"("surviving_project_id");
CREATE INDEX        "jobs_surviving_project_id_idx"    ON "jobs"("surviving_project_id");
CREATE UNIQUE INDEX "projects_source_job_id_key"       ON "projects"("source_job_id");
CREATE INDEX        "projects_source_job_id_idx"       ON "projects"("source_job_id");

ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_surviving_project_id_fkey"
  FOREIGN KEY ("surviving_project_id") REFERENCES "projects"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_source_job_id_fkey"
  FOREIGN KEY ("source_job_id") REFERENCES "jobs"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Idempotent backfill: link every (Job, Project) pair that shares a source_tender_id.
-- Because source_tender_id is UNIQUE on both tables the join is 1:1.
-- Re-running is a no-op (WHERE clauses skip already-linked rows).
UPDATE "jobs" AS j
   SET "surviving_project_id" = p."id"
  FROM "projects" AS p
 WHERE j."source_tender_id" IS NOT NULL
   AND p."source_tender_id" = j."source_tender_id"
   AND j."surviving_project_id" IS NULL;

UPDATE "projects" AS p
   SET "source_job_id" = j."id"
  FROM "jobs" AS j
 WHERE p."source_tender_id" IS NOT NULL
   AND j."source_tender_id" = p."source_tender_id"
   AND p."source_job_id" IS NULL;
