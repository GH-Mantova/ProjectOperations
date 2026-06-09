# 7. Award / Contract / Job Conversion

## Purpose

The bridge between commercial (Tender → Quote → Award) and operational
(Project / Job / Delivery). When a tender is won, the Quote becomes a
Contract; the Contract spawns a Job (or Project). Includes variations,
progress claims, retention, and cut-off reminders.

Amy's operational workflow (billing) sits on top of this. Marco gates it
with compliance checks.

## Surface area

**Routes (frontend):**
- `/contracts` — contracts list (under `pages/contracts/`)
- `/contracts/:id` — contract detail
- `/projects` — project list (under `pages/projects/`)
- `/projects/:id` — `ProjectDetailPage`
- Tender Detail → "Convert to Project" CTA (gated on Won status)
- Project Detail → "Revert to Tender" (admin escape hatch, PR #250)

**API endpoints (key):**
- `POST /api/v1/tenders/:id/convert` — tender → project conversion
- `POST /api/v1/projects/:id/revert-to-tender` — admin escape hatch
- `GET/POST/PATCH/DELETE /api/v1/contracts`
- `GET/POST /api/v1/contracts/:id/variations`
- `GET/POST /api/v1/contracts/:id/progress-claims`
- `POST /api/v1/contracts/:id/progress-claims/:claimId/invoice` — Xero
  invoice push (PR #88)
- `POST /api/v1/projects` — manual project creation

**DB entities:**
- `Contract`, `Variation`, `ProgressClaim`, `ClaimLineItem`
- `Project` (linked to source Tender, has Manager / Supervisor /
  Estimator / WHS user)
- `ProjectActivityLog`
- `Job`, `JobActivity`, `Shift`, `JobIssue`, `JobVariation`,
  `JobProgressEntry`, `JobStatusHistory`
- `JobNumber` (canonical J-YYYY-NNN per PR #210)

## What should work (functional checklist)

### Tender → Project conversion
- [ ] "Convert to Project" CTA visible only on Won tenders
- [ ] Convert action requires confirmation modal
- [ ] On convert: Project created with link to source Tender; manager /
      supervisor / estimator / WHS user copied from tender team
- [ ] Original Tender stays in Won state; can't be deleted
- [ ] Revert-to-Tender (PR #250) — admin only; project deleted, tender
      goes back to Won
- [ ] Audit log entries for both directions
- [ ] Quote → contract numbering preserved across conversion

### Contracts
- [ ] Contracts list with filters by client, status, value range
- [ ] Contract detail shows: contract value, original quote, variations,
      progress claims, retention, cut-off date
- [ ] Variation create — type, value, status, approval workflow
- [ ] Progress claim create — line items by discipline (`ClaimLineItem`,
      4-code discipline post PR A1)
- [ ] Progress claim → Xero invoice push (draft, PR #88)
- [ ] Retention tracking shows: held %, released to date
- [ ] Cut-off reminder — automated reminder to claim reminder contact
      (PR #74 wired this to internal user)

### Projects
- [ ] Project list with filters
- [ ] Project detail: 7 tabs (overview, scope, activities, allocations,
      timesheets, documents, financials)
- [ ] Gantt timeline view (PR #82) — schedule tab
- [ ] Project Manager / Supervisor / Estimator / WHS roles assignable
- [ ] Activity completion toggle (clickable, PR #43 layout)
- [ ] Discipline dropdown 4-code (PR A1.5 / #163)

### Jobs (transactional)
- [ ] POST `/api/v1/jobs` manual create works (PR #197 / B02)
- [ ] Canonical Job ID `J-YYYY-NNN` (PR #210 / B05) — no JOB-COMP-* or
      JOB-YYYY-NNN legacy formats on new jobs
- [ ] Race on create returns 409, not 500 (PR #210 B02.1)
- [ ] Job detail 7 tabs with surgical ErrorBoundary on each tab section
      (PR #199 / B01 + PR #203 / B01.1 fix)
- [ ] flattenActivities helper used (job.activities derived from
      stages[].activities, PR #203)

## Recent PRs that shaped it (last ~100 merged)

- #39 — Projects module — **functional / foundational**
- #40 — Resource allocation
- #41 — Field worker experience
- #42 — Timesheet approval
- #58 — Contracts module — **functional / foundational**
- #82 — Gantt scheduling — **functional**
- #88 — Xero OAuth2 / invoice push from progress claims — **functional**
- #197 — POST /api/v1/jobs manual job creation (B02) — **functional**
- #199 — JobDetailPage surgical ErrorBoundary (B01) — **functional**
- #203 — JobDetailPage line 207 precedence bug fix (B01.1) —
  **functional / blank-page root cause**
- #210 — Canonical J-YYYY-NNN job IDs + createJob race-fix (B05 / B02.1)
- #242 — Quote PDF Prepared-by + convert-to-project gate + Alt+A unguard
- #250 — Project → Tender revert (admin escape hatch) — **functional**
- #288 — Sites module detail page (also touches site → tender linking)
- #303 — Team-as-estimator + client-filtered activity (backend)

Test-only / doc-only:
- #283 — ProjectsService unit tests
- #46 — ProjectsService unit tests (older)
- #45 — JSDoc master-data
- #281 — Swagger MaintenanceController

## What to watch for during sanity check

- **Convert-to-Project (PR #242 gate)** — Alt+A unguard means convert
  requires Alt+A keypress? Verify the gate behaviour. The Prepared-by
  field should be populated on the quote PDF.
- **Revert-to-Tender (PR #250)** — admin-only escape hatch. Verify the
  audit log entries and that Tender state goes back to Won (not Lost or
  Withdrawn).
- **Job ID format (PR #210)** — any new job should be `J-2026-NNN`. If
  you see `JOB-*` legacy format on a newly created job, that's a finding.
- **JobDetailPage tabs (PR #199 + #203)** — break a tab section
  deliberately (e.g. inject a console.error) and verify only that tab's
  surgical boundary shows the fallback, not the whole page.
- **flattenActivities (PR #203)** — `job.activities` is a flat derive
  from `stages[].activities`. If you see "Cannot read properties of
  undefined (reading 'length')" anywhere near MessagePort.M in
  DevTools, it's a regression of B01.1.
- **Progress claim → Xero invoice (PR #88)** — confirm Xero is in mock /
  disconnected state during sanity check unless Marco wants live test.
- **Activity timeline filtering (PR #303)** — client-filtered + team-as-
  estimator behaviour. Verify as a non-team-member user that you see
  only allowed activities.
- **Variation approval workflow** — variations have a status; ensure the
  status transitions are clean (Draft → Submitted → Approved / Rejected).

## Edge cases worth probing

- **Convert tender with 0 scope items** — should succeed with empty
  Project, or be blocked?
- **Convert tender twice** — second click should be no-op or 409
- **Revert project with allocations + timesheets attached** — what
  cascades? Should it be blocked rather than silently destroy data?
- **Two jobs created at exact same second** — race-fix per PR #210 B02.1;
  verify 409 not 500
- **JOB-COMP-* legacy fixtures from compliance smoke** — were
  renormalised in the PR #210 migration; verify they're now `J-2026-NNN`
  format after reseed
- **Variation type "Provisional Sum" pricing** — PR #46 fixed
  provisional sum pricing; confirm
- **Progress claim with 0 line items** — validation
- **Retention release across multiple claims** — math correctness
- **Contract delete** — should be blocked if progress claims exist
- **Concurrent variation approvals by two admins** — last write wins +
  audit trail
- **Mobile width** — Projects / Contracts are admin/PM surfaces; degrade
  acceptable; Jobs is field-relevant so should hold up
