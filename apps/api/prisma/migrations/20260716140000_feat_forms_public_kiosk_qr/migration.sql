-- Migration: 20260716140000_feat_forms_public_kiosk_qr
-- PR #621 -- public / kiosk / QR-code capture (no-login form submission)
-- Adds FormPublicLink table and back-reference columns on form_submissions.

-- FormPublicLink: tokenised public/kiosk links against a form template
CREATE TABLE "form_public_links" (
    "id"               TEXT NOT NULL,
    "template_id"      TEXT NOT NULL,
    "token"            TEXT NOT NULL,
    "mode"             TEXT NOT NULL DEFAULT 'public',
    "is_active"        BOOLEAN NOT NULL DEFAULT true,
    "expires_at"       TIMESTAMP(3),
    "site_id"          TEXT,
    "job_id"           TEXT,
    "max_submissions"  INTEGER,
    "submission_count" INTEGER NOT NULL DEFAULT 0,
    "label"            TEXT,
    "created_by_id"    TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_public_links_pkey" PRIMARY KEY ("id")
);

-- Unique token index (keyed by GET /forms/public/:token)
CREATE UNIQUE INDEX "form_public_links_token_key" ON "form_public_links"("token");
CREATE INDEX "form_public_links_template_id_idx" ON "form_public_links"("template_id");

-- Add public_link_id back-reference on form_submissions
ALTER TABLE "form_submissions" ADD COLUMN "public_link_id" TEXT;
CREATE INDEX "form_submissions_public_link_id_idx" ON "form_submissions"("public_link_id");

-- Foreign keys
ALTER TABLE "form_public_links"
    ADD CONSTRAINT "form_public_links_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "form_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_public_links"
    ADD CONSTRAINT "form_public_links_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "form_submissions"
    ADD CONSTRAINT "form_submissions_public_link_id_fkey"
    FOREIGN KEY ("public_link_id") REFERENCES "form_public_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;
