-- Site sign-in / sign-out (SiteAttendance) — additive.
--
-- One row per worker-visit. `signed_out_at` is nullable and null means STILL
-- ON SITE. This is the WHS spine: the evacuation muster roll reads this table
-- to answer "who is on site right now" without inferring it from rosters or
-- timesheets (which are intent/reconciliation, not attendance).
--
-- Idempotency is enforced in the service layer, not the DB — we may legitimately
-- have multiple attendance rows for one worker/site over time (yesterday's
-- closed row + today's open row), so a partial unique index would require
-- Postgres-specific syntax Prisma cannot yet emit. The service refuses to
-- create a second open row while one exists.

CREATE TABLE "site_attendances" (
  "id"                TEXT PRIMARY KEY,
  "site_id"           TEXT NOT NULL,
  "worker_profile_id" TEXT NOT NULL,
  "signed_in_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "signed_out_at"     TIMESTAMP(3),
  "job_id"            TEXT,
  "method"            TEXT,
  "notes"             TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_attendances_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "site_attendances_worker_profile_id_fkey"
    FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "site_attendances_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "site_attendances_site_id_signed_out_at_idx"
  ON "site_attendances" ("site_id", "signed_out_at");
CREATE INDEX "site_attendances_worker_profile_id_signed_out_at_idx"
  ON "site_attendances" ("worker_profile_id", "signed_out_at");
