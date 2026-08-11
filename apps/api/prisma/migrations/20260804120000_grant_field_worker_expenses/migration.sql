-- Data migration: grant the "Field Worker" role expenses.view + expenses.manage in production.
--
-- Why: deploy.yml runs only `prisma migrate deploy`, which never runs the TypeScript reference
-- seed (seed-initial-services.ts). A role-permission grant added only to the seed therefore
-- never reaches production (CP-23; see sot/05 #504/#506). This migration writes the two
-- role_permissions rows into prod to match the seed change in this PR (#876).
--
-- Prereqs that already hold in production:
--   * the "Field Worker" role exists (seeded; mobile-access provisioning depends on it --
--     workers.service.ts does findUnique({ where: { name: "Field Worker" } })).
--   * expenses.view / expenses.manage permissions exist (upserted at boot by
--     PermissionsService.syncRegistry from the code permission-registry).
--
-- Semantics: insert-if-absent ONLY, guarded by the unique (role_id, permission_id).
-- Idempotent: running twice is a no-op. Safe if the role or a permission is absent
-- (e.g. a fresh test DB migrated before the seed runs): it RAISEs NOTICE and skips cleanly.
--
-- Reverse (documented; run manually if rolling back):
--   DELETE FROM "role_permissions"
--   WHERE role_id = (SELECT id FROM "roles" WHERE name = 'Field Worker')
--     AND permission_id IN (
--       SELECT id FROM "permissions" WHERE code IN ('expenses.view', 'expenses.manage')
--     );

DO $$
DECLARE
  v_role_id TEXT;
  v_perm_id TEXT;
  v_code    TEXT;
BEGIN
  SELECT id INTO v_role_id FROM "roles" WHERE name = 'Field Worker' LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE NOTICE 'grant_field_worker_expenses: "Field Worker" role absent, skipping.';
    RETURN;
  END IF;

  FOREACH v_code IN ARRAY ARRAY['expenses.view', 'expenses.manage'] LOOP
    SELECT id INTO v_perm_id FROM "permissions" WHERE code = v_code LIMIT 1;
    IF v_perm_id IS NULL THEN
      RAISE NOTICE 'grant_field_worker_expenses: permission % absent, skipping.', v_code;
      CONTINUE;
    END IF;

    INSERT INTO "role_permissions" (id, role_id, permission_id, assigned_at)
    VALUES ('rp-fieldworker-' || REPLACE(v_code, '.', '-'), v_role_id, v_perm_id, NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
