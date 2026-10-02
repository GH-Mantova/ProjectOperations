-- fv2_formrule_contract (F-2c contract drop)
-- Drops the five legacy flat columns from form_rules after soak period.
-- Both evaluators (rules-engine.service.ts server-side, FormFillPage.tsx
-- client-side) have been reading only `definition` since the F-2a backfill
-- migration (20260804_fv2_formrule_expand). The legacy columns are no
-- longer written or read at runtime; this migration removes them.
--
-- This migration is deliberately irreversible for the dropped column values.
-- If a rollback is needed, add the five columns back as nullable in a
-- follow-up migration and leave them NULL (do not attempt to re-populate
-- from definition).

ALTER TABLE "form_rules" DROP COLUMN "source_field_key";
ALTER TABLE "form_rules" DROP COLUMN "target_field_key";
ALTER TABLE "form_rules" DROP COLUMN "operator";
ALTER TABLE "form_rules" DROP COLUMN "comparison_value";
ALTER TABLE "form_rules" DROP COLUMN "effect";
