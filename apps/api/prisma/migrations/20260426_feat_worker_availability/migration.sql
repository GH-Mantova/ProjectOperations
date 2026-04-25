-- Worker leaves
CREATE TABLE "worker_leaves" (
  "id" TEXT NOT NULL,
  "worker_profile_id" TEXT NOT NULL,
  "leave_type" TEXT NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "approved_by_id" TEXT,
  "approved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "worker_leaves_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "worker_leaves_worker_profile_id_start_date_idx" ON "worker_leaves"("worker_profile_id", "start_date");
CREATE INDEX "worker_leaves_status_idx" ON "worker_leaves"("status");

ALTER TABLE "worker_leaves"
  ADD CONSTRAINT "worker_leaves_worker_profile_id_fkey"
  FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "worker_leaves"
  ADD CONSTRAINT "worker_leaves_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Worker unavailability (RDOs, training, ad-hoc holds)
CREATE TABLE "worker_unavailability" (
  "id" TEXT NOT NULL,
  "worker_profile_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "recurring_day" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "worker_unavailability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "worker_unavailability_worker_profile_id_start_date_idx" ON "worker_unavailability"("worker_profile_id", "start_date");

ALTER TABLE "worker_unavailability"
  ADD CONSTRAINT "worker_unavailability_worker_profile_id_fkey"
  FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
