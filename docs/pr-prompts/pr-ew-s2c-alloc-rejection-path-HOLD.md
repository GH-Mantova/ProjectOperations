---
premise: '! grep -q "pushBack" apps/api/src/modules/tendering/allocation.service.ts'
premise_means: AllocationService has no rejection or reassignment path, so a rejected tender cannot be transferred, pushed back to unallocated, or detected as stale.
scope:
  - apps/api/src/modules/tendering/allocation.service.ts
  - apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts
done_when: pnpm build && pnpm lint && grep -q "pushBack" apps/api/src/modules/tendering/allocation.service.ts && grep -q "detectUnallocated" apps/api/src/modules/tendering/allocation.service.ts
size: 3
gate_allow: none
seed_only: false
escalates: false
requires_on_main: apps/api/src/modules/tendering/allocation.service.ts :: allocatePool
---

# EW-2c: Allocation rejection and reassignment path

**This is slice 3 of 4 of the former EW-2 (size 10), split 2026-08-23 on Marco's instruction.**
Chain: 2a capacity service -> 2b engine core -> **2c (this)** -> 2d controller.

**Binding plan:** `docs/plans/estimator-allocation-workload-plan.md` sections 3, 5 and 6.

**Gate:** EW-2b must be on main - `allocatePool` present in
`apps/api/src/modules/tendering/allocation.service.ts`.

## Context - grounded against origin/main (REUSE - do NOT rebuild)

- 2b already built `allocateSingle`, `allocatePool` and `selfClaim` on `AllocationService`, and
  wired the service into `tendering.module.ts`. **You are ADDING methods to an existing service** -
  do not recreate the file, do not restate its constructor, do not duplicate its imports.
- EW-1 supplied `TenderAllocationRejection`.
- Use the existing audit pattern in `tendering.service.ts`. Grep it first.
- **Do NOT call `NotificationsService`** - alert dispatch is EW-3. `detectUnallocated` exists here
  purely so EW-3 has something to call.

## What to build - five methods added to `AllocationService`

- `reject(tenderId: string, estimatorId: string, reason: string, actorId: string): Promise<void>`
  - Validates `reason.trim().length > 0` - throws `BadRequestException` if blank.
  - Verifies `assignedEstimatorId === estimatorId` (only the assigned estimator may reject).
  - Creates a `TenderAllocationRejection` row.
  - Sets `allocationState = "REJECTED"`, clears `assignedEstimatorId`.
  - Writes audit.

- `override(tenderId: string, newEstimatorId: string, actorId: string): Promise<void>`
  - Allocator-only action. Sets `assignedEstimatorId = newEstimatorId`,
    `allocationState = "ALLOCATED"`.
  - Writes an audit entry **naming the previous estimator**.

- `transfer(tenderId: string, newEstimatorId: string, actorId: string): Promise<void>`
  - Post-rejection reassign. Verifies `allocationState = "REJECTED"`, then calls `allocateSingle()`.

- `pushBack(tenderId: string, actorId: string): Promise<void>`
  - Post-rejection return to the pool. Sets `allocationState = "UNALLOCATED"`,
    `assignedEstimatorId = null`, clears candidate rows. Writes audit.

- `detectUnallocated(thresholdMinutes = 60): Promise<string[]>`
  - Returns tender IDs where `allocationState = "UNALLOCATED"` and
    `updatedAt < now() - threshold`. Consumed by EW-3.

## Unit tests - extend `allocation.service.spec.ts`

Add to the existing spec file; do not replace 2b's assertions.
- `reject` throws `BadRequestException` when the reason is blank or whitespace-only.
- `reject` throws when `assignedEstimatorId` does not match the rejector.
- `reject` creates the rejection row AND clears `assignedEstimatorId`.
- `transfer` refuses when `allocationState` is not `REJECTED`.
- `override` audit entry records the previous estimator.
- `detectUnallocated` returns only tenders older than the threshold - include a boundary case that
  must NOT be returned.

## Do NOT

- Do NOT create any controller - that is 2d.
- Do NOT call `NotificationsService` (EW-3), build board endpoints (EW-4) or any UI (EW-5).
- Do NOT modify `estimatorUserId`. Do NOT overload `Tender.status` - use `allocationState`.
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

- One attempt. Never exit silently - if `pushBack` is already on main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
