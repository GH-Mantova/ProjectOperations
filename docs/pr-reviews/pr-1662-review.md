VERDICT: MERGE

## Scope compliance

In scope:
- Service: Five `addPlantLineIfSet` calls and `addPlantLineIfSet` helper deleted; five `numericFieldsFrom` assignments deleted; `PLANT_DAYS_RETIRED_V1` record left at both sites.
- DTO: Five plant-days fields deleted from `ScopeItemFieldsBase`, closing the write path.
- Schema: Five fields removed from `ScopeOfWorksItem`; comprehensive `PLANT_DAYS_RETIRED_V1` comment left recording what was removed and why.
- Spec: Five fixture nulls removed; two "plant slug" tests removed (they were the helper's only coverage); coverage header updated.
- Migration: New `20260905010000_drop_legacy_plant_days` with five `DROP COLUMN` statements and extensive gate documentation.
- Data model: `metadata-catalog.json` regenerated (60 deletions — the five field entries and their aggregation configs).

Out of scope: None. No other columns, no other schema changes, no touches to plantItems, waste transport engine, WBS plant picker, /sot/, or .github/workflows.

## Self-verification claims

- [x] The five row counts run against the dev database, all zero. PR body quotes: excavator 0, bobcat 0, ewp 0, hook_truck 0, semi_tipper 0. Gate: PASS — 0 of 23 scope items carry any legacy plant-days value.
- [x] `pnpm --filter @project-ops/api build` clean. Build succeeded after prisma generate.
- [x] `pnpm --filter @project-ops/api lint` 0 errors. (1 pre-existing warning on unrelated file tenant-scoping.middleware.ts.)
- [x] `grep -rn "hookTruckDays|semiTipperDays|excavatorDays|bobcatDays|ewpDays" apps/ | grep -v "/dist/"` returns nothing. Grep is clean outside dist/.
- [x] Migration SQL quoted in full. Five `DROP COLUMN IF EXISTS` statements, one table (scope_of_works_items), no UPDATE, no data movement, no other DDL, no other column.
- [x] `addPlantLineIfSet` did NOT survive. Its five callers were the legacy plant-days block in `createEstimateItemFromScope`; verified by `grep -rn "addPlantLineIfSet" apps/` returning only comment references. Helper is deleted.
- [x] `PLANT_DAYS_RETIRED_V1` record left at all three sites (schema comment, service site, spec comment). Comprehensive and reconstructable.
- [x] `pnpm --filter @project-ops/api test` touched suite passes in full. Baseline on origin/main identical failure set (20 failed integration suites need DATABASE_URL); delta is exactly the two removed tests (3693 -> 3691 passing).
- [x] Data model map: `node scripts/data-model/build-relationship-map.mjs --check` returns OK. Drift check passes.
- [x] `GATE-ALLOW: migrations` present at column 0 of PR body.

## Risks Marco should know

- Migration ordering: New migration is `20260905010000_drop_legacy_plant_days`. Prior same-day migration is `20260905000000_scope_item_labour_store`. Timestamp ordering is correct (010000 > 000000).
- Irreversibility caveat: PR body explicitly cites dev-database counts and cautions that if a separate production database exists, its counts must be confirmed separately before merge. This is correctly gated by `escalates: true`.
- Tendering-e2e job still running at verdict time, but changed-path filter passed (expected); all critical CI checks (lint, test, build, data model, gates) are green. Browser smoke test is appropriate for this scope impact.

## Recommendation

Safe to merge once tendering-e2e completes. All substantive work done correctly, self-verification items passing, no scope violations, irreversible gate properly documented and confirmed (dev database all zeros, escalates: true holds for Marco's production confirmation).
