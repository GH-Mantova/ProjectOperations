# Resource Allocator → ProjectOperations ERP — Gap Analysis & Data Model Design

**Author:** Cowork analysis session (for Marco)
**Date:** 2026-06-29 (rev. 2 — decisions resolved with Marco)
**Status:** Decision-support input for the 🏗️ MAIN development chat. Architectural
decisions below are now **resolved** with Marco; PR prompts still belong in MAIN.

**Inputs reviewed:**
- `Resource_Allocator_System_Spec.md` (Colin's Scheduler, full spec)
- `Resource_Allocator.html` (the app — CSS/markup/logic)
- Live ERP `apps/api/prisma/schema.prisma` (3,813 lines)
- `roadmap.md`, `project_instructions.md` (current ERP state)
- Marco's product direction (Assignar / ServiceM8 model — see §6)

---

## 1. The headline (read this first)

**The ERP is not missing a scheduler. It has three overlapping ones already**, split
across two duplicated entities. The work here is *consolidation + one new UX*, not a
port.

Live in `main` today:

- `ProjectAllocation` — joins a **WorkerProfile** *or* an **Asset** to a **Project**
  over a **date range**, with a single `roleOnProject` string, plus a
  competency/qualification gate (`CompetencyOverride`, `Project.requiredQualifications`).
- `Shift` cluster — timestamped shifts with `ShiftWorkerAssignment` (uses the
  **Worker** model), `ShiftAssetAssignment`, `ShiftRoleRequirement`
  (`roleLabel` + `competencyId` + `requiredCount`), and `SchedulingConflict`.
- `GanttTask` — per-project timeline bars.

Plus the supporting cast the Allocator lacks entirely: `Crew`/`CrewWorker`,
`Competency`/`WorkerCompetency` (with expiry), `WorkerRoleSuitability`,
`AvailabilityWindow`, `WorkerLeave`, `WorkerUnavailability`, `WorkerQualification`,
and an `Asset` register.

The Allocator's *unique* value is a small set of design ideas (§2). The rest is
already live or already on the roadmap. Two traps to avoid: rebuilding what exists,
and adding a **fourth** allocation model on top of the three we have (plus the two
worker models already flagged as tech debt).

---

## 2. What the Allocator genuinely does better

1. **The dense day grid** — resources × days of the month, click/drag cells, two
   orientations (by job / by resource). This is the deferred roadmap item
   *"Scheduler weekly grid view"*; the Allocator proves the monthly version on real
   IS data.
2. **Per-day role capture** — what a worker did *that day*, which a single
   range-wide `roleOnProject` can't express.
3. **The availability heatmap** — unique-by-name, green→amber→red, archived excluded.
4. ~~Subcontractors as a numeric daily quantity~~ — **parked** (Marco will handle
   subcontractor resourcing through a separate, more complex mechanism; out of scope
   for the scheduler).

Everything else the Allocator does, the ERP already does as well or better.

---

## 3. Feature-by-feature gap analysis

Legend: ✅ ERP already has it · 🟡 Partial / different shape · 🔴 Genuine gap

| Allocator feature | ERP today | Status | Recommendation |
|---|---|---|---|
| Allocate people to jobs by day | `ProjectAllocation` (range) + `Shift` (timestamp) | 🟡 | Move to **day-grain** allocation (§5) |
| Allocate plant/equipment units | `ProjectAllocation` (Asset) + `ShiftAssetAssignment` + `Asset` | ✅ | Reuse `Asset`; surface in the grid |
| Role(s) performed that day | `roleOnProject` (one string, whole range) | 🔴 | Per-day `jobRoleId` on the allocation (§5) |
| Job roles defined by required tickets | `ShiftRoleRequirement` (shift-scoped, free string) | 🟡 | Promote to a reusable **Job Roles** module (§5/§6) |
| "Only show workers who fit" | competency gate exists (`CompetencyOverride`) | 🟡 | Eligibility filter on the picker + "show all" override (§6) |
| Dense month grid (cells) | none | 🔴 | Build as Scheduler grid view |
| By-job / by-resource toggle | partial via queries | 🟡 | Free once the grid reads a normalised table |
| Double-book conflict flags | `SchedulingConflict` (shift-scoped) | 🟡 | Extend to the day grid (compute on read) |
| Availability / leave / quals | `AvailabilityWindow`, `WorkerLeave`, `WorkerUnavailability`, `WorkerCompetency`, `WorkerQualification` | ✅ | Reuse — scheduler **refers**, never copies |
| Crews / teams | `Crew`/`CrewWorker` | ✅ | ERP ahead — Allocator has none |
| Skills/cert expiry | `WorkerCompetency.expiresAt`, compliance cron | ✅ | Already done |
| Availability heatmap report | raw data exists, no report | 🔴 | Build from existing data |
| Gantt / Program overview | `GanttTask` + Schedule tab | ✅ | Already done |
| Client's Program / stages | `Project.plannedStart/End`, `JobStage`, `ProjectMilestone` | ✅ | Already done |
| Subcontractor daily quantity | none | ⏸️ | **Parked** — handled separately (Marco) |
| Public holidays (QLD) | none found | 🔴(minor) | Small data-driven `PublicHoliday` lookup |
| Auth / RBAC / audit / realtime | JWT+SSO, AuditLog, WebSockets planned | ✅ | ERP vastly ahead |

---

## 4. Recommended priorities

**P0 — Structural cleanup (prerequisite, no grid code until done).**
Two consolidations that gate everything else:
- **Merge `Job` + `Project`** into one delivery entity (§6.2).
- **Make `WorkerProfile` canonical**, fold `Worker` into it (§6.3).
Bundle with the already-deferred *Worker/WorkerProfile consolidation* tech-debt item.

**P1 — Job Roles module.** A named, reusable role catalogue, each role defining its
required competencies (§6.4). Promotes the existing `ShiftRoleRequirement` primitive.

**P2 — Day-grain allocation + Scheduler grid view.** The headline feature: one
normalised `ScheduleAllocation` table feeding a month/week grid (by-job + by-resource),
click/drag, reusing `Asset` and `WorkerProfile`. Two entry points, one backend (§6.6).

**P3 — Eligibility filtering + conflict flags + availability heatmap.** "Fit the bill"
picker with "show all available" override; double-book amber/red; unique-by-name heatmap.

**P4 — Minor.** `PublicHoliday` lookup; optional grid CSV export.

**Parked / later.** Subcontractor numeric resourcing (Marco, separate mechanism);
cost-actuals from allocations × rates; auto-levelling.

---

## 5. Data model design (resolved)

Design goals: **one normalised day-grain table** (kills the Allocator's polymorphic
bool/array/number value), **reuse existing models**, **scheduler refers — never
copies** worker capabilities, and **no fourth parallel system** (this becomes *the*
fine-grained allocation; `Shift` stays for timestamped shifts, `GanttTask` for the
timeline).

### 5.1 Job Roles — a role catalogue that bundles required competencies

A **Job Role** is a named job *function* (Supervisor, Machine Operator, Demolition
Labourer, Asbestos Labourer), defined once and reused. It does **not** replace
`Competency` — it *references* competencies as its requirements. This is the layer
that powers "only show workers who fit the bill."

```prisma
model JobRole {                       // the new "Job Roles" admin module
  id           String   @id @default(cuid())
  name         String   @unique       // Supervisor, Machine Operator, Asbestos Labourer…
  description  String?
  colour       String?
  isActive     Boolean  @default(true) @map("is_active")
  sortOrder    Int      @default(0) @map("sort_order")
  requirements JobRoleRequirement[]
  allocations  ScheduleAllocation[]
  demands      JobRoleDemand[]
  @@map("job_roles")
}

model JobRoleRequirement {            // what to ask a worker to provide for this role
  id                 String     @id @default(cuid())
  jobRoleId          String     @map("job_role_id")
  competencyId       String     @map("competency_id")
  isMandatory        Boolean    @default(true) @map("is_mandatory")
  minMonthsExperience Int?      @map("min_months_experience")
  notes              String?
  jobRole            JobRole    @relation(fields: [jobRoleId], references: [id], onDelete: Cascade)
  competency         Competency @relation(fields: [competencyId], references: [id], onDelete: Restrict)
  @@unique([jobRoleId, competencyId])
  @@map("job_role_requirements")
}
```

`Competency` (existing) stays the atomic ticket/skill; `WorkerCompetency` (existing,
with `expiresAt`) stays the worker's held capability. The three scattered free-string
role fields (`ProjectAllocation.roleOnProject`, `ShiftWorkerAssignment.roleLabel`,
`WorkerRoleSuitability.roleLabel`) all collapse into references to `JobRole`.

### 5.2 Optional: per-job role demand

Lets a job declare "needs 1 Supervisor + 2 Operators + 3 Demolition Labourers" so the
grid can show fill progress.

```prisma
model JobRoleDemand {
  id            String  @id @default(cuid())
  jobId         String  @map("job_id")
  jobRoleId     String  @map("job_role_id")
  requiredCount Int     @default(1) @map("required_count")
  // job → the merged delivery entity (§6.2)
  jobRole       JobRole @relation(fields: [jobRoleId], references: [id], onDelete: Cascade)
  @@unique([jobId, jobRoleId])
  @@map("job_role_demands")
}
```

### 5.3 The core: day-grain allocation (the shared backend)

```prisma
enum ScheduleTargetType {
  WORKER
  ASSET
}

model ScheduleAllocation {
  id              String             @id @default(cuid())
  date            DateTime           @db.Date          // ONE day, not a range
  jobId           String             @map("job_id")     // the merged delivery entity (§6.2)

  targetType      ScheduleTargetType @map("target_type")
  workerProfileId String?            @map("worker_profile_id")
  workerProfile   WorkerProfile?     @relation(fields: [workerProfileId], references: [id], onDelete: Cascade)
  assetId         String?            @map("asset_id")
  asset           Asset?             @relation(fields: [assetId], references: [id], onDelete: Cascade)

  jobRoleId       String?            @map("job_role_id") // role filled that day (workers)
  jobRole         JobRole?           @relation(fields: [jobRoleId], references: [id], onDelete: SetNull)
  note            String?

  createdById     String             @map("created_by_id")
  createdBy       User               @relation(fields: [createdById], references: [id], onDelete: Restrict)
  createdAt       DateTime           @default(now()) @map("created_at")
  updatedAt       DateTime           @updatedAt @map("updated_at")

  // default rule: one role per worker per job per day; multi-role = second row
  @@unique([date, jobId, workerProfileId, jobRoleId])
  @@unique([date, jobId, assetId])
  @@index([date])
  @@index([jobId, date])
  @@index([workerProfileId, date])   // fast double-book / eligibility checks
  @@index([assetId, date])
  @@map("schedule_allocations")
}
```

Day-grain (one row per person/asset per job per day) is required because the grid
edits individual cells; range rows would force constant split/merge logic and can't
hold per-day roles. The existing range-based `ProjectAllocation` becomes a **derived**
"assignment period" (collapse contiguous days) so timesheets / pre-starts / the
competency gate keep working — see §6.1.

### 5.4 Eligibility is computed, not stored

"Does this worker fit this role on this day?" is a query, never denormalised onto the
allocation (copying compliance data is how it goes stale):

> worker holds every **mandatory** `JobRoleRequirement.competencyId` for the role,
> each `WorkerCompetency` **not expired on `date`**, AND the worker is available
> (no `WorkerLeave` / `WorkerUnavailability`, within `AvailabilityWindow`), AND not
> already booked elsewhere that day.

Hard gate (expired mandatory ticket) sits behind the existing `CompetencyOverride`
+ reason; soft conflict (double-book) is an amber warning. See §6.5.

### 5.5 Public holidays (replaces the hardcoded QLD map)

```prisma
model PublicHoliday {
  id     String   @id @default(cuid())
  date   DateTime @db.Date
  name   String
  region String   @default("QLD")
  @@unique([date, region])
  @@index([region, date])
  @@map("public_holidays")
}
```

---

## 6. Resolved decisions

**6.1 — Day-grain vs range allocation → DAY-GRAIN canonical.**
`ScheduleAllocation` (day rows) is the source of truth. `ProjectAllocation` (range)
is kept only as a *derived* assignment-period view for the timesheet / pre-start /
competency-gate plumbing already wired to it. Accepts a one-off migration; avoids a
second drifting store.

**6.2 — `Job` vs `Project` → MERGE.**
They're two representations of one real thing: the awarded job the estimating team
creates on tender award and operations then delivers. `Job` owns the work breakdown
(stages → activities → shifts); `Project` owns the commercial + safety + allocation +
Gantt side. Converge on one delivery entity carrying both. Significant migration,
MAIN-chat decision — trace the `/jobs` and `/projects` services first to confirm
which is the more-used spine before choosing the survivor.

**6.3 — `Worker` vs `WorkerProfile` → WORKERPROFILE canonical.**
Worker capabilities, qualifications, leave and availability live on `WorkerProfile`;
the scheduler **refers** to them, never copies (the TSheets / Xero / compliance
pattern). Fold the scheduler-side `Worker` wiring (`Crew`, `AvailabilityWindow`,
`WorkerCompetency`, `WorkerRoleSuitability`, `ShiftWorkerAssignment`) onto
`WorkerProfile`. This is the already-deferred consolidation; do it before the grid.

**6.4 — Roles vs competencies → DISTINCT, role bundles competencies.**
Not merged. `Competency` = atomic ticket/skill (with per-worker expiry). `JobRole`
= named function defined by its required competencies (§5.1). One role vocabulary
replaces the three free-string fields; competencies stay atomic. This is richer than
the earlier "unify" and is what enables "fit the bill" filtering.

**6.5 — Eligibility filtering → "fit the bill" + "show all available" override.**
Allocation picker shows only eligible + available workers by default; a button drops
the competency filter (availability still respected) for deliberate overrides, logged
via `CompetencyOverride` + reason. Hard gate on expired mandatory tickets; soft amber
on double-booking.

**6.6 — Two entry points, one backend.**
Allocate role-first from inside the job ("this job needs N of role X — fill them") and
calendar-first from the scheduler grid. Both read/write the same `ScheduleAllocation`
day-grain store.

**6.7 — Subcontractor numeric lines → PARKED.**
Out of scope for the scheduler; Marco will handle subcontractor resourcing through a
separate, more complex mechanism.

**Open detail to confirm:** default is **one role per worker per job per day**
(multi-role days handled as a second allocation row). Confirm IS crews don't routinely
need one person logged under two roles on the same day.

---

## 7. What to explicitly NOT bring over

Flat JSON storage, `localStorage` mirror, 5s polling, conflict-copy merging,
hardcoded name=password accounts, the single-file HTML architecture, the
migrate-on-load-in-browser pattern, and the hardcoded public-holiday map — the ERP's
Postgres + Prisma + JWT/SSO + (planned) WebSockets supersede all of it.

---

## 8. One-paragraph summary for the MAIN chat

> Colin's Resource Allocator and the ERP solve the same problem for the same company,
> but the ERP already has richer scheduling infrastructure split awkwardly across two
> duplicated entities (`Job` and `Project`) and two worker models (`Worker`,
> `WorkerProfile`). The plan is consolidation + one new UX, not a port:
> **(P0)** merge Job/Project into one delivery entity and make `WorkerProfile`
> canonical (scheduler refers to profile-held qualifications, never copies);
> **(P1)** add a **Job Roles** module — named roles that bundle required
> `Competency` records — promoting the existing `ShiftRoleRequirement` primitive;
> **(P2)** add one normalised **day-grain `ScheduleAllocation`** table feeding a
> month/week grid with by-job and by-resource views and two entry points (role-first
> from the job, calendar-first from the scheduler) over one backend;
> **(P3)** compute eligibility ("fit the bill" picker + "show all available"
> override), surface double-book flags, and build the unique-by-name availability
> heatmap. Subcontractor numeric resourcing is parked (handled separately). Bundle
> P0 with the already-deferred Worker/WorkerProfile consolidation and scheduler-grid
> roadmap items.
