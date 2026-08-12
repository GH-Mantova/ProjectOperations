-- CRM S1 (pre-step): Commit new OpportunityStage enum values in their own
-- migration so a later migration can USE them.
--
-- Postgres does not allow a newly-added enum value to be referenced in the
-- same transaction/migration that adds it ("unsafe use of new value").
-- These ADD VALUE statements therefore live in this earlier migration; the
-- following migration (20260812140000_crm_s1_lead_collapse) only USES them.
-- Each ADD VALUE is its own statement; IF NOT EXISTS makes them idempotent.

ALTER TYPE "OpportunityStage" ADD VALUE IF NOT EXISTS 'open';
ALTER TYPE "OpportunityStage" ADD VALUE IF NOT EXISTS 'not_pursued';
ALTER TYPE "OpportunityStage" ADD VALUE IF NOT EXISTS 'archived';
