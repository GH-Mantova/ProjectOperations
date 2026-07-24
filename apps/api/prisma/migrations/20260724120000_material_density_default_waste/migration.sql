-- Material density: default waste classification.
--
-- Adds nullable default_waste_group / default_waste_item columns to
-- estimate_material_density so the scope card can auto-populate the
-- (wasteGroup, wasteItem) pair when a material is selected — replacing
-- the per-row manual pickers on scope items and material sub-rows.
-- The aggregator contract (scope-waste.service) is unchanged: values
-- are still WRITTEN to ScopeOfWorksItem.wasteGroup/wasteItem and
-- materials[].wasteGroup/wasteItem exactly as before.
--
-- Nullable + no backfill: legacy density rows carry no default until an
-- admin sets one from the Rates & Lists → Densities table. Scope rows
-- with no matching default fall back to the two-picker UI unchanged.

ALTER TABLE "estimate_material_density" ADD COLUMN "default_waste_group" TEXT;
ALTER TABLE "estimate_material_density" ADD COLUMN "default_waste_item" TEXT;
