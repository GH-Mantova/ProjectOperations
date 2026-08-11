-- B-HW-5: Handover instance schema
-- Adds: Handover, HandoverValue, HandoverComplianceItem, HandoverSubcontractor,
--        HandoverAttachment, plus three new enums.
-- Purely additive — no existing tables are altered.
--
-- Rollback:
--   DROP TABLE "handover_attachments";
--   DROP TABLE "handover_subcontractors";
--   DROP TABLE "handover_compliance_items";
--   DROP TABLE "handover_values";
--   DROP TABLE "handovers";
--   DROP TYPE "HandoverResponsibleParty";
--   DROP TYPE "HandoverOrigin";
--   DROP TYPE "HandoverStatus";

-- Enums
CREATE TYPE "HandoverStatus" AS ENUM ('draft', 'finalised');
CREATE TYPE "HandoverOrigin" AS ENUM ('suggested', 'manual');
CREATE TYPE "HandoverResponsibleParty" AS ENUM ('us', 'client');

-- Handover: one instance per contract issuance, pinned to a template version.
-- templateVersionId references handover_templates.id with RESTRICT so the
-- pinned version is never silently lost.
-- contractId and tenderId both CASCADE so a deleted contract/tender cleans up.
CREATE TABLE "handovers" (
    "id"                  TEXT           NOT NULL,
    "contract_id"         TEXT           NOT NULL,
    "tender_id"           TEXT           NOT NULL,
    "template_version_id" TEXT           NOT NULL,
    "status"              "HandoverStatus" NOT NULL DEFAULT 'draft',
    "completion_pct"      INTEGER        NOT NULL DEFAULT 0,
    "created_by_id"       TEXT           NOT NULL,
    "finalised_at"        TIMESTAMP(3),
    "created_at"          TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3)   NOT NULL,
    CONSTRAINT "handovers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "handovers_contract_id_idx"
    ON "handovers"("contract_id");

CREATE INDEX "handovers_tender_id_idx"
    ON "handovers"("tender_id");

CREATE INDEX "handovers_status_idx"
    ON "handovers"("status");

ALTER TABLE "handovers"
    ADD CONSTRAINT "handovers_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "contracts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "handovers"
    ADD CONSTRAINT "handovers_tender_id_fkey"
    FOREIGN KEY ("tender_id") REFERENCES "tenders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "handovers"
    ADD CONSTRAINT "handovers_template_version_id_fkey"
    FOREIGN KEY ("template_version_id") REFERENCES "handover_templates"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "handovers"
    ADD CONSTRAINT "handovers_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- HandoverValue: one row per (handover, fieldKey) pair.
-- Stores the field value as JSON; sourceValue retains the original auto-prefill
-- so the UI can offer a "reset to source" action.
CREATE TABLE "handover_values" (
    "id"           TEXT         NOT NULL,
    "handover_id"  TEXT         NOT NULL,
    "field_key"    TEXT         NOT NULL,
    "value"        JSONB        NOT NULL,
    "source_value" JSONB,
    "is_overridden" BOOLEAN     NOT NULL DEFAULT false,
    "section_done"  BOOLEAN     NOT NULL DEFAULT false,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "handover_values_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "handover_values_handover_id_field_key_key"
    ON "handover_values"("handover_id", "field_key");

ALTER TABLE "handover_values"
    ADD CONSTRAINT "handover_values_handover_id_fkey"
    FOREIGN KEY ("handover_id") REFERENCES "handovers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- HandoverComplianceItem: obligations derived from WBS activity types (suggested)
-- or added manually, each with a responsible-party flag.
CREATE TABLE "handover_compliance_items" (
    "id"                 TEXT                       NOT NULL,
    "handover_id"        TEXT                       NOT NULL,
    "type"               TEXT                       NOT NULL,
    "origin"             "HandoverOrigin"            NOT NULL,
    "responsible_party"  "HandoverResponsibleParty"  NOT NULL,
    "status"             TEXT                       NOT NULL,
    "doc_ref"            TEXT,
    "created_at"         TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3)               NOT NULL,
    CONSTRAINT "handover_compliance_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "handover_compliance_items_handover_id_idx"
    ON "handover_compliance_items"("handover_id");

ALTER TABLE "handover_compliance_items"
    ADD CONSTRAINT "handover_compliance_items_handover_id_fkey"
    FOREIGN KEY ("handover_id") REFERENCES "handovers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- HandoverSubcontractor: subcontractors/procurement lines captured in the wizard.
CREATE TABLE "handover_subcontractors" (
    "id"           TEXT         NOT NULL,
    "handover_id"  TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "quote_ref"    TEXT,
    "po_ref"       TEXT,
    "folder_slot"  TEXT         NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "handover_subcontractors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "handover_subcontractors_handover_id_idx"
    ON "handover_subcontractors"("handover_id");

ALTER TABLE "handover_subcontractors"
    ADD CONSTRAINT "handover_subcontractors_handover_id_fkey"
    FOREIGN KEY ("handover_id") REFERENCES "handovers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- HandoverAttachment: document references attached to a handover.
-- fieldKey and category are both nullable; the API layer enforces that
-- exactly one is present (no DB CHECK constraint by design).
CREATE TABLE "handover_attachments" (
    "id"           TEXT         NOT NULL,
    "handover_id"  TEXT         NOT NULL,
    "field_key"    TEXT,
    "category"     TEXT,
    "doc_ref"      TEXT         NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "handover_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "handover_attachments_handover_id_idx"
    ON "handover_attachments"("handover_id");

ALTER TABLE "handover_attachments"
    ADD CONSTRAINT "handover_attachments_handover_id_fkey"
    FOREIGN KEY ("handover_id") REFERENCES "handovers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
