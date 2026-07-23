-- Muster / evacuation roll-call — additive.
--
-- A MusterEvent is started by a WHS officer during an evacuation drill or
-- real emergency. Starting the event snapshots all currently-signed-in
-- attendees (SiteAttendance rows with signed_out_at IS NULL for that site)
-- into muster_attendee rows with status UNKNOWN.  Officers then check off
-- each person as ACCOUNTED or MISSING.  The event is closed once all persons
-- are resolved.
--
-- Status lifecycle: ACTIVE -> COMPLETED | CANCELLED
-- Attendee status lifecycle: UNKNOWN -> ACCOUNTED | MISSING
--
-- The siteAttendanceId on MusterAttendee is nullable to allow a manually-
-- added person (e.g. a visitor not yet logged into the attendance system)
-- without forcing a SiteAttendance row.

-- CreateEnum
CREATE TYPE "MusterEventStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MusterAttendeeStatus" AS ENUM ('UNKNOWN', 'ACCOUNTED', 'MISSING');

-- CreateTable
CREATE TABLE "muster_events" (
    "id"             TEXT NOT NULL,
    "site_id"        TEXT NOT NULL,
    "started_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_by_id"  TEXT NOT NULL,
    "status"         "MusterEventStatus" NOT NULL DEFAULT 'ACTIVE',
    "completed_at"   TIMESTAMP(3),
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "muster_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "muster_attendees" (
    "id"                 TEXT NOT NULL,
    "muster_event_id"    TEXT NOT NULL,
    "site_attendance_id" TEXT,
    "worker_profile_id"  TEXT NOT NULL,
    "status"             "MusterAttendeeStatus" NOT NULL DEFAULT 'UNKNOWN',
    "checked_at"         TIMESTAMP(3),
    "checked_by_id"      TEXT,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "muster_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "muster_events_site_id_status_idx"
  ON "muster_events"("site_id", "status");

-- CreateIndex
CREATE INDEX "muster_events_started_at_idx"
  ON "muster_events"("started_at");

-- CreateIndex
CREATE UNIQUE INDEX "muster_attendees_muster_event_id_worker_profile_id_key"
  ON "muster_attendees"("muster_event_id", "worker_profile_id");

-- CreateIndex
CREATE INDEX "muster_attendees_muster_event_id_status_idx"
  ON "muster_attendees"("muster_event_id", "status");

-- AddForeignKey
ALTER TABLE "muster_events" ADD CONSTRAINT "muster_events_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muster_events" ADD CONSTRAINT "muster_events_started_by_id_fkey"
  FOREIGN KEY ("started_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muster_attendees" ADD CONSTRAINT "muster_attendees_muster_event_id_fkey"
  FOREIGN KEY ("muster_event_id") REFERENCES "muster_events"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muster_attendees" ADD CONSTRAINT "muster_attendees_site_attendance_id_fkey"
  FOREIGN KEY ("site_attendance_id") REFERENCES "site_attendances"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muster_attendees" ADD CONSTRAINT "muster_attendees_worker_profile_id_fkey"
  FOREIGN KEY ("worker_profile_id") REFERENCES "worker_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "muster_attendees" ADD CONSTRAINT "muster_attendees_checked_by_id_fkey"
  FOREIGN KEY ("checked_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
