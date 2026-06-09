# 8. Jobs and Delivery

## Purpose

Live job management — the operational record of what's actually happening
on site. Sits between Contracts (commercial) and Scheduler / Field workers
(operations). Supervisors, project managers, and field workers all read /
write here.

## Surface area

**Routes (frontend):**
- `/jobs` — `JobsListPage` (card grid default + table toggle + 7 filters
  + "New job" slide-over)
- `/jobs/:id` — `JobDetailPage` (7 tabs with clickable activity completion
  toggle, surgical ErrorBoundary per tab)
- `/projects/:id` — project detail also exposes job-like surface

**API endpoints (key):**
- `GET/POST/PATCH/DELETE /api/v1/jobs`
- `GET /api/v1/jobs/:id/activities`
- `POST /api/v1/jobs/:id/activities/:actId/complete` — toggle completion
- `GET/POST /api/v1/jobs/:id/issues`
- `GET/POST /api/v1/jobs/:id/variations`
- `GET/POST /api/v1/jobs/:id/progress-entries`
- `GET /api/v1/jobs/:id/status-history`

**DB entities:**
- `Job` (canonical J-YYYY-NNN ID per PR #210)
- `JobActivity` (stages[] → activities[] structure per PR #203)
- `Shift`
- `JobIssue` (reporter, type, severity, status)
- `JobVariation` (approver workflow)
- `JobProgressEntry`
- `JobStatusHistory`
- `JobCloseout` (closeout phase entity)

## What should work (functional checklist)

### Jobs list
- [ ] Card grid view (default) with status badge + key facts
- [ ] Table toggle works
- [ ] 7 filters (status, client, supervisor, date range, ...)
- [ ] Empty state with CTA (PR #327 referenced in instructions)
- [ ] Loading skeleton on data fetch
- [ ] Pagination
- [ ] "New job" slide-over with required fields

### Job detail (7 tabs)
- [ ] Overview tab: KPIs, key facts, status
- [ ] Scope tab: linked scope items
- [ ] Activities tab: stages[] → activities[], clickable completion toggle
- [ ] Allocations tab: workers + plant assigned
- [ ] Timesheets tab: timesheet entries linked to job
- [ ] Documents tab: linked documents
- [ ] Closeout tab: closeout checklist + archive trigger

### Per-tab error handling
- [ ] Surgical ErrorBoundary on each tab section (PR #199)
- [ ] Dev-mode console.error surfaces fetch failures (PR #199)
- [ ] Render-phase throws do NOT cause blank page (PR #203 — flattenActivities)
- [ ] EmptyState fallback replaces `return null` (PR #203)

### Activities
- [ ] Clickable activity completion toggle
- [ ] flattenActivities helper (PR #203) — `job.activities` is derived
      from `stages[].activities`
- [ ] Owner assignment per activity
- [ ] Status history populated on every status change

### Issues
- [ ] Issue create with type / severity / reporter
- [ ] Issue resolution workflow
- [ ] Issue feed into Safety widget on Dashboard (PR #81 / #96)

### Variations
- [ ] Variation create (mirrors Contract variation but job-level)
- [ ] Approver workflow

### Progress entries
- [ ] Progress entry create with author, date, narrative
- [ ] Author = current user, audit-logged

## Recent PRs that shaped it (last ~100 merged)

- #17 — S7 jobs rebuild
- #41 — Field worker experience (job allocations, timesheets)
- #42 — Timesheet approval
- #58 — Contracts module (parent surface)
- #197 — POST /jobs handler (B02) — **functional**
- #199 — JobDetailPage surgical ErrorBoundary (B01) — **functional**
- #203 — JobDetailPage line 207 precedence bug (B01.1) —
  **functional / fix-forward**
- #210 — Canonical J-YYYY-NNN IDs (B05 + B02.1 race) — **functional**
- #250 — Project → Tender revert (touches Job state)
- #303 — Team-as-estimator + client-filtered activity
- #327 (instructions reference) — JobsPage empty state — **UX**

Test-only:
- #283 — ProjectsService unit tests (closely related)

## What to watch for during sanity check

- **JobDetailPage tabs (B01 + B01.1)** — the blank-page report fixed in
  PR #203 was caused by `job.activities.length` when activities was
  undefined. The fix flattens activities from stages[]. Watch for any
  tab section that reaches into a property without null guarding.
- **Job ID format** — every new job should be `J-2026-NNN`. JOB-* legacy
  format on a fresh seed = regression of PR #210.
- **Race condition on create (PR #210 B02.1)** — two concurrent POST
  /jobs should both succeed cleanly, no 500. One gets 409.
- **Empty state (PR #327)** — Jobs list with zero jobs should show empty
  state with CTA, not a blank table. Verify it only renders when there
  are zero jobs AND loading is finished (the explicit-state-over-derived
  lesson from MEMORY.md).
- **Activity completion toggle** — clickable, optimistic UI, server
  confirms. Toggling rapidly should debounce or queue safely.
- **Status history** — every transition logged. Spot-check audit log.
- **Per-tab loading skeletons** — never a blank tab.

## Edge cases worth probing

- **Job with 0 activities** — empty Activities tab with CTA
- **Job with 100+ activities across 10 stages** — performance, no
  virtualisation expected, watch for slow render
- **Concurrent activity toggle by two users** — race / last-write-wins
- **Delete job with timesheets attached** — should block or cascade?
  Verify behaviour
- **Job status change while user has detail page open** — does UI refresh
  cleanly?
- **Mobile width** — Jobs is field-relevant; should be usable. Card grid
  collapses to single column; table degrades to scrollable
- **Network failure mid-toggle** — optimistic UI must revert + show error
- **Permission-gated** — Field worker should see own allocated jobs only;
  supervisor sees team's jobs; admin sees all
- **JobsListPage filter combinations** — 7 filters × multiple values;
  no filter set returns full list; impossible combo (e.g. filter that
  matches zero) returns empty state, not blank
