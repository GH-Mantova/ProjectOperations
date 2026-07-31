-- CreateTable: tip_recommendation_logs
-- Append-only log written when an operator accepts a tip finder recommendation.
-- Prices are snapshotted at decision time; the log never recomputes.

CREATE TABLE "tip_recommendation_logs" (
    "id" TEXT NOT NULL,
    "map_location_id" TEXT NOT NULL,
    "facility_name" TEXT NOT NULL,
    "facility_lat" DECIMAL(10,7) NOT NULL,
    "facility_lng" DECIMAL(10,7) NOT NULL,
    "waste_type_code" TEXT NOT NULL,
    "load_tonnes" DECIMAL(8,3) NOT NULL,
    "origin_type" TEXT NOT NULL,
    "project_id" TEXT,
    "origin_lat" DECIMAL(10,7) NOT NULL,
    "origin_lng" DECIMAL(10,7) NOT NULL,
    "distance_km" DECIMAL(8,3) NOT NULL,
    "disposal_fee" DECIMAL(12,2) NOT NULL,
    "travel_cost" DECIMAL(12,2) NOT NULL,
    "total_cost" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "tip_recommendation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tip_recommendation_logs_map_location_id_idx" ON "tip_recommendation_logs"("map_location_id");

-- CreateIndex
CREATE INDEX "tip_recommendation_logs_project_id_idx" ON "tip_recommendation_logs"("project_id");

-- CreateIndex
CREATE INDEX "tip_recommendation_logs_created_by_id_idx" ON "tip_recommendation_logs"("created_by_id");

-- CreateIndex
CREATE INDEX "tip_recommendation_logs_created_at_idx" ON "tip_recommendation_logs"("created_at");

-- AddForeignKey
ALTER TABLE "tip_recommendation_logs" ADD CONSTRAINT "tip_recommendation_logs_map_location_id_fkey"
    FOREIGN KEY ("map_location_id") REFERENCES "map_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_recommendation_logs" ADD CONSTRAINT "tip_recommendation_logs_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_recommendation_logs" ADD CONSTRAINT "tip_recommendation_logs_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
