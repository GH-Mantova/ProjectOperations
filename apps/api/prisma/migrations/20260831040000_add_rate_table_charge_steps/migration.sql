-- feat(rates): add nullable charge_steps column to rate_tables
-- Stores an ordered list of calculation steps as JSONB.
-- Nullable so existing rows are unaffected; populated by admin when
-- a rate table carries its own calculation definition.
ALTER TABLE "rate_tables" ADD COLUMN "charge_steps" JSONB;
