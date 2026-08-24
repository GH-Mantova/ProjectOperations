---
premise: '! test -f apps/api/src/modules/tendering/capacity.service.ts'
premise_means: No CapacityService exists, so per-estimator load, weight config and capacity cannot be computed and the tenders.allocate permission is not registered.
scope:
  - apps/api/src/modules/tendering/capacity.service.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/common/auth/permissions.registry.ts
  - apps/api/src/modules/tendering/__tests__/capacity.service.spec.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/tendering/capacity.service.ts && grep -q "getLeastLoaded" apps/api/src/modules/tendering/capacity.service.ts && grep -q "tenders.allocate" apps/api/src/common/auth/permissions.registry.ts
size: 3
gate_allow: none
seed_only: false
escalates: false
requires_on_main: apps/api/prisma/schema.prisma :: model EstimatorCapacity
---

# EW-2a: CapacityService + `tenders.allocate` permission

**This is slice 1 of 4 of the former EW-2 (size 10), split 2026-08-23 on Marco's instruction.**
Chain: **2a (this) -> 2b engine core -> 2c rejection path -> 2d controller.**

**Binding plan:** `docs/plans/estimator-allocation-workload-plan.md` sections 3, 5 and 6. Read them
in full before starting.

**Gate:** EW-1 (allocation schema) is on main - `model EstimatorCapacity` is present in
`apps/api/prisma/schema.prisma`. Verify before starting.

## Context - grounded against origin/main (REUSE - do NOT rebuild)

- EW-1 added: `allocationState` on Tender, `TenderAllocationCandidate`, `TenderAllocationRejection`,
  `EstimatorCapacity`, `AllocationWeightConfig`, `AllocatorDelegate`.
- `assignedEstimatorId` is the allocation target on Tender. `estimatorUserId` is the historical
  estimator-of-record - do NOT modify it anywhere in this cluster.
- `RequirePermissions` lives in `apps/api/src/common/auth/permissions.decorator.ts`. Existing
  guards include `tenders.view` and `tenders.manage`.
- Read `tendering.module.ts` to understand how services are wired before adding one.
- Value-band edges: if `WL3-S1` (win-likelihood) is merged, import `VALUE_BAND_EDGES` from
  `apps/api/src/modules/win-likelihood/win-likelihood-features.service.ts`. If it is not merged,
  define the same edges locally as an exported const `ALLOCATION_VALUE_BAND_EDGES` in
  `capacity.service.ts` (e.g. `[50000, 250000, 1000000]` for XS/S/M/L/XL).

## What to build

### 1. Register `tenders.allocate`

Add `"tenders.allocate"` to the permission registry - wherever `tenders.view` / `tenders.manage`
are registered. **Confirm the exact file by grepping for `"tenders.manage"` before editing**; the
scope names `permissions.registry.ts` as the expected location but the grep is the authority.

### 2. `CapacityService` - `apps/api/src/modules/tendering/capacity.service.ts`

An `@Injectable()` service that computes per-estimator load and capacity:

- `getWeightConfig(): Promise<{ urgency: Map<string, number>, size: Map<string, number> }>` - reads
  `AllocationWeightConfig` rows grouped by dimension. Memoize per-request (a Map built once per call
  is fine; do not over-engineer caching).
- `urgencyKey(dueDate: Date | null): string` - `null` -> `"MEDIUM"`, `< 7 days` -> `"CRITICAL"`,
  `< 21 days` -> `"HIGH"`, `< 60 days` -> `"MEDIUM"`, `>= 60 days` -> `"LOW"`.
- `sizeBand(estimatedValue: Decimal | null): string` - maps value to band key using the band edges.
  `null` -> `"M"` (mid-range assumption; genuine gaps are reported by EW-4/EW-5).
- `computeTenderLoad(tender: { dueDate, estimatedValue }): Promise<number>` - `urgencyWeight x sizeWeight`.
- `getEstimatorLoad(estimatorId: string): Promise<number>` - sum `computeTenderLoad(t)` over all
  open (non-terminal-status) tenders where `assignedEstimatorId = estimatorId`.
- `getCapacity(estimatorId: string): Promise<{ concurrentCap: number, availabilityPct: number, effectiveCap: number }>` -
  reads `EstimatorCapacity`; if no row, defaults `concurrentCap=5, availabilityPct=100`.
  `effectiveCap = concurrentCap x (availabilityPct / 100)`.
- `isOverloaded(estimatorId: string): Promise<boolean>` - `load > effectiveCap`.
- `getLeastLoaded(estimatorIds: string[]): Promise<string | null>` - returns the estimator with the
  lowest `load / effectiveCap` ratio, or `null` if all are at or over capacity.

### 3. Wire into `tendering.module.ts`

Register `CapacityService` only. `AllocationService` and its controller arrive in 2b and 2d.

### 4. Unit tests - `apps/api/src/modules/tendering/__tests__/capacity.service.spec.ts`

Mirror the `tendering.service.spec.ts` style using the Prisma-mock approach. Key assertions:
- `urgencyKey` returns each of the five keys at its boundary, and `"MEDIUM"` for `null`.
- `getCapacity` returns the documented defaults when no `EstimatorCapacity` row exists.
- `effectiveCap` scales with `availabilityPct` (e.g. cap 5 at 60% -> 3).
- `getLeastLoaded` returns `null` when every candidate is at or over capacity.
- `getLeastLoaded` picks by RATIO, not by raw load - include a case where the lowest raw load is
  NOT the answer because that estimator has a small cap.

## Do NOT

- Do NOT create `allocation.service.ts` or any controller - those are 2b and 2d.
- Do NOT call `NotificationsService` - alert dispatch is EW-3.
- Do NOT build the capacity board endpoints (EW-4) or any UI (EW-5).
- Do NOT modify `estimatorUserId`. Do NOT overload `Tender.status` - use `allocationState`.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

Scope discipline still applies: do not widen beyond the four files in `scope`. That is a scope
limit, **not** a reason to stop before pushing.

## Guardrails

- One attempt. Never exit silently - if `capacity.service.ts` already exists on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
