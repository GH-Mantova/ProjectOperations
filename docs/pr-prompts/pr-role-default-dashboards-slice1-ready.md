---
premise: '! grep -qE "RoleDefaultDashboard|defaultDashboardId" apps/api/prisma/schema.prisma'
premise_means: There is no role -> default-dashboard concept in the schema yet (neither a RoleDefaultDashboard model nor a defaultDashboardId column). Slice 1 has not shipped.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/dashboards/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model RoleDefaultDashboard" apps/api/prisma/schema.prisma && node scripts/data-model/build-relationship-map.mjs --check
size: 9
gate_allow: migrations
seed_only: false
escalates: true
---
# [Feat] Role-based default dashboards — SLICE 1 (backend: schema + migration + admin CRUD + resolver)

Branch: `feat/role-default-dashboards-slice1`
Reviewer: `GH-Mantova`
Migration: YES (additive). `GATE-ALLOW: migrations` is written into the PR body at column 0 by the pipeline — do not hand-write it.

## Why this is real (verified against origin/main this run)

`RoleDefaultDashboard` / `defaultDashboardId` do not exist anywhere in `apps/api/prisma/schema.prisma`.
Models that DO exist and this slice builds on: `Role` (with `RolePermission`), `Dashboard` (+ `DashboardWidget`),
`UserDashboard` (user -> dashboard), and `PermissionModule` (its `.name` values are the module keys). There is no
role -> default-dashboard concept today, so a new user/role lands with no dashboard for a module.

This is **Marco's decided design (2026-07-15)**, recorded in `docs/pr-prompts/BACKLOG.yaml` under `role-default-dashboards`:

> PER ROLE, PER MODULE, and ADMIN-CONFIGURABLE DATA (Directors set it in Admin settings; no code change to
> re-point a role). Split into 3 slices, stage in order. **Slice 1 = backend: schema + migration + admin CRUD API
> (controller/service/dto) + a resolver service that returns a user's default dashboard for a module (with graceful
> fallback).** Slice 2 = frontend admin UI. Slice 3 = wire the landing logic. THIS PROMPT IS SLICE 1 ONLY.

The A/B question the old HOLD carried is RESOLVED by that decision: implement the **resolve-with-graceful-fallback**
read path (no copy-on-seed).

## What to build (backend only — SLICE 1)

1. **Schema** (`apps/api/prisma/schema.prisma`): add
   ```
   model RoleDefaultDashboard {
     id          String   @id @default(cuid())
     roleId      String   @map("role_id")
     module      String   // matches an existing PermissionModule.name value
     dashboardId String   @map("dashboard_id")
     role        Role      @relation(fields: [roleId], references: [id])
     dashboard   Dashboard @relation(fields: [dashboardId], references: [id])
     createdAt   DateTime @default(now()) @map("created_at")
     updatedAt   DateTime @updatedAt @map("updated_at")
     @@unique([roleId, module])
     @@map("role_default_dashboard")
   }
   ```
   Add the reverse relation fields on `Role` and `Dashboard`. Use a **full-timestamp** migration folder
   (`YYYYMMDDHHMMSS_*`) — bare `YYYYMMDD_` sorts wrong (sot/05). Additive only; **no backfill** of existing users
   in the migration.
2. **Admin CRUD API** under `apps/api/src/modules/dashboards/` (reuse the module; do not build a new shell):
   controller + service + DTOs to list/upsert/delete a `(roleId, module) -> dashboardId` mapping. Gate it exactly
   like the surrounding dashboards/roles admin (the same permission the existing dashboards-admin endpoints use, and
   `isSuperUser` passes via the shared guard — do not invent a new permission code; reuse an existing one from
   `apps/api/src/common/permissions/permission-registry.ts`). Prisma access **through the service only**.
3. **Resolver service** (same module): `getDefaultDashboardForModule(userId|roleIds, module)` returns the role's
   default `Dashboard` for that module with a **graceful fallback** (no mapping -> return null / a safe default,
   never throw). This is a pure read used by slice 3 later; expose it as an injectable service method now, no route
   wiring to the landing page in this slice.
4. Regenerate the data-model relationship map for the new model and update `docs/data-model/**` as the generator
   requires.

## Do NOT (out of scope for slice 1)

- **No frontend.** Nothing under `apps/web/**`. (That is slice 2.)
- **No landing-page wiring / no call from module entry.** (That is slice 3.)
- Do not seed fabricated dashboards or widgets that do not exist.
- Do not add `defaultDashboardId` to `Role` (we chose the join model, not a scalar FK).
- Do not touch auth config, Azure/Entra/SharePoint, or any other module's schema.

## ⛔ STANDING AUTHORITY — verbatim, non-negotiable

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

This PR is a **schema change**: `escalates: true` — the pipeline builds it and holds it for Marco's review.
That still means **OPEN THE PR**. Do not stop before opening it.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` — never exit silently, never "stand by" for approval.
- Never ask a question; there is no human awake to answer it. Decide, or `NO-OP:` and exit.
- Read the CI job log (`gh run view <id> --job <id> --log`) before diagnosing any CI failure — never from the diff.
- `pnpm build` + `pnpm lint` must pass; `pnpm seed` must stay idempotent x2; run `build-relationship-map.mjs --check`.
- Completion test: **is there a PR number in your output?** If not because it is already on main -> `NO-OP:`. If not
  because you are waiting for someone -> WRONG, open the PR.
