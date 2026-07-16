-- ERP gap A/commercial — punch / snag / defect list.
-- Job-scoped handover / make-good close-out list, Procore parity.
-- Raised from ad-hoc inspections or linked to a FormSubmission /
-- corrective action row when generated from a checklist.
--
-- Status graph: OPEN → IN_PROGRESS → CLOSED. Cascade delete on the
-- parent job; raiser is required (Restrict); assignee, closer and
-- linked submission all fall through to SET NULL on delete so we
-- never lose a punch item because a user or submission went away.

CREATE TABLE "punch_items" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "raised_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "due_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "closed_by_id" TEXT,
    "closure_note" TEXT,
    "photo_url" TEXT,
    "submission_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "punch_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "punch_items_job_id_status_idx" ON "punch_items"("job_id", "status");
CREATE INDEX "punch_items_assigned_to_id_status_idx" ON "punch_items"("assigned_to_id", "status");
CREATE INDEX "punch_items_due_at_idx" ON "punch_items"("due_at");

ALTER TABLE "punch_items"
  ADD CONSTRAINT "punch_items_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "jobs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "punch_items"
  ADD CONSTRAINT "punch_items_raised_by_id_fkey"
  FOREIGN KEY ("raised_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "punch_items"
  ADD CONSTRAINT "punch_items_assigned_to_id_fkey"
  FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "punch_items"
  ADD CONSTRAINT "punch_items_closed_by_id_fkey"
  FOREIGN KEY ("closed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "punch_items"
  ADD CONSTRAINT "punch_items_submission_id_fkey"
  FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
