CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "job_stage_id" TEXT,
    "job_activity_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "work_instructions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shift_worker_assignments" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "role_label" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_worker_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shift_asset_assignments" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_asset_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scheduling_conflicts" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduling_conflicts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shifts_job_id_start_at_idx" ON "shifts"("job_id", "start_at");
CREATE INDEX "shifts_job_activity_id_start_at_idx" ON "shifts"("job_activity_id", "start_at");
CREATE INDEX "shifts_status_idx" ON "shifts"("status");
CREATE UNIQUE INDEX "shift_worker_assignments_shift_id_worker_id_key" ON "shift_worker_assignments"("shift_id", "worker_id");
CREATE INDEX "shift_worker_assignments_worker_id_idx" ON "shift_worker_assignments"("worker_id");
CREATE UNIQUE INDEX "shift_asset_assignments_shift_id_asset_id_key" ON "shift_asset_assignments"("shift_id", "asset_id");
CREATE INDEX "shift_asset_assignments_asset_id_idx" ON "shift_asset_assignments"("asset_id");
CREATE INDEX "scheduling_conflicts_shift_id_severity_idx" ON "scheduling_conflicts"("shift_id", "severity");

ALTER TABLE "shifts"
ADD CONSTRAINT "shifts_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shifts"
ADD CONSTRAINT "shifts_job_stage_id_fkey"
FOREIGN KEY ("job_stage_id") REFERENCES "job_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shifts"
ADD CONSTRAINT "shifts_job_activity_id_fkey"
FOREIGN KEY ("job_activity_id") REFERENCES "job_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shift_worker_assignments"
ADD CONSTRAINT "shift_worker_assignments_shift_id_fkey"
FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shift_worker_assignments"
ADD CONSTRAINT "shift_worker_assignments_worker_id_fkey"
FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shift_asset_assignments"
ADD CONSTRAINT "shift_asset_assignments_shift_id_fkey"
FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shift_asset_assignments"
ADD CONSTRAINT "shift_asset_assignments_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "scheduling_conflicts"
ADD CONSTRAINT "scheduling_conflicts_shift_id_fkey"
FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
