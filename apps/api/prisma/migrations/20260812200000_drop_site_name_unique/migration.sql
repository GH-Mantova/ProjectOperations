-- MIG-1: Drop Site name unique constraint.
-- Rationale: sites are not unique by name in reality (Marco: "the auto ID is
-- the key; you revisit addresses over years"). MIG-2 will create name-only
-- stub Sites per imported tender (plan D4), which requires this constraint
-- to be gone.
DROP INDEX IF EXISTS "sites_name_key";
