-- Data migration: seed the `claim.draft_ready_for_review` notification trigger config.
--
-- The month-end draft-claim reminder (ClaimDraftReminderService) fires the
-- "claim.draft_ready_for_review" trigger. Production runs `prisma migrate deploy`
-- and NOT the TypeScript seed (seedNotificationTriggerConfigs), so without this
-- migration the trigger row would never exist in prod and the reminder could not
-- be enabled from Admin Settings. Seeded DISABLED (opt-in), matching the seed intent.
--
-- Idempotent: the unique `trigger` column arbitrates via ON CONFLICT DO NOTHING,
-- so re-applying (or a later dev seed run) is a no-op and never clobbers admin state.
INSERT INTO "notification_trigger_configs"
  ("id", "trigger", "label", "description", "is_enabled", "delivery_method", "recipient_roles", "recipient_user_ids", "created_at", "updated_at")
VALUES
  ('ntc-claim-draft-ready-for-review',
   'claim.draft_ready_for_review',
   'Draft progress claim ready for review',
   'Sent on the 28th of each month when an ACTIVE contract has no progress claim generated yet for the current month. Prompts the responsible user to generate and issue the claim before the cut-off date.',
   false,
   'both',
   ARRAY[]::text[],
   ARRAY[]::text[],
   now(),
   now())
ON CONFLICT ("trigger") DO NOTHING;
