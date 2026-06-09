# 12. Maintenance

## Purpose

Planned and reactive maintenance events for the asset register. Logs
downtime, schedules upcoming services, and feeds back into Asset
utilisation. Matthew's domain.

## Surface area

**Routes (frontend):**
- `/maintenance` — `MaintenancePage` (v2) — Upcoming / overdue list +
  month calendar + "Log event" slide-over
- `/maintenance/...` — sub-routes under `pages/maintenance/`

**API endpoints (key):**
- `GET/POST/PATCH/DELETE /api/v1/maintenance/events`
- `GET /api/v1/maintenance/upcoming` — upcoming + overdue
- `GET /api/v1/maintenance/calendar?from=&to=`
- `GET /api/v1/maintenance/dashboard` — KPIs (PHASE 6 audit script flagged
  /maintenance/dashboard wrong path — should be /maintenance/upcoming)

**DB entities:**
- `MaintenanceEvent` (type, asset, scheduled date, completed date, status)
- `AssetDowntimeRecord`

## What should work (functional checklist)

- [ ] Upcoming / overdue list with sort by date
- [ ] Month calendar shows scheduled events
- [ ] Log event slide-over: asset picker, type, scheduled date, notes
- [ ] Edit event inline
- [ ] Mark complete updates status + completed date
- [ ] Downtime auto-calculated from scheduled vs completed
- [ ] Linked from Asset Detail → Maintenance tab
- [ ] Overdue items highlighted (red badge)
- [ ] Empty state with CTA
- [ ] Loading skeleton

## Recent PRs that shaped it (last ~100 merged)

- #20 — S7 maintenance foundation (with Assets)
- #281 — Swagger MaintenanceController (doc-only)
- #244 — Material density seed (peripherally related)

## What to watch for during sanity check

- **Audit script path correction (PHASE 6 ⏸️)** — chain audit script
  had stale `/maintenance/dashboard`; correct is `/maintenance/upcoming`.
  If audit smoke still flags 404 on dashboard, it's the audit script
  that's wrong, not the app.
- **Downtime auto-calc** — completed vs scheduled gap should populate
  AssetDowntimeRecord. Verify on a complete event.
- **Overdue detection** — events past scheduled date with status not
  completed.

## Edge cases worth probing

- **Event scheduled in the past, not completed** — overdue category
- **Event with no asset** — should validate / block
- **Maintenance during an active allocation** — conflict warning per
  Assets module
- **Calendar with 100+ events in a month** — performance
- **Maintenance scheduling automation (PHASE 8 ⏸️)** — based on asset
  usage hours; not yet implemented
- **Mobile width** — Matthew may use on site / tablet; should be usable
- **Concurrent edit** — two users editing same event
- **Delete completed event** — should be blocked or audit-logged
- **Permission-gated** — admin / Matthew only
