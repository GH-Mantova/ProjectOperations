# Job / Project merge (B-P0a) — Slice plan (Job is canonical)

> **Status:** PLAN ONLY. This document changes no schema, migration, service, or route.
> It is SLICE 0 — the ordered plan that every later slice will follow.
> **Scope:** `docs/architecture/drafts/**` in this PR. Nothing else.

---

## 1. Decision header

**Job is canonical. Project is folded into Job and dropped last.**
Confirmed by Marco on **2026-07-16**, reaffirming the earlier `docs/pr-prompts/BACKLOG-DECISIONS.md`
(2026-07-14) entry:

> "## 1. Job / Project merge (B-P0a) — **`Job` IS CANONICAL**
>  Merge `Project` into `Job`. Restart the workstream."

**This REVERSES the shipped Phase-A direction.** #500 (and the preceding B-P0a-1..3 in June/July)
built **Project as the survivor**, adding to the schema:

- `Project.legacyJobId` (unique)
- `Project.jobNumber` (unique)
- `Project.sourceJobId` (unique) + `Project.sourceJob Job? @relation("ProjectSourceJob", ...)`
- `Job.survivingProjectId` (unique) + `Job.survivingProject Project? @relation("JobSurvivingProject", ...)`
- `Job.reverseSourceOf Project? @relation("ProjectSourceJob")`
- `Project.reverseSurvivorOf Job? @relation("JobSurvivingProject")`

Those Phase-A links now point the WRONG way and must be unwound (§4).

### SoT documents that contradict this decision — flag for `05-sot-keeper`

| Doc | Line | Wrong content today | Needed |
|---|---|---|---|
| `sot/02-roadmap-and-status.md` | 100 | "Job + Project full merge — **survivor Project** (Phase A links already merged #500; remaining phases)." | Rewrite to "survivor **Job**"; note direction reversal + reference this plan. |
| `sot/04-data-model.md` | 3004–3239 | Entire "Job / Project Consolidation — Survivor-Spine Design (B-P0a)" section is authored as **Project-survives** (see §1 "`Project` survives as the delivery spine. `Job` is folded into it and retired."). | Re-author whole section to Job-canonical, or delete and replace with a pointer to this plan. Keep the still-valid mechanics (expand→backfill→switch→contract, migration ordering rules, multi-role guard, risk register). |
| `docs/pr-prompts/BACKLOG-DECISIONS.md` | 8–14 | Already correct (Job canonical) — no reconcile needed. | (verification only) |

**05-sot-keeper action item:** open a `doc-reconcile` PR that fixes `sot/02` line 100 and re-authors
`sot/04` §3004+. Do NOT touch `sot/` from this workstream — CP-24 forbids it.

---

## 2. Inventory (grepped, not guessed)

Sourced from `apps/api/prisma/schema.prisma` (commit `102f1626`, current `main`).

### 2.1 `model Project` — fields + relations (lines 2518–2583)

**Own fields:**
`id`, `projectNumber` (unique), `jobNumber` (unique, **Phase-A**), `legacyJobId` (unique, **Phase-A**),
`name`, `status ProjectStatus` (enum), `sourceTenderId` (unique), `sourceJobId` (unique, **Phase-A**),
`clientId`, `siteId`, `siteAddressLine1/2/Suburb/State/Postcode`, `requiredQualifications String[]`,
`contractValue`, `budget`, `actualCost`, `proposedStartDate`, `actualStartDate`,
`practicalCompletionDate`, `closedDate`, `projectManagerId`, `supervisorId`, `estimatorId`,
`whsOfficerId`, `estimateSnapshot Json`, `createdById`, `plannedStartDate`, `plannedEndDate`,
`createdAt`, `updatedAt`.

**Owned relations (Project → other):**
`client`, `site`, `sourceTender`, `sourceJob` (**Phase-A**), `reverseSurvivorOf` (**Phase-A**),
`projectManager`, `supervisor`, `estimator`, `whsOfficer`, `createdBy`.

**Reverse relations (other → Project) — the 18 FK edges we must re-point:**

| # | Model | Line | Field on that model | Cardinality | OnDelete |
|---|---|---|---|---|---|
| 1 | `Case` | 5825 | `projectId` (rel `CaseProject`) | 0..1 | SetNull |
| 2 | `CompetencyOverride` | 1270 | `projectId` | 0..1 | SetNull |
| 3 | `Contract` | 2717 | `projectId` (`@unique`) | 1..1 | Cascade |
| 4 | `DailyDiary` | 2597 | `projectId` | 1..1 | Cascade |
| 5 | `Expense` | 5696 | `projectId` (rel `ExpenseProject`) | 0..1 | SetNull |
| 6 | `ExpenseNumberSequence` | 3588 | `projectId` (`@unique`) | 1..1 | Cascade |
| 7 | `GanttTask` | 2655 | `projectId` | 1..1 | Cascade |
| 8 | `HazardObservation` | 4230 | `projectId` | 0..1 | SetNull |
| 9 | `PreStartChecklist` | 4261 | `projectId` | 0..1 | SetNull |
| 10 | `ProjectActivityLog` | 2663 | `projectId` | 1..1 | Cascade |
| 11 | `ProjectAllocation` | 2760 | `projectId` | 1..1 | Cascade |
| 12 | `ProjectMilestone` | 2641 | `projectId` | 1..1 | Cascade |
| 13 | `ProjectScopeItem` | 2627 | `projectId` | 1..1 | Cascade |
| 14 | `SafetyIncident` | 2839 | `projectId` | 1..1 | Cascade |
| 15 | `ScheduleAllocation` | 2761 | `projectId` (part of `@@unique(date,projectId,workerProfileId,jobRoleId)`) | 1..1 | Cascade |
| 16 | `SurveyResponse` | 5757 | `projectId` (rel `ProjectSurveyResponses`) | 0..1 | SetNull |
| 17 | `TenderDocumentLink` | 2717 | `projectId` | 1..1 | Cascade |
| 18 | `Timesheet` | 2888 | `projectId` | 1..1 | Cascade |

(Also `TenderOutcome.projectId` at line 4544 — verify at slice time whether it is populated in prod.)

### 2.2 `model Job` — fields + reverse relations (lines 1288–1336)

**Own fields:**
`id`, `jobNumber` (unique), `clientSlugSnapshot`, `name`, `description`, `clientId`, `siteId`,
`sourceTenderId` (unique), `survivingProjectId` (unique, **Phase-A**), `status String` (default
`"PLANNING"`), `projectManagerId`, `supervisorId`, `createdAt`, `updatedAt`.

**Owned relations (Job → other):**
`client`, `site`, `sourceTender`, `survivingProject` (**Phase-A**), `reverseSourceOf` (**Phase-A**),
`projectManager`, `supervisor`.

**Reverse relations (other → Job) — already Job-attached today, will grow:**
`JobConversion` (1341), `JobStage` (1354), `JobActivity` (1374), `JobIssue` (1423),
`JobVariation` (1452), `JobProgressEntry` (1472), `JobStatusHistory` (1491), `JobCloseout` (1506),
`Shift` (1525), `FormSubmission.jobId` (1844), `PunchItem` (4320), `Docket` (5607),
`AssetCheckout` (983, rel `AssetCheckoutJob`), `Commitment` (5194),
`CorrespondenceThread` (4715, rel `JobCorrespondence`), `Expense.jobId` (5697, rel `ExpenseJob`),
`SurveyResponse.jobId` (5754, rel `JobSurveyResponses`), `Case.jobId` (5821, rel `CaseJob`).

### 2.3 Application-code consumers of `Project`

**API (Prisma-client users of `prisma.project.*` / `import.*Project`):**

- `apps/api/src/modules/projects/**` — `projects.service.ts`, `jpm.service.ts`, `gantt.service.ts`,
  `daily-diary.service.ts` (4 files)
- `apps/api/src/modules/scheduler/**` — `schedule-allocation.service.ts`, `suggestion.service.ts`
  + spec (3 files)
- `apps/api/src/modules/allocations/**` — `allocations.service.ts` + spec (2 files)
- `apps/api/src/modules/cases/cases.service.ts`
- `apps/api/src/modules/contracts/contracts.service.ts`
- `apps/api/src/modules/portal/portal-client.service.ts`

**Web / packages:** no direct Prisma-model imports — the web consumes REST/DTO contracts, so the
UI-visible impact reduces to route/DTO shape changes flowing from the API cutover slices.

### 2.4 Scheduler / allocation consumers (must be re-wired to Job)

- `apps/api/src/modules/scheduler/schedule-allocation.service.ts` (main allocator)
- `apps/api/src/modules/scheduler/schedule-allocation.controller.ts` (REST)
- `apps/api/src/modules/scheduler/suggestion.service.ts` (availability engine)
- `apps/api/src/modules/allocations/allocations.service.ts` (range-grain allocations)
- `apps/api/src/modules/job-roles/job-roles.service.ts` (competency gate)
- `apps/api/src/modules/maintenance/maintenance.service.ts`
- Test specs: `schedule-allocation.multirole.spec.ts`, `allocations.service.spec.ts`,
  `job-roles.service.spec.ts`

The **multi-role uniqueness key** `@@unique([date, projectId, workerProfileId, jobRoleId], name:
"schedule_alloc_worker_uniq")` (schema L2166 in the design doc's coordinates) is **locked** and
must survive the rename: it becomes `@@unique([date, jobId, workerProfileId, jobRoleId], ...)`.
Narrowing it would silently forbid a worker holding two roles on one project on one day. Guard
this with the existing regression test in every slice that touches `ScheduleAllocation`.

### 2.5 Regeneration script

`scripts/data-model/build-relationship-map.mjs` exists. Invocation:
`node scripts/data-model/build-relationship-map.mjs` (write) or `--check` (schema-only drift check
for CI). Every slice that changes `schema.prisma` MUST regenerate the map **in the same PR**.

---

## 3. Fold map — Project → Job

Design rule: if a Project-only field has business meaning that survives the merge, it lands on
Job. If Job already has a same-shape field, resolve the collision explicitly (below). If a
Project-only concern is genuinely legacy scaffolding (Phase-A back-pointers, IS-P number scheme
that no user asked for), drop it.

### 3.1 Field-level fold

| Project field | Disposition on Job | Notes / collision resolution |
|---|---|---|
| `id` | discard | Job has its own `id`. |
| `projectNumber` (`IS-P{NNN}`) | **DROP** | Never was user-facing. `Job.jobNumber` (`J{YYMMDD}-{SLUG}-{NNN}`) is the canonical identity. Keep `projectNumber` as a nullable `legacyProjectNumber` on `Job` for a soak period, then drop. |
| `jobNumber` (Phase-A dup) | discard | Already exists on Job (canonical). Reconcile during backfill: `Project.jobNumber` must equal `Job.jobNumber` for the paired row. |
| `legacyJobId` (Phase-A) | discard | Was the back-pointer from Project → Job in the reversed direction. Unwound in §4. |
| `sourceJobId` (Phase-A) | discard | Same as `legacyJobId` — Phase-A cruft. |
| `sourceTenderId` | keep on Job | Job already has `sourceTenderId @unique`. Reconcile per pair. |
| `name` | keep Job's | Identical semantics. |
| `status ProjectStatus` (enum) | **REPLACE** `Job.status String` with `ProjectStatus` (renamed `JobStatus`) | Type collision — Job has free-string, Project has an enum. Rename the enum to `JobStatus`, extend to include any Job-only string values in prod, migrate Job rows into the enum. |
| `clientId` | keep Job's | Identical. Verify agreement per Job/Project pair before backfill. |
| `siteId` | keep Job's | Job already has `siteId` (NOT NULL per PR #642). No action beyond verifying agreement. |
| `siteAddress{Line1,Line2,Suburb,State,Postcode}` | **ADD to Job** (nullable) | Denormalised address snapshot — kept because `Site` is normalised and address history matters for delivery/dispute defence. Backfill from Project; long-term, consider deriving from `Job.site`. |
| `requiredQualifications String[]` | **ADD to Job** | Feeds the scheduler competency gate. |
| `contractValue`, `budget`, `actualCost` (Decimal) | **ADD to Job** | Commercial payload — moves with the merge. |
| `proposedStartDate`, `actualStartDate`, `practicalCompletionDate`, `closedDate`, `plannedStartDate`, `plannedEndDate` | **ADD to Job** | Delivery lifecycle dates. |
| `projectManagerId`, `supervisorId` | keep Job's | Job already has both. Verify agreement per pair. |
| `estimatorId`, `whsOfficerId` | **ADD to Job** | Extra role slots that don't exist on Job today. Preserve. |
| `estimateSnapshot Json` | **ADD to Job** | Frozen at conversion — evidentiary payload. |
| `createdById` | **ADD to Job** (`createdById` FK to User, Restrict) | Job has no explicit creator FK today; the `TenderConversion` bridge is the only creator provenance. Adding this cleans up an existing gap. |
| `createdAt`, `updatedAt` | keep Job's | Identical. |

### 3.2 Relation-level fold — the 18 Project edges

For each Project reverse-relation from §2.1, add `jobId` to the child model, backfill from the
`Project.id → Job.id` map, then drop `projectId`. Two exceptions where a Job-side relation already
exists (deliberate `@relation` names on those models today):

| Project edge | Disposition | Notes |
|---|---|---|
| `Case.projectId` (`CaseProject`) | Merge into existing `Case.jobId` (`CaseJob`). Drop `projectId` + the `CaseProject` relation. | Both relations exist on `Case` today. |
| `Expense.projectId` (`ExpenseProject`) | Merge into existing `Expense.jobId` (`ExpenseJob`). Drop `projectId` + the `ExpenseProject` relation. | Both relations exist on `Expense` today. |
| `SurveyResponse.projectId` (`ProjectSurveyResponses`) | Merge into existing `SurveyResponse.jobId` (`JobSurveyResponses`). Drop the Project side. | Both relations exist today. |
| `Contract.projectId` (`@unique`, Cascade) | Rename to `jobId` (`@unique`, Cascade). | 1:1. `contracts.service.ts` currently reads `contract.project.sourceTenderId` — becomes `contract.job.sourceTenderId`. |
| `DailyDiary.projectId` | Rename to `jobId`. | 1:N. |
| `ExpenseNumberSequence.projectId` (`@unique`) | Rename to `jobId` (`@unique`). | 1:1. |
| `GanttTask.projectId` | Rename to `jobId`. | 1:N. `assignedToId → WorkerProfile` unchanged. |
| `HazardObservation.projectId` | Rename to `jobId`. | Nullable, SetNull. |
| `PreStartChecklist.projectId` | Rename to `jobId`. | Nullable, SetNull. |
| `ProjectActivityLog.projectId` | Rename to `jobId`; rename model to `JobActivityLog` in a cosmetic slice (optional). | The `JobActivity` model is WBS-level, distinct from this audit log — pick names carefully. |
| `ProjectAllocation.projectId` | Rename to `jobId`; rename model to `JobRangeAllocation` (or keep `ProjectAllocation` and just re-point) — cosmetic slice, optional. | Design intent (per sot/04 §4) is that `ProjectAllocation` becomes a **derived view** over `ScheduleAllocation`. Do not conflate the rename with the derive-refactor. |
| `ProjectMilestone.projectId` | Rename to `jobId`; rename model to `JobMilestone`. | |
| `ProjectScopeItem.projectId` | Rename to `jobId`; rename model to `JobScopeItem`. | |
| `SafetyIncident.projectId` | Rename to `jobId`. | |
| `ScheduleAllocation.projectId` | Rename to `jobId`; **preserve the four-column unique** (`date`, `jobId`, `workerProfileId`, `jobRoleId`). | Multi-role guard — see §2.4. |
| `TenderDocumentLink.projectId` | Rename to `jobId`. | |
| `Timesheet.projectId` | Rename to `jobId`. | |
| `TenderOutcome.projectId` (L4544) | Rename to `jobId` if populated; drop the FK if never used. | Verify in prod at slice time. |

### 3.3 Project-only concerns explicitly dropped

- `projectNumber` (`IS-P{NNN}`) as the canonical identity — see 3.1. `jobNumber` wins.
- Model names prefixed `Project*` — retained during transition, cosmetically renamed to `Job*`
  in a final tidy slice (optional; not on the critical path).

---

## 4. Unwind list — Phase-A links to reverse or delete

These were added by PR #500 (and adjacent B-P0a-1..3 PRs #465/#468/#472/#474) when Project was
the intended survivor. They now point the wrong way.

| Element | Where | Fate |
|---|---|---|
| `Project.legacyJobId` (unique, nullable) | schema L2522 | Was the Project → Job back-pointer under the old direction. **Delete** — its data is redundant with the new `Project.id → Job.id` map used to drive the backfill. |
| `Project.jobNumber` (unique, nullable) | schema L2521 | Was a copy of `Job.jobNumber` onto the survivor. **Delete** — `Job.jobNumber` is canonical. |
| `Project.sourceJobId` (unique, nullable) | schema L2527 | **Delete** the column and the FK. |
| `Project.sourceJob Job? @relation("ProjectSourceJob", ...)` | schema L2528 | **Delete** the relation. |
| `Project.reverseSurvivorOf Job? @relation("JobSurvivingProject")` | schema L2529 | **Delete** the relation. |
| `Job.survivingProjectId` (unique, nullable) | schema L1298 | **Delete**. |
| `Job.survivingProject Project? @relation("JobSurvivingProject", ...)` | schema L1307 | **Delete**. |
| `Job.reverseSourceOf Project? @relation("ProjectSourceJob")` | schema L1308 | **Delete**. |
| Migration files creating these columns / relations | `apps/api/prisma/migrations/**` | **Do NOT edit historic migrations.** Reverse-forward: a new migration drops the columns / relations. |
| `@@index([survivingProjectId])` on Job | schema L1334 | Dropped implicitly with the column. |
| `@@index([sourceJobId])` on Project | schema L2581 | Dropped implicitly with the column. |

The unwind runs in the FIRST post-plan slice (S1) so the schema is directionally correct before
any real fold work starts. That avoids the trap of ordering a fold on top of a broken back-pointer.

---

## 5. Ordered slices

Each slice: ≤10 files, independently shippable, its own PR, its own migration file(s), with the
data-model map regenerated **in the same PR**. Slices follow **expand → backfill → switch reads →
switch writes → contract**. Marker `escalates:true` = touches prod data or is destructive.

| Slice | Files | Migration(s) (`YYYYMMDDHHMMSS_…`) | What it does | Rollback | `escalates` |
|---|---|---|---|---|---|
| **S1 — unwind Phase-A** | `schema.prisma`, one migration folder, `sot/04-data-model.md` map only via regenerator | `…_bp0a_s1_unwind_phase_a_links` — drop `Project.{legacyJobId, jobNumber, sourceJobId, sourceJob, reverseSurvivorOf}`, `Job.{survivingProjectId, survivingProject, reverseSourceOf}`, plus the two dropped indexes. No data moved (prod usage of these columns is limited to the traceability nulls set by the previous phase). | Restore the columns from a new additive migration; the data was Phase-A scaffolding, not user-authored. | Yes (drops production columns, though empty of user data — verify with `COUNT(*) WHERE NOT NULL` in the migration preamble). |
| **S2 — expand Job (nullable adds)** | `schema.prisma`, one migration folder, data-model map | `…_bp0a_s2_expand_job` — add to `Job` (all nullable): `siteAddress{Line1,Line2,Suburb,State,Postcode}`, `requiredQualifications String[] @default([])`, `contractValue`, `budget`, `actualCost` (Decimal), the six delivery dates, `estimatorId`, `whsOfficerId`, `estimateSnapshot Json?`, `createdById`, `legacyProjectNumber`. Add `JobStatus` enum by renaming `ProjectStatus` (or adding it fresh and deprecating `ProjectStatus` in a later slice); keep `Job.status` as `String` in this slice — no type change yet. Lock the multi-role regression test into `schedule-allocation.multirole.spec.ts` (already present — verify green). | Drop the added columns; the enum add is a pure additive schema change. | No — additive only. |
| **S3 — build the Project→Job map & backfill Job attributes** | one migration folder + a small verification query script | `…_bp0a_s3_backfill_job_attributes` — build the `Project.id → Job.id` map keyed by shared `sourceTenderId` first, then by `(clientId, name)` for tenderless rows. Emit a report (as migration NOTICE) of unmatched Projects and of Job/Project pairs that disagree on `clientId`/`siteId`. Backfill every Job field added in S2 from the paired Project row. `INSERT/UPDATE ... SELECT` inline in the migration — never a separate seed (avoids the folder-ordering trap from LL/R3 in sot/04). | Null the backfilled columns via a follow-up migration. | Yes — writes to prod `jobs`. |
| **S4 — status enum coercion** | `schema.prisma`, one migration folder, `jobs.service.ts` (+ any read-path that string-compares `Job.status`), data-model map | `…_bp0a_s4_job_status_enum` — rename `ProjectStatus` → `JobStatus` (or add fresh and deprecate) and change `Job.status` from `String` to `JobStatus`. Migration coerces existing string values inline; anything unmapped falls back to `MOBILISING` with an activity-log NOTICE. | Revert `Job.status` to `String`; enum rename is reversible via a follow-up migration. | Yes — changes column type on prod. |
| **S5 — re-point 1:1 children (Contract, ExpenseNumberSequence)** | `schema.prisma` (2 models), one migration, `contracts.service.ts`, data-model map (~5 files) | `…_bp0a_s5_repoint_1to1_children` — add nullable `jobId` to `Contract` + `ExpenseNumberSequence`; backfill from map; enforce `NOT NULL` and `@unique`; drop `projectId` + old FKs in a follow-up S5b if we want a safer split (see R2/R4 rule below). Update `contracts.service.ts` to read `contract.job.sourceTenderId`. | Restore `projectId` from a new additive migration + swap the service back. | Yes — FK rewrites on prod. |
| **S6 — re-point 1:N children (batch A: scope, milestones, activity log, allocations, timesheets)** | ~7 files (5 model edits in `schema.prisma`, one migration, data-model map) | `…_bp0a_s6_repoint_batch_a` — same pattern as S5 for `ProjectScopeItem`, `ProjectMilestone`, `ProjectActivityLog`, `ProjectAllocation`, `Timesheet`, `TenderDocumentLink`. Update `projects.service.ts` + `allocations.service.ts` write paths. | Add-back `projectId` columns; revert services. | Yes. |
| **S7 — re-point 1:N children (batch B: safety, hazards, prestarts, gantt, dailyDiary)** | ~7 files (5 model edits, one migration, data-model map) | `…_bp0a_s7_repoint_batch_b` — same pattern for `SafetyIncident`, `HazardObservation`, `PreStartChecklist`, `GanttTask`, `DailyDiary`. Update `gantt.service.ts` + `daily-diary.service.ts`. | As S6. | Yes. |
| **S8 — re-point ScheduleAllocation (multi-role guard)** | `schema.prisma`, one migration, `schedule-allocation.service.ts`, `suggestion.service.ts`, `job-roles.service.ts`, `maintenance.service.ts`, tests, data-model map (~9 files) | `…_bp0a_s8_repoint_schedule_allocation` — rename `projectId → jobId` on `ScheduleAllocation`; **preserve** `@@unique([date, jobId, workerProfileId, jobRoleId], name: "schedule_alloc_worker_uniq")`. Multi-role regression test must be green on the new key. | Rename back to `projectId`. | Yes — scheduler-critical. Land only after S6 (ProjectAllocation) is in prod and green. |
| **S9 — merge duplicate polymorphic edges (Case, Expense, SurveyResponse)** | `schema.prisma` (3 models), one migration, `cases.service.ts`, data-model map (~6 files) | `…_bp0a_s9_merge_duplicate_edges` — for each of `Case`, `Expense`, `SurveyResponse`: copy any `projectId`-only rows into the `jobId` slot via the map, then drop the Project-side FK + relation. | Restore the Project-side FK + relation from a new additive migration; data preserved on Job side. | Yes. |
| **S10 — drop Project reads from services + web contracts** | `projects.service.ts`, `jpm.service.ts`, `portal-client.service.ts`, related controllers, DTOs, one web-facing shim if any route rename is needed (~≤10 files) | No migration. Point every remaining Prisma read at `prisma.job.*`. Add a route alias for any `/projects/*` endpoint still consumed by the web, delegating to the Job path. | Revert services + route aliases. | No (code-only), but coordinate deploys with S11. |
| **S11 — drop `Project` (destructive)** | `schema.prisma`, one migration, data-model map | `…_bp0a_s11_drop_project_table` — drop `model Project` and the `projects` table. **Gated on a soak period with S1–S10 in prod, all reads on Job, and zero traffic on `/projects/*` legacy alias routes.** Take a full DB snapshot immediately before applying. | **Restore from snapshot** — irreversible via forward migration. | Yes (destructive, snapshot-gated). |
| **S12 — cosmetic rename `Project*` → `Job*` models** (optional) | `schema.prisma`, one migration, all references, data-model map | `…_bp0a_s12_rename_models` — rename `ProjectScopeItem → JobScopeItem`, etc. Pure rename; no data change. | New rename migration. | No. |

**Rule of separation (from R2/R4 in `sot/04-data-model.md` risk register):**
never combine "add nullable FK", "backfill", "enforce NOT NULL", and "drop old column" in one
migration. Each slice may cover only the safe prefix; a follow-up slice enforces `NOT NULL` and
drops after the prior slice has soaked in prod.

**One-at-a-time rule with B-P0b:** SLICES S3+ regenerate `docs/data-model/relationship-map.md`
(and the map section of `sot/04`). B-P0b (`Worker → WorkerProfile`) does the same. **Never run
a B-P0a slice concurrently with a B-P0b slice** — a merge conflict in the regenerated map is a
signal that one workstream stole from the other. Marco has already flagged this in
`BACKLOG-DECISIONS.md` §1–2 ("**Strictly one at a time.**").

---

## 6. Risks

### 6.1 Prod-data risks

- **Data loss on merge slices (S9) and drop slice (S11).** A Job/Project pair whose `clientId`,
  `siteId`, or `name` disagree cannot be safely merged by the S3 backfill without an explicit
  resolution. S3 emits a NOTICE report of disagreements; those rows must be resolved (by a Marco
  decision recorded in the PR) before S5+ runs on them. S11 is snapshot-gated and forward-only.
- **`sourceTenderId` collisions.** Job has `sourceTenderId @unique` (schema L1297). Project has
  `sourceTenderId @unique` (L2525) too, but historically both models could hold different
  tenders. If S3's map finds two Jobs paired to the same tender via different Projects, S3
  aborts. Resolve manually first.
- **Phase-A scaffolding data.** The Phase-A columns dropped in S1 held only back-pointers set
  by the earlier B-P0a-1..3 backfills. Verify with `COUNT(*) WHERE column IS NOT NULL` in the S1
  migration preamble — if any user data has crept into them since #500 shipped, escalate to
  Marco before dropping.

### 6.2 `siteId` risk

- `siteId` is currently NOT NULL on Job (per PR #642, marked open in `sot/02` line 158 — verify
  merge status before starting S3). If S3 discovers a Project with a `siteId` that disagrees
  with its paired Job, the Project's value is discarded — the report **must** list every such
  disagreement, and the migration must fail if the count is non-zero.
- The five denormalised `siteAddress*` fields on Project are the source of truth for delivery
  address history. Preserve them onto Job in S2/S3 even where they duplicate `Job.site.*` —
  address history matters for delay/variation/dispute defence.

### 6.3 Scheduler / allocation consumers

- `ScheduleAllocation` is the canonical scheduler grid; its rename in S8 is the highest-risk
  code change in the plan. Land S8 only after S6 (ProjectAllocation rename) is green in prod.
- The multi-role `@@unique(date, projectId, workerProfileId, jobRoleId)` must become
  `@@unique(date, jobId, workerProfileId, jobRoleId)` with **no other change** to the key
  columns. Any narrowing silently breaks the "one worker, two roles, one day" rule that Marco
  locked in for the scheduler.
- `ProjectAllocation` end-state (per `sot/04` §4) is a **derived view** over `ScheduleAllocation`.
  Do **NOT** conflate the S6 rename with the derive-refactor — the derive is out of scope for
  B-P0a and belongs in a separate workstream after B-P0a is done.

### 6.4 FK cycles and order-of-operations

- The Phase-A links formed a cycle (`Job.survivingProject → Project`, `Project.sourceJob → Job`).
  S1 breaks the cycle before any real fold work. If S1 is skipped, later slices that try to add
  new Job columns may deadlock against the reverse pointer.
- Every slice that adds a FK: (1) add nullable, (2) backfill, (3) enforce NOT NULL in a separate
  migration or a separate statement inside the same migration — never in the column-add itself.
- **Migration folder ordering.** Prisma loads folders alphabetically. A bare `YYYYMMDD_` folder
  sorts *before* a `YYYYMMDDHHMMSS_` folder on the same day. **All new folders in this workstream
  MUST use full 14-digit `YYYYMMDDHHMMSS_` timestamps** and keep backfill data **inline in the
  migration** (never in a separate seed). This rule is locked in `sot/04-data-model.md` R3.

### 6.5 Direction-reversal-specific risks

- The `sot/04` "Survivor-Spine Design" section is currently Project-canonical. Any agent that
  reads it (rather than this plan) will design in the wrong direction. **Blocking action:**
  `05-sot-keeper` MUST reconcile `sot/04` §3004+ and `sot/02` line 100 before S2 starts —
  otherwise a well-meaning agent will re-add Project-side scaffolding while another slice is
  removing it.
- **Do not run this workstream and B-P0b concurrently** — see §5.

---

## 7. Cross-references

- Decision brief: `docs/pr-prompts/BACKLOG-DECISIONS.md` §1 (2026-07-14) + Marco 2026-07-16
  reaffirmation.
- Original (now-reversed) design: `sot/04-data-model.md` §3004–3239. **Mechanics valid, direction
  wrong** — reference for expand→backfill→switch→contract pattern, R1–R9 risk register, and the
  multi-role guard rationale.
- Roadmap entry to fix: `sot/02-roadmap-and-status.md` L100.
- Shipped Phase-A: PRs #465, #468, #472, #474, #500 — see `sot/03-progress-log.md` entries
  2026-07-02 → 2026-07-07.
- Regeneration script: `scripts/data-model/build-relationship-map.mjs` (write) / `--check` (CI).

---

**END OF SLICE 0.** Every subsequent slice ships in its own PR under its own prompt.
