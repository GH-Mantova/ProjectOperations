---
premise: ! test -f apps/web/src/pages/admin/AdminCompaniesPage.tsx
premise_means: There is no UI or API for creating/managing multiple companies (Tenant rows), or for assigning a user's home tenant — only the existing single-entity CompanyProfile admin page exists.
scope:
  - apps/api/src/modules/tenants/**
  - apps/api/src/app.module.ts
  - apps/web/src/pages/admin/AdminCompaniesPage.tsx
  - apps/web/src/pages/admin/AdminCompanyPage.tsx
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/admin/AdminCompaniesPage.tsx && test -f apps/api/src/modules/tenants/tenants.service.ts
size: 6
gate_allow: none
seed_only: false
escalates: true
---

# MT-5: Company admin UI (create/manage companies, assign users)

**Do NOT auto-merge — escalates. Leave the PR open, unmerged, for Marco. Do NOT touch
Azure/Entra/SharePoint.**

By this point in the chain, `model Tenant` exists (MT-0), `User.homeTenantId` exists and JWTs carry the
active tenant (MT-2), and Super Users can switch companies via `POST /auth/switch-company` (MT-2). What's
missing is an admin surface to actually manage the `Tenant` registry itself: create a new company, rename
one, deactivate one, and assign a user's `homeTenantId`. This is deliberately separate from
`apps/api/src/modules/company-profile/company-profile.controller.ts` and
`apps/web/src/pages/admin/AdminCompanyPage.tsx` — `CompanyProfile` is the existing **singleton**
legal-entity/branding record for the primary company (ABN, letterhead, numbering prefixes, etc.) and is
untouched by this slice. `Tenant` is the new multi-row company registry this program introduces; this
slice builds its admin surface **on top of / alongside** the existing company-profile page, not instead
of it.

## What to build

### 1. `apps/api/src/modules/tenants/` (new module)
`tenants.module.ts`, `tenants.controller.ts`, `tenants.service.ts` following the existing module
conventions (mirror the structure of `apps/api/src/modules/company-profile/`). Endpoints, all guarded by
`JwtAuthGuard` + `SuperUserGuard` (`apps/api/src/common/auth/super-user.guard.ts` — only Super Users
manage the company registry):
- `GET /tenants` — list all `Tenant` rows.
- `POST /tenants` — create `{ name, code? }`.
- `PATCH /tenants/:id` — update `{ name?, code?, isActive? }`.
- `PATCH /tenants/:id/assign-user` — `{ userId }`, sets that user's `User.homeTenantId` to `:id`
  (validate the user exists and is active).
Register `TenantsModule` in `apps/api/src/app.module.ts` alongside the other feature modules.

### 2. `apps/web/src/pages/admin/AdminCompaniesPage.tsx` (new — primary artifact)
An admin page listing companies (`Tenant` rows) with create/rename/deactivate actions and a per-company
"assigned users" view with an add-user control, calling the endpoints from step 1. Follow the existing
admin page conventions (compare `apps/web/src/pages/admin/AdminUsersTab.tsx` and
`apps/web/src/pages/admin/JobRolesPage.tsx` for layout/data-fetching style) — reuse the existing
table/form primitives already used across `apps/web/src/pages/admin/`, do not introduce a new UI kit.

### 3. Wire it in alongside the existing company-profile page
In `apps/web/src/pages/admin/AdminCompanyPage.tsx`, add a nav link/tab pointing to the new
`AdminCompaniesPage` (mirror however the existing admin tabs already navigate between
`AdminUsersTab`/`AdminRolesPermissionsTab`/etc. — reuse that routing pattern, do not invent a new one).
Do not remove or restructure any existing tab on `AdminCompanyPage.tsx`.

## Do NOT
- Do NOT touch `CompanyProfile`, `company-profile.controller.ts`, or `company-profile.service.ts` — that
  singleton stays exactly as-is; this slice is purely additive alongside it.
- Do NOT allow non-Super-Users to reach any `/tenants` endpoint.
- Do NOT touch the `switch-company` endpoint from MT-2 — this slice manages the registry, not the active
  session.
- Do NOT touch Azure/Entra/SharePoint.
- Do NOT edit anything under `/sot/`.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if this is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must pass.
