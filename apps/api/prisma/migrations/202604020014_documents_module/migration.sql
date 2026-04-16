ALTER TABLE "sharepoint_file_links"
ADD COLUMN "version_label" TEXT,
ADD COLUMN "version_number" INTEGER;

ALTER TABLE "document_links"
ADD COLUMN "module" TEXT NOT NULL DEFAULT 'documents',
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "version_label" TEXT,
ADD COLUMN "version_number" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "document_family_key" TEXT,
ADD COLUMN "is_current_version" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "superseded_at" TIMESTAMP(3),
ADD COLUMN "created_by_id" TEXT,
ADD COLUMN "updated_by_id" TEXT,
ADD COLUMN "metadata" JSONB;

UPDATE "document_links"
SET "module" = CASE
  WHEN "linked_entity_type" = 'Job' THEN 'jobs'
  WHEN "linked_entity_type" = 'Asset' THEN 'assets'
  WHEN "linked_entity_type" = 'FormSubmission' THEN 'forms'
  WHEN "linked_entity_type" = 'Tender' THEN 'tendering'
  ELSE 'documents'
END;

ALTER TABLE "document_links"
ADD CONSTRAINT "document_links_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "document_links"
ADD CONSTRAINT "document_links_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "document_tags" (
    "id" TEXT NOT NULL,
    "document_link_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_access_rules" (
    "id" TEXT NOT NULL,
    "document_link_id" TEXT NOT NULL,
    "access_type" TEXT NOT NULL,
    "role_name" TEXT,
    "permission_code" TEXT,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_download" BOOLEAN NOT NULL DEFAULT true,
    "can_open_link" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_tags_document_link_id_tag_key" ON "document_tags"("document_link_id", "tag");
CREATE INDEX "document_tags_tag_idx" ON "document_tags"("tag");
CREATE INDEX "document_links_module_idx" ON "document_links"("module");
CREATE INDEX "document_links_document_family_key_version_number_idx" ON "document_links"("document_family_key", "version_number");
CREATE INDEX "document_links_status_is_current_version_idx" ON "document_links"("status", "is_current_version");
CREATE INDEX "document_access_rules_access_type_idx" ON "document_access_rules"("access_type");
CREATE INDEX "document_access_rules_role_name_idx" ON "document_access_rules"("role_name");
CREATE INDEX "document_access_rules_permission_code_idx" ON "document_access_rules"("permission_code");

ALTER TABLE "document_tags"
ADD CONSTRAINT "document_tags_document_link_id_fkey"
FOREIGN KEY ("document_link_id") REFERENCES "document_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_access_rules"
ADD CONSTRAINT "document_access_rules_document_link_id_fkey"
FOREIGN KEY ("document_link_id") REFERENCES "document_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
