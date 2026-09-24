-- fv2_formrule_contract: drop legacy show/hide-style FormRule columns.
-- The canonical FieldRule contract lives in FormRule.definition (Json).
-- Runtime evaluators read only FormField.conditions / FormField.actions;
-- FormRule.* columns are no longer used at read time by any service.
ALTER TABLE "form_rules" DROP COLUMN "source_field_key";
ALTER TABLE "form_rules" DROP COLUMN "target_field_key";
ALTER TABLE "form_rules" DROP COLUMN "operator";
ALTER TABLE "form_rules" DROP COLUMN "comparison_value";
ALTER TABLE "form_rules" DROP COLUMN "effect";
