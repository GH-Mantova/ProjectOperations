---
premise: ! grep -q "capacity-board\|getAllEstimatorsSummary" apps/api/src/modules/tendering/capacity.service.ts
premise_means: The capacity board API endpoints (GET /tenders/capacity-board, suggest-next, allocation history) and the getAllEstimatorsSummary method do not exist yet.
scope:
  - apps/api/src/modules/tendering/capacity.service.ts
  - apps/api/src/modules/tendering/allocation.controller.ts
  - apps/api/src/modules/tendering/tendering.controller.ts
  - apps/api/src/modules/tendering/__tests__/capacity.service.spec.ts
done_when: pnpm build && pnpm lint && grep -q "getAllEstimatorsSummary" apps/api/src/modules/tendering/capacity.service.ts && grep -q "capacity-board" apps/api/src/modules/tendering/allocation.controller.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/src/modules/tendering/allocation.service.ts
---

# EW-4: Weighted load + capacity-board API + suggest-next

**Binding plan:** `docs/plans/estimator-allocation-workload-plan.md` (read sections 5, 7, and 10
in full before starting). This is the fourth slice of the estimator allocation workflow cluster.

**Gate:** EW-1 (schema) and EW-2 (allocation engine) must be on main. Verify that both
`model EstimatorCapacity` is in `schema.prisma` AND `allocation.service.ts` exists before starting.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- `CapacityService` (EW-2) already has: `getEstimatorLoad()`, `getCapacity()`, `isOverloaded()`,
  `getLeastLoaded()`, `computeTenderLoad()`, `urgencyKey()`, `sizeBand()`, `getWeightConfig()`.
  This slice EXTENDS `CapacityService` — do NOT rewrite what exists.
- `AllocationService` (EW-2) has `detectUnallocated()`.
- `AllocationController` (EW-2) is the controller at `/tenders/allocations`. Add board endpoints
  here (or on `tendering.controller.ts` if board routes fit better under `/tenders` — judge from
  the existing route structure; do not create a third controller just for board endpoints).
- `tenders.allocate` permission exists (EW-2). Board read endpoints require `tenders.allocate`.
- `tenders.manage` guards standard estimator endpoints.
- Read `tendering.controller.ts` route registration pattern before adding new routes to understand
  where `/tenders/capacity-board` fits alongside existing `/tenders/*` routes.

## What to build

### 1. Extend `CapacityService` with `getAllEstimatorsSummary()`

Add to `CapacityService`:

```typescript
getAllEstimatorsSummary(): Promise<EstimatorSummary[]>
```

An `EstimatorSummary` should include (define as a local interface, not a Prisma type):
```typescript
interface EstimatorSummary {
  userId: string;
  displayName: string;
  load: number;           // computed weighted load
  effectiveCap: number;   // concurrentCap × (availabilityPct / 100)
  utilizationPct: number; // load / effectiveCap × 100, capped at 999 if effectiveCap is 0
  isOverloaded: boolean;
  openTenderCount: number;
  availabilityPct: number;
  concurrentCap: number;
}
```

To find which users to include in the summary: query all users who have any tender with
`assignedEstimatorId = userId` OR who have an `EstimatorCapacity` row. This is a practical
definition of "active estimators" — do NOT invent a new role tag or hardcode a list.

### 2. Add `suggestEstimator(tenderId: string): Promise<string | null>`

Add to `CapacityService`:

Given a tender ID, loads the tender's `estimatedValue` and `dueDate`, computes the load this
tender would add, and calls `getLeastLoaded(allEstimatorIds)` where `allEstimatorIds` comes from
`getAllEstimatorsSummary()` filtered to non-overloaded estimators. Returns the best candidate ID,
or null if all are overloaded.

### 3. New board endpoints

Add to `AllocationController` (or `tendering.controller.ts` — read the existing structure first):

- `GET /tenders/capacity-board`
  Guard: `@RequirePermissions("tenders.allocate")`
  Returns: `getAllEstimatorsSummary()` plus the list of UNALLOCATED tenders (from
  `detectUnallocated(0)` — all unallocated, not just aged ones, for the board view) each annotated
  with `suggestEstimator()` for that tender.

- `GET /tenders/capacity-board/suggest`
  Query param: `tenderId: string`
  Guard: `@RequirePermissions("tenders.allocate")`
  Returns: `{ suggestedEstimatorId: string | null, reason: string }`.
  The `reason` is a one-line human-readable explanation (e.g. `"Least loaded: 1.2 / 3.0 effective
  capacity (40%)"`) so the board UI can display it without additional computation.

- `GET /tenders/allocations/:id/history`
  Guard: `@RequirePermissions("tenders.manage")`
  Returns: `{ allocationState, assignedEstimatorId, candidates: TenderAllocationCandidate[],
  rejections: TenderAllocationRejection[] }` for the tender.

### 4. `EstimatorCapacity` write endpoint

Allow the allocator (or the estimator themselves) to update capacity:

- `PUT /tenders/capacity-board/estimators/:userId/capacity`
  Guard: `@RequirePermissions("tenders.allocate")` (allocator can edit anyone) OR
  `@RequirePermissions("tenders.manage")` + `req.user.id === userId` (estimator edits own).
  Body: `{ availabilityPct?: number, concurrentCap?: number }`.
  Implement as an upsert on `EstimatorCapacity`.

### 5. Unit tests — `apps/api/src/modules/tendering/__tests__/capacity.service.spec.ts`

Extend or add to the spec (if EW-2 already created a stub spec, extend it; otherwise create it):
- `getAllEstimatorsSummary()` returns correct `utilizationPct` and `isOverloaded` for known inputs.
- `suggestEstimator()` returns null when all estimators are overloaded.
- `suggestEstimator()` returns the least-loaded estimator by load/effectiveCap ratio.
- Urgency key mapping: `null` → `MEDIUM`, `6 days from now` → `CRITICAL`, `20 days` → `HIGH`,
  `59 days` → `MEDIUM`, `61 days` → `LOW`.

## Do NOT

- Do NOT build any UI — that is EW-5.
- Do NOT call `NotificationsService` — that is EW-3.
- Do NOT add a new Prisma model or migration — all schema is from EW-1.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if `getAllEstimatorsSummary` already exists in
  `capacity.service.ts`, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
