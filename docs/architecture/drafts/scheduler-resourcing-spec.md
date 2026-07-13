# Scheduler + Resourcing — Design Spec (DRAFT)

- **Status:** DRAFT — for Marco's review. Not yet in `/sot/`. If accepted, Marco
  promotes the durable parts into `/sot/06-active-specs.md`.
- **Author:** Claude (branch `docs/scheduler-resourcing-spec`)
- **Date:** 2026-07-13
- **Scope:** Analysis + design spec only. **No application code, no schema
  change, no migration, no data writes** in this PR.
- **Origin prompt:** `PR prompt — DESIGN SPEC: unified resourcing + scheduler
  (decisions LOCKED by Marco)` — Marco's D1–D7 decisions frame this document.

---

## 0. TL;DR — can we answer Marco's four questions today?

Marco's requirement (verbatim, 2026-07-13):

> *"I just want a more user friendly way to allocate work to people or people
> to work, and be able to easily visualize that so I know: (1) Jobs that I need
> to resource or are over resourced; (2) People that I need to allocate or are
> double allocated; (3) Gaps in my schedule where I need to find work for my
> crew; (4) Periods where I need to get more people."*

| # | Question | Today | Why |
|---|---|---|---|
| Q1 | Under- / over-resourced jobs | **NO** | No demand model at Job / Activity grain. `ShiftRoleRequirement` exists (`schema.prisma:1376`) but only at Shift grain, has no UI, and the seed writes 2 rows (`seed.ts:2834-2849`). Without demand, "0 required / 0 filled" is the only answer. |
| Q2 | People unallocated or double-booked | **PARTLY** | Double-booking IS caught server-side: `ScheduleAllocationService.upsert` throws 409 on the `@@unique([date, projectId, workerProfileId, jobRoleId])` collision (`schema.prisma:2317`, `schedule-allocation.service.ts:270-378`). But "unallocated" means "should be somewhere and is not" — which needs the same demand baseline as Q1. |
| Q3 | Idle-crew gaps (find them work) | **NO** | Same root cause as Q1 — you cannot show "what was requested and not filled" without a request table. |
| Q4 | Shortfall periods (recruit more) | **NO** | Requires demand aggregation over time. Not modelled. |

**The blocker for three of four is the same one thing:** the system has no way
to say *"job X needs 3 of role Y from Mon to Wed"* as a first-class,
independently editable record. Every other piece (double-book detection,
competency gate, calendar views) already exists.

**One consequence to internalise:** the spec below is **not** a scheduler
rewrite. It is (1) inventing the missing demand model, (2) unifying the three
existing allocation models the SoT already plans to unify, and (3) writing the
balance view on top. The scheduler UI itself is largely there.

---

## 1. Ground truth — what's actually in the schema

All line references are to `apps/api/prisma/schema.prisma` unless noted.

### 1.1 There are THREE parallel allocation models, not two

Marco's D1 says *"keep ONE model, and it must support time of day."* Correct
in principle — but the current state is **three**, not two:

| # | Model | Grain | Scoped to | Time-of-day? | Wired to |
|---|---|---|---|---|---|
| A | `Shift` + `ShiftWorkerAssignment` + `ShiftAssetAssignment` + `ShiftRoleRequirement` + `SchedulingConflict` (`schema.prisma:1274-1389`) | time-range (`startAt`/`endAt`) | **Job** + required `jobActivityId` (line 1278) | **YES** | scheduler workspace, availability service, calendar sync, maintenance asset-utilisation, `FormSubmission.shiftId`, pre-start (via shift), asset maintenance events |
| B | `ScheduleAllocation` (`schema.prisma:2298-2324`) | **day-grain** (`date @db.Date`) | **Project** + optional `jobRoleId` (line 2308) | **NO** | scheduler grid, availability report, "my day" widget |
| C | `ProjectAllocation` (`schema.prisma:2256-2281`) | date-range (`startDate`/`endDate`) | **Project** | **NO** | **timesheets**, **pre-starts**, **`CompetencyOverride`** |

`sot/04-data-model.md` already documents the resolution path
(lines 2619-2660, 2680, 2697):

- `ScheduleAllocation` is **canonical**.
- `Shift` cluster is scheduled for retirement under **B-P0a-9** (line 2680).
- `ProjectAllocation` becomes a **derived range view** over `ScheduleAllocation`
  under **B-P0c** (out of scope for the earlier phases).
- Retirement is gated on **B-P0b** (`Worker → WorkerProfile` consolidation) —
  see section 1.3 below.

**Implication for D1.** D1 aligns with the existing SoT plan — the survivor
is `ScheduleAllocation`. But `ScheduleAllocation` today is day-grain only and
Project-scoped only. Two additions are required to make it the ONE model:

1. **Add time-of-day** (`startTime` / `endTime` nullable, per D1) so it can
   express *"6am–2pm"* when the standard-shift default is wrong.
2. **Give it activity granularity** (see D3 verification in §2.3).

### 1.2 `JobActivity` is FLAT, not a tree

`JobActivity` (`schema.prisma:1157-1179`) fields: `id, jobId, jobStageId,
ownerUserId, name, description, activityOrder, status, plannedDate, notes,
createdAt, updatedAt`.

**There is no `parentActivityId` and no self-relation.** WBS is a two-level
fixed shape:

```
Job → JobStage → JobActivity   (that's it)
```

**This contradicts D3** as literally worded (*"if there is a further breakdown
available on the job, the pop-up can allow the person allocating to either go
down to the finest details or not"*). "Deeper breakdown" is not modelled at
all. See §2.3 for how to reconcile — the practical answer is that today's
two-level shape is already "ragged" (some stages have many activities, some
have one), so the "any depth" language reduces to "job vs top-level activity"
which the current model can support once the FK is fixed.

### 1.3 There are TWO parallel worker models

Also documented in `sot/04` (§B-P0b, lines 2724+).

| Model | Belongs to | Competency store | Availability store | Used by |
|---|---|---|---|---|
| `Worker` (`schema.prisma:706-733`) | scheduler / crews | `WorkerCompetency` (line 795) | `AvailabilityWindow` (line 1345), `WorkerRoleSuitability` (line 1361) | Shift cluster |
| `WorkerProfile` (`schema.prisma:2219-2254`) | HR / mobile / field | `WorkerQualification` (line 3534) | `WorkerLeave` (line 3658), `WorkerUnavailability` (line 3680) | `ScheduleAllocation`, `ProjectAllocation`, timesheets, pre-starts, competency gate |

**Only `WorkerProfile` is consulted by the current competency gate.**
`AvailabilityWindow` and `WorkerRoleSuitability` are **schema debt** — they
are read by the legacy Shift board but not by the scheduler grid
(`schedule-allocation.service.ts:138-161` reads `WorkerLeave` +
`WorkerUnavailability`, never `AvailabilityWindow`).

`WorkerRoleSuitability.suitability String @default("SUITABLE")` (line 1365)
has zero non-default writers in the codebase — it is a stub, not an
enforcement point.

**Implication.** The consolidation is already planned (`sot/04` B-P0b). The
work in this spec is designed to run **on the `WorkerProfile` side only** so
it is compatible with that plan.

---

## 2. Verifying Marco's locked decisions D1–D7 against the code

Marco locked D1–D7 (in the prompt) as decisions, not questions. My job here
is to check whether the code supports each — and to flag any conflict rather
than quietly design around it.

### 2.1 D1 — one allocation model, carrying time of day → **SUPPORTED (with caveat)**

- **Aligns with `sot/04`'s existing retirement plan** (canonical =
  `ScheduleAllocation`). D1's rationale ("two parallel models is not an
  option") is stronger than the SoT's rationale but reaches the same
  destination.
- **Caveat:** the reality is THREE models, not two (§1.1). Deleting `Shift`
  is scoped in B-P0a-9; `ProjectAllocation` cannot go with it because
  timesheets, pre-starts and `CompetencyOverride` all FK to it
  (`schema.prisma:2271, 2273, 2338, and the Timesheet + PreStartChecklist
  models near line 2380+`). So this spec **cannot** promise the loser is
  deleted in the same phase as the survivor is made canonical. See phased
  plan §4.
- **Time of day.** `ScheduleAllocation.date` is `@db.Date` today (no
  time). Adding nullable `startTime` / `endTime` (or `startsAtMinute`/
  `endsAtMinute` int; either works) is a small additive migration.

### 2.2 D2 — no data migration; delete the loser outright → **SUPPORTED**

- The system is not live. Marco has said so; no production allocation data
  exists. This is the biggest simplifier of the whole plan.
- **Code blast radius is the real cost.** The Explore agent counted ~31
  files touching the `Shift` cluster and 3 core files touching
  `ProjectAllocation`. Full list will be re-derived at the start of each
  phase since branches move (do not rely on the map below beyond the day
  it was written).

  **Shift-cluster consumers (2026-07-13 snapshot):**
  - `apps/api/src/modules/scheduler/scheduler.service.ts` (`+ .controller.ts`)
  - `apps/api/src/modules/workers/availability.service.ts`
  - `apps/api/src/modules/resources/resources.service.ts` (`+ .controller.ts, .dto.ts`)
  - `apps/api/src/modules/calendar/calendar.service.ts`
  - `apps/api/src/modules/forms/*` (via `FormSubmission.shiftId`)
  - `apps/api/src/modules/maintenance/asset-utilisation.helpers.ts` (`+ .spec.ts`)
  - `apps/api/src/modules/platform/dashboards.service.ts`
  - `apps/web/src/pages/scheduler/SchedulerGridPage.tsx`,
    `SchedulerWorkspacePage.tsx`, `schedulerGridHelpers.ts`
  - `tests/e2e/pr-acceptance/batch6-scheduler.spec.ts`
  - `apps/api/src/modules/estimate-export/excel/estimate-excel.builder.ts`
  - `apps/api/src/modules/tendering/scope-item-pricing.ts`

  Every one of these is a code edit, none is a data migration.

### 2.3 D3 — allocate to a Job by default, drill into WBS to any depth → **CONFLICTS (see §5)**

Two contradictions to flag rather than paper over:

1. **`ScheduleAllocation` is Project-scoped, not Job-scoped**
   (`schema.prisma:2301: projectId String @map("project_id")`). It has an
   optional `jobRoleId` but no `jobId` and no `jobActivityId`. To satisfy
   D3, either:
   - The FK is repointed to `Job` and (optional) `JobActivity`, and the
     Project↔Job relation (`Job.survivingProjectId` /
     `Project.sourceJobId`, `schema.prisma:1090, 2113`) is used to render
     the Project-facing surfaces (Gantt, timesheets); **or**
   - We add two FKs (`jobId` nullable, `jobActivityId` nullable) alongside
     `projectId` and require exactly one is set.
   Both are additive migrations. Recommendation: repoint (Job/Activity),
   because Marco's whole language is "job-first". See §4 phase 2.
2. **`JobActivity` is FLAT — no self-referencing tree** (§1.2). "Any depth"
   as literally written is not supportable without a schema change (add
   `parentActivityId` self-relation). Practical resolution:
   - Support **two allocation targets** for now: **Job** (whole job) or
     **JobActivity** (one row of the two-level breakdown).
   - Adding a self-referencing tree is out of scope for the first four
     phases and can be added later if Marco actually needs it — the seeds
     today produce ~15 activities per job spread across 4–5 stages, which
     is deep enough for the demolition trades Marco named ("asbestos,
     demolition, civil, …"). Verify with him before writing code.

### 2.4 D4 — competency gating is enforced, not advisory → **ALREADY TRUE for ProjectAllocation and ScheduleAllocation**

- `allocations.service.ts:194-216` (ProjectAllocation) — server throws
  `409 ConflictException` unless a valid override payload is supplied.
- `schedule-allocation.service.ts:270-378` (ScheduleAllocation) — same
  pattern, server throws 409, `overrideReason` recorded inline on the row
  (`schema.prisma:2311`) plus `AuditLog` action
  `schedule.unqualified_override`.
- **Not true for `ShiftWorkerAssignment`** — no gate today. Not a problem
  for this spec since the Shift cluster is being retired anyway.
- Uses `WorkerProfile.qualifications` (WorkerQualification) as the ticket
  store. `WorkerCompetency` is NOT consulted (schema debt per §1.3).

**Conclusion:** D4 needs no new architecture, only the extension in D7.

### 2.5 D5 — requirements are first-class on the JOB; the estimate SEEDS them; job trumps estimate → **NEW WORK REQUIRED**

- No demand-side "requirement" table exists at Job or Activity grain
  today. `JobRoleRequirement` (`schema.prisma:691`) is a **catalogue rule**
  ("filling role X requires competency Y"), not a project-level demand
  ("this job needs 3 of role X"). Verified: consumer is
  `JobRolesService` catalogue CRUD, no reads from any job or scheduler
  code path.
- `JobConversion` (`jobs.service.ts:1145-1316`) creates the Job and copies
  commercial + document metadata only. It does **not** touch
  `EstimateItem` / `EstimateLabourLine` / `EstimatePlantLine` and does
  **not** create `JobActivity` rows. Handover today is commercial-only.
- Both job-creation paths exist (`jobs.service.ts:433-507` manual;
  `1145-1316` tender-convert), so D5's "design for the manual job first,
  then bolt handover pre-fill on top" is the correct sequencing.

### 2.6 D6 — every job has at least one activity → **CONVENTION, NOT ENFORCED**

- The schema has **no minimum-activity constraint**. `JobActivity.jobId`
  is required, but `Job.activities[]` can be empty.
- Neither `createJob` (`jobs.service.ts:433-507`) nor `convertTenderToJob`
  (`1145-1316`) creates activities server-side. A freshly-manually-created
  job has zero activities until the user adds them.
- The seed happens to create 15+ activities per job
  (`seed-initial-services.ts:1578-1628`), which is why it feels like the
  floor is enforced.

**Recommendation:** enforce D6 by making the "create job" flow require at
least one top-level activity be entered in the same form (server-side
validation, no schema change). This is the "always has something to
allocate to" property Marco needs.

### 2.7 D7 — overridability is a JobRole flag; asbestos is `false` → **ALIGNED WITH CHARTER; NEEDS ONE COLUMN**

- Charter rule `sot/01-charter-and-architecture.md:178` (PR #479 — the
  `AuthorityService` / `AuthorityRule` pattern) says authorization is a
  config layer, never hard-coded. D7's "add a flag to `JobRole`, don't
  write `if (name === 'asbestos')`" is precisely this rule.
- Proposed column: `JobRole.competencyOverridable Boolean @default(true)`.
  Default `true` matches the existing world (overrides currently allowed
  for any allocation). Asbestos removal (and any other WHS-critical role
  Marco calls) gets flipped to `false`.
- **Enforcement site.** Add a second guard in
  `allocations.service.ts` (~line 200) and `schedule-allocation.service.ts`
  (~line 292): after the existing "requires override?" branch, before
  accepting the override, look up `jobRole.competencyOverridable` and if
  `false`, throw 409 with a clear reason regardless of who the actor is.
  This is the WHS control; put it behind the same seam as the existing
  gate.
- **Audit + governance for editing `competencyOverridable` itself.**
  Marco is the WHS & Commercial Compliance officer; this is his call, not
  something for a design spec to decide. Flag it in §5 as needs-Marco:
  should editing this flag be restricted to super-users, and should every
  change go to `AuditLog`? Recommendation: yes to both.

### 2.8 Marco's failure-honesty principle

Marco cited this as "`sot/01` SECTION 6". The concept is definitely how he
runs the project (see the Rates page incident that motivated the
principle), but the exact phrase does **not** appear in `sot/01` §6
today — §6 (charter architecture rules) has 30+ specific bullets but no
codified failure-honesty rule. The closest existing formalisations are:

- *"either way the page gets an explicit banner or a route redirect, never
  a silent behaviour change"* (`sot/04-data-model.md:2951`).
- *"Nothing is silently dropped."* (`sot/06-active-specs.md:474`).

**Recommendation for a follow-up SoT PR (not this one):** promote Marco's
failure-honesty principle into `sot/01` §6 as an explicit bullet, so future
prompts can cite it verbatim. In the meantime this spec enforces the
principle by (a) never grey-out-without-reason, (b) surfacing the block
reason in the error toast, (c) never hiding an unfillable requirement.

---

## 3. Design — the four moving parts

Only the shape is fixed here; field-level DTOs and API URLs are decided
when each phase is implemented.

### 3.1 Demand — `ActivityResourceRequirement`

The missing piece. First-class, independently creatable and editable on
Job / Activity — the estimate is a seeder, never the source of truth.

Shape (illustrative — not a migration):

```
ActivityResourceRequirement
  id
  jobId            — nullable — set when the requirement is against the Job as a whole
  jobActivityId    — nullable — set when the requirement is against a specific activity
  jobRoleId        — required — points at JobRole (typed, not free string)
  requiredCount    — int
  startDate        — date
  endDate          — date (inclusive)
  standardShiftOnly — bool (true = "standard day", false = requires per-day time-of-day fill)
  sourceEstimateLineId — nullable — set only when the row was seeded from an EstimateLabourLine
  createdById / createdAt / updatedAt

  constraint: (jobId != null) XOR (jobActivityId != null)
  (writing at the wrong level is a data-integrity bug; enforce with a CHECK)
```

Why this shape:

- **Grain-independent demand.** Answers Q1/Q3/Q4 by definition.
- **Typed `jobRoleId`** (unlike `EstimateLabourLine.role: String` or
  `ShiftRoleRequirement.roleLabel: String`) — the "role" is now first-class,
  so eligibility can be computed without string joins.
- **`standardShiftOnly` split** lets Marco choose whether the requirement
  is "3 of role X, standard hours" (day-grain default) or "3 of role X, must
  be a 6am–2pm shift" (drives the time-of-day fields on the allocation
  side).
- **`sourceEstimateLineId`** preserves the D5 rule: seeded lines are marked
  as such once, and a later estimate revision does not overwrite them (a
  re-seed only writes rows that do not exist yet for the same source).
  Editing a seeded row breaks the link (nulls the source pointer) —
  planner's edits are theirs.

### 3.2 Supply — the ONE allocation model

Recommendation: **evolve `ScheduleAllocation`** into the survivor (aligning
with `sot/04`), with two additive changes:

1. Add `jobId String? @map("job_id")` and
   `jobActivityId String? @map("job_activity_id")` (both nullable, at least
   one must be non-null — CHECK constraint). Keep `projectId` for the
   duration of `sot/04` B-P0b/B-P0c but let it become derivable from the
   Job. Once B-P0c lands, remove `projectId` and route Gantt / timesheets
   through `Job.survivingProjectId`.
2. Add `startTime Time?` and `endTime Time?` — null means "standard shift"
   (per §3.1 above), populated means the allocation covers a specific
   window on that date.

Rename to `Allocation` at the end of the sequence to reflect the
single-model reality.

### 3.3 Eligibility — one query, not three

Today (`schedule-allocation.service.ts:94-177`), eligibility is three
serial queries: competency, leave, unavailability, and then a client-side
join. This is fine for the current small dataset but should collapse into
one Prisma query for the answer to *"who is ticketed for asbestos AND free
Mon–Wed?"* — that query is the drag-and-drop preflight in D3/D4/D5. Design
this alongside the D7 flag lookup so the whole preflight is one round
trip. **No new table required.**

### 3.4 The balance view — Marco's four questions on one page

Read-only aggregation over the demand table (3.1) and the survivor
allocation table (3.2). Per-day, per-Job (or Activity), per-JobRole:

- `required` (from `ActivityResourceRequirement`)
- `filled` (count of matching allocations)
- `variance = filled − required`

Roll-ups: by day, week, role, and worker. Answers all four questions:

- **Q1** — variance < 0 → under-resourced job; variance > 0 → over-resourced.
- **Q2** — worker with allocations on the same date across two projects
  where the sum > 1 shift → double-book. Worker with zero allocations across
  their standard workdays → unallocated.
- **Q3** — worker rows with contiguous zero-allocation days.
- **Q4** — global sum of `variance < 0` by role by week.

This is a **read** view. It never writes. It surfaces reasons for blocked
allocations verbatim (failure-honesty).

---

## 4. Phased build plan

Each phase is independently shippable and reversible. **No phase requires
data migration** (Marco's D2). Every phase is code-only, plus additive
schema where noted.

### Phase 1 — Demand: `ActivityResourceRequirement` + minimum-activity floor

**What ships**

- New `ActivityResourceRequirement` table (additive migration).
- Server-side enforcement that `createJob` requires at least one
  top-level `JobActivity` in the same request (D6). Both the manual and
  the tender-convert path are updated.
- UI page under `/jobs/:id/resources`: table of activities with an
  add-requirement drawer. Types the role via a `<Select>` from `JobRole`.
- Read-only endpoint that returns the requirements a Job needs.

**Depends on**

- Nothing. `Shift` / `ScheduleAllocation` / `ProjectAllocation` are
  untouched.

**Reversal**

- Drop the table. Revert the `createJob` validation (which fails-open, so
  reversal cannot corrupt existing data). Remove the UI.

**Notes**

- This alone unblocks Q1 for manually-created jobs. It is the single
  most valuable phase and the one that should be built first.

### Phase 2 — Supply: unify onto `ScheduleAllocation`; add time-of-day; add Job/Activity FKs

**What ships**

- Additive migration: `ScheduleAllocation.jobId`, `.jobActivityId`,
  `.startTime`, `.endTime` — all nullable. CHECK: `(jobId != null OR
  projectId != null)`.
- Scheduler-grid write path updated to populate `jobId`/`jobActivityId`
  when the caller targets a Job (previously it always went via
  `projectId`).
- `Shift` cluster removed — this is the `sot/04` B-P0a-9 slice, gated on
  B-P0b having redirected all non-shift `Worker` readers to
  `WorkerProfile` (see `sot/04:2881-2884` for the mutual gating).
- The `sot/04` B-P0c work (ProjectAllocation → derived view) may run
  **after** this phase or in parallel; it is out of scope here and
  timesheets/pre-starts continue writing to `ProjectAllocation`
  transitionally.

**Depends on**

- Phase 1 (nothing hard, but the demand data is what makes the new
  Job/Activity FKs useful).
- `sot/04` B-P0b progress on `Worker → WorkerProfile` — this phase must
  not fork the plan.

**Reversal**

- Data-safe reversal is possible until the `Shift` table is dropped. Roll
  back only the additive columns.
- Once `DROP TABLE shifts` runs, reversal is snapshot-restore only.
  Marco's call.

### Phase 3 — Handover: `EstimateLabourLine` / `EstimatePlantLine` seeds requirements

**What ships**

- `convertTenderToJob` (`jobs.service.ts:1145`) gains an optional seeder
  step that:
  - Maps `EstimateLabourLine.role` (String) to `JobRole.id` by name (best
    match), routing unmatched to a warning list surfaced in the handover
    dialog.
  - Creates `JobStage` / `JobActivity` rows from `EstimateItem`s (one
    activity per item, grouped into stages by discipline).
  - Creates `ActivityResourceRequirement` rows from labour/plant lines
    with `sourceEstimateLineId` set.
- A later estimate revision **never** overwrites a row whose
  `sourceEstimateLineId` is populated and matches; it only adds rows for
  new estimate lines.
- Manual edits to a seeded row null out `sourceEstimateLineId` — D5's
  "job trumps estimate" made mechanical.

**Depends on** — Phase 1 (target table must exist).

**Reversal** — Revert the seeder call in `convertTenderToJob`. Optionally
delete rows where `sourceEstimateLineId IS NOT NULL AND createdAt >
{cutoff}` for jobs converted after this ships. Data-safe until Marco
turns it on for real jobs.

### Phase 4 — Balance view (read-only)

**What ships**

- One aggregation service that produces the required / filled / variance
  matrix for a date range.
- Four surfaces:
  - **Jobs → Resource balance** — per-job under/over table.
  - **People → Roster** — per-worker unallocated / double-booked calendar
    strip.
  - **Crew → Gaps** — worker-by-day zero-allocation strip.
  - **Recruitment → Shortfall** — variance-negative role-by-week
    heatmap.
- No writes. No allocation changes are possible from this view — you
  click through to phase 5's dialog to change anything.

**Depends on** — Phases 1 and 2.

**Reversal** — Delete the pages; unwire the service.

### Phase 5 — Allocation UX: drag-drop + WBS-and-competency dialog

**What ships**

- Drag-drop on the balance view: drag a person onto a job/activity cell
  → the dialog fires.
- Dialog behaviour (D3 / D4 / D7):
  - Show the Job's activities (two-level). Planner picks Job-level OR one
    specific activity.
  - Show the role the person is being allocated as (default from their
    home role; changeable).
  - Eligibility preflight (§3.3). If the person lacks a required
    competency AND `jobRole.competencyOverridable = false` → HARD BLOCK
    with the reason ("no asbestos removal ticket") shown in the dialog
    body, not as a silently disabled control (failure-honesty).
  - If `competencyOverridable = true` and the actor has
    `resources.manage`, an override with mandatory reason is offered.
    Override writes `AuditLog` action
    `schedule.unqualified_override` (existing) and the `overrideReason`
    field.
- Bulk allocate: same dialog can accept a date range and fills all days
  in one write, respecting per-day availability windows.

**Depends on** — Phases 1, 2, 4. D7 flag (added in a small phase 0 or as
part of phase 5 — either works, one column).

**Reversal** — Revert the UI + service. Underlying data unchanged.

---

## 5. Open questions for Marco

Not to answer here — flag and route to Marco.

1. **`JobActivity` tree** (§2.3). Two-level is enough for the first four
   phases. Do you actually need deeper WBS (Demolition → soft strip →
   floor A) at any point? If yes, phase 6 adds `parentActivityId`; if no,
   we retire the language "any depth" in favour of "job or top-level
   activity".
2. **Editing the D7 flag** (§2.7). Should changing
   `JobRole.competencyOverridable` be super-user-only, and should every
   change be audit-logged? Strongly recommend yes to both.
3. **Failure-honesty as a codified charter rule** (§2.8). Do you want a
   small follow-up SoT PR that promotes your failure-honesty principle
   into `sot/01` §6 as a bullet, so future prompts can cite it verbatim?
4. **Multi-role-per-day.** The `@@unique([date, projectId,
   workerProfileId, jobRoleId])` constraint (`schema.prisma:2317`) allows
   one worker to be allocated to two roles on the same day on the same
   project. Adding `jobActivityId` to the survivor changes this — should
   the unique key include activity, so the same person can hold two
   activities in one day? Preferred default: yes.

---

## 6. Non-goals for this spec

- Not designing the `CompetencyOverride` refactor to work uniformly across
  ProjectAllocation and ScheduleAllocation — that is a `sot/04` B-P0c
  concern.
- Not resolving the `Worker` ↔ `WorkerProfile` duality — `sot/04` B-P0b
  owns that.
- Not deleting `ProjectAllocation` — cannot happen until timesheets and
  pre-starts move (B-P0c).
- Not touching the Rates & Lists R0 seam (`sot/01` §6, PR #485). All
  allocation rows continue reading rates via `resolveRate`.

---

## 7. Evidence appendix (file:line index)

Every claim in this document is anchored here so future readers can verify.

- Three allocation models —
  `apps/api/prisma/schema.prisma:1274-1389` (Shift cluster);
  `2298-2324` (ScheduleAllocation); `2256-2281` (ProjectAllocation).
- `JobActivity` flat — `schema.prisma:1157-1179` (no `parentActivityId`).
- `Job.survivingProjectId` / `Project.sourceJobId` bridge —
  `schema.prisma:1090, 2113`.
- Worker duality — `schema.prisma:706-733, 795, 1345, 1361, 2219-2254,
  2243, 3534, 3658, 3680`.
- `JobRoleRequirement` is catalogue-only, not demand —
  `schema.prisma:691-704`; consumer:
  `apps/api/src/modules/master-data/job-roles.service.ts:1-130`.
- `ShiftRoleRequirement` is demand-at-Shift-grain, API only, no UI —
  `schema.prisma:1376-1389`;
  `apps/api/src/modules/resources/resources.controller.ts:143-175`;
  `resources.service.ts:244-277`; seed
  `apps/api/prisma/seed.ts:2834-2849` (2 rows).
- `JobConversion` handover is commercial-only, does not create activities
  or requirements — `apps/api/src/modules/jobs/jobs.service.ts:1145-1316`.
- Job creation, manual path — `jobs.service.ts:433-507`.
- Competency gate enforcement (ProjectAllocation) —
  `apps/api/src/modules/allocations/allocations.service.ts:157-359`
  (block at `194-216`, override write at `320-351`).
- Competency gate enforcement (ScheduleAllocation) —
  `apps/api/src/modules/scheduler/schedule-allocation.service.ts:270-378`
  (block at `292-311`, audit at `356-371`, inline `overrideReason` at
  `schema.prisma:2311`).
- Eligibility three-query composition —
  `schedule-allocation.service.ts:94-177`.
- Scheduler grid UI hits `GET/POST /scheduler/allocations` —
  `apps/web/src/pages/scheduler/SchedulerGridPage.tsx` →
  `apps/api/src/modules/scheduler/schedule-allocation.controller.ts:40-160`.
- Gantt UI hits `/projects/:id/allocations` (ProjectAllocation) —
  `apps/web/src/pages/projects/GanttChart.tsx` →
  `apps/api/src/modules/allocations/allocations.controller.ts:52-160`.
- Timesheet / PreStart bound to ProjectAllocation —
  `schema.prisma:2271, 2272, 2384, 2433`.
- Authorization-as-config charter rule (basis for D7) —
  `sot/01-charter-and-architecture.md:178` (PR #479).
- `sot/04` retirement plan — `sot/04-data-model.md:2619-2660, 2680,
  2697, 2724+, 2851-2884, 2951`.
- `sot/06` active spec W6 (timesheet chasers depend on the
  ProjectAllocation ↔ ScheduleAllocation interim state) —
  `sot/06-active-specs.md:1243`.
- "Nothing is silently dropped" — `sot/06-active-specs.md:474`.
- "Never a silent behaviour change" — `sot/04-data-model.md:2951`.
