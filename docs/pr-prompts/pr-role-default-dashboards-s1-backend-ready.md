---
premise: '! grep -q "model RoleDefaultDashboard" apps/api/prisma/schema.prisma'
premise_means: The RoleDefaultDashboard model does not exist yet - slice 1 has not shipped.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/**
  - apps/api/src/**/__tests__/**
done_when: pnpm build && pnpm lint && grep -q "model RoleDefaultDashboard" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---

# Role -> default dashboard mapping — SLICE 1 (backend only)

Admin-configurable mapping of `(role, module) -> dashboard`, so a Director can set which dashboard
each role lands on for each module, with NO code change to re-point a role. This is **slice 1 of 3**
(backend). Slices 2 (Admin UI) and 3 (wire the landing logic) are separate prompts — **do not build
them here.**

## STANDING AUTHORITY - read this first

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does not mean "wait for approval
before starting", and it does not mean "do the work then ask permission to push". There is no human
in this run. **Finishing the work and then asking for permission is indistinguishable from failing**
— the work is discarded either way. **Your run is complete only when your output contains a PR NUMBER**
— or an honest `NO-OP: <reason>`.

## Marco's decision (2026-07-15) — this is the spec, do not reinterpret it

> PER ROLE, PER MODULE, and ADMIN-CONFIGURABLE DATA (Directors set it in Admin settings; no code
> change to re-point a role). Schema: new model `RoleDefaultDashboard(roleId, module -> PermissionModule.name,
> dashboardId)`, `@@unique([roleId, module])`. Modules are the existing `PermissionModule.name` keys;
> Roles are the existing `Role` table; `Dashboard` already supports `ownerRole`.
> SPLIT (each < size 10, stage in order): slice 1 = backend: schema + migration + admin CRUD API
> (controller/service/dto) + a resolver service that returns a user's default dashboard for a module
> (with graceful fallback); slice 2 = frontend; slice 3 = wire the landing logic. Stage slice 1 first.

## What to build

1. **Schema** (`apps/api/prisma/schema.prisma`): add
   ```prisma
   model RoleDefaultDashboard {
     id          String   @id @default(cuid())
     roleId      String
     module      String   // FK to PermissionModule.name
     dashboardId String
     role        Role      @relation(fields: [roleId], references: [id])
     dashboard   Dashboard @relation(fields: [dashboardId], references: [id])
     // add the matching back-relations on Role and Dashboard
     @@unique([roleId, module])
   }
   ```
   Read the real `Role`, `PermissionModule`, and `Dashboard` models first and match their existing
   id/onDelete conventions. `module` references `PermissionModule.name` (its `@id`).

2. **Migration**: generate the migration for the new model. Use a full timestamped folder name
   (`YYYYMMDDHHMMSS_*`), never a bare `YYYYMMDD_` prefix (Prisma sorts alphabetically — see sot/05).

3. **Admin CRUD API**: a controller + service + DTOs to list / upsert / delete role-default-dashboard
   mappings. Guard it exactly like the other Admin-settings endpoints (super-user + the same
   permission code the sibling admin config endpoints use — find the pattern, do not invent one).

4. **Resolver service**: a method that, given a user (their role) and a module name, returns that
   role's default dashboard for that module, with a **graceful fallback** when no mapping exists
   (return null / the module's existing default — do not throw). Unit-test the fallback path.

## Do NOT

- Do NOT build the Admin UI (slice 2) or touch any landing/redirect logic (slice 3).
- Do NOT change how `Dashboard.ownerRole` works.
- Do NOT touch `sot/`. CP-24 hard-fails any PR mixing code and `sot/`.
- Do NOT hardcode role or module lists — read them from the existing tables/enums.

## Guardrails

- **ONE ATTEMPT.** If it does not work, `NO-OP: <reason>` and stop.
- **NEVER ask a question. NEVER "stand by".** There is nobody to answer.
- **CI failures: read the job log** (`gh run view <run> --job <job> --log`) before diagnosing.
- Open the PR. Do not merge it — this adds a migration; Marco reviews the diff.
