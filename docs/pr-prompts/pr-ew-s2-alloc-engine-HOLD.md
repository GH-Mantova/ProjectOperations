---
premise: ! test -f apps/api/src/modules/tendering/allocation.service.ts
premise_means: No AllocationService exists — the allocation engine (allocate-single/pool, self-claim, reject-with-reason, override, hybrid pool resolution) and the tenders.allocate permission have not been built yet.
scope:
  - apps/api/src/modules/tendering/allocation.service.ts
  - apps/api/src/modules/tendering/allocation.controller.ts
  - apps/api/src/modules/tendering/capacity.service.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/modules/tendering/tendering.controller.ts
  - apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts
  - apps/api/src/common/auth/permissions.registry.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/tendering/allocation.service.ts && test -f apps/api/src/modules/tendering/capacity.service.ts && grep -q "tenders.allocate" apps/api/src/modules/tendering/allocation.controller.ts
size: 10
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/prisma/schema.prisma
---

# EW-2: Allocation engine + API + `tenders.allocate` permission

**Binding plan:** `docs/plans/estimator-allocation-workload-plan.md` (read sections 3, 5, and 6
in full before starting). This is the second slice of the estimator allocation workflow cluster.

**Gate:** EW-1 (allocation schema) must be on main. Verify that `model EstimatorCapacity` is
present in `apps/api/prisma/schema.prisma` before starting.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- EW-1 added: `allocationState` on Tender, `TenderAllocationCandidate`, `TenderAllocationRejection`,
  `EstimatorCapacity`, `AllocationWeightConfig`, `AllocatorDelegate` models.
- `assignedEstimatorId` is the allocation target on Tender — the allocation engine writes here.
- `estimatorUserId` is the historical estimator-of-record — do NOT modify it in this slice.
- `NotificationsService` is imported in `tender-entries.service.ts` and `scope-waste.service.ts`.
  Do NOT call it from this slice — alert dispatch is EW-3.
- `RequirePermissions` decorator is in `apps/api/src/common/auth/permissions.decorator.ts`.
  Existing guards: `tenders.view`, `tenders.manage`. Add `tenders.allocate` here.
- Read `tendering.module.ts` to understand how to wire new services before adding them.
- Value-band edges: if `WL3-S1` (win-likelihood) is merged, import `VALUE_BAND_EDGES` from
  `apps/api/src/modules/win-likelihood/win-likelihood-features.service.ts`. If it is not yet
  merged, define the same edges locally (e.g. `[50000, 250000, 1000000]` for XS/S/M/L/XL) as an
  exported const `ALLOCATION_VALUE_BAND_EDGES` in `capacity.service.ts`.

## What to build

### 1. Register `tenders.allocate` permission

Add `"tenders.allocate"` to the permission registry (wherever `tenders.view`, `tenders.manage`,
etc. are registered — typically `apps/api/src/common/auth/permissions.registry.ts` or the module
that exports the permission list). Confirm the exact file by grepping for `"tenders.manage"` before
editing.

### 2. `CapacityService` — `apps/api/src/modules/tendering/capacity.service.ts`

An `@Injectable()` service that computes per-estimator load and capacity:

- `getWeightConfig(): Promise<{ urgency: Map<string, number>, size: Map<string, number> }>` —
  reads `AllocationWeightConfig` rows grouped by dimension. Memoize per-request (a Map built once
  per call is fine; do not over-engineer caching).
- `urgencyKey(dueDate: Date | null): string` — maps due date to urgency key:
  `null` → `"MEDIUM"`, `< 7 days` → `"CRITICAL"`, `< 21 days` → `"HIGH"`,
  `< 60 days` → `"MEDIUM"`, `>= 60 days` → `"LOW"`.
- `sizeBand(estimatedValue: Decimal | null): string` — maps value to band key using the band edges.
  `null` → `"M"` (mid-range assumption, not a hard gap here — gaps are reported by EW-4/5).
- `computeTenderLoad(tender: { dueDate, estimatedValue }): Promise<number>` — `urgencyWeight × sizeWeight`.
- `getEstimatorLoad(estimatorId: string): Promise<number>` — sum `computeTenderLoad(t)` for all
  open (non-terminal-status) tenders where `assignedEstimatorId = estimatorId`.
- `getCapacity(estimatorId: string): Promise<{ concurrentCap: number, availabilityPct: number, effectiveCap: number }>` —
  reads `EstimatorCapacity`; if no row: defaults `concurrentCap=5, availabilityPct=100`.
  `effectiveCap = concurrentCap × (availabilityPct / 100)`.
- `isOverloaded(estimatorId: string): Promise<boolean>` — `load > effectiveCap`.
- `getLeastLoaded(estimatorIds: string[]): Promise<string | null>` — returns the estimator with
  lowest `load / effectiveCap` ratio, or `null` if all are at or over capacity.

### 3. `AllocationService` — `apps/api/src/modules/tendering/allocation.service.ts`

An `@Injectable()` service. Inject `PrismaService` and `CapacityService`.

Methods (all `async`):

- `allocateSingle(tenderId: string, estimatorId: string, actorId: string): Promise<void>`
  - Verifies tender exists, estimator exists.
  - Sets `assignedEstimatorId = estimatorId`, `allocationState = "ALLOCATED"`.
  - Writes an audit entry (use the existing audit pattern in `tendering.service.ts`).
  - Clears `TenderAllocationCandidate` rows for the tender (cleanup of any prior pool).

- `allocatePool(tenderId: string, estimatorIds: string[], actorId: string): Promise<void>`
  - Inserts `TenderAllocationCandidate` rows (upsert, ignore duplicates).
  - Sets `allocationState = "POOL"`, clears `assignedEstimatorId`.
  - Runs hybrid resolution: calls `getLeastLoaded(estimatorIds)`.
    - If a free-capacity candidate found: call `allocateSingle()` (state → ALLOCATED).
    - If none found: leave as POOL (estimators self-claim).
  - Writes audit.

- `selfClaim(tenderId: string, estimatorId: string): Promise<void>`
  - Verifies `allocationState` is `UNALLOCATED` or `POOL`.
  - Race-guard: use a Prisma `updateMany` with `where: { id: tenderId, allocationState: { in: ["UNALLOCATED", "POOL"] } }`.
    If `count === 0`, throw `ConflictException("Tender already claimed.")`.
  - Sets `assignedEstimatorId = estimatorId`, `allocationState = "CLAIMED"`.
  - Marks the candidate row `claimedAt = now()` if exists.
  - Writes audit.

- `reject(tenderId: string, estimatorId: string, reason: string, actorId: string): Promise<void>`
  - Validates `reason.trim().length > 0` — throws `BadRequestException` if blank.
  - Verifies `assignedEstimatorId === estimatorId` (only the assigned estimator can reject).
  - Creates `TenderAllocationRejection` row.
  - Sets `allocationState = "REJECTED"`, clears `assignedEstimatorId`.
  - Writes audit. (Alert routing is EW-3 — do NOT call NotificationsService here.)

- `override(tenderId: string, newEstimatorId: string, actorId: string): Promise<void>`
  - Allocator-only action. Sets `assignedEstimatorId = newEstimatorId`, `allocationState = "ALLOCATED"`.
  - Writes audit entry noting previous estimator.

- `transfer(tenderId: string, newEstimatorId: string, actorId: string): Promise<void>`
  - Post-rejection reassign. Calls `allocateSingle()` after verifying `allocationState = "REJECTED"`.

- `pushBack(tenderId: string, actorId: string): Promise<void>`
  - Post-rejection return. Sets `allocationState = "UNALLOCATED"`, `assignedEstimatorId = null`.
  - Clears candidate rows. Writes audit.

- `detectUnallocated(thresholdMinutes = 60): Promise<string[]>`
  - Returns tender IDs where `allocationState = "UNALLOCATED"` and `updatedAt < now() - threshold`.
  - Used by EW-3 to trigger alerts.

### 4. `AllocationController` — `apps/api/src/modules/tendering/allocation.controller.ts`

A NestJS controller with base route `/tenders/allocations`. Guards:
- All write endpoints: `JwtAuthGuard` + `PermissionsGuard` + `@RequirePermissions("tenders.allocate")`.
- `POST /tenders/allocations/:id/self-claim`: `@RequirePermissions("tenders.manage")` (estimator's own permission).
- `POST /tenders/allocations/:id/reject`: `@RequirePermissions("tenders.manage")`.

Endpoints:
- `POST /tenders/allocations/:id/allocate-single` — body: `{ estimatorId: string }`
- `POST /tenders/allocations/:id/allocate-pool` — body: `{ estimatorIds: string[] }`
- `POST /tenders/allocations/:id/self-claim`
- `POST /tenders/allocations/:id/reject` — body: `{ reason: string }`
- `POST /tenders/allocations/:id/override` — body: `{ estimatorId: string }`
- `POST /tenders/allocations/:id/transfer` — body: `{ estimatorId: string }`
- `POST /tenders/allocations/:id/push-back`

### 5. Wire into `tendering.module.ts`

Register `AllocationService`, `CapacityService`, `AllocationController` in `tendering.module.ts`.

### 6. Unit tests — `apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts`

Mirror the `tendering.service.spec.ts` style using the Prisma-mock approach. Key assertions:
- `selfClaim` throws `ConflictException` when `updateMany` returns `count = 0`.
- `reject` throws `BadRequestException` when reason is blank.
- `reject` verifies `assignedEstimatorId` matches the rejector.
- `allocatePool` calls `allocateSingle` when `getLeastLoaded` returns a candidate.
- `allocatePool` leaves state as POOL when `getLeastLoaded` returns null.
- `detectUnallocated` returns only tenders older than the threshold.

## Do NOT

- Do NOT call `NotificationsService` — alert dispatch is EW-3.
- Do NOT build the capacity board endpoints — that is EW-4.
- Do NOT build any UI — that is EW-5.
- Do NOT modify `estimatorUserId` — only `assignedEstimatorId` is the allocation target.
- Do NOT overload `Tender.status` — use `allocationState`.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if `allocation.service.ts` already exists on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
