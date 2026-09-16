-- Scope Cards S1 (SCOPE_OPERATIONAL_COSTS_PRICED_V1)
-- Additive only: four nullable columns on scope_operational_cost_lines.
-- No UPDATE ... SET, no default backfill, no existing data changed.
-- Rollback: DROP COLUMN for each of the four columns below.

ALTER TABLE "scope_operational_cost_lines" ADD COLUMN "wbs_ref" TEXT;
ALTER TABLE "scope_operational_cost_lines" ADD COLUMN "source_ref" TEXT;
ALTER TABLE "scope_operational_cost_lines" ADD COLUMN "markup_override" DECIMAL(5,2);
ALTER TABLE "scope_operational_cost_lines" ADD COLUMN "notes" TEXT;
