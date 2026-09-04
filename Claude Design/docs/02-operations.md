# Operations — Projects, Jobs, Scheduling & Sites

> ⚠️ **SNAPSHOT — describes the UI as at 2026-06-26.** Screens changed since then are not
> reflected here. Regeneration is tracked in `Claude Design/proposed/README.md`. Do not cite this
> document as the current design without checking it against the running app.

This section documents the **Operations** nav group of the Initial Services — ProjectOperations
staff workspace: delivery records (projects), the operational job tree, the resource scheduler,
calendar sync, the site register, and field timesheet approval. All pages render inside
`ShellLayout` (dark sidebar + 56px top bar injected by `chrome.js` in the gallery). Currency is
AUD, dates display in the browser locale (dd/mm/yyyy for `en-AU`), and sample data reflects SEQ
civil/construction work (Brisbane City Council, TMR Queensland, Urban Utilities, Redland/Logan City
Council; drainage, culverts, retaining walls, pump stations).

Shared conventions across these pages:
- `authFetch(path)` from `useAuth()` (`AuthContext`) is the single API client; it prefixes the
  configured API base (`/api/v1`). Endpoint paths below are written relative to that base.
- Status/state pills use either the `s7-badge s7-badge--*` system or an inline `type-badge` span
  with hardcoded brand hex (teal `#005B61` active, sand `#F1EFE8`/`#854F0B` mobilising/warning,
  red `#FCEBEB`/`#A32D2D` danger, slate `#E2E8F0` closed).
- Loading uses `Skeleton` blocks; empty uses the `EmptyState` component (icon + heading + subtext +
  optional CTA); errors render a red-bordered `s7-card[role="alert"]`.

---

## Jobs — `/jobs`

The Jobs list (delivery workspace) is the entry point to the operational job tree and **already has
a mockup** at `mockups/jobs.html` (component `JobsListPage.tsx`). It is a card/table-toggle grid of
job cards (`jobs-card` with number, status badge, progress bar, PM avatar) above a filter bar
(search + status/client/site/worker/date selects). It is not recreated here — see that file for the
canonical layout. Job cards link through to the Job detail page documented below.

---

## Project Detail — `/projects/:id`

**Component file:** `pages/projects/ProjectDetailPage.tsx` (plus `pages/projects/GanttChart.tsx`,
`AdvanceStatusModal.tsx`, `ConfirmRevertDialog.tsx`).

**Purpose:** The full delivery record for one project converted from an awarded tender — financials,
team, key dates, frozen scope snapshot, schedule (Gantt + milestones), documents, allocations and an
activity audit trail.

**Layout & key sections:** Uses the `admin-page` shell. Header (`admin-page__header`) shows a
`← Projects` back link, the project number as `s7-type-label`, the name as `s7-type-page-title`,
client + a `From {tenderNumber}` link to the source tender, a status `type-badge`, and two
permission-gated actions: **Revert to Tender** (`tenders.manage`, red ghost button → preflight
cascade-count dialog) and **Advance status →** (`projects.manage`, opens `AdvanceStatusModal`).
A six-item tab nav (`admin-page__tabs` / `admin-page__tab--active`) drives `role="tabpanel"`
sections: **Overview** (three `s7-card`s — Financials stat grid of Contract Value/Budget/Actual
Cost/Variance with green/red variance accent, Team person-cards with circular avatar initials, and a
Key dates `tender-detail__dl`), **Scope** (a "frozen at conversion" banner then per-scope-code
`s7-card`s each with an `admin-page__table` of description/quantity/unit), **Schedule**, **Documents**
(re-linked from the source tender's document list), **Team**, and **Activity**.

The **Schedule** tab is the headline interaction. It has a Gantt/List view toggle, week/month/quarter
zoom buttons, and (for `projects.manage`) "Generate from scope" + "+ Add task". `GanttChart.tsx`
renders a horizontally-scrolling timeline: a sticky date strip with ticks (every 7 days in week zoom,
month-start in month/quarter), a fixed 200px task-label column, one 32px row per task with a coloured
bar positioned by `offsetDays * pxPerDay` and widened by duration, an inner dark progress fill, and a
red dashed "today" line. Clicking a bar opens `EditTaskModal` (title/dates/progress slider/colour,
delete). Below the Gantt is a Milestones `s7-card` table (Name/Planned/Status). The mockup renders the
Schedule tab populated with five disciplined civil tasks plus the Overview financials/team cards above
it for context.

**Key components/CSS classes:** `admin-page`, `admin-page__header`, `admin-page__tabs`,
`admin-page__tab(--active)`, `admin-page__table`, `s7-card`, `s7-type-section-heading`, `type-badge`,
`s7-btn s7-btn--primary/--ghost/--secondary s7-btn--sm`, `tender-detail__dl`. The Gantt is built from
inline styles in `GanttChart.tsx` (replicated as `.cdx-gantt*` rules in the mockup's local `<style>`).

**Data sources (endpoints):** `GET /projects/:id` (detail); `GET /projects/:id/gantt`,
`POST /projects/:id/gantt/generate`, `POST /projects/:id/gantt`, `PATCH|DELETE /projects/:id/gantt/:taskId`;
`GET /projects/:id/allocations`, `POST /projects/:id/allocations`, `DELETE /projects/:id/allocations/:allocId`;
`GET /projects/:id/activity?page&limit`; `GET /tenders/:sourceId/documents`; `GET /workers?search&isActive`,
`GET /assets?q`; `GET|DELETE /projects/:id/revert-to-tender[/preflight]`; `PATCH /projects/:id`
(required qualifications). The Team tab enforces a competency gate — a 409 `COMPETENCY_GATE_BLOCKED`
surfaces missing/expired qualifications and (for `resources.manage` / super-users) an audited override
reason field.

**States:** Loading shows two stacked `Skeleton` blocks. Not-found/error renders an `EmptyState`
("Project not found") with a back button. Each tab has its own empties (no scope items, no milestones,
no documents, no workers/assets allocated). A teal toast confirms allocation/qual saves.

**Notable interactions:** Status advancement and tender revert (with cascade preflight) are
destructive/stateful flows; worker allocation can trigger double-booking warnings (amber) and the
competency gate (red); Gantt bars are draggable-by-modal in the live app.

Mockup: `mockups/project-detail.html`

---

## Projects — `/projects`

**Component file:** `pages/projects/ProjectsListPage.tsx`.

**Purpose:** Register of all active and historical delivery projects, filterable by lifecycle status.

**Layout & key sections:** `admin-page` shell. Header has the "Delivery" label, "Projects" title, a
descriptive subline, and a right-aligned search input (search-on-blur, writes `?search=` to the URL).
Below is a status filter tab bar (`admin-page__tabs`) with All / Mobilising / Active / Practical
Completion / Defects / Closed, each showing a live count of rows in that status. The body is a single
`s7-card` wrapping an `admin-page__table`: columns **Project # / Name / Client / Status / Contract
Value (right-aligned tabular) / Proposed Start / PM**. The project number links to the detail page in
brand-accent; an optional `(tender)` micro-link sits beside it for projects converted from a tender.
A row-count footer reports the filtered total.

**Key components/CSS classes:** `admin-page`, `admin-page__tabs`, `admin-page__tab(--active)`,
`admin-page__table`, `s7-card`, `s7-input`, `type-badge`. Status colours come from a `STATUS_STYLE`
map (per-status bg/fg hex + label).

**Data sources (endpoints):** `GET /projects?status=&search=` returning `{ items, total, page, limit }`.
Status filter and search are reflected into the URL search params (`useSearchParams`, replace mode).

**States:** Loading → a single `Skeleton` inside an `s7-card`. Empty → `EmptyState` ("No projects yet"
with a status-aware subtext, or "Convert an AWARDED tender to create your first project."). Error → red
`s7-card[role="alert"]`.

**Notable interactions:** Tab clicks re-filter without a full navigation; rows are pointer-cursor and
navigate to `/projects/:id`; the source-tender micro-link deep-links to `/tenders/:id`.

Mockup: `mockups/projects.html`

---

## Job Detail — `/jobs/:id`

**Component file:** `pages/jobs/JobDetailPage.tsx` (with `components/ErrorBoundary` and
`components/correspondence/CorrespondencePanel`).

**Purpose:** Operational view of a single job — stage/activity tree, issues, variations (with running
total), weekly progress, documents and status history, plus a correspondence panel.

**Layout & key sections:** Root `job-detail`. A `← Back to jobs` link, then a `job-detail__header`
(job number label, name title, a meta line combining client · site · PM · supervisor, and a created/
updated line) with quick-actions on the right (status `s7-badge` and, when a closeout exists, a "View
archive →" button to `/archive/:id`). The tab nav (`tender-detail__tabs job-detail__tabs`) has seven
tabs with live counts: **Overview**, **Stages & Activities (n)**, **Issues (n)**, **Variations (n)**,
**Progress (n)**, **Documents**, **History (n)**. Overview is a KPI strip (`job-detail__overview` of
`s7-card job-detail__overview-kpi` tiles — Total activities, Open issues, Variations value, Progress
with a `jobs-card__progress` bar — plus an optional Description card). Stages & Activities renders a
`job-tree`: expandable `job-tree__stage` rows (caret, order, title, status badge, completed/total
count) each containing `job-tree__activity` rows whose `job-tree__check` button cycles
NOT_STARTED → IN_PROGRESS → COMPLETE with an optimistic update. Issues/Progress use `job-list` cards;
Variations uses an `s7-table` inside `s7-table-scroll` with a computed running total column; Documents
uses `tender-docs`; History uses a `tender-timeline`. Every tab is wrapped in an `ErrorBoundary`, and
a `CorrespondencePanel` always renders below the active tab.

**Key components/CSS classes:** `job-detail`, `job-detail__header/__meta/__dates/__quick-actions/__tabs`,
`job-detail__overview(-kpi/-value)`, `job-tree`, `job-tree__stage(-head/-order/-title/-count)`,
`job-tree__caret`, `job-tree__activities`, `job-tree__activity(-name/-meta)`, `job-tree__check(--done)`,
`job-list`, `tender-detail__tab(--active)`, `tender-detail__back`, `s7-table`, `s7-table-scroll`,
`tender-docs`, `tender-timeline`, `s7-badge s7-badge--active/--info/--warning/--danger/--neutral`.
A documented gotcha (B01.1): activities are nested inside `stages[].activities`, not a top-level array —
`flattenActivities()` derives the flat list for KPIs.

**Data sources (endpoints):** `GET /jobs/:id` (full nested job); `PATCH /jobs/:id/activities/:activityId`
(status toggle); `GET /documents/entity/Job/:id` (lazy, on Documents tab); correspondence is loaded by
`CorrespondencePanel` (ownerKind `job`).

**States:** Initial load → `Skeleton` stack. Fetch failure → `EmptyState` "Job not found" with a back
CTA. As a deliberate guard, a null job (loading or broken fetch) shows a "Loading job…" `EmptyState`
rather than a blank page. Each tab has its own empty (no stages/issues/variations/progress/documents/
status history). Documents tab shows a `Skeleton` until its lazy fetch resolves.

**Notable interactions:** Activity check toggles are optimistic and roll back on API failure; stage
rows expand/collapse (all expanded on first load); section-level `ErrorBoundary`s isolate a failing tab
from the rest of the page.

Mockup: `mockups/job-detail.html`

---

## Scheduler — `/scheduler`

**Component file:** `pages/scheduler/SchedulerWorkspacePage.tsx`.

**Purpose:** Resource scheduling workspace — assign workers and assets to shifts across jobs, with
conflict detection, week/month calendar views and availability awareness.

**Layout & key sections:** A three-pane `sched-page` grid (collapses the right pane via
`sched-page--resource-collapsed`). **Left** (`sched-hierarchy`): a Jobs tree — "All jobs" plus one
`sched-hierarchy__job` button per job (number, name, shift count); selecting a job expands its
stages → activities (`sched-hierarchy__stages/__activities`) and filters the calendar. **Centre**
(`sched-main`): a header with prev/Today/next nav + range label, a Week/Month view toggle
(`tender-page__view-toggle`), and a Hide/Show-resources button. The **week view** (`sched-week`) is
seven day columns (`sched-week__col`, `--today` highlight) each with a date header and a body of
`ShiftPill`s; the **month view** (`sched-month`) is a weekday header row + a 7-column cell grid
(`sched-month__cell`, `--today`/`--dim`) showing up to three pills per day plus a "+n more" overflow.
**Right** (`sched-resources`): a Workers/Assets toggle then a list — worker rows show avatar initials,
name, resource type, an availability dot (`--ok`/`--leave`) and a shift count; asset rows show name,
category·home-base and a status badge. Selecting a resource highlights its shifts and dims the rest.
Clicking a shift opens a `ShiftDetailSlideOver` (overlay panel) with conflicts, assigned workers/assets
(each removable), assign-dropdowns, and notes/work-instructions.

**Key components/CSS classes:** `sched-page(--resource-collapsed)`, `sched-hierarchy(__head/__body/
__list/__job/__job--active/__job-name/__count/__stages/__activities/__activity/__stage-title)`,
`sched-main(__head/__nav/__range/__actions)`, `sched-week(__col/__col--today/__colhead/__day/__date/
__date--today/__body/__empty)`, `sched-month(__headrow/__dayhead/__grid/__cell/__cell--today/
__cell--dim/__daynum/__cellbody/__more)`, `sched-pill(--success/--warning/--danger/--highlight/--dim/
--compact)`, `sched-pill__time/__title/__conflict`, `sched-resource(__avatar/__meta/__name/__role/
__dot/__dot--ok/__dot--leave/__shifts)`, `slide-over(-overlay/__header/__body/__close/__subtitle)`,
`sched-detail__section/__conflict(s)`, `tender-page__view-toggle/__view-btn(--active)`. Pill colour is
driven by conflict severity (RED→danger, AMBER→warning) then status (CONFIRMED→success).

**Data sources (endpoints):** `GET /scheduler/workspace?page&pageSize` (jobs, workers, assets, shifts);
`POST|DELETE /scheduler/shifts/:shiftId/workers[/:workerId]`; `POST|DELETE /scheduler/shifts/:shiftId/
assets[/:assetId]`. All mutations trigger a full workspace reload.

**States:** Loading shows `Skeleton`s in each pane. Empties: "No jobs" (hierarchy), "No workers" /
"No assets" (resources), per-day "—" (`sched-week__empty`) for empty columns. Errors render a
`tender-page__error` banner above the calendar.

**Notable interactions:** Job filter, resource highlight/dim, week↔month switching with prev/next/today
navigation, conflict badges with hover detail, and an Escape-closeable slide-over for shift editing.
A local-time `dayKey` is used deliberately (AEST +10) so pills map to the correct calendar cell.

Mockup: `mockups/scheduler.html`

---

## Calendar Sync — `/account/calendar-sync`

**Component file:** `pages/calendar/CalendarSyncPage.tsx`.

**Purpose:** Per-user settings/status panel for syncing assigned shifts to a calendar. Mock-mode-first;
the live Microsoft Graph (Outlook) adapter is a gated follow-up.

**Layout & key sections:** A simple stacked layout of `AppCard`s (rendered as `s7-card` in the gallery).
Page header (title + explanatory subline). **Status** card: a left column listing Mode (mock, with a
"Graph is a follow-up" note), Active events, Cancelled events and Last sync; a right column with a
**Sync now** button (`.btn-primary`, `data-testid="calendar-sync-run"`) and a last-run summary
(created/updated/cancelled/active counts). **ICS feed** card explaining the subscribe URL with a `<code>`
block (`GET /api/v1/calendar-sync/feed.ics`). **Synced events** card: a plain table of Title / Start /
End / Status for the active+cancelled events ledger.

**Key components/CSS classes:** `AppCard` (from `@project-ops/ui`), `.btn-primary`, plain `<table>` with
inline padding, `<code>` chip on `--surface-muted`. (Mockup substitutes `s7-card` / `s7-btn--primary`
for visual parity since `AppCard`/`.btn-primary` are equivalent surfaces.)

**Data sources (endpoints):** `GET /calendar-sync/status`, `GET /calendar-sync/events` (loaded in
parallel on mount), `POST /calendar-sync/run` (manual sync), and the documented `GET
/api/v1/calendar-sync/feed.ics` subscribe endpoint.

**States:** Loading shows "Loading…" placeholders in both the Status list and the events area. Empty →
"No events synced yet. Click Sync now to push your shifts." Error → a red `role="alert"` paragraph inside
a card (`--status-error`). While a sync runs the button reads "Syncing…" and is disabled.

**Notable interactions:** "Sync now" posts a run then reloads status+events and shows the run summary;
mode is read-only (live mode is not yet user-switchable).

Mockup: `mockups/calendar-sync.html`

---

## Sites — `/sites`

**Component file:** `pages/sites/SitesListPage.tsx` (with `SiteFormModal`).

**Purpose:** Master register of physical project sites (locations IS has worked or is working).

**Layout & key sections:** An inline-styled page (20px pad). Header with "Sites" `s7-type-page-heading`,
a subline, and a right-aligned **+ New site** primary button. A filter bar (subtle background panel)
holds a search input (`s7-input s7-input--sm`, server-side `q` search) and an All-clients select
(`s7-select s7-input--sm`, client-side filter). The body is a plain inline-styled table (not `s7-table`)
with columns **Site name / Address / Client / Code / Jobs / (quick-edit)**. Rows are pointer-cursor and
navigate to `/sites/:id`; the trailing cell has a `✎` quick-edit ghost button (stops row navigation) that
opens `SiteFormModal`.

**Key components/CSS classes:** `s7-type-page-heading`, `s7-btn s7-btn--primary/--ghost s7-btn--sm`,
`s7-input s7-input--sm`, `s7-select`, inline table styling on `--surface-muted` header /
`--border` row rules. `SiteFormModal` is the shared create/edit modal.

**Data sources (endpoints):** `GET /master-data/sites?q=&pageSize=100` (`{ items }`),
`GET /master-data/clients?limit=100` (for the filter dropdown). Create/edit goes through `SiteFormModal`.

**States:** Loading → "Loading…" muted text. Empty → "No sites match the current filters." Error → red
`--status-danger` paragraph. (No skeleton on this list — simple text placeholders.)

**Notable interactions:** Debounced search refetch, client-side client filter, row-click navigation,
inline quick-edit that opens the form modal and refetches on save.

Mockup: `mockups/sites.html`

---

## Site Detail — `/sites/:id`

**Component file:** `pages/sites/SiteDetailPage.tsx` (with `SiteFormModal`, `site-detail-helpers.ts`).

**Purpose:** Full record for one site — identity, KPI rollups, and the tenders, projects and documents
linked to it, with edit and (guarded) delete.

**Layout & key sections:** Inline-styled page. A `← Back to sites` ghost button, an optional toast card,
then a header `s7-card` (name `s7-type-page-heading`, client + code `s7-badge`s, formatted address, and
**Edit site** / **Delete site** actions). A KPI grid uses the shared `KpiCard` component — **Linked
tenders / Linked projects / Documents / Created** (the Created card carries a relative-age value plus an
absolute date trend). Tabs (`tender-detail__tabs`, URL-synced via `?tab=`) are **Overview / Tenders (n) /
Projects (n) / Documents (n)**. Overview shows optional "Access notes / hazards" and a "Summary" card.
Tenders and Projects tabs render inline-styled tables (Tender # / Title / Status / Due date and
Project # / Name / Status / Planned start respectively, status via `tenderStatusBadgeClass` /
`projectStatusBadgeClass` helpers), each row navigating to the linked record. Documents tab lazy-loads a
rollup of documents across the site's projects with an Open link per file.

**Key components/CSS classes:** `KpiCard` (replicated as `.cdx-kpi*` in the mockup), `s7-card`,
`s7-badge s7-badge--info/--neutral`, `s7-type-page-heading`, `s7-type-section-heading`,
`tender-detail__tabs/__tab(--active)`, `s7-btn s7-btn--primary/--ghost/--danger/--secondary`, inline
cell/header style constants, and `CenteredModal` for the delete confirmation. Helpers in
`site-detail-helpers.ts` resolve the active tab and badge classes.

**Data sources (endpoints):** `GET /master-data/sites/:id` (detail incl. linked tenders/projects),
`GET /master-data/clients?limit=200` (edit form options), `GET /documents/sites/:id/documents` (lazy on
Documents tab), `DELETE /master-data/sites/:id` (204 success; 409 when tenders/projects block deletion).

**States:** Loading → bespoke `SiteDetailSkeleton` (pulsing blocks). Not-found → "Site not found" panel
with back link. Error → "Couldn't load site" with Retry + back. Documents tab has its own skeleton,
empty ("No documents have been uploaded…") and error states. Delete modal surfaces a 409 message
("can't be deleted while tenders or projects are linked"). Tab counts and the Documents KPI show "—"
until their data resolves.

**Notable interactions:** Tab state persists in the URL; stale detail is cleared at the start of every
load (PR #288 fix) so a failed refetch can't show the previous site; document rollup is cached across
tab toggles but reset when the site id changes; delete is a guarded `CenteredModal` flow.

Mockup: `mockups/site-detail.html`

---

## Timesheet Approval — `/timesheets/approval`

**Component file:** `pages/timesheets/TimesheetApprovalPage.tsx`.

**Purpose:** Supervisor/commercial review queue for field-worker timesheets — approve, bulk-approve or
return submissions with a reason. Gated by the `field.manage` permission (redirects to `/` otherwise).

**Layout & key sections:** `admin-page` shell with an Operations/Timesheets header and a two-tab nav:
**Pending approval** and **All timesheets**. The **Pending** tab (shown in the mockup) leads with a stat
`s7-card` (Pending count in amber, Oldest pending date, Pending hours) then an `admin-page__table` of
submitted timesheets: a select-all checkbox column, **Worker** (name + role), **Project** (number +
name), **Date**, **Hours** (right-aligned tabular), **Break**, **Description** (truncated), **Submitted**
(relative), and **Actions** (Approve primary + Return — a sand `#FEAA6D` secondary). Selecting rows
reveals a bulk-action banner ("n selected" + Approve selected / Clear). The **All** tab swaps the stats
for a filter bar (Status / Worker / Project / From / To selects + Export CSV) and a read-only table with
a status `type-badge` and Approved-by column; clicking a row opens a right-side `TimesheetDetailDrawer`
(full field detail + submit/approve/return history). Returning opens `ReturnTimesheetModal`
(`CenteredModal`) requiring a ≥10-char reason.

**Key components/CSS classes:** `admin-page`, `admin-page__header/__tabs/__tab(--active)/__table`,
`s7-card`, `s7-btn s7-btn--primary/--secondary/--ghost s7-btn--sm`, `type-badge` with a `STATUS_PILL`
map (Draft slate / Submitted sand / Approved teal), `CenteredModal` (return modal), a fixed right-edge
drawer, and a reusable teal `Toast`.

**Data sources (endpoints):** Pending tab → `GET /field/timesheets/pending?limit=100` and
`GET /field/timesheets/summary`; `POST /field/timesheets/:id/approve`,
`POST /field/timesheets/bulk-approve`, `POST /field/timesheets/:id/reject`. All tab →
`GET /field/timesheets/all?status&workerId&projectId&dateFrom&dateTo&limit`. Approvals optimistically
remove the row then reload.

**States:** Loading → `Skeleton` in an `s7-card`. Empty (pending) → "✓ No timesheets pending approval".
Empty (all, filtered) → "No timesheets match these filters." Error → red `s7-card[role="alert"]`.
Non-permitted users never see the page (redirect). The page is approval-only — no edit of worker hours.

**Notable interactions:** Multi-select + bulk approve, optimistic single approve with rollback on error,
return-with-reason validation, URL-independent in-page tabs, a slide-in detail drawer, and a "CSV export
coming soon" toast placeholder.

Mockup: `mockups/timesheets-approval.html`
