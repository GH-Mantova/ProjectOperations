# B-P0b SLICE 0 — Worker / WorkerProfile Merge Plan (WorkerProfile canonical)

**Decision:** WorkerProfile is canonical. Everything relevant folds into WorkerProfile. Worker is
dropped last. Confirmed by Marco 2026-07-17: RESTART B-P0b.

**SEQUENCING LOCK — READ BEFORE ARMING ANY CODE SLICE:**
Track-code slice 1 (B-P0b S1) is NOT to be armed until B-P0a (Job/Project merge, PR #715) has
fully merged into main. Both workstreams regenerate `docs/data-model/**` and touch shared
infrastructure. Running them concurrently will produce migration-folder conflicts and stale
relationship-map outputs. Arm B-P0b S1 only after B-P0a's final slice is green on main.

---

## 1. Decision Header

| Item | Value |
|---|---|
| Canonical model | `WorkerProfile` (table `worker_profiles`) |
| Model to drop | `Worker` (table `workers`) |
| Decision date | 2026-07-17 (Marco) |
| Trigger | RESTART B-P0b — WorkerProfile is the HR/compliance spine; Worker is the legacy scheduling/field model |
| B-P0a lock | B-P0b code slices blocked until B-P0a fully merged |
| Plan PR | this document |

---

## 2. Full Inventory

### 2a. model Worker (schema line 869)

Fields and relations as they exist in `apps/api/prisma/schema.prisma`:

```
model Worker {
  id                  String                  @id @default(cuid())
  userId              String?                 @unique @map("user_id")
  resourceTypeId      String?                 @map("resource_type_id")
  employeeCode        String?                 @unique @map("employee_code")
  firstName           String                  @map("first_name")
  lastName            String                  @map("last_name")
  email               String?
  phone               String?
  employmentType      String?                 @map("employment_type")
  status              String                  @default("ACTIVE")
  notes               String?
  createdAt           DateTime                @default(now()) @map("created_at")
  updatedAt           DateTime                @updatedAt @map("updated_at")
  user                User?                   @relation(fields: [userId], references: [id], onDelete: SetNull)
  resourceType        ResourceType?           @relation(fields: [resourceTypeId], references: [id], onDelete: SetNull)
  crewMemberships     CrewWorker[]
  competencies        WorkerCompetency[]
  shiftAssignments    ShiftWorkerAssignment[]
  availabilityWindows AvailabilityWindow[]
  roleSuitabilities   WorkerRoleSuitability[]
  formSubmissions     FormSubmission[]
  dockets             Docket[]
  assetCheckouts      AssetCheckout[]         @relation("AssetCheckoutHolderWorker")

  @@index([status])
  @@index([resourceTypeId])
  @@index([lastName, firstName])
  @@map("workers")
}
```

### 2b. model WorkerProfile (schema line 2681)

```
model WorkerProfile {
  id                       String                 @id @default(cuid())
  firstName                String                 @map("first_name")
  lastName                 String                 @map("last_name")
  preferredName            String?                @map("preferred_name")
  role                     String
  phone                    String?
  email                    String?                @unique
  emergencyContactName     String?                @map("emergency_contact_name")
  emergencyContactPhone    String?                @map("emergency_contact_phone")
  licenceNumber            String?                @map("licence_number")
  licenceClass             String?                @map("licence_class")
  ticketNumbers            String?                @map("ticket_numbers")
  hasMobileAccess          Boolean                @default(false) @map("has_mobile_access")
  internalUserId           String?                @unique @map("internal_user_id")
  internalUser             User?                  @relation(fields: [internalUserId], references: [id], onDelete: SetNull)
  isActive                 Boolean                @default(true) @map("is_active")
  locationConsent          Boolean                @default(false) @map("location_consent")
  locationConsentAt        DateTime?              @map("location_consent_at")
  locationConsentRevokedAt DateTime?              @map("location_consent_revoked_at")
  allocations              ProjectAllocation[]
  scheduleAllocations      ScheduleAllocation[]
  preStartChecklists       PreStartChecklist[]
  timesheets               Timesheet[]
  qualifications           WorkerQualification[]
  ganttTasks               GanttTask[]
  locationLogs             WorkerLocationLog[]
  leaves                   WorkerLeave[]
  unavailabilities         WorkerUnavailability[]
  leaveRequests            LeaveRequest[]
  createdAt                DateTime               @default(now()) @map("created_at")
  updatedAt                DateTime               @updatedAt @map("updated_at")

  @@index([isActive])
  @@index([lastName, firstName])
  @@map("worker_profiles")
}
```

### 2c. Everything pointing AT either model

Results of `git grep -nE "workerId|workerProfileId|Worker @relation|WorkerProfile @relation|references:"` filtered to Worker/WorkerProfile-relevant lines:

**Models with FK to Worker (`workerId`):**

| Line | Model | Field | Relation |
|---|---|---|---|
| 917 | `CrewWorker` | `workerId String @map("worker_id")` | `worker Worker @relation(...)` onDelete: Cascade |
| 1010 | `WorkerCompetency` | `workerId String @map("worker_id")` | `worker Worker @relation(...)` onDelete: Cascade |
| 1562 | `ShiftWorkerAssignment` | `workerId String @map("worker_id")` | `worker Worker @relation(...)` onDelete: Cascade |
| 1601 | `AvailabilityWindow` | `workerId String @map("worker_id")` | `worker Worker @relation(...)` onDelete: Cascade |
| 1617 | `WorkerRoleSuitability` | `workerId String @map("worker_id")` | `worker Worker @relation(...)` onDelete: Cascade |
| 1852 | `FormSubmission` | `workerId String? @map("worker_id")` | `worker Worker? @relation(...)` onDelete: SetNull |
| 4374 | `Docket` | `workerId String @map("worker_id")` | `worker Worker @relation(...)` onDelete: **Restrict** |
| 4477 | `LeaveRequest` | `workerId String @map("worker_id")` | `worker WorkerProfile @relation(...)` onDelete: Cascade |
| 980 | `AssetCheckout` | `holderWorkerId String? @map("holder_worker_id")` | `holderWorker Worker? @relation("AssetCheckoutHolderWorker", ...)` onDelete: SetNull |

Note: `LeaveRequest.workerId` already points at `WorkerProfile` despite the column being named `workerId` — this is an existing naming inconsistency in the schema.

**Models with FK to WorkerProfile (`workerProfileId`):**

| Line | Model | Field | Relation |
|---|---|---|---|
| 2724 | `ProjectAllocation` | `workerProfileId String? @map("worker_profile_id")` | `workerProfile WorkerProfile? @relation(...)` onDelete: Cascade |
| 2767 | `ScheduleAllocation` | `workerProfileId String? @map("worker_profile_id")` | `workerProfile WorkerProfile? @relation(...)` onDelete: Cascade |
| 4235 | `WorkerQualification` | `workerProfileId String @map("worker_profile_id")` | `workerProfile WorkerProfile @relation(...)` onDelete: Cascade |
| 4430 | `WorkerLeave` | `workerProfileId String @map("worker_profile_id")` | `workerProfile WorkerProfile @relation(...)` onDelete: Cascade |
| 4453 | `WorkerUnavailability` | `workerProfileId String @map("worker_profile_id")` | `workerProfile WorkerProfile @relation(...)` onDelete: Cascade |
| 4519 | `WorkerLocationLog` | `workerProfileId String @map("worker_profile_id")` | `workerProfile WorkerProfile @relation(...)` onDelete: Cascade |
| 2804 | `CompetencyOverride` | `workerProfileId String @map("worker_profile_id")` | (no named back-relation on WorkerProfile yet) |

### 2d. Code consumers — `apps/` and `packages/`

**API — workers module** (`apps/api/src/modules/workers/`):

| File | Role |
|---|---|
| `workers.service.ts` | CRUD on `WorkerProfile`; `allocationsForWorker`; `provisionMobileAccess` (links `User` via `internalUserId`) |
| `workers.controller.ts` | REST endpoints for WorkerProfile list/get/create/update/delete/provision |
| `availability.service.ts` | Leave/unavailability CRUD keyed on `workerProfileId`; shift-conflict checks; availability calendar |
| `availability.controller.ts` | REST endpoints for leave, unavailability, calendar |
| `leave-request.service.ts` | HR self-service leave requests keyed on `WorkerProfile` |
| `leave-request.controller.ts` | REST endpoints for leave requests |
| `dto/create-worker.dto.ts` | DTO for WorkerProfile creation |
| `dto/update-worker.dto.ts` | DTOs for list/update WorkerProfile |
| `dto/provision-mobile-access.dto.ts` | DTO for mobile provisioning |
| `dto/availability.dto.ts` | DTOs for leave/unavailability |

**API — scheduler module** (`apps/api/src/modules/scheduler/`):

| File | Role |
|---|---|
| `scheduler.service.ts` | Shift CRUD; `assignWorker` / `unassignWorker` via `ShiftWorkerAssignment` (FK to `Worker`) |
| `scheduler.controller.ts` | REST endpoints for shifts and worker assignments |
| `schedule-allocation.service.ts` | Day-grain allocations; eligibility check on `workerProfileId`; `eligibleWorkers` query |
| `schedule-allocation.controller.ts` | REST endpoints for schedule allocations |
| `suggestion.service.ts` | Suggests workers for shift slots (reads `Worker` model) |
| `availability-report.service.ts` | Aggregates schedule cells; conflict detection on `workerProfileId` |
| `dto/scheduler.dto.ts` | `AssignWorkerDto` (uses `workerId` → `Worker`) |
| `dto/schedule-allocation.dto.ts` | `CreateScheduleAllocationDto` (uses `workerProfileId`) |

**API — compliance module** (`apps/api/src/modules/compliance/`):

| File | Role |
|---|---|
| `compliance.service.ts` | `WorkerQualification` CRUD (keyed on `workerProfileId`); `checkWorkerCompetency` (keyed on `WorkerProfile`); `expiringCompetencies` (reads `WorkerCompetency` → `Worker`); `workerCompetencyFlags` (reads `WorkerCompetency` → `Worker`) |
| `compliance.controller.ts` | REST endpoints; `GET workers/:workerId/competency-flags` (uses `Worker.id`); `GET workers/:workerId/competency-check` (uses `WorkerProfile.id` despite param name) |
| `competency-gate.ts` | Pure helper — no direct DB access |

**API — field module** (`apps/api/src/modules/field/`):

| File | Role |
|---|---|
| `field.service.ts` | Resolves `WorkerProfile` via `internalUserId`; timesheets; pre-start checklists; location consent; payroll CSV export |
| `docket.service.ts` | Creates `Docket` records with `workerId` → `Worker` (NOT WorkerProfile) |
| `dto/docket.dto.ts` | `workerId` field in `CreateDocketDto` (uses `Worker.id`) |
| `dto/field.dto.ts` | `WorkerLocationConsentDto`; filter DTOs with optional `workerId` (uses `WorkerProfile.id` in service despite name) |

**API — assets module** (`apps/api/src/modules/assets/`):

| File | Role |
|---|---|
| `assets.service.ts` | `checkoutAsset` — `holderWorkerId` → `Worker` via `AssetCheckout` |
| `dto/assets.dto.ts` | `holderWorkerId?: string` on checkout DTO |

**API — allocations module** (`apps/api/src/modules/allocations/`):

| File | Role |
|---|---|
| `allocations.service.ts` | `ProjectAllocation` CRUD keyed on `workerProfileId`; competency gate; notifications via `workerProfile.internalUserId` |
| `allocations.controller.ts` | REST endpoints |
| `dto/create-allocation.dto.ts` | `workerProfileId` field |

**API — estimate-export module** (`apps/api/src/modules/estimate-export/`):

| File | Role |
|---|---|
| `estimate-export.service.ts` | Reads `User.workerProfile.phone` for PDF quote contact line |

**API — seed files**:

| File | Role |
|---|---|
| `seed.ts` | Seeds `Worker`, `CrewWorker`, `ShiftWorkerAssignment`, `WorkerCompetency`, `AvailabilityWindow` |
| `seed-initial-services.ts` | Seeds both `Worker` and `WorkerProfile`; crews; shift assignments; form submissions with `workerId` |
| `seed-users-prod.ts` | Seeds `WorkerProfile` for prod users |
| `seed-form-templates.ts` | Form field config references `lookupEntity: "Worker"` |

**Web frontend** (`apps/web/src/`):

| File | Role |
|---|---|
| `App.tsx` | Routes for `/workers`, `/workers/:id`, `/workers/leave-approvals` |
| `pages/workers/WorkersListPage.tsx` | List page backed by WorkerProfile API |
| `pages/workers/WorkerDetailPage.tsx` | Detail page for WorkerProfile |
| `pages/workers/WorkerLeaveApprovalsPage.tsx` | Leave approval UI (WorkerProfile) |
| `pages/workers/QualificationsSection.tsx` | Qualifications UI (WorkerProfile) |
| `pages/workers/AvailabilitySection.tsx` | Availability UI (WorkerProfile) |
| `pages/ResourcesPage.tsx` | Legacy `/resources` page reads `Worker` model (competencies, availability windows, role suitabilities) |
| `pages/SchedulerPage.tsx` | Scheduler grid; `WorkerRecord` type; `assignWorker` / `unassignWorker` calls use `Worker.id` (via `ShiftWorkerAssignment`) |
| `components/ShellLayout.tsx` | Nav entry: `/workers` (Workers) and `/resources` (Workers legacy) |
| `components/CommandPalette.tsx` | Entity lookup type `"Worker"` → `/resources?highlight=...` |
| `dashboards/widgets/batch1.helpers.ts` | Dashboard leave/unavailability helpers read `workerProfile.id/firstName/lastName` |
| `dashboards/widgets/availabilityHeatmap.helpers.ts` | Heatmap helper uses `workerId` |

---

## 3. Fold Map

### 3a. Worker field → WorkerProfile destination

| Worker field | WorkerProfile field | Action | Notes |
|---|---|---|---|
| `id` (cuid) | — | **IDs do not merge** — new rows will use `WorkerProfile.id` | All FK consumers re-pointed in code slices |
| `userId` (unique) | `internalUserId` (unique) | Already parallel; Worker.userId ≅ WorkerProfile.internalUserId | Backfill: copy `Worker.userId` to `WorkerProfile.internalUserId` where not already set |
| `resourceTypeId` | — | **ADD** `resourceTypeId String? @map("resource_type_id")` + relation to WorkerProfile | Worker-specific operational field needed for scheduler/ResourcesPage |
| `employeeCode` (unique) | — | **ADD** `employeeCode String? @unique @map("employee_code")` to WorkerProfile | Required for payroll CSV (currently falls back to `WorkerProfile.id`) |
| `firstName` | `firstName` | Already present — no action | |
| `lastName` | `lastName` | Already present — no action | |
| `email` | `email` (unique) | Already present — resolve collision: both have email; unique constraint on WorkerProfile is sufficient | Backfill: if a Worker row has email not on matching WorkerProfile, copy it |
| `phone` | `phone` | Already present — no action | |
| `employmentType` | — | **ADD** `employmentType String? @map("employment_type")` to WorkerProfile | HR field |
| `status` (ACTIVE default) | `isActive` (Boolean, true default) | **Mapping:** `status == "ACTIVE"` ↔ `isActive = true` | No new column needed; backfill logic must translate |
| `notes` | — | **ADD** `notes String?` to WorkerProfile | Operational notes |
| `createdAt` | `createdAt` | Already present — no action | |
| `updatedAt` | `updatedAt` | Already present — no action | |

### 3b. Worker relation → WorkerProfile destination

| Worker relation | Target model | Action |
|---|---|---|
| `user User?` (via `userId`) | `User` | Already mirrored as `internalUser` on WorkerProfile; no new relation needed |
| `resourceType ResourceType?` | `ResourceType` | **ADD** relation to WorkerProfile once `resourceTypeId` field is added (S1) |
| `crewMemberships CrewWorker[]` | `CrewWorker` | Re-point `CrewWorker.workerId` FK → `WorkerProfile` (S5) |
| `competencies WorkerCompetency[]` | `WorkerCompetency` | Re-point `WorkerCompetency.workerId` FK → `WorkerProfile` (S6) — NOTE: WorkerProfile already has `qualifications WorkerQualification[]` which is the newer pattern; `WorkerCompetency` is the older scheduler-facing model |
| `shiftAssignments ShiftWorkerAssignment[]` | `ShiftWorkerAssignment` | Re-point `ShiftWorkerAssignment.workerId` FK → `WorkerProfile` (S3 — scheduler consumer) |
| `availabilityWindows AvailabilityWindow[]` | `AvailabilityWindow` | Re-point `AvailabilityWindow.workerId` FK → `WorkerProfile` (S4) |
| `roleSuitabilities WorkerRoleSuitability[]` | `WorkerRoleSuitability` | Re-point `WorkerRoleSuitability.workerId` FK → `WorkerProfile` (S4) |
| `formSubmissions FormSubmission[]` | `FormSubmission` | Re-point `FormSubmission.workerId` FK → `WorkerProfile` (S7) |
| `dockets Docket[]` | `Docket` | Re-point `Docket.workerId` FK → `WorkerProfile` (S7) — currently Restrict delete, must handle carefully |
| `assetCheckouts AssetCheckout[]` | `AssetCheckout` | Re-point `AssetCheckout.holderWorkerId` FK → `WorkerProfile` (S8) |

### 3c. Worker-only concerns — dropped

| Concern | Reason for drop |
|---|---|
| `Worker.userId` column (DB) | Merged into `WorkerProfile.internalUserId`; column dropped with `Worker` table in final slice |
| `Worker.resourceTypeId` column (DB) | Migrated to `WorkerProfile.resourceTypeId`; dropped with `Worker` table |
| `Worker.status` string enum | Replaced by `WorkerProfile.isActive`; logic is simpler boolean |
| `ResourcesPage.tsx` `Worker`-model API calls | Replaced by WorkerProfile API endpoints; legacy `/resources` route retired or redirected to `/workers` |
| `CommandPalette.tsx` `lookupEntity: "Worker"` | Replaced by `"WorkerProfile"` lookup after web re-point |

---

## 4. Ordered Slices

Each slice produces a migration, a data-model map regen (`node scripts/data-model/build-relationship-map.mjs`), and a PR. `escalates: true` means the slice writes or destroys prod data.

---

### S1 — Additive: add missing fields/relations to WorkerProfile

**Purpose:** Widen WorkerProfile to carry everything Worker has, before any data is moved.
No data migration. No FK changes. Purely additive.

**Files touched (≤10):**

1. `apps/api/prisma/schema.prisma` — add to `model WorkerProfile`:
   - `resourceTypeId String? @map("resource_type_id")`
   - `resourceType ResourceType? @relation(fields: [resourceTypeId], references: [id], onDelete: SetNull)`
   - `employeeCode String? @unique @map("employee_code")`
   - `employmentType String? @map("employment_type")`
   - `notes String?`
2. `apps/api/prisma/migrations/<timestamp>_wp_additive_fields/migration.sql` — additive `ALTER TABLE worker_profiles ADD COLUMN` statements (all nullable/defaulted, safe on prod)
3. `scripts/data-model/build-relationship-map.mjs` — run; commit updated `docs/data-model/**`
4. `docs/data-model/**` — regen output (committed in-PR)

**Migration sketch:**
```sql
ALTER TABLE worker_profiles ADD COLUMN resource_type_id TEXT REFERENCES resource_types(id) ON DELETE SET NULL;
ALTER TABLE worker_profiles ADD COLUMN employee_code TEXT UNIQUE;
ALTER TABLE worker_profiles ADD COLUMN employment_type TEXT;
ALTER TABLE worker_profiles ADD COLUMN notes TEXT;
CREATE INDEX worker_profiles_resource_type_id_idx ON worker_profiles(resource_type_id);
```

**Rollback:** `ALTER TABLE worker_profiles DROP COLUMN resource_type_id, employee_code, employment_type, notes;`

**Regen data-model map in-PR:** yes.

**`GATE-ALLOW: migrations`** required in PR body.

`escalates: false` — additive columns only, no data touched.

---

### S2 — Backfill: copy data from Worker rows → WorkerProfile

**Purpose:** For every `Worker` row that has a matching `WorkerProfile` (matched on `userId`/`internalUserId` or on `email`), copy the fields that are absent on WorkerProfile. Creates new WorkerProfile rows for any Worker with no matching profile.

**Files touched (≤10):**

1. `apps/api/prisma/migrations/<timestamp>_wp_backfill/migration.sql` — data migration SQL (see below)
2. `scripts/data-model/build-relationship-map.mjs` — run; commit updated `docs/data-model/**`
3. `docs/data-model/**` — regen output

**Migration sketch:**
```sql
-- 1. Copy employeeCode from Worker where WorkerProfile.employeeCode is null
UPDATE worker_profiles wp
SET employee_code = w.employee_code
FROM workers w
WHERE w.user_id = wp.internal_user_id
  AND wp.employee_code IS NULL
  AND w.employee_code IS NOT NULL;

-- 2. Copy employmentType
UPDATE worker_profiles wp
SET employment_type = w.employment_type
FROM workers w
WHERE w.user_id = wp.internal_user_id
  AND wp.employment_type IS NULL;

-- 3. Copy resourceTypeId
UPDATE worker_profiles wp
SET resource_type_id = w.resource_type_id
FROM workers w
WHERE w.user_id = wp.internal_user_id
  AND wp.resource_type_id IS NULL;

-- 4. Copy notes
UPDATE worker_profiles wp
SET notes = w.notes
FROM workers w
WHERE w.user_id = wp.internal_user_id
  AND wp.notes IS NULL
  AND w.notes IS NOT NULL;

-- 5. Insert WorkerProfile rows for Worker rows with no matching profile
INSERT INTO worker_profiles (
  id, first_name, last_name, role, phone, email,
  employee_code, employment_type, resource_type_id, notes,
  internal_user_id, is_active, created_at, updated_at
)
SELECT
  gen_random_uuid(), -- or cuid equivalent
  w.first_name, w.last_name,
  'FIELD_WORKER',  -- default role for workers with no profile
  w.phone, w.email,
  w.employee_code, w.employment_type, w.resource_type_id, w.notes,
  w.user_id,
  CASE WHEN w.status = 'ACTIVE' THEN TRUE ELSE FALSE END,
  w.created_at, w.updated_at
FROM workers w
WHERE NOT EXISTS (
  SELECT 1 FROM worker_profiles wp
  WHERE wp.internal_user_id = w.user_id
     OR (wp.email = w.email AND w.email IS NOT NULL)
);
```

**Rollback:** The migration cannot trivially be reversed once data is written. The reversibility strategy is to restore from a pre-migration backup. Mark as irreversible — requires a prod backup window.

**Regen data-model map in-PR:** yes.

`escalates: true` — writes prod rows.

**Review requirement:** Marco reviews the SQL and confirms no Worker rows will be orphaned.

---

### S3 — Re-point ShiftWorkerAssignment → WorkerProfile

**Purpose:** `ShiftWorkerAssignment.workerId` currently points at `Worker`. Re-point it to `WorkerProfile`. This changes the scheduler shift-assignment flow.

**Files touched (≤10):**

1. `apps/api/prisma/schema.prisma` — change `ShiftWorkerAssignment.worker Worker @relation` to `worker WorkerProfile @relation`; rename column backing field from `worker_id` to `worker_profile_id` (or keep column name, change model target)
2. `apps/api/prisma/migrations/<timestamp>_shift_assignment_repoint/migration.sql`
3. `apps/api/src/modules/scheduler/scheduler.service.ts` — update `assignWorker`/`unassignWorker` to use `WorkerProfile.id`
4. `apps/api/src/modules/scheduler/dto/scheduler.dto.ts` — rename `AssignWorkerDto.workerId` to `workerProfileId`
5. `apps/api/src/modules/scheduler/scheduler.controller.ts` — update param/route for unassign
6. `apps/api/src/modules/scheduler/__tests__/scheduler.service.spec.ts` — update test fixtures
7. `apps/web/src/pages/SchedulerPage.tsx` — update `assignment.workerId` field references to `workerProfileId`; update `WorkerRecord` type to use WorkerProfile fields
8. `scripts/data-model/build-relationship-map.mjs` — run; commit `docs/data-model/**`
9. `docs/data-model/**` — regen output

**Migration sketch:**
```sql
-- Copy Worker.id → WorkerProfile.id mapping via shared user_id
ALTER TABLE shift_worker_assignments ADD COLUMN worker_profile_id TEXT;

UPDATE shift_worker_assignments swa
SET worker_profile_id = wp.id
FROM workers w
JOIN worker_profiles wp ON wp.internal_user_id = w.user_id
WHERE swa.worker_id = w.id;

-- Drop rows where mapping was impossible (orphaned Worker assignments)
DELETE FROM shift_worker_assignments WHERE worker_profile_id IS NULL;

ALTER TABLE shift_worker_assignments ALTER COLUMN worker_profile_id SET NOT NULL;
ALTER TABLE shift_worker_assignments DROP COLUMN worker_id;
ALTER TABLE shift_worker_assignments RENAME COLUMN worker_profile_id TO worker_id;
-- (or use a new column name — final column name to be confirmed in review)
```

**Rollback:** Restore from backup (FK re-point on populated table is irreversible without backup).

**Regen data-model map in-PR:** yes.

`escalates: true` — FK re-point on populated prod table.

---

### S4 — Re-point AvailabilityWindow + WorkerRoleSuitability → WorkerProfile

**Purpose:** Both models currently point at `Worker`. After S2 backfill, re-point their FKs.

**Files touched (≤10):**

1. `apps/api/prisma/schema.prisma` — update `AvailabilityWindow.worker` and `WorkerRoleSuitability.worker` relations to point at `WorkerProfile`
2. `apps/api/prisma/migrations/<timestamp>_avail_rolesuit_repoint/migration.sql`
3. `apps/api/src/modules/workers/availability.service.ts` — currently uses `workerProfileId`; verify service already operates on WorkerProfile (it does for leave/unavailability, but `AvailabilityWindow` is older — review `conflictsForShift`)
4. `apps/api/src/modules/workers/dto/availability.dto.ts` — update any remaining `workerId` references to `workerProfileId`
5. `apps/api/src/modules/workers/__tests__/availability.service.spec.ts` — update fixtures
6. `apps/web/src/pages/ResourcesPage.tsx` — availability windows section already reads from WorkerProfile-backed API; verify no direct `workerId` sends
7. `scripts/data-model/build-relationship-map.mjs` — run; commit `docs/data-model/**`
8. `docs/data-model/**` — regen output

**Migration sketch:** Same pattern as S3 — add new FK column, backfill via `Worker.user_id → WorkerProfile.internal_user_id`, drop old column.

**Rollback:** Restore from backup.

`escalates: true` — FK re-point on populated prod tables.

---

### S5 — Re-point CrewWorker → WorkerProfile

**Purpose:** `CrewWorker.workerId` currently points at `Worker`. Re-point to `WorkerProfile`.

**Files touched (≤10):**

1. `apps/api/prisma/schema.prisma` — update `CrewWorker.worker` relation
2. `apps/api/prisma/migrations/<timestamp>_crew_worker_repoint/migration.sql`
3. Any service/controller that creates/reads `CrewWorker` rows — search for `prisma.crewWorker` in codebase; update `workerId` parameter to use `WorkerProfile.id`
4. Web pages rendering crew membership (if any — currently shown on ResourcesPage)
5. `apps/web/src/pages/ResourcesPage.tsx` — crew display section
6. `scripts/data-model/build-relationship-map.mjs` — run; commit `docs/data-model/**`
7. `docs/data-model/**` — regen output

**Migration sketch:** Same FK-swap pattern — add `worker_profile_id`, backfill, drop `worker_id`.

**Rollback:** Restore from backup.

`escalates: true` — FK re-point on populated prod table.

---

### S6 — Re-point WorkerCompetency → WorkerProfile

**Purpose:** `WorkerCompetency.workerId` → `WorkerProfile`. This affects `compliance.service.ts` which currently calls `expiringCompetencies` and `workerCompetencyFlags` using `Worker.id`. These must be re-keyed to `WorkerProfile.id`.

**Files touched (≤10):**

1. `apps/api/prisma/schema.prisma` — update `WorkerCompetency.worker` relation
2. `apps/api/prisma/migrations/<timestamp>_worker_competency_repoint/migration.sql`
3. `apps/api/src/modules/compliance/compliance.service.ts` — update `expiringCompetencies` (currently includes `worker` relation); update `workerCompetencyFlags`; rename param `workerId` → `workerProfileId`
4. `apps/api/src/modules/compliance/compliance.controller.ts` — update route param names (`workers/:workerId/competency-flags` → `workers/:workerProfileId/competency-flags`)
5. `apps/api/src/modules/compliance/__tests__/compliance-competency.service.spec.ts` — update fixtures
6. `apps/api/src/modules/compliance/__tests__/compliance.service.spec.ts` — update fixtures
7. `scripts/data-model/build-relationship-map.mjs` — run; commit `docs/data-model/**`
8. `docs/data-model/**` — regen output

**Migration sketch:** Same FK-swap pattern.

**Rollback:** Restore from backup.

`escalates: true` — FK re-point.

---

### S7 — Re-point FormSubmission + Docket → WorkerProfile

**Purpose:** `FormSubmission.workerId` and `Docket.workerId` both point at `Worker`.
`Docket.worker` is `onDelete: Restrict` — this is the most constrained FK; requires extra care (all docket rows must have a valid matching WorkerProfile before the old FK is dropped).

**Files touched (≤10):**

1. `apps/api/prisma/schema.prisma` — update `FormSubmission.worker` and `Docket.worker` relations
2. `apps/api/prisma/migrations/<timestamp>_form_docket_repoint/migration.sql`
3. `apps/api/src/modules/field/docket.service.ts` — update `workerId` lookup from `Worker` to `WorkerProfile`
4. `apps/api/src/modules/field/dto/docket.dto.ts` — update `workerId` description/type
5. `apps/api/src/modules/field/field.controller.ts` — update any filter param descriptions
6. `apps/api/src/modules/field/field.service.ts` — `query.workerId` filter already maps to `workerProfileId` in timesheets; verify docket path
7. Seed files that create `FormSubmission` with `workerId` — update to use `WorkerProfile.id`
8. `scripts/data-model/build-relationship-map.mjs` — run; commit `docs/data-model/**`
9. `docs/data-model/**` — regen output

**Migration sketch:**
```sql
-- FormSubmission
ALTER TABLE form_submissions ADD COLUMN worker_profile_id TEXT;
UPDATE form_submissions fs
SET worker_profile_id = wp.id
FROM workers w
JOIN worker_profiles wp ON wp.internal_user_id = w.user_id
WHERE fs.worker_id = w.id;
-- nullify unmatched (nullable FK)
ALTER TABLE form_submissions DROP COLUMN worker_id;
ALTER TABLE form_submissions RENAME COLUMN worker_profile_id TO worker_id;

-- Docket (Restrict — must confirm all rows have match before drop)
ALTER TABLE dockets ADD COLUMN worker_profile_id TEXT;
UPDATE dockets d
SET worker_profile_id = wp.id
FROM workers w
JOIN worker_profiles wp ON wp.internal_user_id = w.user_id
WHERE d.worker_id = w.id;
-- Verify no NULLs before dropping old FK
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM dockets WHERE worker_profile_id IS NULL) THEN
    RAISE EXCEPTION 'Unmapped docket rows exist — backfill S2 must be complete';
  END IF;
END $$;
ALTER TABLE dockets ALTER COLUMN worker_profile_id SET NOT NULL;
ALTER TABLE dockets DROP COLUMN worker_id;
ALTER TABLE dockets RENAME COLUMN worker_profile_id TO worker_id;
```

**Rollback:** Restore from backup. Docket's Restrict constraint means a clean rollback requires a point-in-time restore.

`escalates: true` — FK re-point on prod data; Docket Restrict requires explicit verification gate.

---

### S8 — Re-point AssetCheckout.holderWorkerId → WorkerProfile

**Purpose:** `AssetCheckout.holderWorkerId` → `WorkerProfile.id`. Updates asset checkout flow.

**Files touched (≤10):**

1. `apps/api/prisma/schema.prisma` — update `AssetCheckout.holderWorker` relation
2. `apps/api/prisma/migrations/<timestamp>_asset_checkout_repoint/migration.sql`
3. `apps/api/src/modules/assets/assets.service.ts` — `holderWorkerId` lookup; `include: { holderWorker: ... }` select
4. `apps/api/src/modules/assets/dto/assets.dto.ts` — `holderWorkerId` description updated to clarify it is now a WorkerProfile ID
5. `apps/api/src/modules/assets/assets.controller.ts` — doc string update
6. `apps/api/src/modules/assets/assets.service.spec.ts` — fixture update
7. `scripts/data-model/build-relationship-map.mjs` — run; commit `docs/data-model/**`
8. `docs/data-model/**` — regen output

**Migration sketch:** Same FK-swap pattern.

**Rollback:** Restore from backup.

`escalates: true` — FK re-point.

---

### S9 — Retire ResourcesPage + CommandPalette Worker entity

**Purpose:** Replace the legacy `/resources` page (backed by `Worker`) with a redirect to `/workers` (backed by `WorkerProfile`). Update `CommandPalette` entity type. No schema change.

**Files touched (≤10):**

1. `apps/web/src/pages/ResourcesPage.tsx` — replace Worker API calls with WorkerProfile API calls (or redirect to `/workers`)
2. `apps/web/src/App.tsx` — update `/resources` route
3. `apps/web/src/components/ShellLayout.tsx` — remove `"/resources": "Workers (legacy)"` nav entry or redirect
4. `apps/web/src/components/CommandPalette.tsx` — update `"Worker"` entity to `"WorkerProfile"` and update route resolver
5. `apps/web/src/pages/MasterDataPage.tsx` — update `recordKind: "Worker"` reference
6. `scripts/data-model/build-relationship-map.mjs` — run; commit `docs/data-model/**`
7. `docs/data-model/**` — regen output

`escalates: false` — web-only change.

---

### S10 — Re-point seed files + form-template lookupEntity

**Purpose:** Update all seed files to use `WorkerProfile.id` where they currently use `Worker.id`; update form-template `lookupEntity: "Worker"` to `"WorkerProfile"`.

**Files touched (≤10):**

1. `apps/api/prisma/seed.ts` — update `ShiftWorkerAssignment`, `CrewWorker`, `AvailabilityWindow`, `WorkerCompetency` seed calls to use WorkerProfile IDs
2. `apps/api/prisma/seed-initial-services.ts` — same; update `formSubmission.workerId` seed references
3. `apps/api/prisma/seed-form-templates.ts` — change `lookupEntity: "Worker"` to `"WorkerProfile"`
4. `apps/api/prisma/seed-reference.ts` — verify alert references are WorkerProfile-based (they currently reference `entityType: "Worker"` in AuditLog — update to `"WorkerProfile"`)
5. `scripts/data-model/build-relationship-map.mjs` — run; commit `docs/data-model/**`
6. `docs/data-model/**` — regen output

`escalates: false` — seed-only; no prod data change.

---

### S11 (FINAL) — Drop model Worker

**Purpose:** Drop the `workers` table and the `Worker` model. Remove all remaining references to `Worker` type from TypeScript code.

**Precondition:** All previous slices (S1–S10) are merged and green. No FK in the schema points at `workers` table. Zero references to `prisma.worker` in source code.

**Files touched (≤10):**

1. `apps/api/prisma/schema.prisma` — delete `model Worker { ... }`; delete `model CrewWorker` Worker relation remnants if any; delete `model WorkerCompetency` Worker relation remnants if any; etc.
2. `apps/api/prisma/migrations/<timestamp>_drop_workers/migration.sql`
3. `apps/api/src/app.module.ts` — if `WorkersModule` (which manages WorkerProfile) has any remaining Worker import, clean it
4. Any remaining `Worker` type imports in services/controllers (should be zero at this point — verify with grep)
5. `scripts/data-model/build-relationship-map.mjs` — run; commit `docs/data-model/**`
6. `docs/data-model/**` — regen output

**Migration sketch:**
```sql
DROP TABLE workers CASCADE;
-- CASCADE will only proceed if no FK still references workers — serves as a
-- final safety check. If it errors, a FK was missed in a prior slice.
```

**Rollback:** There is no rollback from a table drop without a point-in-time backup. This slice requires:
1. A verified prod backup immediately before running.
2. Marco's explicit sign-off after confirming zero active FK references.

`escalates: true` — destructive drop of a prod table.

---

## 5. Risks

### R1 — Production data (spine change)

Worker and WorkerProfile are both live prod tables with active rows. Slices S2–S8 and S11 all
write or destroy prod data. Each must be preceded by a verified point-in-time backup.
The S2 backfill is the riskiest single step — it inserts new WorkerProfile rows for every
unmatched Worker row. Marco must validate the mapping SQL against a prod data snapshot before S2
runs in prod.

### R2 — Scheduler consumer (ShiftWorkerAssignment)

The scheduler currently identifies workers by `Worker.id`. S3 re-keys to `WorkerProfile.id`.
Active shifts in the scheduler UI will show a brief inconsistency window between S3 migration
running and the web frontend being redeployed. Deploy API and web atomically in S3.
The scheduler suggestion service (`suggestion.service.ts`) also reads `Worker` — must be updated
in S3 to complete the scheduler re-point.

### R3 — Docket Restrict FK

`Docket.worker` is `onDelete: Restrict`. This means S7 cannot proceed if any Docket row cannot be
mapped to a WorkerProfile row. The migration SQL includes a guard assertion. If any unmapped rows
exist, the S2 backfill must be fixed before S7 runs.

### R4 — WorkerCompetency vs WorkerQualification

Two competency models exist: `WorkerCompetency` (older, linked to `Worker`, used by scheduler for
expiry digests) and `WorkerQualification` (newer, linked to `WorkerProfile`, used by compliance and
allocation gate). They serve overlapping but distinct purposes. S6 re-points `WorkerCompetency` to
`WorkerProfile`, but does NOT merge these two models. A future slice (post B-P0b) may consolidate
them. Do not conflate them in S6.

### R5 — FK cycles and migration ordering

The ordering S1 → S2 → S3 → ... → S11 is strict. S2 (backfill) must complete before any FK
re-point slice (S3–S8) because the re-point migrations join on `Worker.user_id = WorkerProfile.internal_user_id`.
If S3 is run before S2, unmapped rows will be silently nulled or the migration will fail.

### R6 — B-P0a sequencing

B-P0a (Job/Project merge) and B-P0b (Worker/WorkerProfile merge) both regenerate `docs/data-model/**`
and produce Prisma migrations. If both are in-flight simultaneously, migration folder timestamps
will conflict on merge. **B-P0b code slices must not be armed until B-P0a is fully on main.**

### R7 — sot/ reconcile

`sot/02` (data model) and `sot/04` (roadmap) will need updating to reflect WorkerProfile canonical
status and the retirement of the `Worker` model. This is flagged for station 05 (sot-keeper).
Do NOT edit `sot/` in this PR or in any B-P0b code slice PR. The sot-keeper station runs after
the final slice merges.

### R8 — LeaveRequest.workerId naming inconsistency

`LeaveRequest` already has `workerId String @map("worker_id")` that points at `WorkerProfile` (not
`Worker`). This is an existing schema naming inconsistency. It does NOT need to change in B-P0b —
the column already points at the right model. Document this to avoid confusion during review.

---

*Flag for 05-sot-keeper:* After B-P0b S11 merges, update `sot/02-data-model.md` to mark Worker
retired and WorkerProfile as the canonical field/scheduler/HR record. Update `sot/04-roadmap.md`
to close the B-P0b milestone. Do NOT edit sot/ in this PR.
