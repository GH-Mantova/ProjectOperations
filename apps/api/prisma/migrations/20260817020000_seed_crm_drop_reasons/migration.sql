-- Data migration: seed the six default CRM drop reasons.
--
-- Production runs "prisma migrate deploy" and NOT the TypeScript seed, so without
-- this migration the drop_reasons table stays empty in production and the
-- "Don't pursue" action is unusable: DontPursueModal hard-blocks with
-- "No drop reasons configured. An admin needs to create them under Settings first."
-- (Observed on the deployed app, 2026-08-17.)
--
-- Idempotent: the unique label column arbitrates via ON CONFLICT DO NOTHING, so
-- re-applying, or a later dev seed run, is a no-op and never clobbers a label an
-- admin has since renamed or deactivated. Mirrors the pattern established by
-- 20260811160000_seed_claim_draft_ready_trigger.
INSERT INTO "drop_reasons" ("id", "label", "is_active", "sort_order", "created_at", "updated_at")
VALUES
  ('dr-price-budget',     'Price / budget',            true, 10, now(), now()),
  ('dr-unaware-offering', 'Didn''t know we offer it', true, 20, now(), now()),
  ('dr-timing-capacity',  'Timing / capacity',         true, 30, now(), now()),
  ('dr-out-of-area',      'Out of service area',       true, 40, now(), now()),
  ('dr-went-cold',        'Went cold',                 true, 50, now(), now()),
  ('dr-other',            'Other',                     true, 60, now(), now())
ON CONFLICT ("label") DO NOTHING;
