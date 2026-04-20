-- Projects module — delivery-side record produced by tender→project conversion.

CREATE TYPE "ProjectStatus" AS ENUM (
  'MOBILISING',
  'ACTIVE',
  'PRACTICAL_COMPLETION',
  'DEFECTS',
  'CLOSED'
);

CREATE TYPE "ProjectActivityAction" AS ENUM (
  'PROJECT_CREATED',
  'STATUS_CHANGED',
  'TEAM_CHANGED',
  'CONTRACT_VALUE_CHANGED',
  'BUDGET_CHANGED',
  'DOCUMENT_ADDED',
  'DOCUMENT_REMOVED'
);

CREATE TABLE "project_number_sequences" (
  "id"          INTEGER NOT NULL DEFAULT 1,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "project_number_sequences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
  "id"                        TEXT          NOT NULL,
  "project_number"            TEXT          NOT NULL,
  "name"                      TEXT          NOT NULL,
  "status"                    "ProjectStatus" NOT NULL DEFAULT 'MOBILISING',
  "source_tender_id"          TEXT,
  "client_id"                 TEXT          NOT NULL,
  "site_address_line1"        TEXT          NOT NULL,
  "site_address_line2"        TEXT,
  "site_address_suburb"       TEXT          NOT NULL,
  "site_address_state"        TEXT          NOT NULL,
  "site_address_postcode"     TEXT          NOT NULL,
  "contract_value"            DECIMAL(12,2) NOT NULL DEFAULT 0,
  "budget"                    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "actual_cost"               DECIMAL(12,2) NOT NULL DEFAULT 0,
  "proposed_start_date"       TIMESTAMP(3),
  "actual_start_date"         TIMESTAMP(3),
  "practical_completion_date" TIMESTAMP(3),
  "closed_date"               TIMESTAMP(3),
  "project_manager_id"        TEXT,
  "supervisor_id"             TEXT,
  "estimator_id"              TEXT,
  "whs_officer_id"            TEXT,
  "estimate_snapshot"         JSONB         NOT NULL,
  "created_by_id"             TEXT          NOT NULL,
  "created_at"                TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "projects_project_number_key" ON "projects"("project_number");
CREATE INDEX "projects_status_idx" ON "projects"("status");
CREATE INDEX "projects_client_id_idx" ON "projects"("client_id");
CREATE INDEX "projects_source_tender_id_idx" ON "projects"("source_tender_id");
ALTER TABLE "projects" ADD CONSTRAINT "projects_source_tender_id_fkey"
  FOREIGN KEY ("source_tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_manager_id_fkey"
  FOREIGN KEY ("project_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_supervisor_id_fkey"
  FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_estimator_id_fkey"
  FOREIGN KEY ("estimator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_whs_officer_id_fkey"
  FOREIGN KEY ("whs_officer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "project_scope_items" (
  "id"                      TEXT          NOT NULL,
  "project_id"              TEXT          NOT NULL,
  "scope_code"              TEXT          NOT NULL,
  "description"             TEXT          NOT NULL,
  "quantity"                DECIMAL(10,3) NOT NULL,
  "unit"                    TEXT          NOT NULL,
  "source_estimate_line_id" TEXT,
  CONSTRAINT "project_scope_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_scope_items_project_id_scope_code_idx" ON "project_scope_items"("project_id", "scope_code");
ALTER TABLE "project_scope_items" ADD CONSTRAINT "project_scope_items_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "project_milestones" (
  "id"           TEXT          NOT NULL,
  "project_id"   TEXT          NOT NULL,
  "name"         TEXT          NOT NULL,
  "planned_date" TIMESTAMP(3),
  "actual_date"  TIMESTAMP(3),
  "status"       TEXT          NOT NULL DEFAULT 'PENDING',
  "order"        INTEGER       NOT NULL DEFAULT 0,
  CONSTRAINT "project_milestones_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_milestones_project_id_order_idx" ON "project_milestones"("project_id", "order");
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "project_activity_logs" (
  "id"         TEXT                    NOT NULL,
  "project_id" TEXT                    NOT NULL,
  "user_id"    TEXT                    NOT NULL,
  "action"     "ProjectActivityAction" NOT NULL,
  "details"    JSONB                   NOT NULL,
  "created_at" TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_activity_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_activity_logs_project_id_created_at_idx" ON "project_activity_logs"("project_id", "created_at");
ALTER TABLE "project_activity_logs" ADD CONSTRAINT "project_activity_logs_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_activity_logs" ADD CONSTRAINT "project_activity_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Tender documents can now be re-linked to a project on conversion.
ALTER TABLE "tender_document_links" ADD COLUMN "project_id" TEXT;
CREATE INDEX "tender_document_links_project_id_idx" ON "tender_document_links"("project_id");
ALTER TABLE "tender_document_links" ADD CONSTRAINT "tender_document_links_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the singleton sequence row.
INSERT INTO "project_number_sequences" ("id", "last_number") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;
