-- CreateEnum
CREATE TYPE "MapLocationKind" AS ENUM ('TIP', 'POI');

-- CreateTable
CREATE TABLE "map_locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MapLocationKind" NOT NULL,
    "category_id" TEXT,
    "address_line1" TEXT NOT NULL,
    "suburb" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "facility" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "map_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "map_locations_kind_facility_idx" ON "map_locations"("kind", "facility");

-- CreateIndex
CREATE INDEX "map_locations_is_active_idx" ON "map_locations"("is_active");
