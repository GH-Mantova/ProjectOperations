---
premise: '! grep -qE "RoleDefaultDashboard|defaultDashboardId" apps/api/prisma/schema.prisma'
premise_means: There is no role -> default-dashboard concept in the schema (neither a RoleDefaultDashboard model nor a defaultDashboardId on Role).
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/dashboards/**
  - apps/web/src/pages/admin/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -qE "RoleDefaultDashboard|defaultDashboardId" apps/api/prisma/schema.prisma && node scripts/data-model/build-relationship-map.mjs --check
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm -->
# HOLD — [Feat] Role-based default dashboards (Dashboards batch-3 part 1b)

STATUS: STAGED, NOT ARMED. Has ONE open schema decision (below) — confirm it in MAIN chat,
then rename to `pr-role-default-dashboards-ready.md`.

Branch: `feat/role-default-dashboards`
Reviewer: `GH-Mantova`
Migration: YES (additive) — `GATE-ALLOW: migrations` at column 0. Do NOT auto-merge
(schema change) — human review.

## Context (verified in-repo)

Deferred out of PR #527's batch-3 because it needs a schema addition. Current models:
`Role` (schema ~175) with `RolePermission`, `Dashboard` (~468) + `DashboardWidget` (~488),
and `UserDashboard` (~1979) linking a user to their dashboard(s). There is no role ->
default-dashboard concept today — new users/roles get no dashboard seeded.

## Decision required BEFORE arming (take to MAIN chat)

**How should a role's default dashboard relate to a user's own dashboard?** Two clean options:
- (A) **Seed-on-first-login / seed-on-role-assign:** a `RoleDefaultDashboard(roleId,
  dashboardId)` mapping is used to COPY a starter dashboard into `UserDashboard` once; the
  user then owns and edits their copy. (Recommended — matches "default", preserves user
  customisation.)
- (B) **Live fallback:** users with no `UserDashboard` render their role's default
  read-only until they customise. No copy.
Confirm A or B — it changes whether this PR writes a copy-on-seed service or a
resolve-with-fallback read path.

## Scope (once decided)

1. Additive model: `RoleDefaultDashboard` (`roleId` FK, `dashboardId` FK, unique on
   `roleId`) — or a nullable `defaultDashboardId` on `Role`; pick per the audit, full
   timestamp migration, no backfill of existing users in the migration itself.
2. Admin: let a `waste`/dashboards-admin-permitted user set the default dashboard per role
   (small UI in the existing dashboards or roles admin — reuse, don't build a new shell).
3. Apply logic per decision A or B, in the dashboards service layer (Prisma via service
   only). Seed one sensible role default (do not fabricate widgets that don't exist).
4. `waste.view`-style gating consistent with the surrounding admin; non-permitted users
   can't set defaults.

## Verify before PR

- API + web build/lint/test green; `pnpm seed` idempotent x2; `compliance:smoke` green.
- `node scripts/data-model/build-relationship-map.mjs` regenerated (new model) + `--check` OK.
- PR body: a **Data-model impact** section and which option (A/B) was implemented.
