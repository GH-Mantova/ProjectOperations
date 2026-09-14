-- EA-2a: Estimating Analytics system UserDashboard preset, one row per user who
-- holds reporting.view.
--
-- Why a migration: deploy.yml runs only `prisma migrate deploy`, which never runs
-- the TypeScript seed (seed.ts). The preset rows added to seedUserDashboards()
-- would therefore never reach production (CP-23 seed-without-migration). Same
-- reasoning as 20260911120000_grant_company_manage and
-- 20260914041500_brandtheme_s4_named_presets.
--
-- The row shape is byte-for-byte what seed.ts writes for ESTIMATING_ANALYTICS_PRESET
-- (slug, name, is_system=true, is_default=false, config with period "30d" and the
-- ten ordered widgets, each { id: "<type>-default", type, visible, order, colSpan,
-- config: { period: null, filters: {} } }). Keep the two in sync if either changes.
--
-- Prereqs that already hold in production:
--   * "user_dashboards" exists with UNIQUE (user_id, slug, is_system).
--   * "users", "user_roles", "role_permissions", "permissions" exist.
--   * The reporting.view permission row exists (registry-seeded on API startup;
--     if it is absent the SELECT yields zero rows and the migration is a no-op).
--
-- Semantics: insert-if-absent ONLY. One row per user that holds reporting.view
-- through any role, WHERE NOT EXISTS a system dashboard with this slug for that
-- user. No UPDATE, no DELETE. Users' own (non-system) dashboards and is_default
-- flags are not touched. Re-running is a no-op. A user granted reporting.view
-- AFTER this migration gets the preset from the seed (dev) or from a later
-- slice - this migration does not install a trigger.
--
-- Reverse (documented; run manually if rolling back):
--   DELETE FROM "user_dashboards" WHERE slug = 'estimating-analytics' AND is_system = TRUE;

INSERT INTO "user_dashboards" (id, user_id, name, slug, is_system, is_default, config, created_at, updated_at)
SELECT
  gen_random_uuid()::text,
  u.id,
  'Estimating Analytics',
  'estimating-analytics',
  TRUE,
  FALSE,
  '{
    "period": "30d",
    "widgets": [
      { "id": "report:chart:estimator-turnaround-default",         "type": "report:chart:estimator-turnaround",         "visible": true, "order": 0, "colSpan": 4, "config": { "period": null, "filters": {} } },
      { "id": "report:chart:tender-win-rate-default",              "type": "report:chart:tender-win-rate",              "visible": true, "order": 1, "colSpan": 2, "config": { "period": null, "filters": {} } },
      { "id": "report:chart:estimator-qty-vs-value-default",       "type": "report:chart:estimator-qty-vs-value",       "visible": true, "order": 2, "colSpan": 2, "config": { "period": null, "filters": {} } },
      { "id": "ten_win_rate_chart-default",                        "type": "ten_win_rate_chart",                        "visible": true, "order": 3, "colSpan": 2, "config": { "period": null, "filters": {} } },
      { "id": "report:chart:tender-winloss-over-time-default",     "type": "report:chart:tender-winloss-over-time",     "visible": true, "order": 4, "colSpan": 2, "config": { "period": null, "filters": {} } },
      { "id": "report:chart:tender-winloss-by-value-band-default", "type": "report:chart:tender-winloss-by-value-band", "visible": true, "order": 5, "colSpan": 2, "config": { "period": null, "filters": {} } },
      { "id": "report:chart:tender-winloss-by-reason-default",     "type": "report:chart:tender-winloss-by-reason",     "visible": true, "order": 6, "colSpan": 2, "config": { "period": null, "filters": {} } },
      { "id": "report:table:tender-winloss-by-client-default",     "type": "report:table:tender-winloss-by-client",     "visible": true, "order": 7, "colSpan": 4, "config": { "period": null, "filters": {} } },
      { "id": "report:chart:tender-pipeline-default",              "type": "report:chart:tender-pipeline",              "visible": true, "order": 8, "colSpan": 2, "config": { "period": null, "filters": {} } },
      { "id": "report:chart:tender-outcome-coverage-default",      "type": "report:chart:tender-outcome-coverage",      "visible": true, "order": 9, "colSpan": 2, "config": { "period": null, "filters": {} } }
    ]
  }'::jsonb,
  NOW(),
  NOW()
FROM "users" u
WHERE EXISTS (
  SELECT 1
  FROM "user_roles" ur
  INNER JOIN "role_permissions" rp ON rp.role_id = ur.role_id
  INNER JOIN "permissions" p ON p.id = rp.permission_id AND p.code = 'reporting.view'
  WHERE ur.user_id = u.id
)
AND NOT EXISTS (
  SELECT 1
  FROM "user_dashboards" d
  WHERE d.user_id = u.id
    AND d.slug = 'estimating-analytics'
    AND d.is_system = TRUE
)
ON CONFLICT DO NOTHING;
