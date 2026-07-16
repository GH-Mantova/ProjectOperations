-- ERP gap C — geofenced clock-in/out. Adds SiteGeofence (circular boundary
-- attached to a Site), Site centre coordinates, and per-timesheet audit
-- columns capturing whether each clock event fell inside an active geofence
-- (and which one). GPS capture on Timesheet already existed and is untouched.

-- AlterTable — Site canonical coordinates
ALTER TABLE "sites" ADD COLUMN "centre_lat" DECIMAL(9,6);
ALTER TABLE "sites" ADD COLUMN "centre_lng" DECIMAL(9,6);

-- CreateTable — SiteGeofence
CREATE TABLE "site_geofences" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "centre_lat" DECIMAL(9,6) NOT NULL,
    "centre_lng" DECIMAL(9,6) NOT NULL,
    "radius_metres" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_geofences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_geofences_site_id_is_active_idx" ON "site_geofences"("site_id", "is_active");

-- AddForeignKey
ALTER TABLE "site_geofences" ADD CONSTRAINT "site_geofences_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable — Timesheet audit flags
ALTER TABLE "timesheets" ADD COLUMN "clock_on_in_geofence" BOOLEAN;
ALTER TABLE "timesheets" ADD COLUMN "clock_off_in_geofence" BOOLEAN;
ALTER TABLE "timesheets" ADD COLUMN "clock_on_geofence_id" TEXT;
ALTER TABLE "timesheets" ADD COLUMN "clock_off_geofence_id" TEXT;

-- CreateIndex
CREATE INDEX "timesheets_clock_on_geofence_id_idx" ON "timesheets"("clock_on_geofence_id");
CREATE INDEX "timesheets_clock_off_geofence_id_idx" ON "timesheets"("clock_off_geofence_id");

-- AddForeignKey
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_clock_on_geofence_id_fkey" FOREIGN KEY ("clock_on_geofence_id") REFERENCES "site_geofences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "timesheets" ADD CONSTRAINT "timesheets_clock_off_geofence_id_fkey" FOREIGN KEY ("clock_off_geofence_id") REFERENCES "site_geofences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
