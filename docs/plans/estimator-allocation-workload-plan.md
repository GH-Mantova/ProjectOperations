# Estimator Allocation Workflow + Weighted Capacity Board — Plan

**Date authored:** 2026-08-12
**Decision basis:** PR-Master interview + panel, 2026-08-12 (Marco's locked decisions — do not re-litigate)
**Related plan context:** roles-permissions-admin-redesign-plan.md (capability-based additive multi-role),
tender-winloss-datacapture-plan.md (value-band + outcome data reused for weighted load)

---

## 1. Problem statement

Tenders arrive without a guaranteed estimator. When no estimator is assigned the tender can be missed
or left unworked. There is no way for Sean (or whoever holds allocator authority in future) to see
who has capacity, who is overloaded, or which tenders are waiting. Estimators have no way to self-claim
or record a rejection with a reason. There is no temporary delegate cover for leave.

This plan closes those gaps with: an allocation lifecycle, a multi-estimator pool, capacity tracking
with weighted load, an admin-configurable weight system, and a self-service board for the allocator
and estimators. The entire authority model flows from a `tenders.allocate` capability — nobody is
hardcoded.

---

## 2. Grounded state on origin/main (verified 2026-08-12)

### 2.1 Two existing estimator FKs on Tender — role clarification (REQUIRED before adding state)

`model Tender` carries two estimator foreign keys. Their roles are distinct:

| Field | Relation name | Role |
|---|---|---|
| `estimatorUserId` | `TenderEstimator` | **Historical estimator-of-record.** Written when a tender is created or duplicated. Represents who was associated with the estimate at creation/import time. The service comment at `tendering.service.ts §5A.3` explicitly labels this the "legacy estimator-of-record". **This FK is NOT the allocation target.** |
| `assignedEstimatorId` | `TenderAssignedEstimator` | **Team-level current assignment.** Written by the Team panel (`setAssignedEstimator()`). This is the active estimator on the tender today. **This is the allocation target** — the allocation lifecycle wraps around this field. |

**Consequence for the slice design:**
- `allocationState` and the pool/candidate model wrap `assignedEstimatorId`, not `estimatorUserId`.
- The allocation engine's "assign" action ultimately writes `assignedEstimatorId`.
- `estimatorUserId` is preserved as-is for history/audit; the allocation workflow does not modify it.
- The plan must NOT add a third estimator FK for the allocation target.

### 2.2 Existing permission strings

Confirmed in `apps/api/src/modules/tendering/tendering.controller.ts` and `tendering.service.ts`:
- `tenders.view` — read access to tenders
- `tenders.manage` — general write access (update, etc.)
- `tenders.create`, `tenders.delete`, `tenders.duplicate`, `tenders.update` — specific action permissions

**Net-new permission added by this workflow:** `tenders.allocate`
Capability-based, additive, ties into the existing roles/permissions redesign. Whoever holds
`tenders.allocate` is the allocator — no hardcoded user or role name.

### 2.3 NotificationsService (REUSE, do NOT duplicate)

`NotificationsService` is already imported and called in:
- `apps/api/src/modules/tendering/tender-entries.service.ts` (import line 5, call ~line 216)
- `apps/api/src/modules/tendering/scope-waste.service.ts` (import line 4, call ~line 608)

All allocation alerts (unallocated flag, rejection, overload) route via `NotificationsService`.
Do not build a parallel channel.

### 2.4 estimatedValue + dueDate (existing on Tender)

Both fields already exist on `model Tender`:
- `estimatedValue Decimal? @map("estimated_value") @db.Decimal(14, 2)` — used for value-band sizing
- `dueDate DateTime? @map("due_date")` — used for urgency

These are the same fields the win-loss report bands use. The weighted load formula uses them directly.
No new tender fields are added for load computation.

### 2.5 What does NOT exist on main (net-new)

- Any `allocationState` field or enum on Tender
- Any multi-estimator pool / candidate table (a single FK cannot hold several candidates)
- Any reject-with-reason capture (who rejected, reason text, timestamp)
- Any `EstimatorCapacity` model (availability %, concurrent cap per estimator)
- Any admin-configurable load-weight config
- Any allocator delegate model (userId + date window)
- Any `tenders.allocate` permission
- Any capacity board UI or allocation API endpoints

---

## 3. Marco's locked decisions (baked in — do not re-litigate)

1. **Three work-arrival paths:** direct invitation by the allocator, estimator self-select from
   unallocated pool, or allocator assigns directly.

2. **Allocation lifecycle (state machine):**
   ```
   UNALLOCATED
     -> flags the tenders.allocate holder(s) + active delegate
     -> ALLOCATED (single estimator, direct assign)
     -> POOL (multi-estimator offered, awaiting claim)
       -> CLAIMED (one estimator claimed — race-guarded)
     -> REJECTED (with required reason, by the assigned estimator)
       -> alerts allocator
       -> TRANSFER (allocator reassigns to new estimator)
         OR PUSH_BACK (allocator returns it to pool/unallocated)
   ```
   `allocationState` is a separate string field on Tender — it does NOT overload `Tender.status`
   (which tracks the editorial lifecycle: DRAFT, SUBMITTED, etc.).

3. **Hybrid pool resolution (auto-assign vs first-to-accept):**
   - When a tender enters POOL, check each pool member's current load vs capacity.
   - If any pool member has free capacity: AUTO-ASSIGN to the first-free-with-capacity.
   - If NONE have capacity: fall back to FIRST-TO-ACCEPT (estimator self-claims).
   - Allocator can override any state at any time.
   - Claim race must be guarded (one winner — use a unique constraint or a serialised update).

4. **Self-claim:**
   - An estimator can self-claim any UNALLOCATED tender.
   - Self-claim writes `assignedEstimatorId`, sets `allocationState = CLAIMED`, clears the
     unallocated alert.
   - Allocator can override a self-claim.

5. **Weighted capacity formula:**
   ```
   load(tender) = urgency_weight(dueDate) × size_weight(value_band(estimatedValue))
   load(estimator) = sum over open tenders of load(tender)
   overloaded = load(estimator) > capacity.concurrentCap × capacity.availabilityPct
   ```
   - `urgency_weight` and `size_weight` are admin-configurable lookup tables (data, not code).
   - Value-band edges reuse the same `VALUE_BAND_EDGES` constant the win-likelihood service defines
     (WL3-S1) — import, do not duplicate.
   - Formula must be explainable and visible on the capacity board (show per-tender load contribution).

6. **`tenders.allocate` = the capability (not a user or a role name).**
   - Unallocated flags, rejection alerts, overload alerts, and override rights all route to whoever
     currently holds `tenders.allocate` plus whoever is the active delegate.
   - Granting/revoking happens via the roles-admin UI (existing permission matrix), not a special
     screen.

7. **Two authority-transfer mechanisms:**
   - Permanent: grant/revoke `tenders.allocate` via the roles admin (existing capability).
   - Temporary delegate: a record with `userId`, `startDate`, `endDate`, granted by the current
     allocator. During the window, alerts and decisions route to the delegate. Auto-reverts at
     `endDate` (cron or check-on-read). Audit log entry on delegate create/update/expiry.

8. **Board audience split:**
   - Allocator/management board: allocate, override, reassign, monitor all estimators' load.
   - Estimator self-view: see own tenders, self-claim from pool, reject with reason.
   - Anti-fatigue: cap notification volume; aggregate multiple overload alerts where sensible
     (reuse the lesson from the reminders cluster — one digest, not ten individual pings).

---

## 4. Data model additions (EW-1)

### 4.1 allocationState on Tender

Add to `model Tender`:
```prisma
allocationState  String  @default("UNALLOCATED") @map("allocation_state")
@@index([allocationState])
```

States: `UNALLOCATED`, `ALLOCATED`, `POOL`, `CLAIMED`, `REJECTED`

The field tracks allocation workflow state. It is deliberately separate from `status` (editorial
lifecycle). A tender can be `DRAFT` + `ALLOCATED` or `SUBMITTED` + `UNALLOCATED`.

### 4.2 TenderAllocationCandidate (pool model)

A join table that holds the set of estimators offered a tender when `allocationState = POOL`:

```prisma
model TenderAllocationCandidate {
  id          String   @id @default(cuid())
  tenderId    String   @map("tender_id")
  estimatorId String   @map("estimator_id")
  offeredAt   DateTime @default(now()) @map("offered_at")
  claimedAt   DateTime? @map("claimed_at")
  tender      Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  estimator   User     @relation(fields: [estimatorId], references: [id], onDelete: Cascade)
  @@unique([tenderId, estimatorId])
  @@index([tenderId])
  @@index([estimatorId])
  @@map("tender_allocation_candidates")
}
```

The claim-race guard is the `@@unique([tenderId, estimatorId])` constraint combined with a
conditional update: `UPDATE ... SET claimedAt = now() WHERE tenderId = ? AND claimedAt IS NULL`.
The database serialises concurrent claims; the second writer gets a unique violation.

### 4.3 TenderAllocationRejection (reject-with-reason)

```prisma
model TenderAllocationRejection {
  id          String   @id @default(cuid())
  tenderId    String   @map("tender_id")
  rejectedBy  String   @map("rejected_by")
  reason      String
  rejectedAt  DateTime @default(now()) @map("rejected_at")
  tender      Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  rejector    User     @relation(fields: [rejectedBy], references: [id], onDelete: Restrict)
  @@index([tenderId])
  @@map("tender_allocation_rejections")
}
```

Reason is required (enforced at the service layer — the API rejects a blank reason string).
Multiple rejections are allowed (chain of rejected-then-reassigned).

### 4.4 EstimatorCapacity (per-estimator availability)

```prisma
model EstimatorCapacity {
  id               String   @id @default(cuid())
  userId           String   @unique @map("user_id")
  availabilityPct  Int      @default(100) @map("availability_pct")
  concurrentCap    Int      @default(5)  @map("concurrent_cap")
  updatedAt        DateTime @updatedAt   @map("updated_at")
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("estimator_capacity")
}
```

- `availabilityPct`: 0–100, represents how much of full capacity this estimator has this period.
- `concurrentCap`: max number of open tenders before the estimator is considered at capacity.
- Updated by the allocator (or the estimator themselves, subject to a separate permission check).
- The load formula uses both: `effectiveCap = concurrentCap × (availabilityPct / 100)`.

### 4.5 AllocationWeightConfig (admin-configurable load weights)

```prisma
model AllocationWeightConfig {
  id         String   @id @default(cuid())
  dimension  String   @unique
  key        String
  weight     Decimal  @db.Decimal(5, 2)
  label      String
  updatedAt  DateTime @updatedAt @map("updated_at")
  @@index([dimension])
  @@map("allocation_weight_configs")
}
```

Seed rows for `dimension = "urgency"` (keys: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) and
`dimension = "size"` (keys: `XS`, `S`, `M`, `L`, `XL`, matching the value-band edges).
Weights are decimal multipliers. The allocator configures them via the capacity board settings tab.

### 4.6 AllocatorDelegate (temporary delegate with date window)

```prisma
model AllocatorDelegate {
  id          String    @id @default(cuid())
  delegateId  String    @map("delegate_id")
  grantedById String    @map("granted_by_id")
  startDate   DateTime  @map("start_date")
  endDate     DateTime  @map("end_date")
  createdAt   DateTime  @default(now()) @map("created_at")
  delegate    User      @relation("AllocatorDelegateUser",   fields: [delegateId],  references: [id], onDelete: Cascade)
  grantedBy   User      @relation("AllocatorDelegateGrantor", fields: [grantedById], references: [id], onDelete: Restrict)
  @@index([delegateId])
  @@index([endDate])
  @@map("allocator_delegates")
}
```

Active delegate = row where `startDate <= now() <= endDate`. The cron/check-on-read pattern:
when routing an alert, the service queries for active delegates in the same query that resolves
`tenders.allocate` holders. No background job required for deactivation — the filter is temporal.
Audit log entry is written on create/update/delete (reuse the existing audit pattern).

---

## 5. Allocation engine (EW-2)

### 5.1 AllocationService

A new `AllocationService` in `apps/api/src/modules/tendering/allocation.service.ts`:

**Methods:**
- `allocateSingle(tenderId, estimatorId, actorId)` — direct assign; sets `assignedEstimatorId`,
  `allocationState = ALLOCATED`.
- `allocatePool(tenderId, estimatorIds[], actorId)` — inserts `TenderAllocationCandidate` rows,
  runs hybrid resolution (check capacity → auto-assign or leave as POOL).
- `selfClaim(tenderId, estimatorId)` — estimator claims UNALLOCATED or POOL tender; race-guarded;
  sets `assignedEstimatorId`, `allocationState = CLAIMED`; triggers the unallocated-cleared alert.
- `reject(tenderId, estimatorId, reason, actorId)` — requires non-blank reason; sets
  `allocationState = REJECTED`; creates `TenderAllocationRejection`; triggers rejection alert.
- `override(tenderId, newEstimatorId, actorId)` — allocator re-assigns from any state; audit log.
- `transfer(tenderId, newEstimatorId, actorId)` — post-rejection reassign (calls allocateSingle).
- `pushBack(tenderId, actorId)` — post-rejection return to UNALLOCATED; triggers unallocated alert.
- `detectUnallocated()` — returns all tenders with `allocationState = UNALLOCATED` that have been
  in that state for longer than a configurable threshold (config value, not hardcoded).

### 5.2 Capacity resolution

A `CapacityService` in `apps/api/src/modules/tendering/capacity.service.ts`:

- `getEstimatorLoad(estimatorId)` — sum weighted load over all open (non-closed) tenders assigned to
  this estimator.
- `getCapacity(estimatorId)` — reads `EstimatorCapacity` for the user (defaults to 100%, cap 5 if
  no row exists).
- `isOverloaded(estimatorId)` — `load > effectiveCap`.
- `getLeastLoaded(estimatorIds[])` — for hybrid pool resolution; returns the estimator with the
  lowest load/capacity ratio, or null if all are at/over capacity.
- `getAllEstimatorsSummary()` — board-level view: all estimators with `tenders.manage` (or a
  configurable role tag — TBD but not hardcoded), their load, capacity, overload flag.

Weight lookup: reads `AllocationWeightConfig` rows. The urgency dimension maps `dueDate` to a bucket
(`CRITICAL` < 7 days, `HIGH` < 21, `MEDIUM` < 60, `LOW` otherwise; null dueDate = `MEDIUM`).
The size dimension maps `estimatedValue` to a band using `VALUE_BAND_EDGES`.

### 5.3 Permission guard

`tenders.allocate` added to the permission registry (the same list `tendering.controller.ts` draws
from). The `AllocationController` (a new controller at `/tenders/allocations`) guards all write
endpoints with `@RequirePermissions("tenders.allocate")`. Self-claim and reject require only
`tenders.manage` (the estimator's own permission) plus ownership check.

---

## 6. Alerts (EW-3)

Three alert types via `NotificationsService`:

| Alert | Trigger | Recipients |
|---|---|---|
| `UNALLOCATED_TENDER` | `allocationState` transitions to UNALLOCATED (or stays UNALLOCATED past threshold) | All `tenders.allocate` holders + active delegate |
| `TENDER_REJECTED` | `reject()` called | All `tenders.allocate` holders + active delegate |
| `ESTIMATOR_OVERLOADED` | `getEstimatorLoad()` crosses threshold | `tenders.allocate` holders + active delegate + the overloaded estimator |

Anti-fatigue rule: if >3 UNALLOCATED_TENDER alerts would fire in one batch (e.g. a bulk import),
aggregate into a single "N tenders need allocating" notification. Same for ESTIMATOR_OVERLOADED
across the same estimator.

Recipient resolution: `resolveAllocatorRecipients()` helper in the allocation service that:
1. Finds all users with the `tenders.allocate` capability (via the permission registry).
2. Finds all active `AllocatorDelegate` rows where `startDate <= now() <= endDate`.
3. Returns a deduplicated union.

---

## 7. Capacity board API (EW-4)

New endpoints (all on the existing tendering controller or a dedicated allocation controller):

- `GET /tenders/capacity-board` — returns `getAllEstimatorsSummary()` (load, capacity, overload,
  open tender count, suggested next candidate for a new incoming tender).
- `GET /tenders/capacity-board/suggest?tenderId=<id>` — runs `getLeastLoaded()` on all eligible
  estimators and returns the best candidate for this specific tender (considering its value-band and
  urgency weight).
- `GET /tenders/:id/allocation` — allocation history for a single tender (state, candidates,
  rejections).

---

## 8. Capacity board UI + allocation actions (EW-5)

### 8.1 Allocator board (management view)

Route: `/tenders/capacity` (or a tab on the existing tenders list page — exact route TBD in slice).
Components:
- Estimator grid: rows = estimators, columns = load score, capacity, % utilisation, overload badge,
  open tenders count.
- Per-row actions: direct-assign a specific tender, view estimator's open tenders.
- Unallocated panel: list of UNALLOCATED tenders with age (time since created), suggested estimator.
- Override: allocator can drag-reassign or use a dropdown on any tender row.

### 8.2 Estimator self-view

Route: `/tenders` with a "My tenders" filter (reuses existing filter mechanism).
Actions:
- Self-claim: button on unallocated tender card/row, guarded against concurrent claims.
- Reject: modal with required reason text field; cannot submit with blank reason.

### 8.3 Delegate window editor

Route: sub-page or slide-over in the capacity board, accessible only to `tenders.allocate` holders.
Fields: delegate user picker, start date, end date. Shows active and upcoming windows.

---

## 9. Slice order and chain

| Slice | Label | Key outputs | Gated on |
|---|---|---|---|
| EW-1 | S1 — allocation + capacity schema | Migration, 5 new models, regen data-model map | (none — first slice) |
| EW-2 | S2 — allocation engine + API + `tenders.allocate` | `AllocationService`, `CapacityService`, `AllocationController`, permission registered | EW-1: `EstimatorCapacity` model |
| EW-3 | S3 — alerts via NotificationsService | Alert dispatch, recipient resolution, anti-fatigue | EW-2: `AllocationService` |
| EW-4 | S4 — weighted load + capacity-board API + assign-next | Board API endpoints, weight-config read, suggest-next | EW-1 + EW-2 |
| EW-5 | S5 — capacity board UI + allocation actions + delegation config | Board page, estimator view, delegate editor | EW-4: board API |

Chain edges: EW-2 <- EW-1, EW-3 <- EW-2, EW-4 <- EW-1 + EW-2, EW-5 <- EW-4.

---

## 10. Out of scope / boundaries

- **Tender `status`** is not modified by the allocation workflow. `allocationState` is a separate
  field.
- **No per-tender hours estimates.** Value-band (from `estimatedValue`) is the size proxy. T-shirt
  sizing is explicitly deferred.
- **No duplication of the staged tender-reminders worklist** or the staged estimating-analytics
  (historical). This is the forward allocation/capacity engine only.
- **No new notification channel.** Only `NotificationsService`.
- **No hardcoded user or role name.** `tenders.allocate` is the only authority source.
- **No Azure/Entra/SharePoint.** No `/sot/` edits.
- **The plan document itself is docs-only.** No product code in this PR.
