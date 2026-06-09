# 10. Resources and Competencies

## Purpose

Worker register + qualification tracking. Marco's compliance domain — every
worker has licences / inductions / medicals that expire on a calendar, and
the system has to gate job allocations on currency. Also covers payroll
export and the worker-availability overlay used by Scheduler.

## Surface area

**Routes (frontend):**
- `/resources` — `WorkersListPage` (worker card grid with search + role +
  availability filters)
- `/resources/:id` — `WorkerDetailPage` (5 tabs: Profile / Competencies /
  Availability / Assigned shifts / Documents)
- `/workers` — older alias under `pages/workers/`
- `/admin/...` — worker / role admin

**API endpoints (key):**
- `GET/POST/PATCH/DELETE /api/v1/resources/workers`
- `GET /api/v1/resources/workers/:id` — detail with eager-loaded relations
- `GET/POST /api/v1/worker-qualifications`
- `GET /api/v1/competencies/gate-check?workerId=&jobId=` — read-only
  competency check (PR #273)
- `GET /api/v1/timesheets/payroll-export?from=&to=` — approved timesheets
  CSV (PR #274)

**DB entities:**
- `Worker` (and parallel `WorkerProfile` — PHASE 6 consolidation TODO)
- `WorkerQualification` (licence type, expiry, document link)
- `WorkerLeave`, `WorkerUnavailability`
- `Allocation`

## What should work (functional checklist)

### Worker list
- [ ] Card grid with search + role + availability filters
- [ ] Empty state with CTA
- [ ] Loading skeleton
- [ ] Pagination
- [ ] Click card → worker detail

### Worker detail (5 tabs)
- [ ] Profile: name, role, employment type, contact, emergency contact
- [ ] Competencies: list of WorkerQualifications with expiry indicator
      (green / amber 30-day / red expired)
- [ ] Add qualification — type picker, expiry date, upload document
- [ ] Availability: leave + unavailability calendar view
- [ ] Assigned shifts: future shifts from Scheduler
- [ ] Documents: linked DocumentLinks

### Competency gate
- [ ] Soft-warn when allocating worker missing optional qualification
      (PR #278)
- [ ] Block when allocating worker missing critical qualification (e.g.
      asbestos_b for asbestos job)
- [ ] Project.requiredQualifications drives the gate (PR #278)
- [ ] Audit log entry on every gate decision (allow / warn / block)

### Daily cron
- [ ] 30-day expiry alert sent to Marco
- [ ] 7-day expiry alert sent to Marco
- [ ] Auto-block expired subcontractor on critical items (Phase 3 complete)

### Payroll export
- [ ] Approved timesheets CSV export (PR #274)
- [ ] Date range filter (from / to)
- [ ] CSV format MYOB / Xero compatible (verify against PR #277 schema
      alignment)

### Asset utilisation
- [ ] Asset utilisation report endpoint (PR #275) — see Assets module

## Recent PRs that shaped it (last ~100 merged)

- #19 — S7 workers foundation
- #38 — Seed staff fix
- #79 — Compliance tracking expiry alerts + worker qualifications +
  auto-block — **functional / foundational**
- #85 — GPS clock-on
- #86 — Worker availability (leave + unavailability + scheduler overlay)
- #87 — Availability + GPS hardening (self-approval block + audit)
- #273 — Worker competency gate helper + read-only endpoint —
  **functional / compliance critical**
- #278 — Wire competency gate into AllocationsService + Project.requiredQualifications
  (soft-warn + audit) — **functional / compliance critical**
- #274 — Approved timesheets → payroll CSV export — **functional**
- #275 — Asset utilisation reporting endpoint (Assets module)
- #331 — ResourcesService unit tests (test-only)

## What to watch for during sanity check

- **Competency gate behaviour (PR #278)** — current implementation is
  soft-warn + audit. Verify the warning appears, the audit log entry is
  written, but allocation still completes. The Phase 7 entry calls for
  blocking — verify whether that's been wired yet for critical items.
- **Self-approval block (PR #87)** — supervisor can't approve their own
  leave / timesheet.
- **Worker / WorkerProfile dual model (PHASE 6 ⏸️)** — ResourcesPage
  calls /resources/workers (Worker model) but WorkerDetailPage may pull
  WorkerProfile. Watch for shape mismatches in fields like role,
  qualifications.
- **Payroll export CSV format** — manually open the CSV and check that
  hours, rates, dates align. Test with a worker who has 0 approved
  timesheets in range.
- **30-day / 7-day cron** — manually trigger via test endpoint or wait;
  Marco should get the alert.

## Edge cases worth probing

- **Worker with 0 qualifications** — empty state
- **Worker with 100+ qualifications** — performance
- **Qualification expiring tomorrow** — amber + alert imminent
- **Qualification expired yesterday** — red + worker blocked from
  critical allocations
- **Worker with expired qualification allocated before expiry** —
  what happens to active allocation? (PHASE 7 area)
- **Mobile width** — resources is admin-y; degrade acceptable
- **Concurrent qualification update** — two admins editing
- **Delete worker with active allocations** — blocked? cascade?
- **Permission-gated** — only admin / Marco sees full compliance dashboard;
  worker sees own profile only
- **Audit log on every gate decision** — verify 100% coverage
