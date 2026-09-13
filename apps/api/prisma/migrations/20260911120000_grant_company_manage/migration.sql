-- Data migration: register company.manage permission and grant it to every role
-- that already holds platform.admin.
--
-- Why: deploy.yml runs only `prisma migrate deploy`, which never runs the TypeScript
-- reference seed (seed-initial-services.ts). A permission + role-permission grant
-- added only to the seed therefore never reaches production (CP-23; see sot/05
-- #504/#506). This migration writes the rows into prod to match the registry and
-- controller changes in this PR (SLICE 17 company.manage slice 1).
--
-- Prereqs that already hold in production:
--   * Roles that hold platform.admin already exist (seeded; platform.admin is a
--     core permission used by Admin and equivalent roles).
--   * The `permissions` and `role_permissions` tables exist.
--
-- Semantics: insert-if-absent ONLY.
--   1. Insert the company.manage permission row if absent. The seed also upserts
--      from the registry on API startup; the migration must not depend on the seed.
--   2. Insert one role_permissions row per role that already holds platform.admin,
--      WHERE NOT EXISTS against company.manage for that role. Idempotent.
--
-- No UPDATE, no DELETE, no TRUNCATE. Re-running is a no-op.
-- Grant is at the ROLE level only. No per-user rows. UserRole is not touched.
--
-- Reverse (documented; run manually if rolling back):
--   DELETE FROM "role_permissions"
--   WHERE permission_id = (SELECT id FROM "permissions" WHERE code = 'company.manage');
--   DELETE FROM "permissions" WHERE code = 'company.manage';

DO $$
DECLARE
  v_perm_id TEXT;
BEGIN
  -- Step 1: ensure the permission row exists.
  INSERT INTO "permissions" (id, code, module, label, description, is_high_risk, created_at, updated_at)
  VALUES (
    'perm-company-manage',
    'company.manage',
    'platform',
    'Manage company details and branding',
    'Edit company details, legal information and branding',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (code) DO NOTHING;

  -- Resolve the id (may differ from the literal above if inserted by seed first).
  SELECT id INTO v_perm_id FROM "permissions" WHERE code = 'company.manage' LIMIT 1;

  IF v_perm_id IS NULL THEN
    RAISE NOTICE 'grant_company_manage: permission row absent after insert, skipping role grants.';
    RETURN;
  END IF;

  -- Step 2: grant company.manage to every role that already holds platform.admin,
  -- but only where that role does not already have company.manage.
  INSERT INTO "role_permissions" (id, role_id, permission_id, assigned_at)
  SELECT
    'rp-' || rp.role_id || '-company-manage',
    rp.role_id,
    v_perm_id,
    NOW()
  FROM "role_permissions" rp
  INNER JOIN "permissions" pa ON pa.id = rp.permission_id AND pa.code = 'platform.admin'
  WHERE NOT EXISTS (
    SELECT 1
    FROM "role_permissions" existing
    WHERE existing.role_id     = rp.role_id
      AND existing.permission_id = v_perm_id
  )
  ON CONFLICT DO NOTHING;
END $$;
