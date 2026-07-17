-- Migration: 20260717000000_feat_hr_leave_selfservice
-- Adds LeaveRequest model for HR self-service leave management.
-- On approval a WorkerLeave row is written so the scheduler reads it.

-- Enums
CREATE TYPE "LeaveRequestType" AS ENUM ('ANNUAL', 'PERSONAL', 'UNPAID', 'OTHER');
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Table
CREATE TABLE "leave_requests" (
    "id"              TEXT NOT NULL,
    "worker_id"       TEXT NOT NULL,
    "type"            "LeaveRequestType" NOT NULL,
    "start_date"      TIMESTAMP(3) NOT NULL,
    "end_date"        TIMESTAMP(3) NOT NULL,
    "hours"           DOUBLE PRECISION,
    "reason"          TEXT,
    "status"          "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by_id"  TEXT,
    "approved_at"     TIMESTAMP(3),
    "worker_leave_id" TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one LeaveRequest per WorkerLeave (nullable FK)
CREATE UNIQUE INDEX "leave_requests_worker_leave_id_key" ON "leave_requests"("worker_leave_id");

-- Indexes
CREATE INDEX "leave_requests_worker_id_start_date_idx" ON "leave_requests"("worker_id", "start_date");
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- Foreign keys
ALTER TABLE "leave_requests"
    ADD CONSTRAINT "leave_requests_worker_id_fkey"
    FOREIGN KEY ("worker_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_requests"
    ADD CONSTRAINT "leave_requests_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leave_requests"
    ADD CONSTRAINT "leave_requests_worker_leave_id_fkey"
    FOREIGN KEY ("worker_leave_id") REFERENCES "worker_leaves"("id") ON DELETE SET NULL ON UPDATE CASCADE;
