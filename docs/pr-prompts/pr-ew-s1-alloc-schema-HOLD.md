---
premise: ! grep -q "model EstimatorCapacity" apps/api/prisma/schema.prisma
premise_means: The EstimatorCapacity model does not yet exist — the allocation schema (pool candidates, rejection capture, capacity, weight config, allocator delegate) has not been added.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/tendering/tendering.service.ts
done_when: pnpm build && pnpm lint && grep -q "model EstimatorCapacity" apps/api/prisma/schema.prisma && test -f docs/data-model/relationship-map.json
size: 5
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: All additions are purely additive (new nullable/defaulted columns and new tables). The allocationState column has a NOT NULL default ("UNALLOCATED") backfilled in the same migration for existing rows — this is a safe one-way default and no code change is required to leave it on main. To revert remove the five new models and the allocationState field from schema.prisma, then drop the corresponding migration. No UPDATE ... SET data transform; existing Tender rows are unaffected beyond the default value.
requires_file_on_main: docs/plans/estimator-allocation-workload-plan.md
---

# EW-1: Allocation + capacity schema (additive migration)

**Binding plan:** `docs/plans/estimator-allocation-workload-plan.md` (read sections 2, 4, and 10
in full before starting). This is the first slice of the estimator allocation workflow cluster.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- `model Tender` already has `estimatorUserId` (`TenderEstimator` relation) and
  `assignedEstimatorId` (`TenderAssignedEstimator` relation). The plan §2.1 clarifies the roles:
  `estimatorUserId` = historical estimator-of-record (do not touch); `assignedEstimatorId` = active
  team-level assignment (this is the allocation target). Do NOT add a third estimator FK.
- `model Tender` already has `estimatedValue Decimal?` and `dueDate DateTime?` — reuse these.
- Tender `status` field tracks editorial lifecycle (DRAFT/SUBMITTED/etc.). `allocationState` is a
  SEPARATE field. Do NOT overload `status`.
- `NotificationsService` exists and is used in the tendering module. This slice does NOT call it —
  that is EW-3.
- Permissions `tenders.view`, `tenders.manage`, etc. exist. `tenders.allocate` is net-new and
  added in EW-2, not here.

## What to build

### 1. Add `allocationState` to `model Tender`

```prisma
allocationState  String  @default("UNALLOCATED") @map("allocation_state")
```

Add the field and a `@@index([allocationState])`. Valid states: `UNALLOCATED`, `ALLOCATED`, `POOL`,
`CLAIMED`, `REJECTED`. Do NOT create a Prisma enum — use a String field with the state values
enforced at the service layer (consistent with the existing `status` field convention on Tender).

Existing Tender rows will receive the default `"UNALLOCATED"` via the migration's `ALTER TABLE ...
ADD COLUMN ... DEFAULT 'UNALLOCATED'`. This is correct — unallocated is the right starting state.

### 2. Add `model TenderAllocationCandidate`

Pool model: holds the set of estimators offered a tender when in the POOL state.

```prisma
model TenderAllocationCandidate {
  id          String    @id @default(cuid())
  tenderId    String    @map("tender_id")
  estimatorId String    @map("estimator_id")
  offeredAt   DateTime  @default(now()) @map("offered_at")
  claimedAt   DateTime? @map("claimed_at")
  tender      Tender    @relation(fields: [tenderId],    references: [id], onDelete: Cascade)
  estimator   User      @relation("TenderPoolCandidate", fields: [estimatorId], references: [id], onDelete: Cascade)
  @@unique([tenderId, estimatorId])
  @@index([tenderId])
  @@index([estimatorId])
  @@map("tender_allocation_candidates")
}
```

The `@@unique([tenderId, estimatorId])` constraint is the race-guard for claims — the allocation
engine relies on it in EW-2.

### 3. Add `model TenderAllocationRejection`

Captures reject-with-reason (required reason text, who rejected, when).

```prisma
model TenderAllocationRejection {
  id         String   @id @default(cuid())
  tenderId   String   @map("tender_id")
  rejectedBy String   @map("rejected_by")
  reason     String
  rejectedAt DateTime @default(now()) @map("rejected_at")
  tender     Tender   @relation(fields: [tenderId],   references: [id], onDelete: Cascade)
  rejector   User     @relation("TenderRejector", fields: [rejectedBy], references: [id], onDelete: Restrict)
  @@index([tenderId])
  @@map("tender_allocation_rejections")
}
```

Multiple rejection rows per tender are allowed (one per reject-then-reassign cycle).

### 4. Add `model EstimatorCapacity`

Per-estimator manual availability and concurrent-cap.

```prisma
model EstimatorCapacity {
  id              String   @id @default(cuid())
  userId          String   @unique @map("user_id")
  availabilityPct Int      @default(100) @map("availability_pct")
  concurrentCap   Int      @default(5)   @map("concurrent_cap")
  updatedAt       DateTime @updatedAt    @map("updated_at")
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("estimator_capacity")
}
```

`availabilityPct` is 0–100. `concurrentCap` is the max open tenders before overloaded.
Effective capacity = `concurrentCap × (availabilityPct / 100)`.

### 5. Add `model AllocationWeightConfig`

Admin-configurable load weight lookup. Dimension + key are unique together.

```prisma
model AllocationWeightConfig {
  id        String   @id @default(cuid())
  dimension String
  key       String
  weight    Decimal  @db.Decimal(5, 2)
  label     String
  updatedAt DateTime @updatedAt @map("updated_at")
  @@unique([dimension, key])
  @@index([dimension])
  @@map("allocation_weight_configs")
}
```

Seed rows (add to `apps/api/prisma/seed.ts` or the appropriate seeder):
- `dimension=urgency`: `CRITICAL` 4.0, `HIGH` 2.5, `MEDIUM` 1.0, `LOW` 0.5
- `dimension=size`: `XS` 0.5, `S` 1.0, `M` 2.0, `L` 3.5, `XL` 5.0

### 6. Add `model AllocatorDelegate`

Temporary delegate with date window.

```prisma
model AllocatorDelegate {
  id          String   @id @default(cuid())
  delegateId  String   @map("delegate_id")
  grantedById String   @map("granted_by_id")
  startDate   DateTime @map("start_date")
  endDate     DateTime @map("end_date")
  createdAt   DateTime @default(now()) @map("created_at")
  delegate    User     @relation("AllocatorDelegateUser",    fields: [delegateId],  references: [id], onDelete: Cascade)
  grantedBy   User     @relation("AllocatorDelegateGrantor", fields: [grantedById], references: [id], onDelete: Restrict)
  @@index([delegateId])
  @@index([endDate])
  @@map("allocator_delegates")
}
```

Active delegate = row where `startDate <= now() <= endDate`. No background job needed — resolved
on-read by the alert routing logic in EW-3.

### 7. Wire new relations on `model User`

Add the back-relations to `model User` for all five new models:
```prisma
// in model User:
poolCandidacies      TenderAllocationCandidate[] @relation("TenderPoolCandidate")
allocationRejections TenderAllocationRejection[] @relation("TenderRejector")
estimatorCapacity    EstimatorCapacity?
allocatorDelegatesGranted AllocatorDelegate[]    @relation("AllocatorDelegateGrantor")
allocatorDelegatesReceived AllocatorDelegate[]   @relation("AllocatorDelegateUser")
```

And add back-relations to `model Tender`:
```prisma
allocationCandidates TenderAllocationCandidate[]
allocationRejections TenderAllocationRejection[]
```

### 8. Migration

Generate a single migration:
```
npx prisma migrate dev --name ew1_allocation_capacity_schema --create-only
```

Review the generated SQL. It should:
- `ALTER TABLE tenders ADD COLUMN allocation_state VARCHAR DEFAULT 'UNALLOCATED' NOT NULL`
- `CREATE TABLE tender_allocation_candidates ...` with the unique constraint
- `CREATE TABLE tender_allocation_rejections ...`
- `CREATE TABLE estimator_capacity ...`
- `CREATE TABLE allocation_weight_configs ...`
- `CREATE TABLE allocator_delegates ...`
- All indexes declared in the models

Commit the migration file.

### 9. Regen data-model map

```
node scripts/data-model/build-relationship-map.mjs
```

Commit the regenerated `docs/data-model/relationship-map.json`, `relationship-map.md`,
and `metadata-catalog.json`.

### 10. Update unit tests

If any `*.spec.ts` file has a `toHaveBeenCalledWith(...)` assertion on a Prisma `tender.update` or
`tender.create` call that now includes the new `allocationState` field in the generated type,
update those expected objects to include the field. Use `grep -r "toHaveBeenCalledWith" apps/api`
to find all affected assertions.

## Do NOT

- Do NOT add `tenders.allocate` permission — that is EW-2.
- Do NOT build `AllocationService` or `CapacityService` — that is EW-2.
- Do NOT call `NotificationsService` — that is EW-3.
- Do NOT build any UI — that is EW-5.
- Do NOT add a third estimator FK to Tender. Reuse `assignedEstimatorId` as the allocation target.
- Do NOT overload `Tender.status` with allocation state. Use `allocationState`.
- Do NOT edit `/sot/`.
- Do NOT touch Azure/Entra/SharePoint.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if the `EstimatorCapacity` model already exists on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
- `node scripts/data-model/build-relationship-map.mjs` must be committed in the same PR.

GATE-ALLOW: migrations
