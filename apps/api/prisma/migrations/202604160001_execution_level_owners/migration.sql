ALTER TABLE "job_activities"
ADD COLUMN IF NOT EXISTS "owner_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "job_activities_owner_user_id_idx"
ON "job_activities"("owner_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_activities_owner_user_id_fkey'
  ) THEN
    ALTER TABLE "job_activities"
    ADD CONSTRAINT "job_activities_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "shifts"
ADD COLUMN IF NOT EXISTS "lead_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "shifts_lead_user_id_idx"
ON "shifts"("lead_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'shifts_lead_user_id_fkey'
  ) THEN
    ALTER TABLE "shifts"
    ADD CONSTRAINT "shifts_lead_user_id_fkey"
    FOREIGN KEY ("lead_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
