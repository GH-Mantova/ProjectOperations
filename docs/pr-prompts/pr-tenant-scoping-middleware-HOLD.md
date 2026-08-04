---
premise: ! test -f apps/api/src/common/tenancy/tenant-scoping.middleware.ts
premise_means: No tenant-scoping enforcement exists yet on main — Prisma queries against tenant-aware models are not filtered by tenant at all.
scope:
  - apps/api/src/common/tenancy/**
  - apps/api/src/prisma/prisma.service.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/common/tenancy/tenant-scoping.middleware.ts && grep -q "tenantId" apps/api/src/common/tenancy/tenant-scoping.middleware.ts
size: 5
gate_allow: none
seed_only: false
escalates: true
---

# MT-1: Tenant-scoping Prisma extension (security core)

**Do NOT auto-merge — escalates. Leave the PR open, unmerged, for Marco. A data-leak in this slice
defeats the entire multi-tenant program (per `docs/plans/multi-tenant-plan.md`: "Data-leak = the whole
point failing").**

MT-0 (already on main) added a nullable `tenantId` column to `Client`, `Worker`, `Contact`, `Tender`,
`Job` and exported `PILOT_TENANT_AWARE_MODELS` from `apps/api/src/common/tenancy/tenant.constants.ts`.
Nothing filters on it yet — `apps/api/src/prisma/prisma.service.ts` is a bare `PrismaClient` subclass.
This slice adds the enforcement layer: **every read and write against the pilot tenant-aware models must
be scoped to `tenantId IS NULL OR tenantId = currentTenant`, fail-closed.** Prisma 6.19.3 does not support
`$use` middleware (removed) — implement this as a **Prisma Client Extension** (`$extends`).

## What to build

### 1. `apps/api/src/common/tenancy/tenant-context.ts` (new)
An `AsyncLocalStorage<{ tenantId: string | null }>`-backed `TenantContextService`:
- `run<T>(tenantId: string | null, fn: () => T): T` — enters context for the duration of `fn`.
- `getCurrentTenantId(): string | null | undefined` — `undefined` when NOT inside a `run()` call (no
  context established at all — e.g. a background job or a request this identity work hasn't wired yet).
- Fail-closed contract, documented in a comment: no context (`undefined`) means the scoping extension
  below must treat the caller as having **no** active tenant — only `tenantId IS NULL` (shared) rows are
  visible/writable, never a specific company's rows. `null` (explicit, once MT-2 wires it) behaves the
  same as `undefined` for read scope. A real `tenantId` string unlocks that tenant's rows plus shared.

### 2. `apps/api/src/common/tenancy/tenant-scoping.middleware.ts` (new — primary artifact of this slice)
A Prisma Client Extension factory, e.g. `export function tenantScopingExtension()`, that:
- Imports `PILOT_TENANT_AWARE_MODELS` from `./tenant.constants.ts` (MT-0).
- Uses `Prisma.defineExtension` with a `query` component covering `findMany`, `findFirst`,
  `findFirstOrThrow`, `findUnique`, `findUniqueOrThrow`, `count`, `update`, `updateMany`, `delete`,
  `deleteMany` for each pilot model.
- For each intercepted call, merges into `args.where`:
      { AND: [ existingWhere, { OR: [{ tenantId: null }, { tenantId: currentTenantId }] } ] }
  where `currentTenantId` comes from `TenantContextService.getCurrentTenantId()`. When that is
  `undefined`/`null`, the injected filter collapses to `{ tenantId: null }` only (fail-closed — no
  company-owned row leaks with no context).
- Does NOT touch `create`/`createMany` in this slice — assigning `tenantId` on write is MT-2/MT-4
  territory. This slice is read/update/delete scoping only, as scoped above.

### 3. Wire it into `apps/api/src/prisma/prisma.service.ts`
Apply the extension in the constructor/`onModuleInit` via `this.$extends(tenantScopingExtension())` (or
equivalent per Prisma 6's typed-extension pattern) so every consumer of the existing injected
`PrismaService` gets scoping for free with no call-site changes.

### 4. `apps/api/src/common/tenancy/__tests__/tenant-scoping.middleware.spec.ts` (new)
Contract tests proving BOTH directions required by the plan doc:
- A company A row (`tenantId: "tenant-a"`) is invisible to a request running inside
  `TenantContextService.run("tenant-b", ...)`.
- A shared row (`tenantId: null`) IS visible inside both `run("tenant-a", ...)` and
  `run("tenant-b", ...)`.
- With no context at all (no `run()` wrapper), only shared (`tenantId: null`) rows are returned — proves
  fail-closed.
Mock the Prisma extension's query args/next per the existing repo convention of mocking Prisma at the
service layer (see `apps/api/src/modules/directory/directory.service.spec.ts` for the house style).

## Do NOT
- Do NOT wire this to real JWT/session identity — `TenantContextService.run()` is called directly by
  tests in this slice; MT-2 wires it to the real request lifecycle.
- Do NOT touch `create`/`createMany` behaviour or auto-stamp `tenantId` on write.
- Do NOT expand scoping beyond `PILOT_TENANT_AWARE_MODELS` from MT-0.
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
- `pnpm build` and `pnpm lint` must pass. The contract tests (step 4) proving BOTH directions are
  non-negotiable per the plan doc — do not ship this slice without them passing.
