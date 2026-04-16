ALTER TABLE "tender_clients"
ADD COLUMN "contract_issued" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "contract_issued_at" TIMESTAMP(3);

CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "job_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "client_id" TEXT NOT NULL,
    "site_id" TEXT,
    "source_tender_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "project_manager_id" TEXT,
    "supervisor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_conversions" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "tender_client_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "carried_documents" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_conversions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jobs_job_number_key" ON "jobs"("job_number");
CREATE UNIQUE INDEX "jobs_source_tender_id_key" ON "jobs"("source_tender_id");
CREATE INDEX "jobs_client_id_idx" ON "jobs"("client_id");
CREATE INDEX "jobs_status_idx" ON "jobs"("status");
CREATE INDEX "jobs_project_manager_id_idx" ON "jobs"("project_manager_id");
CREATE INDEX "jobs_supervisor_id_idx" ON "jobs"("supervisor_id");

CREATE UNIQUE INDEX "job_conversions_tender_id_key" ON "job_conversions"("tender_id");
CREATE UNIQUE INDEX "job_conversions_tender_client_id_key" ON "job_conversions"("tender_client_id");
CREATE UNIQUE INDEX "job_conversions_job_id_key" ON "job_conversions"("job_id");

CREATE INDEX "tender_clients_contract_issued_idx" ON "tender_clients"("contract_issued");

ALTER TABLE "jobs"
ADD CONSTRAINT "jobs_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "jobs"
ADD CONSTRAINT "jobs_site_id_fkey"
FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "jobs"
ADD CONSTRAINT "jobs_source_tender_id_fkey"
FOREIGN KEY ("source_tender_id") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "jobs"
ADD CONSTRAINT "jobs_project_manager_id_fkey"
FOREIGN KEY ("project_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "jobs"
ADD CONSTRAINT "jobs_supervisor_id_fkey"
FOREIGN KEY ("supervisor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "job_conversions"
ADD CONSTRAINT "job_conversions_tender_id_fkey"
FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_conversions"
ADD CONSTRAINT "job_conversions_tender_client_id_fkey"
FOREIGN KEY ("tender_client_id") REFERENCES "tender_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "job_conversions"
ADD CONSTRAINT "job_conversions_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
