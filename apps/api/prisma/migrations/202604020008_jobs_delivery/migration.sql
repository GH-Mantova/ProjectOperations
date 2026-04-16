CREATE TABLE "job_stages" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stage_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_stages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_activities" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "job_stage_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "activity_order" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "planned_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_issues" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reported_by_id" TEXT,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_variations" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "amount" DECIMAL(14,2),
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_variations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_progress_entries" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL DEFAULT 'PROGRESS',
    "entry_date" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "percent_complete" INTEGER,
    "details" TEXT,
    "author_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_progress_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_status_history" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "note" TEXT,
    "changed_by_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_status_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_stages_job_id_stage_order_idx" ON "job_stages"("job_id", "stage_order");
CREATE INDEX "job_stages_status_idx" ON "job_stages"("status");
CREATE INDEX "job_activities_job_id_job_stage_id_idx" ON "job_activities"("job_id", "job_stage_id");
CREATE INDEX "job_activities_status_idx" ON "job_activities"("status");
CREATE INDEX "job_issues_job_id_status_idx" ON "job_issues"("job_id", "status");
CREATE INDEX "job_issues_severity_idx" ON "job_issues"("severity");
CREATE INDEX "job_variations_job_id_status_idx" ON "job_variations"("job_id", "status");
CREATE UNIQUE INDEX "job_variations_job_id_reference_key" ON "job_variations"("job_id", "reference");
CREATE INDEX "job_progress_entries_job_id_entry_date_idx" ON "job_progress_entries"("job_id", "entry_date");
CREATE INDEX "job_progress_entries_entry_type_idx" ON "job_progress_entries"("entry_type");
CREATE INDEX "job_status_history_job_id_changed_at_idx" ON "job_status_history"("job_id", "changed_at");

ALTER TABLE "job_stages"
ADD CONSTRAINT "job_stages_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_activities"
ADD CONSTRAINT "job_activities_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_activities"
ADD CONSTRAINT "job_activities_job_stage_id_fkey"
FOREIGN KEY ("job_stage_id") REFERENCES "job_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_issues"
ADD CONSTRAINT "job_issues_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_issues"
ADD CONSTRAINT "job_issues_reported_by_id_fkey"
FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_variations"
ADD CONSTRAINT "job_variations_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_variations"
ADD CONSTRAINT "job_variations_approved_by_id_fkey"
FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_progress_entries"
ADD CONSTRAINT "job_progress_entries_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_progress_entries"
ADD CONSTRAINT "job_progress_entries_author_user_id_fkey"
FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_status_history"
ADD CONSTRAINT "job_status_history_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_status_history"
ADD CONSTRAINT "job_status_history_changed_by_id_fkey"
FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
