-- SoR S9a — feed APPROVED Agreed Records into the existing ProgressClaim.
--
-- WHAT THIS DOES (two steps, both additive, nothing existing altered):
--   1. DDL   — one NULLABLE column `agreed_record_id` on "claim_line_items",
--              its FK (ON DELETE SET NULL) and its index. This is the AR-side
--              mirror of the `variation_id` column that already exists on the
--              same table and feeds approved VCs into a claim.
--   2. DATA  — one idempotent upsert into "notification_trigger_configs" for
--              `progress_claim.ready_for_director`, so the Director can be
--              notified when a claim is raised. Production runs
--              `prisma migrate deploy` and NOT the TypeScript seed, so a
--              trigger row that is not seeded HERE would never exist in prod
--              and the notification could never be enabled from Admin
--              Settings. Same reasoning, and the same ON CONFLICT DO NOTHING
--              shape, as 20260811160000_seed_claim_draft_ready_trigger.
--
-- PRODUCTION SAFETY
--   * The new column is nullable with NO default: existing "claim_line_items"
--     rows are not rewritten and not read. No data is moved, changed or
--     deleted. There is no backfill, because there is nothing to backfill —
--     no claim line predating S9a has an AR source.
--   * `recipient_roles` is matched against Role.name (see
--     ComplianceService.resolveRecipients: `role: { name: { in: ... } }`), so
--     the value here MUST be a real row in "roles". The seeded roles are
--     Admin / Planner / Field / Viewer / Project Manager / Senior Estimator /
--     WHS Officer / Accounts / Warehouse Manager / Field Worker — there is NO
--     "Director" role. Marco (Company Director) holds Admin, and the S8
--     migration already set the precedent of mapping a human title onto the
--     Admin role ('agreed_record.priced_awaiting_ops' → ARRAY['Admin'],
--     described as "the Operations Manager (Admin role)"). A literal
--     'DIRECTOR' token would match zero users and the notification would
--     silently reach nobody. The DO block below RAISES A NOTICE if the role
--     it points at is missing, so a zero-recipient trigger is visible in the
--     deploy log instead of looking like a success.
--
-- DOWN MIGRATION (forward-only repo; recorded for the reviewer):
--   DROP INDEX "claim_line_items_agreed_record_id_idx";
--   ALTER TABLE "claim_line_items"
--     DROP CONSTRAINT "claim_line_items_agreed_record_id_fkey",
--     DROP COLUMN "agreed_record_id";
--   DELETE FROM "notification_trigger_configs"
--     WHERE "trigger" = 'progress_claim.ready_for_director';

-- ── 1. DDL — nullable AR foreign key on claim_line_items ────────────────────

ALTER TABLE "claim_line_items"
    ADD COLUMN "agreed_record_id" TEXT;

ALTER TABLE "claim_line_items"
    ADD CONSTRAINT "claim_line_items_agreed_record_id_fkey"
    FOREIGN KEY ("agreed_record_id") REFERENCES "agreed_records"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "claim_line_items_agreed_record_id_idx"
    ON "claim_line_items"("agreed_record_id");

-- ── 2. DATA — seed the Director claim-ready trigger (idempotent) ────────────

INSERT INTO "notification_trigger_configs"
    ("id", "trigger", "label", "description", "is_enabled", "delivery_method",
     "recipient_roles", "recipient_user_ids", "created_at", "updated_at")
VALUES
    (
        'ntc-progress-claim-ready-for-director',
        'progress_claim.ready_for_director',
        'Progress claim ready — Director review',
        'Fires when a progress claim is raised from the per-job SoR register (approved Variations and/or approved, fully signed Agreed Records). Notifies the Director that a claim is ready for review. Recipients are the Admin role — the Director holds Admin; there is no separate Director role. Change the recipients in Admin Settings without a code deploy.',
        TRUE,
        'both',
        ARRAY['Admin'],
        ARRAY[]::TEXT[],
        NOW(),
        NOW()
    )
ON CONFLICT ("trigger") DO NOTHING;

-- ── 3. Report what this migration actually touched ─────────────────────────
--
-- Every count below is printed to the deploy log. Two of them are assertions
-- in disguise: `lines_with_ar` must be 0 (the column was just created), and
-- `admin_role_users` being 0 would mean the trigger we just seeded can never
-- notify anyone — the exact "matched zero rows, exited 0, looked successful"
-- failure this project has hit before.

DO $$
DECLARE
    total_claim_lines INTEGER;
    lines_with_ar     INTEGER;
    trigger_rows      INTEGER;
    admin_role_users  INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_claim_lines FROM "claim_line_items";
    SELECT COUNT(*) INTO lines_with_ar
      FROM "claim_line_items" WHERE "agreed_record_id" IS NOT NULL;
    SELECT COUNT(*) INTO trigger_rows
      FROM "notification_trigger_configs"
     WHERE "trigger" = 'progress_claim.ready_for_director';
    SELECT COUNT(*) INTO admin_role_users
      FROM "user_roles" ur
      JOIN "roles" r ON r."id" = ur."role_id"
     WHERE r."name" = 'Admin';

    RAISE NOTICE 'sor_s9a: claim_line_items rows = % (all keep agreed_record_id NULL; none rewritten)', total_claim_lines;
    RAISE NOTICE 'sor_s9a: claim_line_items with agreed_record_id set = % (expected 0 immediately after add)', lines_with_ar;
    RAISE NOTICE 'sor_s9a: progress_claim.ready_for_director trigger rows = % (expected 1)', trigger_rows;
    RAISE NOTICE 'sor_s9a: users holding the Admin role (trigger recipients) = %', admin_role_users;

    IF lines_with_ar <> 0 THEN
        RAISE WARNING 'sor_s9a: agreed_record_id is unexpectedly populated on % row(s) immediately after ADD COLUMN — investigate before trusting the claim feed', lines_with_ar;
    END IF;

    IF trigger_rows <> 1 THEN
        RAISE WARNING 'sor_s9a: expected exactly 1 progress_claim.ready_for_director row, found % — the Director notification will not behave as configured', trigger_rows;
    END IF;

    IF admin_role_users = 0 THEN
        RAISE WARNING 'sor_s9a: NO user holds the Admin role — progress_claim.ready_for_director is enabled but will notify nobody until recipients are set in Admin Settings';
    END IF;
END $$;
