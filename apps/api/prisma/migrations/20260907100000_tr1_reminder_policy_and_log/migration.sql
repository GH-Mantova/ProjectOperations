-- feat(crm): TR-1 reminder policy + polymorphic reminder log (TR1_REMINDER_POLICY_V1)
--
-- Creates the two new CRM reminder tables. NOTHING ELSE.
--
--   tender_reminder_policy  singleton admin config for the reminder engine
--   tender_reminder_log     (subject_type, subject_id, trigger_key) idempotency
--                           log the TR-2 cron will upsert into
--
-- PRODUCTION IMPACT — read this before merging:
--   * Both tables are NEW. They do not exist on production today, so both are
--     created with ZERO rows.
--   * No existing table is altered. The single ALTER TABLE below adds the
--     updated_by_id foreign key to the table this migration just created; it
--     does not touch "users" or any other existing relation.
--   * No UPDATE, no DELETE, no backfill, no NOT NULL column added to a
--     populated table. There is no data step, so there is no row count that
--     could silently be zero: the NOTICE at the end reports what actually
--     exists after the DDL runs, so the deploy log records it either way.
--   * The default policy row is NOT inserted here. `prisma migrate deploy`
--     runs without the seed on production, so ReminderPolicyService.getPolicy()
--     lazily creates the singleton on first read instead. That keeps this
--     migration pure DDL and keeps the declared rollback strategy honest.
--
-- ROLLBACK: DROP TABLE "tender_reminder_log"; DROP TABLE "tender_reminder_policy";
--   Nothing else needs undoing — no other table was written.
--
-- Loud on a false assumption: the foreign key below assumes "users" exists.
-- If it does not, abort with a message that says so rather than letting
-- ALTER TABLE emit a bare "relation does not exist".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'users'
  ) THEN
    RAISE EXCEPTION
      'TR1_REMINDER_POLICY_V1: table "users" not found in schema %; refusing to create tender_reminder_policy.',
      current_schema();
  END IF;
END
$$;

-- CreateTable
CREATE TABLE "tender_reminder_policy" (
    "id" TEXT NOT NULL,
    "days_before" INTEGER NOT NULL DEFAULT 7,
    "due_day_of" BOOLEAN NOT NULL DEFAULT true,
    "post_submission_chase_days" INTEGER NOT NULL DEFAULT 14,
    "post_submission_cadence_days" INTEGER NOT NULL DEFAULT 14,
    "watch_idle_thresholds" JSONB NOT NULL,
    "rotting_idle_thresholds" JSONB NOT NULL,
    "escalation_window_days" INTEGER NOT NULL DEFAULT 3,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "tender_reminder_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_reminder_log" (
    "id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "trigger_key" TEXT NOT NULL,
    "fired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tender_reminder_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tender_reminder_log_subject_type_subject_id_idx" ON "tender_reminder_log"("subject_type", "subject_id");

-- CreateIndex
-- The race-guard the TR-2 cron upserts against: one fire per
-- (subject, triggerKey), ever.
CREATE UNIQUE INDEX "tender_reminder_log_subject_type_subject_id_trigger_key_key" ON "tender_reminder_log"("subject_type", "subject_id", "trigger_key");

-- AddForeignKey
ALTER TABLE "tender_reminder_policy" ADD CONSTRAINT "tender_reminder_policy_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Report what this migration actually left behind, so the deploy log records
-- it. A fresh production deploy must print 0 and 0 — anything else means these
-- table names collided with something that already existed.
DO $$
DECLARE
  policy_rows BIGINT;
  log_rows    BIGINT;
BEGIN
  SELECT COUNT(*) INTO policy_rows FROM "tender_reminder_policy";
  SELECT COUNT(*) INTO log_rows    FROM "tender_reminder_log";
  RAISE NOTICE
    'TR1_REMINDER_POLICY_V1: created tender_reminder_policy (% rows) and tender_reminder_log (% rows); 0 existing rows modified.',
    policy_rows, log_rows;
END
$$;
