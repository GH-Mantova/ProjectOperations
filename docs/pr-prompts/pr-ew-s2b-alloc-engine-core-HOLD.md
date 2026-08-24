---
premise: '! test -f apps/api/src/modules/tendering/allocation.service.ts'
premise_means: No AllocationService exists, so tenders cannot be allocated to a single estimator, offered to a pool, or self-claimed.
scope:
  - apps/api/src/modules/tendering/allocation.service.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/tendering/allocation.service.ts && grep -q "allocatePool" apps/api/src/modules/tendering/allocation.service.ts && grep -q "selfClaim" apps/api/src/modules/tendering/allocation.service.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
requires_on_main: apps/api/src/modules/tendering/capacity.service.ts :: getLeastLoaded
---

# EW-2b: Allocation engine core - allocate-single, allocate-pool, self-claim

**This is slice 2 of 4 of the former EW-2 (size 10), split 2026-08-23 on Marco's instruction.**
Chain: 2a capacity service -> **2b (this)** -> 2c rejection path -> 2d controller.

**Binding plan:** `docs/plans/estimator-allocation-workload-plan.md` sections 3, 5 and 6.

**Gate:** EW-2a must be on main - `getLeastLoaded` present in
`apps/api/src/modules/tendering/capacity.service.ts`.

## Context - grounded against origin/main (REUSE - do NOT rebuild)

- `CapacityService` (2a) already provides `getLeastLoaded`, `getEstimatorLoad`, `getCapacity`,
  `isOverloaded`. **Inject it. Do not reimplement any of it.**
- `assignedEstimatorId` is the allocation target on Tender. `estimatorUserId` is the historical
  estimator-of-record - do NOT modify it.
- EW-1 supplied `TenderAllocationCandidate` and `allocationState` on Tender.
- Use the existing audit pattern in `tendering.service.ts` for every audit write. Grep it first -
  do not invent an audit API.
- `NotificationsService` is imported in `tender-entries.service.ts` and `scope-waste.service.ts`.
  **Do NOT call it from this slice** - alert dispatch is EW-3.

## What to build

`AllocationService` - `apps/api/src/modules/tendering/allocation.service.ts`. An `@Injectable()`
service injecting `PrismaService` and `CapacityService`. All methods `async`.

- `allocateSingle(tenderId: string, estimatorId: string, actorId: string): Promise<void>`
  - Verifies the tender exists and the estimator exists.
  - Sets `assignedEstimatorId = estimatorId`, `allocationState = "ALLOCATED"`.
  - Writes an audit entry.
  - Clears `TenderAllocationCandidate` rows for the tender (cleanup of any prior pool).

- `allocatePool(tenderId: string, estimatorIds: string[], actorId: string): Promise<void>`
  - Inserts `TenderAllocationCandidate` rows (upsert, ignore duplicates).
  - Sets `allocationState = "POOL"`, clears `assignedEstimatorId`.
  - Hybrid resolution: call `capacity.getLeastLoaded(estimatorIds)`.
    - Candidate with free capacity found -> call `allocateSingle()` (state becomes ALLOCATED).
    - None found -> leave as POOL for estimators to self-claim.
  - Writes audit.

- `selfClaim(tenderId: string, estimatorId: string): Promise<void>`
  - Verifies `allocationState` is `UNALLOCATED` or `POOL`.
  - **Race-guard:** use a Prisma `updateMany` with
    `where: { id: tenderId, allocationState: { in: ["UNALLOCATED", "POOL"] } }`.
    If `count === 0`, throw `ConflictException("Tender already claimed.")`.
  - Sets `assignedEstimatorId = estimatorId`, `allocationState = "CLAIMED"`.
  - Marks the candidate row `claimedAt = now()` if one exists.
  - Writes audit.

Register `AllocationService` in `tendering.module.ts` alongside the existing `CapacityService`.

## Unit tests - `apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts`

Mirror `tendering.service.spec.ts` (Prisma-mock approach). Key assertions:
- `selfClaim` throws `ConflictException` when `updateMany` returns `count = 0`.
- `selfClaim` sets state to `CLAIMED` and stamps `claimedAt` when the candidate row exists.
- `allocatePool` calls `allocateSingle` when `getLeastLoaded` returns a candidate.
- `allocatePool` leaves state as `POOL` when `getLeastLoaded` returns `null`.
- `allocateSingle` clears candidate rows for the tender.

## Do NOT

- Do NOT implement `reject`, `override`, `transfer`, `pushBack` or `detectUnallocated` - those are
  **2c**, and adding them here breaks the chain gate.
- Do NOT create any controller - that is 2d.
- Do NOT call `NotificationsService` (EW-3), build board endpoints (EW-4) or any UI (EW-5).
- Do NOT modify `estimatorUserId`. Do NOT overload `Tender.status`.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

Scope discipline still applies: do not widen beyond the three files in `scope`. That is a scope
limit, **not** a reason to stop before pushing.

## Guardrails

- One attempt. Never exit silently - if `allocation.service.ts` already exists on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
