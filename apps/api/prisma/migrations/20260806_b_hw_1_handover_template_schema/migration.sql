-- B-HW-1: HandoverTemplate / HandoverTemplateSection / HandoverTemplateField
-- Purely additive — no existing tables are altered. Creates the three schema
-- tables that back the configurable, versioned contract handover wizard template.
--
-- Rollback:
--   DROP TABLE "handover_template_fields";
--   DROP TABLE "handover_template_sections";
--   DROP TABLE "handover_templates";
--   DROP TYPE "HandoverFieldType";
--   DROP TYPE "HandoverFieldSourceType";

-- Enums
CREATE TYPE "HandoverFieldType" AS ENUM ('text', 'money', 'date', 'list', 'attachment', 'contact');
CREATE TYPE "HandoverFieldSourceType" AS ENUM ('auto', 'capture', 'attach', 'derived');

-- HandoverTemplate: one row per published version.
-- publishedById references users.id (nullable — drafts have no publisher yet).
CREATE TABLE "handover_templates" (
    "id"              TEXT        NOT NULL,
    "version"         INTEGER     NOT NULL,
    "is_active"       BOOLEAN     NOT NULL DEFAULT false,
    "published_at"    TIMESTAMP(3),
    "published_by_id" TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "handover_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "handover_templates_is_active_idx"
    ON "handover_templates"("is_active");

CREATE INDEX "handover_templates_version_idx"
    ON "handover_templates"("version");

ALTER TABLE "handover_templates"
    ADD CONSTRAINT "handover_templates_published_by_id_fkey"
    FOREIGN KEY ("published_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- HandoverTemplateSection: ordered groups of fields within a template.
CREATE TABLE "handover_template_sections" (
    "id"          TEXT        NOT NULL,
    "template_id" TEXT        NOT NULL,
    "key"         TEXT        NOT NULL,
    "label"       TEXT        NOT NULL,
    "sort_order"  INTEGER     NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "handover_template_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "handover_template_sections_template_id_key_key"
    ON "handover_template_sections"("template_id", "key");

CREATE INDEX "handover_template_sections_template_id_sort_order_idx"
    ON "handover_template_sections"("template_id", "sort_order");

ALTER TABLE "handover_template_sections"
    ADD CONSTRAINT "handover_template_sections_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "handover_templates"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- HandoverTemplateField: individual fields within a section.
-- key is stable/immutable — the identity that HandoverValue rows bind to.
-- retiredAt is used instead of deletion so saved data remains interpretable.
CREATE TABLE "handover_template_fields" (
    "id"           TEXT                     NOT NULL,
    "section_id"   TEXT                     NOT NULL,
    "key"          TEXT                     NOT NULL,
    "label"        TEXT                     NOT NULL,
    "type"         "HandoverFieldType"      NOT NULL,
    "source_type"  "HandoverFieldSourceType" NOT NULL,
    "auto_binding" TEXT,
    "list_id"      TEXT,
    "required"     BOOLEAN                  NOT NULL DEFAULT false,
    "sort_order"   INTEGER                  NOT NULL,
    "retired_at"   TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "handover_template_fields_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "handover_template_fields_section_id_key_key"
    ON "handover_template_fields"("section_id", "key");

CREATE INDEX "handover_template_fields_section_id_sort_order_idx"
    ON "handover_template_fields"("section_id", "sort_order");

CREATE INDEX "handover_template_fields_retired_at_idx"
    ON "handover_template_fields"("retired_at");

ALTER TABLE "handover_template_fields"
    ADD CONSTRAINT "handover_template_fields_section_id_fkey"
    FOREIGN KEY ("section_id") REFERENCES "handover_template_sections"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
