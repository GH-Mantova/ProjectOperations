---
premise: '! test -f apps/api/src/modules/tendering/allocation.controller.ts'
premise_means: The allocation engine has no HTTP surface, so nothing outside the API module can allocate, claim, reject or reassign a tender.
scope:
  - apps/api/src/modules/tendering/allocation.controller.ts
  - apps/api/src/modules/tendering/tendering.module.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/tendering/allocation.controller.ts && grep -q "tenders.allocate" apps/api/src/modules/tendering/allocation.controller.ts
size: 3
gate_allow: none
seed_only: false
escalates: false
requires_on_main: apps/api/src/modules/tendering/allocation.service.ts :: pushBack
---

# EW-2d: AllocationController - the HTTP surface

**This is slice 4 of 4 of the former EW-2 (size 10), split 2026-08-23 on Marco's instruction.**
Chain: 2a capacity service -> 2b engine core -> 2c rejection path -> **2d (this)**.

**Binding plan:** `docs/plans/estimator-allocation-workload-plan.md` sections 3, 5 and 6.

**Gate:** EW-2c must be on main - `pushBack` present in
`apps/api/src/modules/tendering/allocation.service.ts`. Every method this controller calls therefore
already exists; if one is missing, that is a `NO-OP` and a report, not a reason to write it here.

## Context - grounded against origin/main (REUSE - do NOT rebuild)

- `AllocationService` (2b + 2c) exposes `allocateSingle`, `allocatePool`, `selfClaim`, `reject`,
  `override`, `transfer`, `pushBack`. **This slice only wires them to HTTP.** No business logic.
- `tenders.allocate` was registered by 2a. Do not register it again.
- `RequirePermissions` is in `apps/api/src/common/auth/permissions.decorator.ts`. Read an existing
  tendering controller for the guard-stacking convention before writing a new one.

## What to build

`AllocationController` - `apps/api/src/modules/tendering/allocation.controller.ts`, base route
`/tenders/allocations`.

**Guards:**
- All allocator write endpoints: `JwtAuthGuard` + `PermissionsGuard` +
  `@RequirePermissions("tenders.allocate")`.
- `self-claim` and `reject`: `@RequirePermissions("tenders.manage")` - these are the estimator's own
  actions, not the allocator's.

**Endpoints:**
- `POST /tenders/allocations/:id/allocate-single` - body `{ estimatorId: string }`
- `POST /tenders/allocations/:id/allocate-pool` - body `{ estimatorIds: string[] }`
- `POST /tenders/allocations/:id/self-claim`
- `POST /tenders/allocations/:id/reject` - body `{ reason: string }`
- `POST /tenders/allocations/:id/override` - body `{ estimatorId: string }`
- `POST /tenders/allocations/:id/transfer` - body `{ estimatorId: string }`
- `POST /tenders/allocations/:id/push-back`

Register `AllocationController` in `tendering.module.ts`.

## Do NOT

- Do NOT add business logic to the controller - it delegates to `AllocationService` and nothing more.
- Do NOT change any `AllocationService` or `CapacityService` method - if one is wrong, report it.
- Do NOT call `NotificationsService` (EW-3), build board endpoints (EW-4) or any UI (EW-5).
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

Scope discipline still applies: do not widen beyond the two files in `scope`. That is a scope
limit, **not** a reason to stop before pushing.

## Guardrails

- One attempt. Never exit silently - if `allocation.controller.ts` already exists on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
