---
premise: '! grep -rq "ROLE_GRANT_REGISTRY_V1" apps/api/src'
premise_means: Role-to-permission grants are declared only as inline arrays in the dev seed, so a grant added there never reaches production unless someone hand-writes a migration (the #504 / #506 / #876 toil).
scope:
  - apps/api/src/common/permissions/role-grant-registry.ts
  - apps/api/src/common/permissions/role-grant-diff.ts
  - apps/api/src/modules/permissions/__tests__/role-grant-registry.spec.ts
  - apps/api/prisma/role-grants.ts
  - apps/api/prisma/role-grants.lock.json
  - apps/api/prisma/seed-initial-services.ts
  - apps/api/package.json
done_when: pnpm build && pnpm lint && grep -rq "ROLE_GRANT_REGISTRY_V1" apps/api/src && test -f apps/api/prisma/role-grants.lock.json
size: 5
gate_allow: none
seed_only: true
escalates: true
module: permissions
---

# Role grants: one map in code, delivered to production by generated migrations

**Design signed off by Marco 2026-09-21 (option B of three: "approved").** Option A (keep
hand-writing migrations) and option C (a boot-time reconciler that writes grants when the API
starts) were both rejected. Do not build either. In particular: **nothing in this PR writes to a
database at boot, ever.**

## Problem (root cause)

Permission *definitions* live in code (`apps/api/src/common/permissions/permission-registry.ts`)
and are upserted by `PermissionsService.syncRegistry()`. Role -> permission *grants* live only as
inline arrays in the dev seed (`apps/api/prisma/seed-initial-services.ts`, `seedRoleWithPermissions`,
plus the `viewPermissionCodes` list). Production runs `prisma migrate deploy` and never runs the
seed, so a grant added only to the seed never reaches production. CP-23 catches the seed edit, but
every grant then needs a migration written by hand from the precedent
`20260804120000_grant_field_worker_expenses`.

## The shape (option B)

```
role-grant-registry.ts  (the map: role name -> permission codes, the ONE place grants are declared)
        |
        |  pnpm --filter @project-ops/api grants:write      (a person runs it, never CI, never boot)
        v
migrations/<ts>_role_grants_<slug>/migration.sql   (insert-if-absent, generated from map minus lock)
role-grants.lock.json                               (updated: what migrations have now delivered)
        |
        |  jest spec in CI: map == lock, or fail with the exact command to run
        v
seed-initial-services.ts reads the same map  ->  dev seed and production cannot drift
```

## Grounded on origin/main a9751066 - re-verify before you edit

- `seedRoleWithPermissions(name, description, permissionCodes)` at `seed-initial-services.ts:82-105`
  (additive: `createMany` + `skipDuplicates`). Called for Project Manager (:115), Senior Estimator
  (:147), WHS Officer (:169), Accounts (:195), Warehouse Manager (:217), Field Worker (:243).
- `viewPermissionCodes` list at `:47-66`, granted at `:68`. Admin / Planner / Field are fetched with
  `findUniqueOrThrow` at `:36-38` - find out exactly which codes each receives in the seed.
- `RolePermission` at `schema.prisma:459`, `@@unique([roleId, permissionId])`, no code column - a
  grant is matched through `roles.name` and `permissions.code`.
- Precedent SQL: `apps/api/prisma/migrations/20260804120000_grant_field_worker_expenses/` - DO $$
  block, insert-if-absent with `ON CONFLICT DO NOTHING`, `RAISE NOTICE` and skip when the role or
  permission is absent, id `'rp-fieldworker-' || REPLACE(code,'.','-')`, manual reverse documented.
  **Copy that shape exactly.**
- `apps/api` runs scripts with `tsx` (see the `seed*` scripts in `apps/api/package.json`). It has
  no `resolveJsonModule` - read the lock with `fs.readFileSync` + `JSON.parse`, never `import`.
- Latest migration on main: `20260917193000_transport_capacity_column_order`.

## What to build

1. **`apps/api/src/common/permissions/role-grant-registry.ts`**
   - `export const ROLE_GRANT_REGISTRY_V1 = "permission-role-reconciler";`
   - `export const ROLE_GRANTS: Readonly<Record<string, readonly string[]>>` - role name -> sorted,
     de-duplicated permission codes.
   - **It must reproduce today's seed grants exactly** - every role the seed grants by an explicit
     code list, including the `viewPermissionCodes` role and the Field Worker `baseView` spread.
     Same roles, same codes, nothing added, nothing dropped. A role the seed grants "every
     permission" (if any) stays out of the map and keeps its current seed code.
   - Every code in the map must exist in `permission-registry.ts` (asserted by the spec).
   - A header comment of at most 15 lines explaining the workflow: edit map -> run
     `grants:write` -> commit the migration + lock -> PR carries `GATE-ALLOW: migrations`.

2. **`apps/api/src/common/permissions/role-grant-diff.ts`** - pure functions, no Prisma:
   - `diffGrants(map, lock) -> { added: {role, code}[], removed: {role, code}[] }`, sorted.
   - `renderGrantMigration(added, timestampUtc) -> string` - one DO $$ block in the precedent's
     shape: per grant, look the role up **by name** and the permission **by code**; if either is
     missing `RAISE NOTICE` and skip; otherwise insert-if-absent. Id:
     `'rp-' || <role slug> || '-' || REPLACE(code,'.','-')` (role slug = lower-case, non-alnum ->
     `-`). A trailing comment block lists the manual reverse, as in the precedent.
   - **Never creates a role. Never deletes or updates a `role_permissions` row.**

3. **`apps/api/prisma/role-grants.ts`** (run with `tsx`) and three `apps/api/package.json` scripts:
   - `grants:write` - computes `diffGrants(ROLE_GRANTS, lock)`. If `added` is non-empty, writes
     `prisma/migrations/<UTC yyyymmddHHMMSS>_role_grants_<first-role-slug>/migration.sql` from
     `renderGrantMigration`. Then rewrites the lock to equal the map (sorted keys, sorted codes,
     2-space JSON, trailing newline). **Removals generate no SQL** - they only update the lock and
     print: `removed from map, NOT revoked in any database: <role> <code>`.
   - `grants:check` - exits 1 with the diff if map != lock, else prints `role grants: map == lock`.
   - `grants:report` - read-only. Connects to `DATABASE_URL`, lists every map grant that DB is
     missing, and prints the SQL `grants:write` would generate for them. **SELECT only.** It never
     writes. (Marco runs it against production himself; this PR and its builder never do - Azure
     is a hard stop.)

4. **`apps/api/prisma/role-grants.lock.json`** - bootstrapped **equal to the map**, with **no
   migration**. Reason: this PR changes where grants are declared, not which grants exist. Any
   existing production gap is surfaced by `grants:report`, and closing it is a separate decision.

5. **`seed-initial-services.ts` reads the map.** Replace each inline code array with
   `ROLE_GRANTS["<role name>"]`. `seedRoleWithPermissions` keeps its signature and stays additive.
   Behaviour of the dev seed must be byte-identical: same roles, same grants.

6. **`apps/api/src/modules/permissions/__tests__/role-grant-registry.spec.ts`** - runs in the
   existing api jest job (confirm which CI job runs `apps/api` jest and name it in the PR body):
   - map == lock; on failure the message is exactly:
     `role grants changed without a migration - run: pnpm --filter @project-ops/api grants:write` followed by
     the diff.
   - every code in the map exists in `PERMISSION_REGISTRY` (or whatever the registry export is).
   - `renderGrantMigration` snapshot for a two-grant fixture: contains `ON CONFLICT DO NOTHING`,
     `RAISE NOTICE`, and contains none of `DELETE`, `UPDATE`, `TRUNCATE`, `INSERT INTO "roles"`.
   - `diffGrants` reports a removal without producing SQL for it.

## Do NOT
- Do NOT write to any database at boot, on module init, or from CI. No `onModuleInit`, no
  `onApplicationBootstrap`, no reconciler service.
- Do NOT generate a migration in this PR. Do NOT add, remove or change any grant.
- Do NOT revoke anything, ever. Directors grant extras in the Roles screen; those must survive.
- Do NOT create roles. A role missing from a database is skipped with a NOTICE.
- Do NOT touch `permission-registry.ts` definitions, `roles.service.ts`, CP-23 or `pr-gates.mjs`.
- Do NOT run `grants:report` against anything but the local Docker DB. Do NOT touch Azure /
  Entra / SharePoint.

## Verify
- `pnpm build` + `pnpm lint` pass; `pnpm --filter @project-ops/api test -- role-grant-registry` passes.
- `pnpm --filter @project-ops/api grants:check` prints `role grants: map == lock`.
- Seed parity: run `pnpm --filter @project-ops/api seed` against the local Docker DB before and after your change
  and diff `SELECT r.name, p.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN
  permissions p ON p.id = rp.permission_id ORDER BY 1,2`. The two outputs must be identical; paste
  the row count in the PR body.
- Add one fake grant to the map locally, run `grants:write`, confirm a migration folder and lock
  change appear, then **discard both** - do not commit them. Say in the PR body that you did.

## PR body must carry (column 0, bare)
```
SEED-ONLY: dev  -- seed now reads grant arrays from role-grant-registry; no grant added or removed
```
(CP-23: this PR edits the seed without a migration, and on purpose.)

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never ask a question or stand by.
- Read the CI job log before diagnosing a failure. `pnpm build` + `pnpm lint` must pass.
- This is an authorisation change: label the PR `do-not-merge` so Marco reviews it before it lands.
