-- Forms Engine extensions (PR #97)

-- Templates: category + system flag + settings blob
ALTER TABLE "form_templates"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN "is_system_template" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX "form_templates_category_idx" ON "form_templates"("category");

-- Sections: repeating + visibility conditions
ALTER TABLE "form_sections"
  ADD COLUMN "is_repeating" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "min_repeat" INTEGER,
  ADD COLUMN "max_repeat" INTEGER,
  ADD COLUMN "conditions" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Fields: rules engine attachments
ALTER TABLE "form_fields"
  ADD COLUMN "is_read_only" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "default_value" TEXT,
  ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "conditions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "validations" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "actions" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Submissions: context blob, GPS coords, approval/triggered links
ALTER TABLE "form_submissions"
  ADD COLUMN "context" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN "gps_lat" DECIMAL(10, 7),
  ADD COLUMN "gps_lng" DECIMAL(10, 7);

-- Submission values: boolean + file path
ALTER TABLE "form_submission_values"
  ADD COLUMN "value_boolean" BOOLEAN,
  ADD COLUMN "file_path" TEXT;

-- Approval chain
CREATE TABLE "form_approvals" (
  "id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "step_number" INTEGER NOT NULL,
  "assigned_to_id" TEXT,
  "assigned_to_role" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "comment" TEXT,
  "decided_at" TIMESTAMP(3),
  "due_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "form_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "form_approvals_submission_id_idx" ON "form_approvals"("submission_id");
CREATE INDEX "form_approvals_assigned_to_id_idx" ON "form_approvals"("assigned_to_id");
CREATE INDEX "form_approvals_status_idx" ON "form_approvals"("status");

ALTER TABLE "form_approvals"
  ADD CONSTRAINT "form_approvals_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_approvals"
  ADD CONSTRAINT "form_approvals_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Triggered records (auto-creates from on_submit actions)
CREATE TABLE "form_triggered_records" (
  "id" TEXT NOT NULL,
  "submission_id" TEXT NOT NULL,
  "record_type" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "form_triggered_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "form_triggered_records_submission_id_idx" ON "form_triggered_records"("submission_id");
CREATE INDEX "form_triggered_records_record_type_record_id_idx" ON "form_triggered_records"("record_type", "record_id");

ALTER TABLE "form_triggered_records"
  ADD CONSTRAINT "form_triggered_records_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Schedules
CREATE TABLE "form_schedules" (
  "id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "schedule_type" TEXT NOT NULL,
  "cron_expression" TEXT,
  "event_trigger" TEXT,
  "assign_to_role" TEXT,
  "assign_to_user_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_run_at" TIMESTAMP(3),
  "next_run_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "form_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "form_schedules_template_id_idx" ON "form_schedules"("template_id");
CREATE INDEX "form_schedules_next_run_at_idx" ON "form_schedules"("next_run_at");

ALTER TABLE "form_schedules"
  ADD CONSTRAINT "form_schedules_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_schedules"
  ADD CONSTRAINT "form_schedules_assign_to_user_id_fkey"
  FOREIGN KEY ("assign_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
