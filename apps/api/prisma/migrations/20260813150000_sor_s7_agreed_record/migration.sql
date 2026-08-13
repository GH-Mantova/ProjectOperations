-- SoR S7: Agreed Record (AR / dayworks) field capture.
-- Additive only. Adds one enum and three tables:
--
--   * AgreedRecordStatus (enum) -- lifecycle states: DRAFT → SUBMITTED → ... → VOID
--   * agreed_records             -- header: job, description, work date, signatures
--   * agreed_record_lines        -- resource lines (category/name/qty/tier — NO rates)
--   * agreed_record_attachments  -- photos & signature files
--
-- Nothing existing is altered. The Job model gains a back-ref virtual relation
-- (Prisma-only, no schema effect). JobSorSnapshot gains a back-ref for agreed
-- records locked against it (Prisma-only, no schema effect). User gains three
-- back-refs (Prisma-only).
--
-- Rollback:
--   DROP TABLE "agreed_record_attachments";
--   DROP TABLE "agreed_record_lines";
--   DROP TABLE "agreed_records";
--   DROP TYPE "AgreedRecordStatus";

-- -- agreed_record_number_sequences ----------------------------------------
CREATE TABLE "agreed_record_number_sequences" (
    "id"          INTEGER NOT NULL DEFAULT 1,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "agreed_record_number_sequences_pkey" PRIMARY KEY ("id")
);

-- -- AgreedRecordStatus enum -----------------------------------------------
CREATE TYPE "AgreedRecordStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'OFFICE_REVIEW',
  'PRICED',
  'APPROVED',
  'SENT_BACK',
  'VOID'
);

-- -- agreed_records ---------------------------------------------------------
CREATE TABLE "agreed_records" (
    "id"                        TEXT NOT NULL,
    "job_id"                    TEXT NOT NULL,
    "record_number"             TEXT NOT NULL,
    "description"               TEXT NOT NULL,
    "work_date"                 TIMESTAMP(3) NOT NULL,
    "status"                    "AgreedRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "job_sor_snapshot_id"       TEXT,
    "sor_version"               TEXT,
    "worker_signature_path"     TEXT,
    "worker_signed_by_id"       TEXT,
    "worker_signed_at"          TIMESTAMP(3),
    "client_rep_name"           TEXT,
    "client_rep_signature_path" TEXT,
    "client_rep_signed_at"      TIMESTAMP(3),
    "submitted_at"              TIMESTAMP(3),
    "created_by_id"             TEXT NOT NULL,
    "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agreed_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agreed_records_record_number_key"
    ON "agreed_records"("record_number");

CREATE INDEX "agreed_records_job_id_status_idx"
    ON "agreed_records"("job_id", "status");

ALTER TABLE "agreed_records"
    ADD CONSTRAINT "agreed_records_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agreed_records"
    ADD CONSTRAINT "agreed_records_job_sor_snapshot_id_fkey"
    FOREIGN KEY ("job_sor_snapshot_id") REFERENCES "job_sor_snapshots"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agreed_records"
    ADD CONSTRAINT "agreed_records_worker_signed_by_id_fkey"
    FOREIGN KEY ("worker_signed_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agreed_records"
    ADD CONSTRAINT "agreed_records_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- -- agreed_record_lines ----------------------------------------------------
CREATE TABLE "agreed_record_lines" (
    "id"               TEXT NOT NULL,
    "agreed_record_id" TEXT NOT NULL,
    "category"         "SorCategory" NOT NULL,
    "resource_name"    TEXT NOT NULL,
    "class"            TEXT,
    "unit"             TEXT,
    "quantity"         DECIMAL(12,2) NOT NULL,
    "tier"             TEXT NOT NULL DEFAULT 'ORDINARY',
    "notes"            TEXT,
    "sort_order"       INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "agreed_record_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agreed_record_lines_agreed_record_id_idx"
    ON "agreed_record_lines"("agreed_record_id");

ALTER TABLE "agreed_record_lines"
    ADD CONSTRAINT "agreed_record_lines_agreed_record_id_fkey"
    FOREIGN KEY ("agreed_record_id") REFERENCES "agreed_records"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- -- agreed_record_attachments ----------------------------------------------
CREATE TABLE "agreed_record_attachments" (
    "id"               TEXT NOT NULL,
    "agreed_record_id" TEXT NOT NULL,
    "kind"             TEXT NOT NULL DEFAULT 'PHOTO',
    "file_path"        TEXT NOT NULL,
    "uploaded_by_id"   TEXT,
    "uploaded_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agreed_record_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agreed_record_attachments_agreed_record_id_idx"
    ON "agreed_record_attachments"("agreed_record_id");

ALTER TABLE "agreed_record_attachments"
    ADD CONSTRAINT "agreed_record_attachments_agreed_record_id_fkey"
    FOREIGN KEY ("agreed_record_id") REFERENCES "agreed_records"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agreed_record_attachments"
    ADD CONSTRAINT "agreed_record_attachments_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
