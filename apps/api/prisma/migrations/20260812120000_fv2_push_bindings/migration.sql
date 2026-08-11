-- F-9a: push engine storage.
-- (1) New table: form_field_push_bindings.
-- (2) Three new nullable/defaulted columns on form_triggered_records so
--     failed and retried pushes are visible on the same audit spine.
--     No backfill: existing rows correctly default to status = 'success'
--     and attempts = 1.

-- (1) Push bindings table
CREATE TABLE "form_field_push_bindings" (
    "id"            TEXT        NOT NULL,
    "field_id"      TEXT        NOT NULL,
    "target_module" TEXT        NOT NULL,
    "target_action" TEXT        NOT NULL,
    "apply_on"      TEXT        NOT NULL DEFAULT 'submit',
    "config"        JSONB       NOT NULL DEFAULT '{}',
    "is_enabled"    BOOLEAN     NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_field_push_bindings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "form_field_push_bindings_field_id_idx" ON "form_field_push_bindings"("field_id");

ALTER TABLE "form_field_push_bindings"
    ADD CONSTRAINT "form_field_push_bindings_field_id_fkey"
    FOREIGN KEY ("field_id") REFERENCES "form_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- (2) Audit columns on form_triggered_records
ALTER TABLE "form_triggered_records"
    ADD COLUMN "status"     TEXT    NOT NULL DEFAULT 'success',
    ADD COLUMN "last_error" TEXT,
    ADD COLUMN "attempts"   INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "binding_id" TEXT;

CREATE INDEX "form_triggered_records_binding_id_idx" ON "form_triggered_records"("binding_id");

ALTER TABLE "form_triggered_records"
    ADD CONSTRAINT "form_triggered_records_binding_id_fkey"
    FOREIGN KEY ("binding_id") REFERENCES "form_field_push_bindings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
