CREATE TABLE "job_closeouts" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "checklist_json" JSONB,
    "summary" TEXT,
    "archived_at" TIMESTAMP(3),
    "archived_by_id" TEXT,
    "read_only_from" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_closeouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_closeouts_job_id_key" ON "job_closeouts"("job_id");
CREATE INDEX "job_closeouts_status_idx" ON "job_closeouts"("status");
CREATE INDEX "job_closeouts_archived_at_idx" ON "job_closeouts"("archived_at");

ALTER TABLE "job_closeouts"
ADD CONSTRAINT "job_closeouts_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_closeouts"
ADD CONSTRAINT "job_closeouts_archived_by_id_fkey"
FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
