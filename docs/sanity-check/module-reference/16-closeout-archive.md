# 16. Closeout and Archive

## Purpose

End-of-life for a Job — closeout checklist, archive record, downstream
read-only access. Once a job is archived, it's immutable. Archive is
a separate route (S6 made it standalone).

## Surface area

**Routes (frontend):**
- `/archive` — `ArchivePage` (standalone register with CSV export)
- `/archive/:jobId` — `ArchiveDetailPage` (read-only with 7 collapsible
  panels + JSON record export)
- Job Detail → Closeout tab (closeout checklist + archive trigger)

**API endpoints (key):**
- `GET /api/v1/archive` — paginated archive list
- `GET /api/v1/archive/:jobId` — full record
- `GET /api/v1/archive/:jobId/export` — JSON snapshot
- `POST /api/v1/jobs/:id/closeout` — closeout trigger
- `POST /api/v1/jobs/:id/archive` — final archive

**DB entities:**
- `JobCloseout` (checklist state, archivedBy, archivedAt)

## What should work (functional checklist)

### Closeout (on Job Detail)
- [ ] Closeout tab with checklist items
- [ ] Each item: status + assignee + completion date
- [ ] Cannot archive until all critical items complete
- [ ] Archive button confirms with warning

### Archive list
- [ ] Paginated list of archived jobs
- [ ] Search + filter
- [ ] CSV export
- [ ] Click → detail

### Archive detail (read-only)
- [ ] 7 collapsible panels (overview, scope, financials, allocations,
      timesheets, documents, audit)
- [ ] No edit affordances anywhere
- [ ] JSON record export

## Recent PRs that shaped it (last ~100 merged)

- #9 — S6 archive route (standalone)
- #23 — S7 master data (with archive considerations)

## What to watch for during sanity check

- **Read-only enforcement** — try every input on the archive detail; all
  must be disabled
- **JSON export** — should serialise without circular refs
- **Closeout gates** — verify all critical items block archive
- **Audit trail on archive** — actor + timestamp captured
- **Standalone route** — `/archive` not under `/jobs/archive` (S6 moved it
  standalone)

## Edge cases worth probing

- **Archive job with open variations** — blocked or carry forward?
- **Archive job with unapproved timesheets** — blocked?
- **Archive job already archived** — no-op or 409
- **Unarchive (escape hatch)** — does one exist? If yes, admin only
- **Search archive across years** — date range filter
- **Mobile width** — archive is admin-y; degrade acceptable
- **Permission-gated** — admin only for archive list; read-only access
  for relevant team members
