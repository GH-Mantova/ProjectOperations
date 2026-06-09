# 9. Scheduler and Work Planning

## Purpose

Planning surface: who's working where on which day. Supervisors and project
managers schedule shifts, allocate workers and plant, and see worker
availability / leave overlaid. Gantt timeline on Projects feeds into this.
Field workers see their allocations through the field shell.

## Surface area

**Routes (frontend):**
- `/scheduler` — `SchedulerWorkspacePage` (3-pane layout: hierarchy /
  timeline / resource panel; week + month views)
- `/scheduler/...` — sub-routes under `pages/scheduler/`
- Project Detail → Schedule tab (Gantt, PR #82)

**API endpoints (key):**
- `GET/POST/PATCH/DELETE /api/v1/scheduler/shifts`
- `GET /api/v1/scheduler/calendar?from=&to=&view=week|month`
- `GET/POST /api/v1/allocations` — worker + plant to jobs
- `GET /api/v1/scheduler/availability` — worker availability overlay
- `GET/POST /api/v1/worker-leaves` — leave management (PR #86)
- `GET/POST /api/v1/worker-unavailabilities` — non-leave holds
- `GET/POST/PATCH /api/v1/gantt-tasks` (PR #82)

**DB entities:**
- `Shift` (lead user + date range)
- `Allocation` (worker → job, plant → job)
- `ProjectAllocation`
- `WorkerLeave` (approver workflow)
- `WorkerUnavailability` (non-leave reservation)
- `GanttTask` (Project Schedule tab, discipline-tagged)

## What should work (functional checklist)

### Scheduler workspace
- [ ] 3-pane layout renders without horizontal overflow
- [ ] Hierarchy pane: projects → jobs tree
- [ ] Timeline pane: week view (default), month view toggle
- [ ] Resource panel (right): workers + plant with availability indicators
- [ ] Drag worker / plant from resource panel onto timeline to allocate
- [ ] Shift create modal: lead user, date range, job link
- [ ] Edit shift inline
- [ ] Delete shift with confirmation
- [ ] Weekend columns not clipped at 1280px+ (PHASE 6 known: clip below
      1280px — flag if it leaks above)
- [ ] Calendar widths (PR #99) consistent across views
- [ ] Worker availability overlay shows leave + unavailability
- [ ] Conflict warning when allocating an unavailable worker
- [ ] Auto-generate Gantt from scope (PR #82)
- [ ] Gantt tasks discipline-tagged (4-code post PR A1.5 / #163)

### Allocations (linked from Job Detail)
- [ ] Allocations tab on Job Detail
- [ ] Add worker / plant allocation
- [ ] Competency gate (PR #273 + #278) — soft-warn for missing
      qualifications, block on critical missing
- [ ] Audit log on allocation create + remove
- [ ] Worker availability respected (can't double-book)

### Worker Leave
- [ ] Leave request form (start / end / type / notes)
- [ ] Approval workflow — supervisor / admin approves
- [ ] Self-approval blocked (PR #87 security)
- [ ] Approved leave shows on scheduler overlay
- [ ] Audit trail on request + approval

### Pre-start checklists
- [ ] Linked to Allocation
- [ ] Worker fills in via field shell

### Timesheets
- [ ] Worker captures via field shell
- [ ] Approval workflow (PR #42)
- [ ] Approved → CSV export to payroll (PR #274) — see Module 10

## Recent PRs that shaped it (last ~100 merged)

- #18 — S7 scheduler foundation
- #40 — Resource allocation
- #42 — Timesheet approval
- #82 — Gantt scheduling — **functional**
- #85 — GPS clock-on (consent-based)
- #86 — Worker availability (leave management, unavailability,
  scheduler overlay) — **functional**
- #87 — Availability + GPS hardening (actor scope, self-approval block,
  audit trail)
- #99 — Scheduler month view, calendar widths, sidebar badges, safety
  quick-actions — **functional UX**
- #102 — Scheduler label, dashboard chrome, lead-time data fix
- #273 — Worker competency gate helper + read-only endpoint
- #278 — Wire competency gate into AllocationsService (soft-warn + audit) —
  **functional / compliance critical**
- #287 — Quote scope grouped-mode drag reorder (touches scheduler? no —
  Tendering side. Include here only for completeness; Tendering doc owns.)
- #311 — SchedulerService unit tests (test-only)
- #296 — Swagger SchedulerController (doc-only)

## What to watch for during sanity check

- **Weekend clipping below 1280px** — known PHASE 6 issue from Chat1
  dashboard batch 2026-05-03. If it's clipping above 1280px now, that's
  a regression.
- **Drag-to-reschedule (PHASE 6 ⏸️)** — API supports it; frontend
  @dnd-kit work not done. Verify there's no half-implementation in the UI.
- **Weekly grid view (PHASE 6 ⏸️)** — separate from week timeline.
  Confirm what "week view" actually shows.
- **Worker/WorkerProfile dual model (PHASE 6 ⏸️)** — ResourcesPage still
  calls `/resources/workers`, different model from Worker. Watch for
  data shape mismatches.
- **Competency gate (PR #278)** — try to allocate a worker without the
  required `asbestos_b` licence to an asbestos job. Should soft-warn
  (today, gate-of-record but not blocking). On critical-only it should
  block (per Phase 3 spec).
- **Self-approval block (PR #87)** — verify a supervisor can't approve
  their own leave request.
- **Audit trail on availability / GPS** — should be complete (Marco's
  domain).

## Edge cases worth probing

- **Empty scheduler** — no shifts, no allocations; clean empty state
- **Scheduler with 50+ workers × 30 days** — performance, virtualisation
- **Allocate worker on leave** — conflict warning, block or soft-allow?
- **Allocate plant being maintained** — should cross-reference
  Maintenance module's planned downtime
- **Concurrent shift edit** — two supervisors editing same shift
- **Timezone correctness** — Brisbane TZ for dates (lesson-learned
  2026-05-17 — migration date-filter precision)
- **Mobile width** — scheduler is desktop. Acceptable to show "switch to
  desktop" message rather than degraded view; check what actually happens.
- **Cancel approved leave** — what happens to scheduler overlay? Audit?
- **Leave overlap with active shift** — conflict warning
- **Permission-gated** — Field worker can see own allocations, not
  others'. Supervisor sees team. Admin sees all.
