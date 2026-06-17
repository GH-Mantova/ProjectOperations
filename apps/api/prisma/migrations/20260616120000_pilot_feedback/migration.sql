-- GATE-ALLOW: migrations
-- PR #193b — In-app pilot feedback capture.
-- Single table backing POST /feedback (any logged-in user) and the admin
-- triage list. Status is a free-form string column rather than an enum so
-- we can extend the taxonomy without a schema change.

CREATE TABLE "pilot_feedback" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "route"      TEXT NOT NULL,
  "category"   TEXT NOT NULL,
  "message"    TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'new',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pilot_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pilot_feedback_status_created_at_idx" ON "pilot_feedback"("status", "created_at");
CREATE INDEX "pilot_feedback_user_id_idx" ON "pilot_feedback"("user_id");

ALTER TABLE "pilot_feedback"
  ADD CONSTRAINT "pilot_feedback_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
