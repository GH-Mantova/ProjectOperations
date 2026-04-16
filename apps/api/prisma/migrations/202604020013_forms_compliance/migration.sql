CREATE TABLE "form_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "geolocation_enabled" BOOLEAN NOT NULL DEFAULT false,
    "association_scopes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "form_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_template_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_sections" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "section_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_fields" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "field_order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "help_text" TEXT,
    "options_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_rules" (
    "id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "source_field_key" TEXT NOT NULL,
    "target_field_key" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "comparison_value" TEXT,
    "effect" TEXT NOT NULL DEFAULT 'SHOW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_submissions" (
    "id" TEXT NOT NULL,
    "template_version_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_by_id" TEXT,
    "job_id" TEXT,
    "client_id" TEXT,
    "asset_id" TEXT,
    "worker_id" TEXT,
    "site_id" TEXT,
    "shift_id" TEXT,
    "supplier_name" TEXT,
    "geolocation" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_submission_values" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "field_id" TEXT,
    "field_key" TEXT NOT NULL,
    "value_text" TEXT,
    "value_number" DECIMAL(14,2),
    "value_date_time" TIMESTAMP(3),
    "value_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_submission_values_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_attachments" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "field_key" TEXT,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "form_signatures" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "field_key" TEXT,
    "signer_name" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "form_signatures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "form_templates_code_key" ON "form_templates"("code");
CREATE INDEX "form_templates_status_idx" ON "form_templates"("status");
CREATE UNIQUE INDEX "form_template_versions_template_id_version_number_key" ON "form_template_versions"("template_id", "version_number");
CREATE INDEX "form_template_versions_template_id_status_idx" ON "form_template_versions"("template_id", "status");
CREATE INDEX "form_sections_version_id_section_order_idx" ON "form_sections"("version_id", "section_order");
CREATE UNIQUE INDEX "form_fields_section_id_field_key_key" ON "form_fields"("section_id", "field_key");
CREATE INDEX "form_fields_section_id_field_order_idx" ON "form_fields"("section_id", "field_order");
CREATE INDEX "form_rules_version_id_idx" ON "form_rules"("version_id");
CREATE INDEX "form_submissions_template_version_id_submitted_at_idx" ON "form_submissions"("template_version_id", "submitted_at");
CREATE INDEX "form_submissions_job_id_idx" ON "form_submissions"("job_id");
CREATE INDEX "form_submissions_asset_id_idx" ON "form_submissions"("asset_id");
CREATE INDEX "form_submissions_worker_id_idx" ON "form_submissions"("worker_id");
CREATE INDEX "form_submissions_shift_id_idx" ON "form_submissions"("shift_id");
CREATE INDEX "form_submission_values_submission_id_idx" ON "form_submission_values"("submission_id");
CREATE INDEX "form_submission_values_field_key_idx" ON "form_submission_values"("field_key");
CREATE INDEX "form_attachments_submission_id_idx" ON "form_attachments"("submission_id");
CREATE INDEX "form_signatures_submission_id_idx" ON "form_signatures"("submission_id");

ALTER TABLE "form_template_versions"
ADD CONSTRAINT "form_template_versions_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_sections"
ADD CONSTRAINT "form_sections_version_id_fkey"
FOREIGN KEY ("version_id") REFERENCES "form_template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_fields"
ADD CONSTRAINT "form_fields_section_id_fkey"
FOREIGN KEY ("section_id") REFERENCES "form_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_rules"
ADD CONSTRAINT "form_rules_version_id_fkey"
FOREIGN KEY ("version_id") REFERENCES "form_template_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
ADD CONSTRAINT "form_submissions_template_version_id_fkey"
FOREIGN KEY ("template_version_id") REFERENCES "form_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
ADD CONSTRAINT "form_submissions_submitted_by_id_fkey"
FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
ADD CONSTRAINT "form_submissions_job_id_fkey"
FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
ADD CONSTRAINT "form_submissions_client_id_fkey"
FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
ADD CONSTRAINT "form_submissions_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
ADD CONSTRAINT "form_submissions_worker_id_fkey"
FOREIGN KEY ("worker_id") REFERENCES "workers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
ADD CONSTRAINT "form_submissions_site_id_fkey"
FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
ADD CONSTRAINT "form_submissions_shift_id_fkey"
FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_submission_values"
ADD CONSTRAINT "form_submission_values_submission_id_fkey"
FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_submission_values"
ADD CONSTRAINT "form_submission_values_field_id_fkey"
FOREIGN KEY ("field_id") REFERENCES "form_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_attachments"
ADD CONSTRAINT "form_attachments_submission_id_fkey"
FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_signatures"
ADD CONSTRAINT "form_signatures_submission_id_fkey"
FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
