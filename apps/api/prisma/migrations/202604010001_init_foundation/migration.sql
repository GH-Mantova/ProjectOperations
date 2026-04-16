CREATE TABLE "healthcheck_seed_markers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "healthcheck_seed_markers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "healthcheck_seed_markers_name_key" ON "healthcheck_seed_markers"("name");
