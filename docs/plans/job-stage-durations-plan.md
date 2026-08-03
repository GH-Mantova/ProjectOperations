# Job & Stage durations that drive scheduler resource allocation — SLICE-0 plan

**Status:** draft 2026-08-03 (Marco: "I need to be able to enter, edit and delete the
duration of each job and/or its stages, so I can then allocate resources on the scheduler").
Every finding below was pinned against `origin/main` HEAD on 2026-08-03.
**Owner:** Marco / ProjectOperations desktop-shell + api.
**Rule:** every code slice chains behind this document (`requires_merged`). Slices ship
independently, each ≤ ~10 files, each CI-green. The one slice that carries a Prisma
migration declares `gate_allow: migrations` + a `rollback_strategy` in its own front-matter.

This is the PLAN ONLY (`scope: docs/plans/**`). Nothing here is irreversible.

---

## 1. Motivation and what this plan replaces

Verified defects on `origin/main` (file:line pins to keep future readers honest):

1. **`Job` carries no duration and no dates.** `apps/api/prisma/schema.prisma:1351-1400` —
   the `Job` model has `status`, `projectManagerId`, `supervisorId`, `stages`, `activities`,
   `shifts` etc., but **no** `startDate`, `endDate`, `plannedDurationDays`, or any temporal
   window. There is nothing to enter, edit, or delete at the job level.
2. **`JobStage` has `startDate`/`endDate` but they are un-enterable from the UI.**
   `apps/api/prisma/schema.prisma:1416-1434` declares both fields nullable. The API accepts
   them on create/update — `apps/api/src/modules/jobs/dto/job-delivery.dto.ts:61-73`
   (`CreateJobStageDto` / `UpdateJobStageDto`, both `@IsOptional() @IsDateString()`) and
   `apps/api/src/modules/jobs/jobs.controller.ts:125-152`
   (`POST /jobs/:id/stages`, `PATCH /jobs/:id/stages/:stageId`). But the
   JobDetailPage "Stages & Activities" tab is **read-only** for stages:
   `apps/web/src/pages/jobs/JobDetailPage.tsx:491-560` renders each stage's title, status,
   and activity count only — no create form, no inline editors, no date pickers, no delete
   affordance. `startDate`/`endDate` are declared in the local `JobStage` type
   (`JobDetailPage.tsx:22-33`) and never read.
3. **No `DELETE /jobs/:id/stages/:stageId` endpoint.** Grepped
   `apps/api/src/modules/jobs` — the controller exposes create + update only; deletion
   would fall back to cascade-from-job or manual DB edit. Marco's requirement
   ("**enter, edit and delete**") is un-buildable without adding this route.
4. **The scheduler does not consume any job/stage duration.**
   `apps/api/prisma/schema.prisma:1587-1616` — `Shift` binds to Job + JobStage + JobActivity
   and carries its own `startAt`/`endAt`. The scheduler wizard in
   `apps/web/src/pages/SchedulerPage.tsx:116-121,1450-1454` inputs shift datetimes
   per-shift; nothing pre-populates from a stage window. `ScheduleAllocation`
   (`apps/api/prisma/schema.prisma:2832-2858`) is a **second** allocation surface, keyed by
   `(date, projectId, workerProfileId | assetId, jobRoleId)` — a per-day role-based grid,
   not a duration consumer. Result: today the "duration" that drives resource allocation is
   whatever a user types into the shift form, one shift at a time — the job/stage has no
   say.
5. **Job↔Project model merge is queued but unstarted.**
   `docs/pr-prompts/pr-plan-model-merge-slice0-ready.md` is Phase-A of the B-P0a merge
   (Marco 2026-08-03: prioritise Job↔Project first). `Job.survivingProjectId` unique pointer
   (`schema.prisma:1361,1370`) and the reciprocal on `Project` are already in the schema as
   merge scaffolding; `ScheduleAllocation.projectId` (`schema.prisma:2835`) still points at
   `Project` while `Shift.jobId` (`schema.prisma:1589`) points at `Job`. Any duration this
   plan lands on `Job` (or on `JobStage`) MUST survive the eventual merge without a rename
   dance — see §5.1 sequencing.

**Already queued elsewhere — this plan does NOT re-plan these:**
- Job↔Project model merge program (`pr-plan-model-merge-slice0-ready.md` and the
  downstream `pr-nav-jobs-projects-merge-HOLD.md`). This plan REUSES its convergence but
  does not duplicate it.
- Scheduler grid rewrites, Shift consolidation, `ScheduleAllocation` deprecation — out of
  scope; see §7.

---

## 2. Target state (final)

**Job-level duration (window):**
- `Job.plannedStartDate DateTime? @db.Date` (append-only, nullable — respects sot/01 §7
  append-only movement rule).
- `Job.plannedEndDate DateTime? @db.Date` (append-only, nullable).
- Derived, not stored: `plannedDurationDays = daysBetween(plannedStartDate, plannedEndDate)`
  when both are set. The client and API expose it as a computed field; it is never persisted
  (avoids the two-writer skew problem where `durationDays` and `end - start` disagree).
- Interpretation: the **planning window** for the whole job. Not a contract SLA, not an
  actual-vs-planned tracking axis (those are separate future work; see §7).

**Stage-level duration:** already exists as `JobStage.startDate` + `JobStage.endDate`
(nullable). This plan does NOT add a new column at the stage level — it wires those two
into a first-class editable surface. Rationale: adding a third field (`durationDays`)
alongside the existing two would create the same two-writer skew problem the job-level
choice avoids.

**Roll-up invariants (validated server-side, warned client-side — never auto-clamped):**
- If `Job.plannedStartDate` and `Job.plannedEndDate` are both set: `start <= end` (hard).
- If a stage carries dates: `stage.startDate >= job.plannedStartDate` when both set (soft
  warning — construction reality permits early mobilisation).
- If a stage carries dates: `stage.endDate <= job.plannedEndDate` when both set (soft
  warning — a stage over-run is a real event, not a validation failure).
- Sum of stage-window lengths ≤ (job window length + some slack) is NOT enforced —
  parallel stages are a first-class case in construction. Non-negative window lengths ARE
  enforced.

**CRUD surface (enter / edit / delete):**
- Job: header form on the Job Detail page picks up two new date inputs
  (`plannedStartDate`, `plannedEndDate`) alongside the existing PM/supervisor fields;
  cleared to `null` empties the job window.
- Stage: the "Stages & Activities" tab gains an inline row-editor per stage
  (start-date + end-date pickers + status + name), a "New stage" affordance
  (already backed by the existing `POST /jobs/:id/stages` route), and a delete affordance
  (which needs a new `DELETE /jobs/:id/stages/:stageId` route — see slice 3).
- Permissions: all writes gated by the existing `jobs.manage` code
  (`jobs.controller.ts:126,138,155,167`). No new permission codes.

**Scheduler consumption (the value Marco is after):**
- When a user opens the shift creation wizard from a job, the start/end date-time inputs
  default to that job's `plannedStartDate` (00:00 local) and the same day + the shop-hours
  end time, if set. Choosing a stage in the wizard further narrows the defaults to that
  stage's `startDate` / `endDate` when present. Both are pre-fills, not hard clamps — a user
  can still type outside the window (with a soft warning).
- The scheduler grid ranges (month/week strip in `SchedulerPage.tsx:425-479`) will highlight
  each job's `[plannedStartDate, plannedEndDate]` band as a background lane so an allocator
  can see the intended window at a glance. No allocation math changes in this plan — the
  existing conflict detector still runs on Shift datetimes; the window is decorative +
  pre-fill.
- Full "the job window automatically fans out into shifts on a resource grid" (auto-
  allocation) is explicitly OUT of scope here (§7) — planned as a follow-on program once
  the durations are enterable and observable.

**Non-goals in this plan (see §7 for the full list):**
- No actual vs planned tracking column set.
- No auto-generation of shifts from a job/stage window.
- No cross-job dependency graph / critical path.

---

## 3. Slice list (ordered, independently shippable)

Each slice ≤ ~10 files. Dependency edges expressed as `requires_merged`. All slices are
docs-and-code (never mixed with `/sot/` edits). One dedicated sot doc-reconcile slice sits
at the end.

### SLICE 0 — this document (docs-only) `size:1`
- **Files:** `docs/plans/job-stage-durations-plan.md`.
- **Gate/CI:** `pnpm build && pnpm lint`.
- **Requires:** nothing (but note the sequencing pin on the model-merge plan — see §5.1).
- **Notes:** binds every slice below.

### SLICE 1 — API: `DELETE /jobs/:id/stages/:stageId` (missing today) `size:4`
- **Files:** `apps/api/src/modules/jobs/jobs.controller.ts` (new `@Delete` handler mirroring
  the update handler's shape); `apps/api/src/modules/jobs/jobs.service.ts` (new
  `deleteStage(id, stageId, actorSub)` method — Cascade removes activities/shifts under
  the stage per `schema.prisma:1427,1450,1602`; write an AuditLog row `job.stage.deleted`);
  `apps/api/src/modules/jobs/__tests__/jobs.service.spec.ts` (add coverage: happy path,
  wrong-job stage → 404, archived job → 400 mirroring existing archive guards);
  optionally `apps/web/src/services/job-detail.service.ts` or its equivalent to expose the
  fetch wrapper (if a thin service layer already fronts the API; if not, deferred to slice 4).
- **Non-goal:** no UI in this slice — the button lands in slice 4.
- **Gate/CI:** `pnpm build && pnpm lint && pnpm test:api`.
- **Requires:** SLICE 0.

### SLICE 2 — Schema: append `Job.plannedStartDate` / `plannedEndDate` `size:5`
- **Files:** `apps/api/prisma/schema.prisma` (two nullable `DateTime? @db.Date` columns +
  `@map` to snake_case per house style at `schema.prisma:1362-1366`); new migration file
  under `apps/api/prisma/migrations/<ts>_job_planned_window/migration.sql` (pure additive
  `ALTER TABLE jobs ADD COLUMN ... NULL`); regen the data-model catalog files gitignored
  outputs (per `MEMORY.md` note: **regenerate + commit `metadata-catalog.json` on any model
  add/rename**, other three regenerated outputs stay gitignored); a smoke test in
  `apps/api/src/modules/jobs/__tests__/jobs.service.spec.ts` that a job written with both
  fields round-trips them.
- **Migration front-matter (this slice only):** `gate_allow: migrations`,
  `rollback_strategy: drop the two columns (both nullable, unindexed, no FKs pointing at
  them; no downstream code reads them until slice 3 merges, so a rollback in the window
  slice-2-merged→slice-3-open is a pure ALTER TABLE DROP).`
- **Gate/CI:** `pnpm build && pnpm lint && pnpm test:api` + migration dry-run in CI.
- **Requires:** SLICE 0. **Sequencing pin:** see §5.1 — do NOT merge until the
  model-merge SLICE 0 (`docs/plans/model-merge-plan.md`) has landed on main and its
  disposition for the Job entity name is fixed. If model-merge decides Job is renamed to
  Project as part of Phase A, this slice's migration adds the columns under whichever
  table name model-merge Phase A leaves standing.

### SLICE 3 — API: accept `plannedStartDate`/`plannedEndDate` on Job DTOs + roll-up validators `size:5`
- **Files:** `apps/api/src/modules/jobs/dto/job-delivery.dto.ts` (extend `CreateJobDto` and
  `UpdateJobDto` — both currently accept scalar fields; wire the two new dates as
  `@IsOptional() @IsDateString()`; add a `@ValidateIf` or class-level validator asserting
  `start <= end` when both present); `apps/api/src/modules/jobs/jobs.service.ts`
  (persist on create/update; emit soft-warning payload in the response — do NOT throw for
  the stage-outside-job case, return `warnings: string[]`);
  `apps/api/src/modules/jobs/__tests__/jobs.service.spec.ts` (validator coverage:
  start-only, end-only, both set + valid, both set + inverted, roll-up soft-warning).
- **Non-goal:** no UI.
- **Gate/CI:** `pnpm build && pnpm lint && pnpm test:api`.
- **Requires:** SLICES 0, 2.

### SLICE 4 — UI: Job header date inputs + Stages-tab CRUD `size:8`
- **Files:** `apps/web/src/pages/jobs/JobDetailPage.tsx` (add two date inputs to the header
  edit form; extend the `JobDetail` local type at line 76-99 to carry the two new dates;
  extend the "Stages & Activities" tab at line 491-560 with (a) an inline row-editor per
  stage exposing `startDate`, `endDate`, `name`, `status`; (b) a "New stage" button + inline
  form; (c) a delete button per stage guarded by a confirm dialog; render soft-warning
  strings returned by the API next to the offending field); a small
  `StageRowEditor.tsx` component under `apps/web/src/components/jobs/` if the row shape gets
  above ~120 lines (split for readability); an accompanying unit test spec
  `apps/web/src/pages/jobs/__tests__/JobDetailPage.stages.test.tsx`;
  `apps/web/src/pages/jobs/__tests__/JobDetailPage.b01-1.test.tsx` update if it asserts on
  the read-only shape of the stages tab; new e2e coverage in
  `tests/e2e/pr-acceptance/batch1-jobs.spec.ts` (or the nearest existing job spec — grep at
  PR-open time; do NOT create a new batch file unless none fits).
- **Gate/CI:** `pnpm build && pnpm lint && pnpm test:web:logic` + the e2e spec.
- **Requires:** SLICES 1, 3.

### SLICE 5 — Scheduler: pre-fill shift datetimes from job/stage window `size:5`
- **Files:** `apps/web/src/pages/SchedulerPage.tsx` — extend the shift-creation flow at
  `SchedulerPage.tsx:116-121` (initial `shiftForm` state) and the prefill effect at
  `SchedulerPage.tsx:325-340` so that when a job + stage are selected, the `startAt`/`endAt`
  defaults resolve in this order: (1) stage `startDate`/`endDate` at 08:00-17:00 local when
  present; (2) job `plannedStartDate`/`plannedEndDate` at the same hours when present;
  (3) today's shop-hours as today. Do not overwrite user-entered values; only fill when
  the field is empty. Add a test in
  `apps/web/src/pages/scheduler/__tests__/schedulerGridHelpers.test.ts` (or a new
  `shiftFormDefaults.test.ts`) covering the three-tier fallback.
- **Non-goal:** no auto-shift-generation, no hard clamp, no ScheduleAllocation change.
- **Gate/CI:** `pnpm build && pnpm lint && pnpm test:web:logic`.
- **Requires:** SLICE 4.

### SLICE 6 — Scheduler: render the job window as a background lane `size:4`
- **Files:** `apps/web/src/pages/SchedulerPage.tsx` (the month strip at
  `SchedulerPage.tsx:425-479` — add a background band per job that carries a window; keep
  it purely visual, no click-to-allocate);
  `apps/web/src/pages/scheduler/schedulerGridHelpers.ts` (helper: `jobWindowBands(jobs)`
  returning `{ jobId, startDayIndex, endDayIndex }[]`);
  `apps/web/src/pages/scheduler/__tests__/schedulerGridHelpers.test.ts` (helper unit tests:
  window inside range, window straddling range start, window straddling range end, no
  window).
- **Non-goal:** no interactive UX on the band (right-click / drag), no colour semantics
  tied to over-run — a follow-on program.
- **Gate/CI:** `pnpm build && pnpm lint && pnpm test:web:logic`.
- **Requires:** SLICE 5.

### SLICE 7 — sot doc-reconcile (docs-only, tail) `size:1`
- **Files:** `sot/01-charter-and-architecture.md` (Job spine paragraph updated to list the
  two new job-window columns and to link the stage window fields); `sot/04-data-model.md`
  (Job / JobStage rows updated); `sot/03-progress-log.md` (add a "Job durations wired into
  the scheduler" line dated at merge time).
- **Docs-only PR, never mixed with code (CP-24 sot-purity gate blocks the mix).**
- **Gate/CI:** `pnpm lint`.
- **Requires:** SLICES 1-6 all merged.

---

## 4. Redirect map (old URL → new home)

None. No routes move or die. Every URL currently in `App.tsx` for the Job area and the
Scheduler area keeps its shape. Left in the table for house-style parity:

| Old URL | Disposition | New URL / notes | Slice |
|---------|-------------|-----------------|-------|
| (none)  | —           | plan adds new fields to existing surfaces only | — |

---

## 5. Risks

### 5.1 Collision with the Job↔Project model-merge program (highest risk)
`docs/pr-prompts/pr-plan-model-merge-slice0-ready.md` will produce
`docs/plans/model-merge-plan.md` and then Phase-A slices that touch `Job`, `Project`,
`Job.survivingProjectId`, and both entities' scheduler bindings
(`Shift.jobId` vs `ScheduleAllocation.projectId`). If **this** plan's schema slice
(SLICE 2) adds columns to `Job` and Phase A then renames `Job` to `Project`, the
migration ordering matters.

Mitigation:
- SLICE 0 (this doc) is safe to land immediately — plan-only.
- SLICE 1 (DELETE endpoint) is safe to land ahead of model-merge — no schema change,
  the route survives a rename because the controller is per-entity.
- SLICES 2-6 pin `requires_merged` to the model-merge SLICE-0 landing at minimum, and
  should ideally wait for model-merge Phase A's naming decision (documented in
  `docs/plans/model-merge-plan.md` §Phase A "which entity survives user-facing"). If Marco
  authorises interleaving, the PR body for each of SLICES 2-6 MUST cite the
  model-merge slice it assumes and note the rename-rewrite cost.
- Under NO circumstance run SLICES 2-6 in parallel with an in-flight model-merge Phase-A
  slice — the standing rule "these merges run STRICTLY ONE AT A TIME" from
  `pr-plan-model-merge-slice0-ready.md:18` applies to any schema slice on Job/Project.

### 5.2 Two-writer skew if a `durationDays` column ever gets added
The plan explicitly stores `[start, end]` and derives duration on read. If a future PR
adds a persisted `durationDays` alongside, the two-writer problem returns (a client can
write duration without updating end, or vice-versa). Add a lint rule on the schema in
SLICE 2 comment ("do not add a persisted `durationDays` — derived only") to make the
choice discoverable.

### 5.3 Scheduler double-count / conflict-detector drift
Today `Shift` is the sole allocation grain the conflict detector reads
(`apps/api/src/modules/scheduler/scheduler.service.ts`). This plan does not add a new
allocation grain; the job/stage window is decorative + pre-fill only. But a future
"auto-fan windows into shifts" program MUST re-read the conflict detector before doing
so — a poorly-scoped follow-on could produce N shifts overlapping an existing one and
flood `SchedulingConflict` rows. Flagged here so the follow-on plan can start from a
warning, not a discovery.

### 5.4 e2e specs that assert stages-tab read-only shape
`apps/web/src/pages/jobs/__tests__/JobDetailPage.b01-1.test.tsx` today walks the flat
activities list and asserts on stage titles + activity toggles. It does not assert
"stages are read-only", but SLICE 4 will add edit buttons + a new-stage form to the same
DOM. The unit test MUST be updated in SLICE 4. Grep at PR-open time for any e2e that
hard-asserts stage-row shape:
- `tests/e2e/pr-acceptance/batch1-jobs.spec.ts` (if it exists — grep at PR time)
- `tests/e2e/pr-acceptance/batch1-jobs*.spec.ts`
- Any spec that mentions `job-tree__stage` or `.job-tree__stage-head`.
Each SLICE 4 PR body lists the specs it touched.

### 5.5 Soft-warnings vs hard-errors
This plan treats "stage window outside job window" as a warning, not an error, because
construction reality (early mobilisation, over-run) is normal. If Marco later wants
these to hard-error, that is a one-line change in the SLICE 3 validator but a
behaviour-visible one — call it out on the PR so Marco can flip the toggle at review.

### 5.6 Permission code footprint
This plan does not add new permission codes; every write is `jobs.manage`. If Marco wants
duration-editing to be gated separately from other job field edits (e.g. a PM can edit
schedule but not header), a follow-on slice adds `jobs.schedule` — deferred, not planned
here.

### 5.7 CI blind spot on scheduler helpers
`.github/workflows/ci.yml` runs `pnpm test:web:logic` for the web layer, which per the
settings-restructure plan §5.2 is Tendering-smoke only unless SLICE 2 of that plan lands
first. Slices 5 and 6 add helper tests under `apps/web/src/pages/scheduler/__tests__/`;
if the settings-restructure SLICE 2 has NOT landed at time of merge, the SLICE-5/6 PR
body must paste the local `pnpm --filter @project-ops/web test` output as evidence.

---

## 6. Out of scope

- Auto-generation of shifts from a job/stage window (a follow-on program: "the window
  fans out into a resource plan on the scheduler grid"). This plan makes the window
  enterable + observable; the auto-plan follows.
- Actual-vs-planned tracking columns (`actualStartDate`, `actualEndDate`,
  `progressToDate`). `JobStage` already carries a `status` and there is a
  `JobProgressEntry` model — the tracking axis is a separate initiative.
- Cross-job dependency graph, critical path, gantt view. Deferred.
- Split of `Shift` vs `ScheduleAllocation` into a single allocation model. Deferred, and
  gated by the model-merge program.
- Any change to `ScheduleAllocation` (`schema.prisma:2832-2858`) — this plan touches
  `Job`/`JobStage` only. The allocation controller and service are untouched.
- Any new permission code (`jobs.schedule` etc.) — see risk §5.6.
- Job archive-guard changes — existing archive-guard behaviour on stages continues to
  apply unchanged (SLICE 3 respects the same archived-job 400 that update currently
  raises).
- Mobile / Field-side surfaces — no FIELD nav changes (Marco standing: "FIELD nav is
  untouched").
- Any `/sot/` write outside SLICE 7.

---

## 7. Verification of this document

- [x] `test -f docs/plans/job-stage-durations-plan.md`
- [x] Every referenced schema line, DTO, controller route, and UI location is pinned to
      a file:line seen on origin/main 2026-08-03.
- [x] Every slice ≤ ~10 files.
- [x] Exactly one slice carries a migration; it declares `gate_allow: migrations` +
      `rollback_strategy` (SLICE 2).
- [x] Sequencing pin against `pr-plan-model-merge-slice0-ready.md` recorded in §5.1.
- [x] sot doc-reconcile lives in its own docs-only slice at the tail (SLICE 7).
- [ ] `pnpm build && pnpm lint` (run at PR-open time).
