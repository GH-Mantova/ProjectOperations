-- Field Worker Experience — pre-start checklists + timesheets + forcePasswordReset flag.

CREATE TYPE "PreStartStatus" AS ENUM ('DRAFT', 'SUBMITTED');

CREATE TYPE "TimesheetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');

ALTER TYPE "ProjectActivityAction" ADD VALUE 'TIMESHEET_SUBMITTED';
ALTER TYPE "ProjectActivityAction" ADD VALUE 'PRESTART_SUBMITTED';

ALTER TABLE "users" ADD COLUMN "force_password_reset" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "pre_start_checklists" (
  "id"                          TEXT         NOT NULL,
  "project_id"                  TEXT         NOT NULL,
  "worker_profile_id"           TEXT         NOT NULL,
  "allocation_id"               TEXT         NOT NULL,
  "date"                        TIMESTAMP(3) NOT NULL,
  "status"                      "PreStartStatus" NOT NULL DEFAULT 'DRAFT',
  "supervisor_name"             TEXT,
  "supervisor_signed_at"        TIMESTAMP(3),
  "site_hazards_acknowledged"   BOOLEAN      NOT NULL DEFAULT false,
  "hazard_notes"                TEXT,
  "ppe_helmet"                  BOOLEAN      NOT NULL DEFAULT false,
  "ppe_gloves"                  BOOLEAN      NOT NULL DEFAULT false,
  "ppe_boots"                   BOOLEAN      NOT NULL DEFAULT false,
  "ppe_high_vis"                BOOLEAN      NOT NULL DEFAULT false,
  "ppe_respirator"              BOOLEAN      NOT NULL DEFAULT false,
  "ppe_other"                   TEXT,
  "plant_checks_completed"      BOOLEAN      NOT NULL DEFAULT false,
  "plant_check_notes"           TEXT,
  "fit_for_work"                BOOLEAN      NOT NULL DEFAULT false,
  "fit_for_work_declaration"    TEXT,
  "worker_signature"            TEXT,
  "worker_signed_at"            TIMESTAMP(3),
  "asb_enclosure_inspection"    BOOLEAN,
  "asb_air_monitoring"          BOOLEAN,
  "asb_decon_operational"       BOOLEAN,
  "civ_excavation_permit"       BOOLEAN,
  "civ_underground_clearance"   BOOLEAN,
  "submitted_at"                TIMESTAMP(3),
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pre_start_checklists_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pre_start_checklists_worker_profile_id_allocation_id_date_key"
  ON "pre_start_checklists"("worker_profile_id", "allocation_id", "date");
CREATE INDEX "pre_start_checklists_project_id_date_idx" ON "pre_start_checklists"("project_id", "date");
CREATE INDEX "pre_start_checklists_worker_profile_id_date_idx" ON "pre_start_checklists"("worker_profile_id", "date");
CREATE INDEX "pre_start_checklists_status_idx" ON "pre_start_checklists"("status");
ALTER TABLE "pre_start_checklists" ADD CONSTRAINT "pre_start_checklists_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pre_start_checklists" ADD CONSTRAINT "pre_start_checklists_worker_profile_id_fkey"
  FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pre_start_checklists" ADD CONSTRAINT "pre_start_checklists_allocation_id_fkey"
  FOREIGN KEY ("allocation_id") REFERENCES "project_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "timesheets" (
  "id"                 TEXT             NOT NULL,
  "project_id"         TEXT             NOT NULL,
  "worker_profile_id"  TEXT             NOT NULL,
  "allocation_id"      TEXT             NOT NULL,
  "date"               TIMESTAMP(3)     NOT NULL,
  "hours_worked"       DECIMAL(4,2)     NOT NULL,
  "break_minutes"      INTEGER          NOT NULL DEFAULT 0,
  "description"        TEXT,
  "clock_on_time"      TIMESTAMP(3),
  "clock_off_time"     TIMESTAMP(3),
  "status"             "TimesheetStatus" NOT NULL DEFAULT 'DRAFT',
  "submitted_at"       TIMESTAMP(3),
  "approved_by_id"     TEXT,
  "approved_at"        TIMESTAMP(3),
  "created_at"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "timesheets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "timesheets_worker_profile_id_allocation_id_date_key"
  ON "timesheets"("worker_profile_id", "allocation_id", "date");
CREATE INDEX "timesheets_project_id_date_idx" ON "timesheets"("project_id", "date");
CREATE INDEX "timesheets_worker_profile_id_date_idx" ON "timesheets"("worker_profile_id", "date");
CREATE INDEX "timesheets_status_idx" ON "timesheets"("status");
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_worker_profile_id_fkey"
  FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_allocation_id_fkey"
  FOREIGN KEY ("allocation_id") REFERENCES "project_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
