-- Customer Voice / Satisfaction Surveys (feat/customer-voice-surveys)
-- Survey = reusable template; SurveyResponse = one client's captured answers.
-- overallScore uses the same 1-5 scale as Client.preferenceScore (stored as
-- DOUBLE PRECISION for precision before rounding to Int for the client score).

-- ── 1. Survey templates ────────────────────────────────────────────────────
CREATE TABLE "surveys" (
  "id"          TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "description" TEXT,
  "questions"   JSONB        NOT NULL,
  "is_default"  BOOLEAN      NOT NULL DEFAULT false,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- ── 2. Survey responses ────────────────────────────────────────────────────
CREATE TABLE "survey_responses" (
  "id"            TEXT             NOT NULL,
  "survey_id"     TEXT             NOT NULL,
  "client_id"     TEXT             NOT NULL,
  "job_id"        TEXT,
  "project_id"    TEXT,
  "answers"       JSONB            NOT NULL,
  "overall_score" DOUBLE PRECISION NOT NULL,
  "submitted_at"  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" TEXT,
  "created_at"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)     NOT NULL,

  CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- ── 3. Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX "survey_responses_survey_id_idx"  ON "survey_responses"("survey_id");
CREATE INDEX "survey_responses_client_id_idx"  ON "survey_responses"("client_id");
CREATE INDEX "survey_responses_job_id_idx"     ON "survey_responses"("job_id");
CREATE INDEX "survey_responses_project_id_idx" ON "survey_responses"("project_id");

-- ── 4. Foreign keys ────────────────────────────────────────────────────────
ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_survey_id_fkey"
    FOREIGN KEY ("survey_id")   REFERENCES "surveys"("id")  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_client_id_fkey"
    FOREIGN KEY ("client_id")   REFERENCES "clients"("id")  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_job_id_fkey"
    FOREIGN KEY ("job_id")      REFERENCES "jobs"("id")     ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_project_id_fkey"
    FOREIGN KEY ("project_id")  REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "survey_responses"
  ADD CONSTRAINT "survey_responses_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")  ON DELETE SET NULL ON UPDATE CASCADE;
