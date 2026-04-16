CREATE TABLE "availability_windows" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "availability_windows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "worker_role_suitabilities" (
    "id" TEXT NOT NULL,
    "worker_id" TEXT NOT NULL,
    "role_label" TEXT NOT NULL,
    "suitability" TEXT NOT NULL DEFAULT 'SUITABLE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "worker_role_suitabilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shift_role_requirements" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "role_label" TEXT NOT NULL,
    "competency_id" TEXT,
    "required_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_role_requirements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "availability_windows_worker_id_start_at_idx" ON "availability_windows"("worker_id", "start_at");
CREATE INDEX "availability_windows_status_idx" ON "availability_windows"("status");
CREATE INDEX "worker_role_suitabilities_role_label_idx" ON "worker_role_suitabilities"("role_label");
CREATE UNIQUE INDEX "worker_role_suitabilities_worker_id_role_label_key" ON "worker_role_suitabilities"("worker_id", "role_label");
CREATE INDEX "shift_role_requirements_shift_id_idx" ON "shift_role_requirements"("shift_id");
CREATE INDEX "shift_role_requirements_competency_id_idx" ON "shift_role_requirements"("competency_id");

ALTER TABLE "availability_windows"
ADD CONSTRAINT "availability_windows_worker_id_fkey"
FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "worker_role_suitabilities"
ADD CONSTRAINT "worker_role_suitabilities_worker_id_fkey"
FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shift_role_requirements"
ADD CONSTRAINT "shift_role_requirements_shift_id_fkey"
FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shift_role_requirements"
ADD CONSTRAINT "shift_role_requirements_competency_id_fkey"
FOREIGN KEY ("competency_id") REFERENCES "competencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
