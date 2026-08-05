-- F-2a: FormRule storage expansion
-- Add a nullable `definition` JSONB column to form_rules to store the
-- canonical FieldRule JSON contract shape alongside the legacy flat columns.
-- Legacy columns (source_field_key, target_field_key, operator,
-- comparison_value, effect) are intentionally kept per the soak-before-drop
-- rule — they will be removed in a later slice once consumers are migrated.

ALTER TABLE "form_rules" ADD COLUMN "definition" JSONB;

-- Backfill: for every existing row, populate `definition` with a single-
-- condition + show/hide-action FieldRule derived from the legacy flat columns.
-- Idempotent by construction (WHERE "definition" IS NULL).
UPDATE "form_rules"
SET "definition" = jsonb_build_object(
  'trigger', 'on_change',
  'conditionGroup', jsonb_build_object(
    'logic', 'AND',
    'conditions', jsonb_build_array(
      jsonb_build_object(
        'fieldKey', source_field_key,
        'operator', lower(operator),
        'value',    comparison_value
      )
    )
  ),
  'actions', jsonb_build_array(
    jsonb_build_object(
      'type',   lower(effect),
      'target', target_field_key
    )
  )
)
WHERE "definition" IS NULL;
