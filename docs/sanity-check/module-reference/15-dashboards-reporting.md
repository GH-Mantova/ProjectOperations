# 15. Dashboards and Reporting

## Purpose

Operations + tender dashboards. User-owned dashboards with drag-to-reorder
widgets, widget categories (Tendering, Safety, Compliance, Operations,
Finance), per-widget period override, inline name editing. Phase 5B
shipped polish; Phase 5C / Phase 7 will bring a custom widget builder.

Sean, Raj, Marco, Amy all live here for daily situational awareness.

## Surface area

**Routes (frontend):**
- `/` — `DashboardPlaceholderPage` (Operations dashboard — 4 KPI grid +
  2-col chart grid + "Customise" slide-over)
- `/dashboards` — `DashboardsPage` under `pages/dashboards/`
- `/dashboards/:id` — individual dashboard
- `/tenders/dashboard` — tender-specific dashboard (PR #43)

**API endpoints (key):**
- `GET/POST/PATCH/DELETE /api/v1/dashboards`
- `GET /api/v1/dashboards/:id` — with widgets
- `PATCH /api/v1/dashboards/:id/widgets/reorder` — drag-to-reorder
- `POST /api/v1/dashboards/:id/widgets/select-all?category=`
- KPI / chart data endpoints per widget type

**DB entities:**
- `Dashboard` (owned by user, name, layout)
- `UserDashboard`
- Widget config stored as JSON

## What should work (functional checklist)

### Dashboard list / picker
- [ ] User can create new dashboard
- [ ] Sidebar live-updates when dashboard created (PR #96 invalidates
      query cache)
- [ ] Switch between dashboards from sidebar

### Dashboard view
- [ ] 4-column KPI grid layout (responsive: 4 → 2 → 1) — PR #96
- [ ] 2-column chart grid below KPIs
- [ ] Drag handle visible on widget cards (baseline opacity 0.5, PR #96)
- [ ] Drag-to-reorder widgets within grid
- [ ] Per-widget period override pill (orange when overridden, PR #96)
- [ ] Inline-editable dashboard name (click → Enter to save)
- [ ] No duplicate dashboard page under Platform sidebar (PR #92 fix)

### Widget picker (Customise slide-over)
- [ ] Widget categories: Tendering, Safety, Compliance, Operations,
      Finance (Safety + Compliance added in PR #96)
- [ ] "Select all / Deselect all" per category (PR #96)
- [ ] Multi-select widgets, save
- [ ] localStorage widget toggles for the placeholder dashboard

### Widget types
- [ ] KPI cards (Recharts via @project-ops/ui)
- [ ] BarChartWidget, LineChartWidget, DonutChartWidget from
      `packages/ui/src/charts/`
- [ ] Safety widgets (4): incidents, hazards, near-misses, open issues
- [ ] Compliance widgets (4): expiring licences, expired, blocked
      entities, alerts to Marco
- [ ] Tender widgets: KPIs (active, won, lost, value), follow-up queue,
      scorecard, pipeline by stage

### Tender dashboard (PR #43)
- [ ] Lead-time data correct (PR #102)
- [ ] Dashboard chrome consistent with overview (PR #102)

### Reports
- [ ] CSV / Excel export on dashboards / lists
- [ ] Asset utilisation report (PR #275)
- [ ] Payroll export CSV (PR #274)
- [ ] Estimate export Excel (PR #45)

## Recent PRs that shaped it (last ~100 merged)

- #15 — S7 dashboard foundation
- #31 — Dashboard builder — **functional / foundational**
- #32 — Dashboard polish
- #33 — Dashboard canvas DnD fix
- #43 — Dashboard v2 tender layout — **functional**
- #48 — Nav Dashboards group
- #92 — Remove duplicate dashboard entry from Platform sidebar
- #96 — Dashboard polish: Safety + Compliance widgets, period pill,
  inline name, drag handle — **functional**
- #102 — Dashboard chrome, lead-time data, scheduler label, mode toast,
  directory comment

## What to watch for during sanity check

- **KPI title/period-selector layout collision (PHASE 6 CRITICAL)** —
  Chat1 screenshot batch 2026-05-03 captured visible overlap at narrow
  viewports. Verify at 1024px, 768px, 375px.
- **Job ID inconsistency on dashboard** — PHASE 6 lists this as a Chat1
  finding; canonical post PR #210 is J-YYYY-NNN. Verify dashboard widgets
  show new format.
- **Tender title truncation** — PHASE 6 flag: ~12-15 char ellipsis was
  too aggressive. Verify current truncation point.
- **Sidebar "Tendering" label duplication (DASHBOARDS vs COMMERCIAL)** —
  PHASE 6 known issue; verify still or fixed.
- **"Due this week" card label vs content mismatch** — PHASE 6 flag:
  shows overdue only despite title. Verify.
- **Period override pill orange-when-overridden** — visually distinctive
- **Drag handle visibility** — baseline opacity 0.5 means it's there
  but subtle; verify discoverable
- **Sidebar live-update on dashboard create** — verify query
  invalidation works without refresh

## Edge cases worth probing

- **Empty dashboard (0 widgets)** — empty state with CTA to add widgets
- **Dashboard with 30+ widgets** — performance, scroll
- **Widget with 0 data** — empty state per widget, not blank chart
- **Per-widget period that returns 0 rows** — handled
- **Drag widget to invalid position** — snap back
- **Inline rename with empty name** — validation
- **Concurrent edit on shared dashboard** — last write wins
- **Mobile width** — 4-col → 2-col → 1-col responsive; touch DnD on
  iPad?
- **Permission-gated** — Safety widgets visible to safety-permitted
  users; Finance widgets to admin/Amy
- **Custom widget builder (Phase 7 ⏸️)** — not yet built; verify no
  half-implemented UI
