-- Migration: 20260716000000_forms_corrective_action
-- Forms Engine CAPA close-out loop (this PR).
-- Adds corrective_actions table and back-links on form_submissions and users.

CREATE TABLE "corrective_actions" (
    "id"               TEXT NOT NULL,
    "submission_id"    TEXT,
    "source_field_key" TEXT,
    "title"            TEXT NOT NULL,
    "description"      TEXT,
    "assigned_to_id"   TEXT,
    "assigned_to_role" TEXT,
    "due_at"           TIMESTAMP(3),
    "priority"         TEXT NOT NULL DEFAULT 'medium',
    "status"           TEXT NOT NULL DEFAULT 'open',
    "closed_at"        TIMESTAMP(3),
    "closed_by_id"     TEXT,
    "close_out_note"   TEXT,
    "evidence_path"    TEXT,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "corrective_actions_submission_id_idx"  ON "corrective_actions"("submission_id");
CREATE INDEX "corrective_actions_assigned_to_id_idx" ON "corrective_actions"("assigned_to_id");
CREATE INDEX "corrective_actions_status_idx"         ON "corrective_actions"("status");
CREATE INDEX "corrective_actions_due_at_idx"         ON "corrective_actions"("due_at");

-- Foreign keys
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_submission_id_fkey"
    FOREIGN KEY ("submission_id")
    REFERENCES "form_submissions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_closed_by_id_fkey"
    FOREIGN KEY ("closed_by_id")
    REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
