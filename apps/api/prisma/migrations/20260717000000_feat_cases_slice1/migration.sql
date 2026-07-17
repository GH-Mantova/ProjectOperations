-- Case management slice 1: Case + CaseComment models + enums + number sequence
-- Adds D365 Customer Service parity for construction: defects, warranty, RFIs, complaints.

-- Enums
CREATE TYPE "CaseType" AS ENUM ('defect', 'warranty', 'rfi', 'complaint', 'other');
CREATE TYPE "CaseStatus" AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');
CREATE TYPE "CasePriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- Number sequence (singleton table for CASE-YYYY-NNN generation)
CREATE TABLE "case_number_sequences" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "case_number_sequences_pkey" PRIMARY KEY ("id")
);

-- Insert the singleton row
INSERT INTO "case_number_sequences" ("id", "last_number") VALUES (1, 0);

-- Cases table
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "CaseType" NOT NULL DEFAULT 'other',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'open',
    "priority" "CasePriority" NOT NULL DEFAULT 'medium',
    "client_id" TEXT,
    "job_id" TEXT,
    "project_id" TEXT,
    "raised_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "due_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- Case comments table
CREATE TABLE "case_comments" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_comments_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on case number
CREATE UNIQUE INDEX "cases_number_key" ON "cases"("number");

-- Indexes for cases
CREATE INDEX "cases_status_priority_idx" ON "cases"("status", "priority");
CREATE INDEX "cases_client_id_idx" ON "cases"("client_id");
CREATE INDEX "cases_job_id_idx" ON "cases"("job_id");
CREATE INDEX "cases_project_id_idx" ON "cases"("project_id");
CREATE INDEX "cases_raised_by_id_idx" ON "cases"("raised_by_id");
CREATE INDEX "cases_assigned_to_id_idx" ON "cases"("assigned_to_id");
CREATE INDEX "cases_due_at_idx" ON "cases"("due_at");

-- Indexes for case_comments
CREATE INDEX "case_comments_case_id_idx" ON "case_comments"("case_id");

-- Foreign keys for cases
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cases" ADD CONSTRAINT "cases_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cases" ADD CONSTRAINT "cases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cases" ADD CONSTRAINT "cases_raised_by_id_fkey" FOREIGN KEY ("raised_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for case_comments
ALTER TABLE "case_comments" ADD CONSTRAINT "case_comments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "case_comments" ADD CONSTRAINT "case_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
