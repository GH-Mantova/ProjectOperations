PR #608 requires three fixes before merge:

1. Schema-map drift: Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated `docs/data-model/relationship-map.{md,json}` files — the PR modified schema.prisma but skipped the generated files, causing CI drift-check FAILURE.

2. PR gates: Add `GATE-ALLOW: migrations` at column 0 in the PR body (one new migration file) to pass CP-11 gate check.

3. Data safety: Verify the migration's DELETE scope (schema.prisma USER_DASHBOARDS rows where `slug IN ('operations', 'tendering') AND is_system = true`) against production before merge, per the PR's explicit "do NOT auto-merge (deletes existing dashboard rows in prod)" note.

All three are fixable without code changes — re-run the build script, edit the PR body, and verify prod state.
