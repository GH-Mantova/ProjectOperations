---
premise: '! grep -q "company.manage" apps/api/src/common/permissions/permission-registry.ts'
premise_means: There is no company.manage permission, so the company settings screen can only be gated by the legacy Admin role-name guard and SLICE 17 cannot be closed.
scope:
  - apps/api/src/common/permissions/permission-registry.ts
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/admin-settings/**
  - apps/api/src/common/auth/__tests__/permission-matrix.spec.ts
done_when: pnpm build && pnpm lint && grep -q "company.manage" apps/api/src/common/permissions/permission-registry.ts && ls apps/api/prisma/migrations | grep -q grant_company_manage
size: 4
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: >-
  Purely additive and idempotent. The migration INSERTs one permission row and
  one RolePermission row per role that already holds platform.admin, each
  guarded by WHERE NOT EXISTS, so re-running changes nothing. No row is updated
  or deleted and NOBODY LOSES ACCESS. To revert, delete the company.manage
  RolePermission rows and the permission row; the API guard change reverts with
  the PR. If the migration aborts mid-flight it can simply be re-run.
cluster: company-manage
cluster_order: 1
---

# company.manage slice 1 - the permission, the auto-grant migration, and the API guards

**Marco's decision (2026-08-20), do not re-litigate:** create `company.manage` **and grant it to
every current `platform.admin` holder in the same migration.** Purely additive, nobody loses access,
tenancy-correct. This closes SLICE 17 (slice 2 deletes the last `<AdminOnly>`).

## Grounded on origin/main - read before coding

- **`apps/api/src/common/permissions/permission-registry.ts`** is *"the code-side source of truth.
  Every entry here is upserted into the `permissions` table by the seed (and re-synced on API
  startup); the seed never deletes RolePermission rows an admin created via /admin/settings."*
  152 lines, one object per line. Example entry, verbatim from line 19:
  ```
  { code: "platform.admin", module: "platform", label: "Administer platform configuration", description: "Administer platform configuration — AI providers, notifications, email, integrations", isHighRisk: true },
  ```
- Its own header states the conventions: **`label` is action-first plain English, derived from the
  actual enforcement site - never guessed.** `isHighRisk` marks an override, bypass or elevated
  write and makes the matrix UI add a confirm step.
- Schema models: **`Role`, `Permission`, `RolePermission`, `UserRole`.** A role holds permissions
  through `RolePermission`; a user holds roles through `UserRole`. **"Every `platform.admin` holder"
  therefore means every ROLE with a `platform.admin` RolePermission row** - grant at the role level
  and every user under those roles inherits it. Do not write per-user rows.
- **Copy the shape of an existing grant migration.** These are on main:
  `apps/api/prisma/migrations/20260804120000_grant_field_worker_expenses/migration.sql` and
  `.../20260713120000_grant_prod_superuser_flag/migration.sql`. **Read one before writing yours.**
- `platform.admin` guards ~15 endpoints across `admin-settings.controller.ts` and
  `ai-settings.controller.ts` - grep before touching anything.

## What to build

### 1. Register the permission

Add one entry to `permission-registry.ts`, following the file's own conventions:

```
{ code: "company.manage", module: "platform", label: "Manage company details and branding", description: "Edit company details, legal information and branding", isHighRisk: true },
```

`isHighRisk: true` because it replaces a guard that previously required the Admin **role** outright.
If reading the enforcement site convinces you otherwise, use your judgement and **say which site
changed your mind in the PR body** - do not silently differ.

### 2. The auto-grant migration - `grant_company_manage`

The migration folder name **must contain `grant_company_manage`** (`done_when` asserts it). Use the
repo's timestamped folder convention - a bare `YYYYMMDD_` name is rejected by a CI guard (#1246).
Put a bare `GATE-ALLOW: migrations` line at column 0 of the PR body.

Two idempotent statements, both guarded so a re-run is a no-op:

1. **INSERT the permission row** into `permissions` if absent. (The seed also upserts it from the
   registry; the migration must not depend on the seed having run.)
2. **INSERT one `RolePermission` row per role that already holds `platform.admin`** - an
   `INSERT ... SELECT` from the existing `platform.admin` RolePermission rows, with
   `WHERE NOT EXISTS` against `company.manage` for that role.

🔴 **No `UPDATE`, no `DELETE`, no `TRUNCATE`.** Every current holder gains a permission; nobody
loses one. That is the whole point of Marco's ruling, and it is what makes this safe to run against
production data.

Match the column names and id-generation the sibling grant migrations use - **read them; do not
assume `gen_random_uuid()` or a particular id column.**

### 3. Swap the API enforcement for the company endpoints

Find the endpoints backing the company settings screen (`AdminCompanyPage`) - grep
`admin-settings.controller.ts` for the company routes. Change **only those** from
`@RequirePermissions("platform.admin")` to `@RequirePermissions("company.manage")`.

**Leave every other `platform.admin` guard alone** - AI providers, notifications, email,
integrations, client-versions and Xero all stay as they are. Widening beyond the company endpoints
is out of scope and changes access for surfaces nobody asked about.

Because the migration granted `company.manage` to every role that had `platform.admin`, this swap is
access-neutral on the day it lands.

### 4. Update the permission matrix spec

`apps/api/src/common/auth/__tests__/permission-matrix.spec.ts` drives per-endpoint expectations -
entries look like
`{ group: "long-tail", method: "get", path: "/admin/settings/notifications", permission: "platform.admin", viewer: 403 }`.
Update the company endpoint rows to `company.manage` and keep the `viewer: 403` expectation, so the
test still proves a non-holder is refused. **A guard change with no test change is not verified.**

## Do NOT

- **Do NOT touch any web file.** `App.tsx`, `SettingsShell.tsx` and the route-guard test are
  **slice 2**. Doing them here re-creates the oversized run this was split to avoid.
- Do NOT delete or edit `AdminOnly` - slice 2 removes it once this permission exists.
- Do NOT change any other `platform.admin` guard.
- Do NOT write per-user permission rows, and do not touch `UserRole`.
- Do NOT touch `sot/` (CP-24), tender pricing, or anything Azure/Entra/SharePoint.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the four paths in `scope`. That is a scope
limit, **not** a reason to stop before pushing.

## Guardrails

- One attempt. If `company.manage` is already in the registry on main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
- This PR **stays unmerged** - it carries `escalates: true`, so Marco reviews the migration before it
  ever runs against real data.
