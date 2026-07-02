# Job / Project Consolidation — Survivor-Spine Design (B-P0a)

> **Status:** Design / analysis only. This document changes no schema, service,
> migration, or route. It is the plan of record for collapsing the duplicated
> `Job` and `Project` delivery entities into a single spine.
>
> **Decision date:** 2026-07-02 (Marco). **Scope owner:** WHS & Commercial Compliance.
> **Verified against:** `apps/api/prisma/schema.prisma` (3912 lines) and the
> `jobs` / `projects` / `tendering` / `contracts` modules at commit `d769b86`
> (`origin/main`). All line numbers below are from that tree.

---

## 1. Survivor + name decision

**`Project` survives as the delivery spine. `Job` is folded into it and retired.**
The user-facing name stays **"Job"** in the UX; the surviving table/model is
`Project` / `projects`.

### Evidence (schema + service, this checkout)

- **The new day-grain scheduler already binds to `Project`, not `Job`.**
  `ScheduleAllocation` (schema L2147) has `projectId -> Project` (L2153-2154) and
  `workerProfileId -> WorkerProfile` (L2156-2157). There is no `jobId` on it.
  Choosing `Job` would orphan the entire scheduler grid.
- **`Contract` binds to `Project` one-to-one.** `Contract.projectId` is
  `@unique @map("project_id")` with `project Project @relation(...)`
  (schema L2909-2910). `contracts.service.ts` is already Project-native — it
  reads `contract.project.sourceTenderId` (L366) and creates contracts against
  `dto.projectId` (L116-124). No contract code references `Job`.
- **Gantt binds to `Project` + `WorkerProfile`.** `GanttTask.projectId -> Project`
  (schema L3618-3619) and `assignedToId -> WorkerProfile` (L3627-3628).
  `projects/gantt.service.ts` and `gantt.controller.ts` live inside the projects
  module.
- **Timesheets and pre-starts bind to `Project` (+ `ProjectAllocation`).**
  `Timesheet.projectId -> Project` (L2280-2281) and
  `PreStartChecklist.projectId -> Project` (L2230-2231). Neither has a `jobId`.
- **`Project` carries the commercial delivery payload.** It holds
  `estimateSnapshot Json` (L1990), `contractValue` / `budget` / `actualCost`
  Decimals (L1973-1976), structured site address fields (L1968-1972),
  `requiredQualifications String[]` used by the competency gate (L1973), the
  `ProjectStatus` enum lifecycle (L1925-1932), scope items, milestones, and an
  activity log. `Job` has none of the estimate/contract/scope machinery.

### What `Job` contributes (must be preserved into `Project`)

- **The business-facing name "job"** — kept as UX label only.
- **The operational work breakdown**: `JobStage -> JobActivity -> Shift`
  (schema L993, L1013, L1130). `Project` has no equivalent nested WBS today
  (it has flat `ProjectScopeItem` + `ProjectMilestone`, L2018-2044).
- **Tender-conversion bridge semantics**: `JobConversion` (L979) records
  `tenderId`, `tenderClientId`, `jobId`, `carriedDocuments` — richer than the
  Project path, which only writes `sourceTenderId` and an activity-log row.
- **The `jobNumber` identity** `J{YYMMDD}-{SLUG}-{NNN}` (see
  `jobs/job-number.service.ts` L6-8, `format()` L49) vs Project's
  `IS-P{NNN}` (`projects.service.ts` L83). Number-scheme reconciliation is a
  first-class migration concern (see section 7).

---

## 2. Field + relation inventory

### 2.1 Field collisions (exist on BOTH models)

| Field | On `Job` | On `Project` | Resolution |
|---|---|---|---|
| identity number | `jobNumber` unique, `J{YYMMDD}-{SLUG}-{NNN}` (L941) | `projectNumber` unique, `IS-P{NNN}` (L1961) | **Keep both columns during transition.** `projectNumber` stays the DB key; `jobNumber` becomes an additional (nullable, unique) attribute on `Project` so the UX "Job number" survives. Do NOT drop either until section 6 slice -8. |
| `name` | `name String` (L944) | `name String` (L1962) | Same semantics -> single `Project.name`. Direct copy on backfill. |
| `clientId` | `clientId` -> Client, `onDelete: Restrict` (L946, L954) | `clientId` -> Client, `onDelete: Restrict` (L1966-1967) | Identical -> `Project.clientId`. Verify Job/Project client agree per source tender before backfill. |
| `sourceTenderId` | `@unique` (L948, L956) | **not unique** (L1964-1965) | **Collision + constraint mismatch.** Two rows (one Job, one Project) can share a tender today because Project's FK is not unique. Consolidation makes `Project.sourceTenderId` unique (see section 3, section 6 slice -3). |
| `status` | `String @default("PLANNING")` (L949) | `ProjectStatus` enum, default `MOBILISING` (L1963) | **Type collision.** Job's free-string status vs Project's enum. Map Job statuses into `ProjectStatus` (or extend the enum) during backfill; see section 6 slice -2 mapping. |
| `projectManagerId` | -> User, SetNull (L950, L957) | -> User, SetNull (L1981-1982) | Identical -> `Project.projectManagerId`. |
| `supervisorId` | -> User, SetNull (L951, L958) | -> User, SetNull (L1983-1984) | Identical -> `Project.supervisorId`. |
| site linkage | `siteId` -> `Site` (nullable, L947, L955) | structured `siteAddress*` fields (L1968-1972) | **Shape collision.** Job points at a `Site` row; Project inlines the address. Backfill: resolve `Job.site` -> the five `siteAddress*` columns; keep an optional `siteId` on `Project` if a normalised Site link is still wanted (decide in section 6 slice -2). |
| audit timestamps | `createdAt` / `updatedAt` (L952-953) | `createdAt` / `updatedAt` (L2006-2007) | Standard — no action. |

### 2.2 `Job` relation inventory -> disposition

| Job relation (schema line) | Target | Disposition on `Project` |
|---|---|---|
| `conversion JobConversion?` (L960) | tender bridge | **Move / merge.** Re-point `JobConversion.jobId` -> `projectId` (or fold its fields — `carriedDocuments`, `tenderClientId` — into the Project conversion path). See section 3. |
| `stages JobStage[]` (L961) | WBS level 1 | **Move onto Project.** Add `JobStage.projectId -> Project`; backfill from `Job.id -> Project.id` map. New WBS is Project-owned. |
| `activities JobActivity[]` (L962) | WBS level 2 | **Move onto Project** (transitively, via re-parented stages). `JobActivity.jobId` is re-pointed to `projectId`; `jobStageId` FK unchanged. |
| `shifts Shift[]` (L963) | operational shifts | **Move onto Project.** `Shift.jobId -> projectId`. See section 4 — Shift is the legacy allocation cluster and is scheduled for retirement, so this move may be a no-op if Shift is dropped instead. |
| `issues JobIssue[]` (L964) | delivery issues | **Move onto Project.** `JobIssue.jobId -> projectId`; rename table/model to `ProjectIssue` in a later cosmetic slice (optional). |
| `variations JobVariation[]` (L965) | scope variations | **Drop as duplicate / derive.** `Project` already reaches contract-level `Variation` via `Contract.variations` (L2923). `JobVariation` (L1065) and `Variation` (L2931) overlap. Decision: **keep the contract-linked `Variation`; migrate any `JobVariation` rows into it, then drop `JobVariation`.** Flagged as a data-merge risk in section 7. |
| `progressEntries JobProgressEntry[]` (L966) | progress log | **Move onto Project.** `JobProgressEntry.jobId -> projectId`. Complements Project's `activityLog` — keep both (different grain: progress % vs audit action). |
| `statusHistory JobStatusHistory[]` (L967) | status audit | **Derive / drop.** `ProjectActivityLog` with action `STATUS_CHANGED` (enum L1935) already records transitions. Migrate history into `ProjectActivityLog`, then drop `JobStatusHistory`. |
| `formSubmissions FormSubmission[]` (L968) | forms | **Re-point.** `FormSubmission` currently can attach to Job, Shift, Worker. Add/redirect its Project linkage; backfill Job-attached submissions to the mapped Project. |
| `closeout JobCloseout?` (L969) | closeout | **Move onto Project.** `JobCloseout.jobId -> projectId` (unique). Feeds the S6 Archive route. No Project-side closeout exists yet, so this is a clean move. |
| `correspondences CorrespondenceThread[]` (L970, relation "JobCorrespondence") | comms hub | **Re-point.** Redirect the `JobCorrespondence` relation to Project; backfill thread parent ids. |
| `jobNumber` (field, L941) | identity | **Move as attribute** onto `Project.jobNumber` (nullable/unique), per 2.1. |

### 2.3 `Project` relations that stay put (canonical)

`scopeItems`, `milestones`, `activityLog`, `documents` (`TenderDocumentLink`),
`allocations` (`ProjectAllocation`), `scheduleAllocations` (`ScheduleAllocation`),
`preStartChecklists`, `timesheets`, `contract`, `safetyIncidents`,
`hazardObservations`, `ganttTasks` (schema L1994-2005). None move; the folded
Job relations join them.

---

## 3. Tender-conversion unification

**Today there are two unlinked tender -> delivery paths (verified):**

1. **Project path — SURVIVES.** `ProjectsService.convertFromTender` (L535),
   exposed by `tendering/tender-convert.controller.ts` as
   `POST /tenders/:id/convert`. Requires `tender.status === "AWARDED"` (L557),
   allocates `IS-P###`, snapshots the estimate, flattens scope into
   `ProjectScopeItem`, re-parents `TenderDocumentLink`s, writes a
   `PROJECT_CREATED` activity row, notifies the PM. Guards against
   double-conversion via `findFirst({ sourceTenderId })` (L561-570).

2. **Job path — RETIRED.** `JobsService.convertTenderToJob` (L1145), exposed by
   `jobs/tender-conversion.controller.ts` as
   `POST /tenders/:tenderId/convert-to-job`. Requires an awarded **and**
   contracted client (`isAwarded && contractIssued`, L1158-1164), allocates a
   `jobNumber`, creates a `Job` + a `JobConversion` bridge (L1227-1245),
   provisions a SharePoint folder, and carries documents. Also present:
   `reuseArchivedJobConversion` (L1339) and `rollbackTenderLifecycle` (L1521).

### Divergence that must be reconciled

- **Gating differs**: Project path fires at `AWARDED`; Job path fires at
  `CONTRACT_ISSUED`. The unified path must define one lifecycle gate. Proposal:
  keep the Project path's `AWARDED` entry to create the `Project`, and treat the
  Job path's contract step as `ContractsService.create` against that Project
  (which already exists). i.e. **award -> convert-to-Project -> issue Contract**,
  removing the Job path's own contract gate.
- **`JobConversion` richness**: the Job path records `carriedDocuments`,
  `tenderClientId`, and archived-job reuse. The Project path only sets
  `sourceTenderId` + an activity row. **Preserve** `carriedDocuments` +
  `tenderClientId` by either (a) re-pointing `JobConversion.jobId -> projectId`,
  or (b) adding those two fields to the Project conversion activity payload.
  Slice section 6 -4 picks (a) to retain the bridge row as an audit artifact.

### Caller redirects

- `jobs/tender-conversion.controller.ts` — its `convert`,
  `reuseArchived`, and lifecycle routes are re-pointed to the Project path.
  Keep the old URL (`/convert-to-job`) as a thin alias delegating to
  `convertFromTender` during the transition, or 308-redirect it, so external
  callers don't break. Retire after clients migrate.
- `jobs.service.issueContract` (L1072) currently only flips
  `tenderClient.contractIssued` + tender status. Redirect its callers to
  `ContractsService.create` (Project-native, L116) so a real `Contract` row is
  produced.
- `contracts.service.ts` — **no change needed**; already Project-native
  (reads `contract.project.sourceTenderId`, L366).
- `Project.sourceTenderId` gains a **unique** constraint (matching Job's
  existing `@unique`, L948) so a tender maps to exactly one delivery row. This
  is the constraint change that makes the two paths safe to collapse.

---

## 4. Allocation-model reconciliation (design only — do NOT implement)

Three allocation representations exist today:

| Model | Grain | Binds to | Consumers | Fate |
|---|---|---|---|---|
| `Shift` (L1130) + `ShiftWorkerAssignment` (L1160) + `ShiftAssetAssignment` (L1176) + `SchedulingConflict` (L1189) + `ShiftRoleRequirement` | time-range (`startAt`/`endAt`), bound to **`Job`** via `jobId`/`jobActivityId` | legacy shift board; `Worker` (not `WorkerProfile`) via `ShiftWorkerAssignment.workerId` (L1167) | **Retire** the whole Shift cluster after ScheduleAllocation fully covers its use. |
| `ProjectAllocation` (L2105) | date **range** (`startDate`/`endDate`), bound to **`Project`** + `WorkerProfile`/`Asset` | timesheets, pre-starts, competency gate, `CompetencyOverride` | **Keep as a derived view** over `ScheduleAllocation` (a contiguous run of day rows collapses to one range) OR keep as-is short-term because timesheets/pre-starts FK to it (L2233-2234, L2285-2286). Not dropped in this project. |
| `ScheduleAllocation` (L2147) | **day-grain** (`date @db.Date`), bound to **`Project`** + `WorkerProfile` + `JobRole` | scheduler grid; eligibility/conflict computed on read | **Canonical.** Everything converges here. |

### Intended end state

- `ScheduleAllocation` is the single source of truth for who is on what
  project on which day, in which `JobRole`.
- `ProjectAllocation` is **derived** — presented as a range view materialised
  from contiguous `ScheduleAllocation` day rows — so timesheets and pre-starts
  keep a stable range anchor without a second hand-maintained table. (It may
  remain a real table backfilled from ScheduleAllocation until the derivation
  is built; the point is it stops being independently authored.)
- The `Shift` cluster is **retired**: its `jobId`/`jobActivityId` linkage dies
  with `Job`, and its assignments used the legacy `Worker` model (folded in
  B-P0b). Shifts do not move onto `Project`; they are dropped once no read path
  depends on them.

This section is **design intent only** — no allocation migration is authored
here. It scopes what later slices (and B-P0b for `Worker -> WorkerProfile`) must
achieve.

---

## 5. Multi-role guard (locked)

`ScheduleAllocation` carries the composite uniqueness key (schema L2166):

```prisma
@@unique([date, projectId, workerProfileId, jobRoleId], name: "schedule_alloc_worker_uniq")
```

Because `jobRoleId` is part of the key, **one worker can hold two different
`JobRole`s on the same project on the same day** — this is the intended,
locked behaviour.

- **This key MUST NOT be narrowed** to `(date, projectId, workerProfileId)`.
  Narrowing it would silently forbid multi-role-same-day and would fail the
  backfill for any worker already holding two roles.
- No migration is required to *establish* the role rule — it already exists.
- **A regression test that inserts two rows differing only by `jobRoleId` for
  the same `(date, projectId, workerProfileId)` and asserts both succeed belongs
  in the FIRST migration slice** (section 6 slice -1), so any later slice that
  touches `ScheduleAllocation` indexing cannot regress the rule unnoticed.

---

## 6. Phased migration plan

Small, individually shippable, reversible slices. Each is its own PR with its
own migration file(s). Follows **expand -> backfill -> switch reads -> switch
writes -> contract**. Migration folders use **full `YYYYMMDDHHMMSS_` timestamps**
(Prisma loads migrations alphabetically; bare `YYYYMMDD_` folders sort before
timestamped ones on the same day and reorder backfills — see section 7).

| Slice | PR | Phase | Migration file(s) | What it does |
|---|---|---|---|---|
| **B-P0a-1** | `improvement/s-bp0a1-guard-and-expand` | expand + guard | `YYYYMMDDHHMMSS_bp0a1_project_job_spine_expand` | Add nullable columns to `Project`: `jobNumber` (unique, nullable), optional `siteId`, and a `legacyJobId` back-pointer for backfill traceability. Add the **multi-role regression test** (section 5). No data moved yet. Reversible: drop the new columns. |
| **B-P0a-2** | `improvement/s-bp0a2-status-and-site-map` | backfill (attributes) | `YYYYMMDDHHMMSS_bp0a2_backfill_job_attributes` | Build the `Job.id -> Project.id` map keyed by `sourceTenderId` (both have it) and by client+name for tender-less jobs. Backfill `Project.jobNumber`, map free-string `Job.status -> ProjectStatus` (mapping inline in the migration), resolve `Job.siteId -> siteAddress*`. Inline `INSERT ... SELECT` data steps. Reversible: null the backfilled columns. |
| **B-P0a-3** | `improvement/s-bp0a3-source-tender-unique` | contract (constraint) | `YYYYMMDDHHMMSS_bp0a3_project_source_tender_unique` | After verifying no duplicate `sourceTenderId` across the mapped set, add `@unique` to `Project.sourceTenderId`. Reversible: drop the unique index. **Blocked until -2 proves 1:1 mapping.** |
| **B-P0a-4** | `improvement/s-bp0a4-conversion-unify` | switch writes (conversion) | `YYYYMMDDHHMMSS_bp0a4_reparent_job_conversion` | Re-point `JobConversion.jobId -> projectId`; unify the two tender paths (section 3): `/convert-to-job` becomes an alias of `convertFromTender`; `jobs.issueContract` delegates to `ContractsService.create`. Reversible: restore the alias->own-impl and the FK. |
| **B-P0a-5** | `improvement/s-bp0a5-move-wbs` | backfill + switch (WBS) | `YYYYMMDDHHMMSS_bp0a5_reparent_stages_activities` | Add `projectId` to `JobStage` / `JobActivity` / `JobProgressEntry` / `JobCloseout` / `JobIssue`; backfill via the -2 map; switch read/write paths to Project. Reversible: keep `jobId` columns until -8. |
| **B-P0a-6** | `improvement/s-bp0a6-merge-variations` | backfill (merge) | `YYYYMMDDHHMMSS_bp0a6_merge_job_variations` | Merge `JobVariation` rows into contract-linked `Variation` (2.2); merge `JobStatusHistory` into `ProjectActivityLog`. Reversible only via re-import from a pre-migration snapshot — **flagged high-risk** (section 7). |
| **B-P0a-7** | `improvement/s-bp0a7-forms-comms` | switch (edges) | `YYYYMMDDHHMMSS_bp0a7_reparent_forms_correspondence` | Re-point `FormSubmission` and `CorrespondenceThread` Job linkages to Project; backfill. Reversible: restore Job linkage. |
| **B-P0a-8** | `improvement/s-bp0a8-contract-job` | contract (drop) | `YYYYMMDDHHMMSS_bp0a8_drop_job_tables` | After a soak period with all reads on Project, drop `jobId` columns and the legacy `Job` / `JobConversion` (if fully folded) / `JobStage.jobId` etc. columns and finally the `jobs` table. **Irreversible without snapshot restore** — gated on green metrics from -1..-7. |
| **B-P0a-9** (optional) | `improvement/s-bp0a9-shift-retire` | contract (allocation) | `YYYYMMDDHHMMSS_bp0a9_retire_shift_cluster` | Retire the `Shift` cluster per section 4 once ScheduleAllocation covers its use. Coordinate with B-P0b (`Worker -> WorkerProfile`). Reversible until the table drop step. |

Slices -1 through -4 are safe and low-risk. -6 and -8 are the destructive ones
and must not ship until earlier slices are soaked in production.

---

## 7. Risk + rollback register

| # | Risk | Likelihood | Impact | Mitigation / rollback |
|---|---|---|---|---|
| R1 | **Data loss on Job->Project merge** (variations, status history in -6; table drop in -8). | Med | High | Take a full DB snapshot immediately before -6 and -8. Never combine a backfill and a drop in one slice. Rollback = restore snapshot; forward-only otherwise. |
| R2 | **`sourceTenderId` duplicate blocks the unique constraint** (-3): a tender that was converted down *both* paths yields two rows. | Med | High | -2 emits a report of tenders with both a Job and a Project. Resolve (pick survivor, merge children) before -3. -3 aborts if any duplicate remains. Rollback: drop the unique index. |
| R3 | **Migration ordering / alphabetical load.** Prisma loads folders alphabetically; a bare `YYYYMMDD_` folder sorts *before* a `YYYYMMDDHHMMSS_` folder on the same day, so a backfill can run before the column it fills exists. | Med | High | **All new folders use full 14-digit `YYYYMMDDHHMMSS_` timestamps.** Keep backfill data **inline** in the migration (INSERT/UPDATE ... SELECT), never in a separate seed that could reorder. Verify order with `prisma migrate status` before applying. |
| R4 | **FK / backfill ordering within a slice**: re-parenting children before the parent map is built produces orphans. | Med | Med | Each slice: (1) add nullable FK, (2) backfill from the `-2` map, (3) only then enforce NOT NULL / switch writes. Never enforce NOT NULL in the same statement as the column add. |
| R5 | **Status enum coercion** (-2): a free-string `Job.status` value has no `ProjectStatus` member. | Low | Med | Ship the mapping inline in -2; unmapped values fall to `MOBILISING` with an activity-log note. Extend `ProjectStatus` first if a genuine new state exists. |
| R6 | **Multi-role rule regressed** by a later index change. | Low | High | Regression test locked in -1 (section 5). CI fails if `schedule_alloc_worker_uniq` loses `jobRoleId`. |
| R7 | **External callers of `/tenders/:id/convert-to-job` break** when the Job path retires. | Med | Med | -4 keeps the old route as an alias/redirect to `convertFromTender`; retire only after telemetry shows no traffic. |
| R8 | **Number-scheme confusion**: `jobNumber` (`J...`) and `projectNumber` (`IS-P...`) coexist on one row. | Low | Low | Keep both columns; UX shows the label "Job number" over `jobNumber`. No renumbering of historical rows. |
| R9 | **Shift retirement (-9) removes data still read somewhere.** | Med | Med | Audit all `Shift`/`ShiftWorkerAssignment` readers first; -9 is optional and gated on B-P0b. Reversible until the final table drop. |

### Rollback per slice (summary)

- **-1, -3, -4, -5, -7:** reversible by dropping the added column/constraint or
  restoring the previous route/FK; no data destroyed.
- **-2:** reversible by nulling backfilled columns.
- **-6, -8:** **destructive** — rollback is snapshot restore only. Gate behind a
  soak period and an explicit go/no-go.
- **-9:** reversible until the table-drop step.

---

## Appendix — verified reference points (commit d769b86)

- `Job` model — schema **L940**; `jobNumber` unique L941; `sourceTenderId @unique` L948.
- `Project` model — schema **L1960**; `sourceTenderId` (not unique) L1964; `estimateSnapshot` L1990.
- `JobConversion` — L979; `JobStage` L993; `JobActivity` L1013; `Shift` L1130.
- `WorkerProfile` — L2068; `ProjectAllocation` L2105; `ScheduleAllocation` L2147.
- `schedule_alloc_worker_uniq` — L2166.
- `GanttTask` — L3616; `Contract` — L2907 (unique `projectId`).
- `ProjectsService.convertFromTender` — `projects.service.ts` L535.
- `JobsService.convertTenderToJob` — `jobs.service.ts` L1145; `issueContract` L1072.
- `TenderConvertController` (project path) — `tendering/tender-convert.controller.ts` L48 (`POST /tenders/:id/convert`).
- `TenderConversionController` (job path) — `jobs/tender-conversion.controller.ts` (`POST /tenders/:tenderId/convert-to-job`).
- Web routes — `apps/web/src/App.tsx` L197-200 (`/jobs`, `/jobs/:id`, `/projects`, `/projects/:id`).
