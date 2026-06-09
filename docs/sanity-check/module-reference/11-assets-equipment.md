# 11. Assets and Equipment

## Purpose

Plant and equipment register. Each asset is a tracked unit (saw, core
drill, scaffold, generator, vehicle) with service history, downtime,
utilisation, and a maintenance schedule. Matthew (warehouse / asset
manager) is the primary user.

## Surface area

**Routes (frontend):**
- `/assets` — `AssetsListPage` (card grid with 4 filters)
- `/assets/:id` — `AssetDetailPage` (4 tabs with derived last/next
  service + total downtime KPIs)

**API endpoints (key):**
- `GET/POST/PATCH/DELETE /api/v1/assets`
- `GET /api/v1/assets/:id` — detail with service history
- `GET /api/v1/assets/utilisation?from=&to=` — utilisation report
  (PR #275)
- `GET /api/v1/assets/:id/maintenance-events`

**DB entities:**
- `Asset` (category, status, location, current job)
- `AssetServiceRecord`
- `MaintenanceEvent` (planned + actual downtime)
- `AssetDowntimeRecord`
- `Allocation` (plant → job, shares model with worker allocations)

## What should work (functional checklist)

### Assets list
- [ ] Card grid with 4 filters (category, status, location, available
      / in-use)
- [ ] Empty state with CTA
- [ ] Loading skeleton
- [ ] Search by asset number / name

### Asset detail (4 tabs)
- [ ] Overview: KPIs — last service, next service, total downtime,
      utilisation % (derived)
- [ ] Service history: records sorted desc
- [ ] Maintenance schedule: planned events from Maintenance module
- [ ] Allocations: which jobs has this asset been on, when

### Allocations
- [ ] Asset can be allocated to multiple jobs over time, but only one
      active allocation at a time (verify enforcement)
- [ ] Allocation conflicts with planned maintenance — warn

### Utilisation report (PR #275)
- [ ] Hours per asset
- [ ] Utilisation rate (hours used / hours available)
- [ ] Cost per job (links to estimate plant rates)
- [ ] Date range filter

## Recent PRs that shaped it (last ~100 merged)

- #20 — S7 assets + maintenance foundation
- #40 — Resource allocation (shared with Workers)
- #275 — Asset utilisation reporting endpoint — **functional**

Test-only / doc-only:
- Various Swagger / JSDoc passes

## What to watch for during sanity check

- **Derived KPIs** — last service, next service, total downtime, utilisation
  should match the underlying records. If a service record exists but
  "Last service" shows N/A, that's a derive bug.
- **Allocation conflict with maintenance** — schedule a maintenance event
  during an active allocation; warn or block.
- **Utilisation report (PR #275)** — date range filter; verify
  hours-per-asset matches the sum of timesheets / shifts.
- **Asset deactivation** — what happens to active allocations?

## Edge cases worth probing

- **Asset with 0 service records** — clean empty state on Service tab
- **Asset with 100+ allocations** — pagination on history
- **Utilisation over a date range with 0 use** — clean zero state
- **Asset GPS tracking (PHASE 8 ⏸️)** — not yet implemented; verify no
  half-built UI surfaces
- **Concurrent allocation by two supervisors** — last write wins +
  audit log
- **Delete asset with active allocation** — should block
- **Mobile width** — Matthew is mostly desktop; assets list should still
  be navigable on tablet
- **Permission-gated** — Field worker doesn't manage assets; Matthew /
  admin only
