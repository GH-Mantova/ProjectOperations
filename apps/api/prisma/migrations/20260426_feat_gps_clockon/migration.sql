-- Worker location consent
ALTER TABLE "worker_profiles"
  ADD COLUMN "location_consent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "location_consent_at" TIMESTAMP(3);

-- GPS columns on timesheets
ALTER TABLE "timesheets"
  ADD COLUMN "clock_on_lat" DECIMAL(9, 6),
  ADD COLUMN "clock_on_lng" DECIMAL(9, 6),
  ADD COLUMN "clock_on_accuracy" DECIMAL(8, 2),
  ADD COLUMN "clock_off_lat" DECIMAL(9, 6),
  ADD COLUMN "clock_off_lng" DECIMAL(9, 6),
  ADD COLUMN "clock_off_accuracy" DECIMAL(8, 2);

-- Per-event location log
CREATE TABLE "worker_location_logs" (
  "id" TEXT NOT NULL,
  "worker_profile_id" TEXT NOT NULL,
  "timesheet_id" TEXT,
  "event_type" TEXT NOT NULL,
  "latitude" DECIMAL(9, 6) NOT NULL,
  "longitude" DECIMAL(9, 6) NOT NULL,
  "accuracy" DECIMAL(8, 2),
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "worker_location_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "worker_location_logs_worker_profile_id_recorded_at_idx" ON "worker_location_logs"("worker_profile_id", "recorded_at");
CREATE INDEX "worker_location_logs_timesheet_id_idx" ON "worker_location_logs"("timesheet_id");

ALTER TABLE "worker_location_logs"
  ADD CONSTRAINT "worker_location_logs_worker_profile_id_fkey"
  FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
