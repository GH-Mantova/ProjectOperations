---
premise: ! grep -q "homeTenantId" apps/api/prisma/schema.prisma
premise_means: User has no home-tenant column yet; issued access tokens carry no tenantId claim; there is no company-switch endpoint.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/common/auth/authenticated-request.interface.ts
  - apps/api/src/modules/auth/auth.service.ts
  - apps/api/src/modules/auth/auth.controller.ts
  - apps/api/src/common/tenancy/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "homeTenantId" apps/api/prisma/schema.prisma && grep -q "tenantId" apps/api/src/common/auth/authenticated-request.interface.ts && test -f apps/api/src/common/tenancy/tenant-context.interceptor.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Additive nullable FK column (users.home_tenant_id -> tenants.id, ON DELETE SET NULL); no existing row touched, no constraint tightened. Safe to leave applied. Adding a tenantId claim to newly-issued JWTs is backward compatible: older already-issued tokens simply lack the claim, and the MT-1 extension already treats a missing/undefined tenant context as fail-closed (shared-only), so nothing breaks for tokens issued before this PR. To revert: drop the home_tenant_id column, delete the migration directory, revert the JWT payload change.'
---

# MT-2: Identity carries tenant (JWT + session)

**Do NOT auto-merge — escalates. Leave the PR open, unmerged, for Marco. Reuse the EXISTING auth seam —
do NOT touch Azure/Entra/SharePoint (the Entra/SSO login paths must keep working unchanged).**

MT-1 (already on main) added `TenantContextService` (`apps/api/src/common/tenancy/tenant-context.ts`)
and the scoping extension, but nothing yet populates the context from a real request — every request
today runs with no tenant context (fail-closed to shared-only rows). This slice makes the JWT/session
carry the active `tenantId` and wires that into `TenantContextService.run()` for the lifetime of each
request, per `docs/plans/multi-tenant-plan.md` MT-2. All four staff login paths (local, OTP, Entra, SSO)
converge on ONE shared private method, `AuthService.issueTokens()`
(`apps/api/src/modules/auth/auth.service.ts`), and ONE shared response builder, `finishLogin()` — that
convergence point is the existing auth seam this slice must reuse; do not duplicate token-issuing logic
per provider.

## What to build

### 1. Add `homeTenantId` to `User` in `apps/api/prisma/schema.prisma`
    homeTenantId String? @map("home_tenant_id")
    homeTenant   Tenant? @relation(fields: [homeTenantId], references: [id], onDelete: SetNull)
Nullable — an unassigned user (or a Super User who hasn't picked a company yet) has no home tenant, and
per MT-1's fail-closed rule that means shared-only visibility until a tenant is set. Additive migration
under `apps/api/prisma/migrations/<timestamp>_feat_tenant_identity/migration.sql` — `ALTER TABLE users
ADD COLUMN home_tenant_id TEXT NULL REFERENCES tenants(id) ON DELETE SET NULL` only.

### 2. `apps/api/src/common/auth/authenticated-request.interface.ts`
Add `tenantId?: string | null;` to `AuthenticatedUser`.

### 3. `AuthService.issueTokens()` in `apps/api/src/modules/auth/auth.service.ts`
Load the authenticating user's `homeTenantId` (it is already fetched via `UsersService` in every login
path — thread it through to `issueTokens`) and include it in the access-token payload:
`{ sub: userId, email, permissions, isSuperUser, tenantId }`. Do not add it to the refresh-token payload
(refresh already re-derives fresh state from the DB via `UsersService`). This one change covers every
login path (`login`, `verifyOtp`, `loginWithEntra`, `loginWithSso`, `resetPassword`'s finishLogin call,
`refresh`) because they all funnel through this same method — do not touch `entra-auth.service.ts` or
`entra-token-validator.service.ts` internals.

### 4. `AuthController` — super-user company switch
Add `POST /auth/switch-company` to `apps/api/src/modules/auth/auth.controller.ts`, guarded by the
existing `JwtAuthGuard` + `SuperUserGuard` (`apps/api/src/common/auth/super-user.guard.ts`), body
`{ tenantId: string }`. It re-issues a fresh access/refresh token pair with the requested `tenantId`
(validated against an active `Tenant` row) via a new `AuthService.switchCompany(userId, tenantId)` method
that calls the same `issueTokens()`. Only Super Users may switch to a tenant outside their own
`homeTenantId` — a non-super user calling this endpoint gets `403 Forbidden` regardless of the guard (the
plan doc: "a Super User can switch companies" — ordinary users stay pinned to their `homeTenantId`).

### 5. `apps/api/src/common/tenancy/tenant-context.interceptor.ts` (new — primary artifact of this slice)
A NestJS interceptor (or Express middleware, matching whatever `JwtAuthGuard` already runs alongside) that,
for every authenticated request, reads `request.user.tenantId` (now populated per step 3, decoded by the
existing `JwtAuthGuard.canActivate`) and wraps the rest of the request handling in
`TenantContextService.run(request.user.tenantId ?? null, () => next())`. Register it globally (app-level
interceptor in `apps/api/src/app.module.ts` if that's the existing pattern for global interceptors —
check main.ts/app.module.ts for how `JwtAuthGuard`-adjacent cross-cutting concerns are already wired and
follow that pattern; do not invent a new registration mechanism).

### 6. Regenerate the data-model map
Run `node scripts/data-model/build-relationship-map.mjs`. Commit the regenerated
`docs/data-model/relationship-map.json`, `docs/data-model/relationship-map.md`, and
`docs/data-model/metadata-catalog.json`.

### 7. PR body
Bare line at column 0: `GATE-ALLOW: migrations`.

## Do NOT
- Do NOT touch `entra-auth.service.ts`, `entra-token-validator.service.ts`, or any Entra/SSO/SharePoint
  configuration — reuse the shared `issueTokens()`/`finishLogin()` seam those providers already call
  into; do not fork a parallel path.
- Do NOT introduce a `UserTenant` many-to-many join table in this slice — ordinary users get exactly one
  `homeTenantId`; only Super Users can switch, and they can switch to ANY active tenant, not just ones
  they're "members" of.
- Do NOT change `PermissionsGuard` or the permission model.
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
- Regenerate the data-model map (step 6) or the drift check fails; put `GATE-ALLOW: migrations` bare at
  column 0 of the PR body (step 7) or CP-11 fails. Update any affected `*.spec.ts`
  `toHaveBeenCalledWith(...)` expectations touched by the `issueTokens` payload change (see
  `apps/api/src/modules/auth/auth.service.spec.ts`).
- `pnpm build` and `pnpm lint` must pass.
