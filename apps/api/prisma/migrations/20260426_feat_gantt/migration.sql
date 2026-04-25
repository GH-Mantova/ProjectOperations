-- Gantt scheduling (PR #82)
-- Adds GanttTask + plannedStartDate / plannedEndDate on Project.
-- (actualStartDate / actualEndDate already exist from earlier project work.)

ALTER TABLE "projects"
  ADD COLUMN "planned_start_date" TIMESTAMP(3),
  ADD COLUMN "planned_end_date"   TIMESTAMP(3);

CREATE TABLE "gantt_tasks" (
  "id"              TEXT PRIMARY KEY,
  "project_id"      TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "discipline"      TEXT,
  "start_date"      TIMESTAMP(3) NOT NULL,
  "end_date"        TIMESTAMP(3) NOT NULL,
  "progress"        INTEGER NOT NULL DEFAULT 0,
  "colour"          TEXT,
  "dependencies"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "assigned_to_id"  TEXT,
  "sort_order"      INTEGER NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gantt_tasks_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "gantt_tasks_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "worker_profiles"("id") ON DELETE SET NULL
);

CREATE INDEX "gantt_tasks_project_id_idx" ON "gantt_tasks" ("project_id");
CREATE INDEX "gantt_tasks_start_date_idx" ON "gantt_tasks" ("start_date");
