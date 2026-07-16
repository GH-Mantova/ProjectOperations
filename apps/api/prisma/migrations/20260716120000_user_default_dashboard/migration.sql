-- Per-user default dashboard (Marco decision 2026-07-15).
-- Every user gets a single global "Home" dashboard as the fallback default.
-- A per-user override lives on users.default_dashboard_id (nullable). There
-- is NO per-role or per-module mapping — the superseded RoleDefaultDashboard
-- design is explicitly not built.
--
-- This migration is idempotent: column add uses IF NOT EXISTS, Home
-- upserts via ON CONFLICT, and the DELETE targets only the two seeded
-- generic system dashboards ("operations", "tendering") — user-created
-- dashboards (is_system = false) are never touched.

-- 1. Add the FK column. onDelete: SET NULL so deleting a dashboard
--    reverts its owners to the global default instead of orphaning them.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "default_dashboard_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_default_dashboard_id_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_default_dashboard_id_fkey"
      FOREIGN KEY ("default_dashboard_id") REFERENCES "dashboards"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Ensure the single global "Home" dashboard exists. Stable id so
--    later migrations, seeds and admin UI can address it deterministically.
INSERT INTO "dashboards" (
  "id", "name", "description", "scope",
  "owner_user_id", "owner_role_id", "is_default",
  "created_at", "updated_at"
) VALUES (
  'seed-home-dashboard',
  'Home',
  'Global default dashboard — every user starts here unless they pick a personal default.',
  'GLOBAL',
  NULL,
  NULL,
  true,
  NOW(),
  NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- 3. Remove the two generic seeded UserDashboards ("operations" and
--    "tendering") that every user got a copy of by the old seed. Match
--    ONLY the seeded system copies (is_system = true) — any personal
--    dashboard a user renamed or created stays untouched.
DELETE FROM "user_dashboards"
 WHERE "slug" IN ('operations', 'tendering')
   AND "is_system" = true;
