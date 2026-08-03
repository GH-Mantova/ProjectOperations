# Model Merge Program Plan — B-P0a (Job ↔ Project) then B-P0b (Worker ↔ WorkerProfile)

**Owner:** Marco · **Author:** Claude · **Status:** SLICE-0 plan (docs-only)
**Ruling (2026-08-03):** Prioritise Job↔Project (Phase A). Sequence Worker↔WorkerProfile (Phase B)
STRICTLY BEHIND Phase A. Standing rule: these merges run **ONE AT A TIME**, never concurrently.

This document is a program-level roadmap. The per-slice designs already exist in
`sot/04-data-model.md` (survivor-spine design for both merges, §B-P0a lines 3155–3413 and §B-P0b
lines 3415–3717). This plan **references** those designs — it does not re-derive them. What it
adds: cross-phase sequencing, PENDING-MARCO calls, arm/hold policy for downstream prompts,
UI-cutover ordering, and rollback windows.

---

## 1. Purpose

Two entity duplications block the whole domain:

- **Job vs Project** — the same delivery entity split across two tables. Root cause of the
  `/projects` orphan surface, the dual-model scheduler (Shift→Job, ScheduleAllocation→Project),
  the `Site → jobs vs projects` split, and the tender-conversion double path.
- **Worker vs WorkerProfile** — the same person split across two tables. Root cause of the
  scheduler resourcing bifurcation (`ShiftWorkerAssignment.workerId` vs
  `ScheduleAllocation.workerProfileId`), duplicated qualifications
  (`WorkerCompetency` vs `WorkerQualification`), and the two-doors problem in
  `master-data` / `resources` / `workers`.

Both merges are the LOCKED P0 blocker for the scheduler grid rewrite
(`sot/04-data-model.md:4284–4286`).

## 2. Standing authority & sequencing rule

- Phase A (B-P0a) runs to completion — every slice merged, soak period elapsed,
  `Job` table dropped (`sot/04-data-model.md:3370`, slice B-P0a-8) — **before** any Phase B slice
  is armed. The one exception is B-P0b-6 (crews) which per `sot/04-data-model.md:3630` has no
  B-P0a dependency and may be scheduled independently on Marco's cue.
- Neither phase is auto-arm. Code slices are Marco-present only; watcher NEVER stages any
  `B-P0a-*` or `B-P0b-*` prompt (`docs/pr-prompts/BACKLOG.yaml:124–132` — discharge rule).
- Downstream UI merge (`docs/pr-prompts/pr-nav-jobs-projects-merge-HOLD.md`) stays HOLD until
  the LAST Phase A slice merges. See §7.

## 3. Grounding — current state (file:line)

### 3.1 Schema (`apps/api/prisma/schema.prisma`)

| Model | Lines | Key merge fields |
|---|---|---|
| `Job` | 1351–1400 | `sourceTenderId @unique` (1360), `survivingProjectId @unique` (1361), rel `survivingProject` (1370), `reverseSourceOf` (1371), `@@index([survivingProjectId])` (1398) |
| `Project` | 2591–2657 | `sourceTenderId @unique` (2598), `sourceJobId @unique` (2600), rel `sourceJob` (2601), `reverseSurvivorOf` (2602), `@@index([sourceJobId])` (2655) |
| `Shift` | 1587–1616 | `jobId` (1589), rel `job` (1601), `ShiftWorkerAssignment[]`, `ShiftAssetAssignment[]` (1605–1606) |
| `ScheduleAllocation` | 2832–2858 | `projectId` (2835), rel `project` (2836), `@@unique([date, projectId, workerProfileId, jobRoleId])` (2851) |
| `Worker` | 906–935 | `userId? @unique` (908), `employeeCode? @unique` (910), rels `crewMemberships`, `competencies`, `shiftAssignments` (922–929) |
| `WorkerProfile` | 2750–2788 | `internalUserId?` (2765), `hasMobileAccess`, `locationConsent*` (2763–2769), rels `scheduleAllocations`, `timesheets`, `qualifications`, `leaves`, `unavailabilities`, `siteAttendances`, `musterAttendees` (2770–2781) |

In-flight merge pointers (`survivingProjectId`, `sourceJobId`, matched `sourceTenderId @unique`
on both sides) are the survivor-spine scaffolding already merged per §B-P0a-1..-3 design.

### 3.2 API consumers

- **Job side:** `apps/api/src/modules/jobs/jobs.controller.ts`,
  `apps/api/src/modules/jobs/tender-conversion.controller.ts`.
- **Project side:** `apps/api/src/modules/projects/projects.controller.ts`,
  `apps/api/src/modules/projects/daily-diary.controller.ts`,
  `apps/api/src/modules/projects/gantt.controller.ts`,
  `apps/api/src/modules/projects/jpm.controller.ts`,
  `apps/api/src/modules/allocations/allocations.controller.ts`.
- **Scheduler:** `apps/api/src/modules/scheduler/scheduler.controller.ts` (Shift & ScheduleAllocation).
- **Field:** `apps/api/src/modules/field/*` (WorkerProfile).
- **Workers:** `apps/api/src/modules/workers/*` (Worker CRUD).

### 3.3 Web UI consumers (`apps/web/src`)

| Surface | File |
|---|---|
| Jobs list | `pages/jobs/JobsListPage.tsx` |
| Job detail | `pages/jobs/JobDetailPage.tsx` |
| Legacy jobs (if still live) | `pages/JobsPage.tsx` |
| Projects list | `pages/projects/ProjectsListPage.tsx` |
| Project detail | `pages/projects/ProjectDetailPage.tsx` |
| Portal jobs | `portal/pages/PortalJobsPage.tsx` |
| Portal projects | `portal/pages/PortalProjectsPage.tsx` |
| Site detail (projects tab) | `pages/sites/SiteDetailPage.tsx:49, 89, 416, 440, 462–463, 516–539` |
| Workers list | `pages/workers/WorkersListPage.tsx` |
| Worker detail | `pages/workers/WorkerDetailPage.tsx` |
| Live crew | `pages/workers/LiveCrewMapPage.tsx` |
| Scheduler grid | `pages/scheduler/SchedulerGridPage.tsx` |
| Scheduler home | `pages/scheduler/SchedulerHomePage.tsx` |
| Field allocations | `pages/field/FieldAllocationsPage.tsx` |
| Routing (Job/Project split) | `App.tsx:299–302` |
| Routing (Worker) | `App.tsx:306–309` |

### 3.4 E2E blast radius (`tests/e2e/pr-acceptance/`)

- `batch6-projects-jobs.spec.ts` — tender→project convert, project status ladder, allocations,
  job register.
- `batch6-scheduler.spec.ts` — scheduler + worker assignment (touches both models).
- `batch1-auth-shell.spec.ts`, `batch1-dashboards.spec.ts`, `batch5-sites.spec.ts`,
  `batch6-contracts.spec.ts`, `batch7-universal-timeline.spec.ts`, `batch8-documents-archive.spec.ts`,
  `batch8-misc.spec.ts`, `batch9b-search.spec.ts` — all touch `/jobs`, `/projects`, or workers.

### 3.5 SoT anchors (do not duplicate; link)

- `sot/04-data-model.md:3155` — §B-P0a design (survivor-spine, ScheduleAllocation LOCKED on Project).
- `sot/04-data-model.md:3353–3371` — §B-P0a-1..-9 slice table (canonical).
- `sot/04-data-model.md:3388` — Risk R9 (Shift retirement gated on B-P0b).
- `sot/04-data-model.md:3415` — §B-P0b design (Worker → WorkerProfile).
- `sot/04-data-model.md:3609–3615` — §B-P0b-1..-7 slice table (canonical).
- `sot/04-data-model.md:3572–3575, 3618–3630` — cross-phase interleave rules.
- `sot/04-data-model.md:4201–4206` — LOCKED: ScheduleAllocation bound to Project, multi-role allowed.
- `sot/04-data-model.md:4284–4286` — LOCKED: both merges are the P0 gate for the scheduler grid.
- `sot/04-data-model.md:4088, 4184` — LOCKED: `/resources` 308-redirects to `/workers` at B-P0b-5.

### 3.6 Existing armed/held artifacts to reconcile

- `docs/pr-prompts/pr-nav-jobs-projects-merge-HOLD.md` — UI-only merge of `/jobs` + `/projects`
  into one surface. Gated `<!-- watcher: do-not-arm | GATED: arm ONLY after ...B-P0a... MERGED -->`.
  This plan does NOT modify it. §7 defines when it arms.
- `docs/pr-prompts/BACKLOG.yaml:124–132` — B-P0a & B-P0b already discharged from BACKLOG per
  "when staged, delete here" rule. Their SLICE-0 plan prompts were
  `pr-job-project-merge-plan-ready.md` and `pr-worker-workerprofile-merge-plan-ready.md`. **This
  document is the fulfilment of both.**

---

## 4. Phase A — Job ↔ Project (B-P0a)

**Canonical slice table:** `sot/04-data-model.md:3363–3370`. Do not restate.

### 4.1 Survivor decision (already LOCKED)

`Project` is the survivor entity server-side (schema-of-record). `Job` folds into it.
`sourceTenderId @unique` on both sides + `Project.sourceJobId @unique` (2600) +
`Job.survivingProjectId @unique` (1361) provide the pairing scaffolding. The Job→Project map
(§B-P0a-2) uses `sourceTenderId` where present and `client + name` fallback for tender-less jobs.

**PENDING-MARCO (§9.1):** user-facing label. The UI merge prompt
(`pr-nav-jobs-projects-merge-HOLD.md`) chose the label **"Jobs"** (Job wins verbally, Project
wins in the DB). Reconfirm before B-P0a-8 lands, since renaming user-facing terminology after
drop is cheap but re-splitting a merged table is not.

### 4.2 Slice sequence (see `sot/04-data-model.md:3363–3370` for the authoritative table)

| # | Purpose | Reversible? | Marco-present? |
|---|---|---|---|
| B-P0a-1 | Expand + guard (nullable cols, multi-role regression test) | Yes — drop cols | Yes |
| B-P0a-2 | Backfill Job.id→Project.id map + attributes | Yes — null cols | Yes |
| B-P0a-3 | Add `Project.sourceTenderId @unique` (blocked on -2 proving 1:1) | Yes — drop index | Yes |
| B-P0a-4 | Unify tender→job/project conversion writes | Yes — restore alias | Yes |
| B-P0a-5 | Move WBS (JobStage/Activity/Progress/Closeout/Issue → Project) | Yes — keep `jobId` cols until -8 | Yes |
| B-P0a-6 | Merge `JobVariation`→`Variation`, `JobStatusHistory`→`ProjectActivityLog` | **Snapshot-restore only — HIGH RISK** | Yes, **escalates: true** |
| B-P0a-7 | Re-point `FormSubmission` + `CorrespondenceThread` from Job to Project | Yes — restore linkage | Yes |
| B-P0a-8 | Drop `jobs` table + `jobId` columns | **Irreversible without snapshot** | Yes, **escalates: true** |
| B-P0a-9 (optional) | Retire `Shift` cluster (gated on B-P0b) | Yes until table drop | Yes |

**Slice-level prompt files** live under `docs/pr-prompts/pr-bp0a-<n>-<slug>.md` when Marco
arms each one. This plan does not stage them. Every slice is `gate_allow: none`,
`seed_only: false`. Slices -6 and -8 are `escalates: true`.

### 4.3 Doc-reconcile

Between B-P0a-3 and B-P0a-4, a doc-only PR must land: append a DECISION entry to
`sot/05-decisions-and-lessons.md` capturing the survivor choice (Project schema, Job label) and
the multi-role LOCK. Currently `sot/05` has no explicit Job/Project merge decision — that is a
gap this plan closes. Owner: 05-sot-keeper station.

### 4.4 UI cutover during Phase A

- Slices -1..-7 keep BOTH `/jobs` and `/projects` alive (reads gradually shift to Project
  server-side, but URLs stay separate). No UI merge yet.
- After B-P0a-8 (drop) merges + a **one-week soak** confirms no `jobId`-column reads in
  telemetry, arm `pr-nav-jobs-projects-merge-HOLD.md` (§7).

---

## 5. Phase B — Worker ↔ WorkerProfile (B-P0b)

**Canonical slice table:** `sot/04-data-model.md:3609–3615`. Do not restate.
**Gate:** Phase B slices do NOT begin until Phase A slice B-P0a-8 has merged and soaked.
Exception carve-outs below.

### 5.1 Survivor decision (already LOCKED)

`WorkerProfile` is the canonical survivor. `Worker` folds into it. See `sot/04-data-model.md:3435`.

**PENDING-MARCO (§9.2):** user-facing label stays **"Workers"** (already Marco-confirmed via
the `/resources` → `/workers` redirect LOCK at `sot/04-data-model.md:4088, 4184`).

### 5.2 Slice sequence (see `sot/04-data-model.md:3609–3615` for authoritative table)

| # | Purpose | Reversible? | Depends on |
|---|---|---|---|
| B-P0b-1 | Expand `WorkerProfile` (employeeCode, employmentType, notes, legacyWorkerId) | Yes | — |
| B-P0b-2 | Backfill Worker→WorkerProfile map + attributes; shell for unmapped | Yes | -1 |
| B-P0b-3 | Merge `WorkerCompetency` → `WorkerQualification` | Provenance-marker delete | -2, **Q5 pending** |
| B-P0b-4 | Add `FormSubmission.workerProfileId`; backfill; parallel writes | Yes | -2, **after B-P0a-7** (same table) |
| B-P0b-5 | Redirect master-data/resources/global-lists readers to WorkerProfile; `/resources` → `/workers` 308 | Yes | -2 |
| B-P0b-6 | Crews — retire (Q1 LOCKED 2026-07-03 = `_crew_retire`) | Snapshot-restore only | Independent of B-P0a |
| B-P0b-7 | Drop `workers` + `worker_competencies` + `availability_windows` + `worker_role_suitabilities` + `FormSubmission.worker_id` + `ResourceType.workers` back-rel | **Snapshot-restore only** | **Strictly after B-P0a-9** (`sot/04:3628`) |

### 5.3 Cross-phase interleaves (from `sot/04-data-model.md:3572–3575, 3618–3630`)

- **B-P0a-7 vs B-P0b-4** — both edit `FormSubmission`. B-P0a-7 lands FIRST; B-P0b-4 rebases.
- **B-P0a-9 vs B-P0b-5** — B-P0b-5 lands FIRST so the shift board is not the only remaining
  Worker reader when the Shift cluster retires.
- **B-P0b-7 strictly after B-P0a-9** — `ShiftWorkerAssignment.workerId` FK blocks the drop.
- **B-P0b-6 (crews)** — no B-P0a dependency; may schedule any time per Marco's cue.

### 5.4 Doc-reconcile

Between B-P0b-3 and B-P0b-4, append a DECISION entry to `sot/05-decisions-and-lessons.md`
capturing the `_crew_retire` choice (Q1 locked 2026-07-03) and the qualification-merge rule
(skip when equal-or-later expiry already exists).

---

## 6. Blast radius per phase — files that MUST rebase

### Phase A
- `apps/api/prisma/schema.prisma` (Job, Project, Shift, ScheduleAllocation, JobStage,
  JobActivity, JobProgressEntry, JobCloseout, JobIssue, JobVariation, JobStatusHistory,
  JobConversion, FormSubmission, CorrespondenceThread)
- All Jobs & Projects controllers (§3.2)
- Every Jobs/Projects UI page (§3.3)
- E2E: `batch6-projects-jobs.spec.ts` + all specs touching `/jobs` or `/projects`
- Data-model outputs: `metadata-catalog.json` (tracked; regenerate on every schema slice)

### Phase B
- `apps/api/prisma/schema.prisma` (Worker, WorkerProfile, WorkerCompetency,
  WorkerQualification, CrewWorker, ShiftWorkerAssignment, FormSubmission, ResourceType,
  AvailabilityWindow, WorkerRoleSuitability)
- Workers, Field, master-data, resources, global-lists modules (§3.2)
- Every Workers UI page (§3.3), scheduler pages, field pages
- E2E: `batch6-scheduler.spec.ts`, `batch8-misc.spec.ts` + any spec asserting
  `/resources` (redirects to `/workers` after -5)

---

## 7. Downstream UI-merge PR — arm policy

`docs/pr-prompts/pr-nav-jobs-projects-merge-HOLD.md` stays HOLD until:

1. **B-P0a-8 has merged to main** (jobs table dropped).
2. **≥ 7 days soak** with zero `jobId`-column reads in the telemetry pipeline.
3. Marco explicitly removes the `do-not-arm` header comment.

The UI merge PR then folds `/jobs` and `/projects` into ONE surface labelled "Jobs" and adds
308 redirects `/projects` → `/jobs`, `/projects/:id` → `/jobs/:id`. Site tab renames "Projects"
→ "Jobs". Field/mobile nav untouched.

No analogous UI-merge PR is needed for Phase B: the redirect `/resources` → `/workers`
happens IN B-P0b-5 itself.

---

## 8. Risk register (delta only — canonical list in `sot/04-data-model.md:3388, 3632`)

| # | Risk | Mitigation |
|---|---|---|
| M1 | Both phases run concurrently by mistake | This plan's §2 rule. Watcher must not stage B-P0a/B-P0b prompts (BACKLOG discharge already enforces). |
| M2 | UI merge fires before B-P0a-8 lands | HOLD prompt's `do-not-arm` header. §7 gate. |
| M3 | `sot/05` never gains merge DECISION entries | §4.3 and §5.4 doc-reconcile slices explicitly required. |
| M4 | `metadata-catalog.json` drifts silently across slices | Every schema slice must regenerate and commit it (per user memory rule). |
| M5 | Snapshot-restore path never actually rehearsed before B-P0a-8 / B-P0b-7 | Add a rehearsal step: restore a recent nightly backup to a scratch DB before arming the drop slice. Owner: Marco. |

---

## 9. PENDING-MARCO — irreversible calls that need explicit ruling

### 9.1 Phase A
- **Q-A1 · User-facing label after merge.** Confirm "Jobs" (verbal) + Project (schema).
  Needed before B-P0a-8.
- **Q-A2 · Tender-less Job pairing tie-breaker.** When `client + name` matches multiple
  Projects in the §B-P0a-2 backfill, which side wins? Options: newest, oldest, prompt
  operator. Needed before B-P0a-2.
- **Q-A3 · Production migration window.** B-P0a-6 and B-P0a-8 are snapshot-restore only.
  Marco specifies the maintenance-window date + backup-verification owner.

### 9.2 Phase B
- **Q-B1 · Q5 competency-merge tie-break** (`sot/04-data-model.md:3611`). When a
  `WorkerCompetency` has an earlier expiry than an existing `WorkerQualification`, keep the
  qualification and discard the competency silently, or emit a per-worker review report first?
- **Q-B2 · Unmapped-worker shells (B-P0b-2).** Confirm that shell `WorkerProfile` rows are
  auto-created with `isActive = Worker.status == 'ACTIVE'` and NO `internalUserId`. Any HR
  workflow trigger needed on shell creation?
- **Q-B3 · Production migration window for B-P0b-7.** Same treatment as Q-A3.

### 9.3 Cross-phase
- **Q-X1 · Rehearsal cadence.** How often does the snapshot-restore rehearsal (M5 above)
  happen — once per phase, or once per irreversible slice?

---

## 10. Verify

- `pnpm lint` clean.
- `test -f docs/plans/model-merge-plan.md` (this file exists).
- Both phases sliced with reference to `sot/04-data-model.md` §B-P0a and §B-P0b.
- Every consumer surface listed with file:line.
- Reconciled with `docs/pr-prompts/pr-nav-jobs-projects-merge-HOLD.md` and
  `docs/pr-prompts/BACKLOG.yaml:124–132` — no duplication, no re-arm.

---

## 11. Out of scope for THIS plan

- Writing any migration SQL, TS, or Prisma edit.
- Editing `sot/*` (that is a separate doc-reconcile PR per §4.3 / §5.4).
- Arming any B-P0a-* or B-P0b-* slice prompt (Marco-present only).
- Modifying `pr-nav-jobs-projects-merge-HOLD.md`.
- Scheduler grid rewrite itself (blocked until both phases complete).
