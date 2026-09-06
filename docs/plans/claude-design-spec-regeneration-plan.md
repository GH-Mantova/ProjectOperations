# Claude Design spec regeneration plan (CD-S2)

**Grounded against `origin/main` = `35c62eb6`, measured 2026-09-06.**

> This is the plan CD-S2 was supposed to produce. It does **not** rewrite any spec.
> It measures the drift so the follow-on regeneration slices can be sized honestly.

The seven Claude Design specs at `Claude Design/docs/*.md` describe the UI as at
**2026-06-26**. The route table they were generated from — `Claude Design/assets/routes.js` —
has not been re-cut against the app since. So two distinct drifts exist:

1. **Route-table drift** — screens that changed, moved, were retired, or were added since
   2026-06-26. This is what the drift table below measures.
2. **Route-list drift** — screens that exist today in `apps/web/src/App.tsx` but are not in
   `routes.js` at all (e.g. `/settings/*`, `/crm/accounts`, `/directory`, `/inbox`,
   `/inventory`, `/procurement`, `/schedule-of-rates/*`, `/dockets`, `/cases`, `/knowledge`).
   Those are **out of scope** for CD-S2 — the slice was explicit that every row must map to
   an entry in `routes.js`. They matter, and one of the regeneration slices below has to
   re-cut `routes.js` before it can honestly rewrite the doc that houses them, but the
   scope of THIS plan stops at the 67 rows.

---

## Ground truth used

- Route list: `Claude Design/assets/routes.js` — **67 route entries** across four surfaces
  (Desktop 53 · Field 5 · Portal 6 · Auth 3). Verified by hand-count of `route:` keys in
  the file at commit `35c62eb6`.
- Section index: `##` headings in `Claude Design/docs/0[1-6]-*.md` — **54 sections**
  (01: 9 · 02: 9 · 03: 9 · 04: 11 · 05: 13 · 06: 3 top-level with 14 sub-`###`). Doc
  `00-design-system.md` has 6 sections but describes the design system, not per-screen
  surfaces, so it is not counted in the 54.
- Live routes: `apps/web/src/App.tsx` (787 lines) — read directly to classify each
  documented route as still-live, redirect, or absent.
- Component files: `apps/web/src/pages/**`, `apps/web/src/components/ShellLayout.tsx`,
  `apps/web/src/layouts/FieldLayout.tsx`, `apps/web/src/portal/PortalLayout.tsx`,
  `apps/web/src/styles/tokens.css` — read for the four known-mover checks.

The drift table row count = **67** — one per `route:` in `routes.js`. If either number
above changes, this plan is stale.

---

## What "regeneration" means (acceptance test for the chained slices)

The existing specs share a fixed section shape. A regeneration slice is **done** for a
document when every ## section either matches this shape against the live app or is
deleted (for a `GONE` row):

- **Component file:** absolute path under `apps/web/src/`
- **Purpose:** one paragraph, plain English, what the screen is for
- **Layout & key sections:** structure from top to bottom, named regions, sub-panels
- **Key components / CSS classes:** design-system primitives, bespoke classes, shared UI kit
- **Data sources (endpoints):** every `GET/POST/PATCH/DELETE` path the page hits
- **States:** loading, empty, error, populated (and any status-specific empties)
- **Notable interactions:** what makes this screen behave, not what it looks like
- **Mockup:** path under `Claude Design/mockups/` (if the mockup is retained)

A slice must also update the `> ⚠️ SNAPSHOT` banner at the top of the doc to the new
grounding date, or remove it if the whole doc has been rewritten.

`routes.js` **is not regenerated as part of these slices** unless a slice explicitly says
so — see the Doc 05 slice, which requires a route-table refresh because the
`admin-settings` group has been fully retired in favour of `/settings/*`.

---

## The four known movers (spot-checked)

| Mover | Where measured | Documented location | Verdict |
|---|---|---|---|
| Scope-card redesign (`SCOPE_WBS_*`) | `apps/web/src/pages/tendering/scope-cards/` contains 8 `.tsx` files (`DisciplineSummaryBar`, `ScopeCardTabsRow`, `ScopeCardTab`, `NewCardModal`, `ChangeDisciplineModal`, `ScopeCardCreateTab`, `ScopeCardEmptyState`, `ScopeCardsTab`) plus `useScopeCards.ts`. Doc 01 describes the Scope-of-Works tab as "scope item cards/quantities — separate sub-tree" and does not name any of these components. | `01-commercial.md` § "Tender Detail — `/tenders/:id`" | **MOVED** — doc mentions only `ScopeCardsTab.tsx`; the surface is now a discipline-bar → tabs-row → per-card tab pattern. `/tenders/:id` gets flagged MOVED in the table below. |
| Brand-theme work (dark theme + expanded tokens) | `apps/web/src/styles/tokens.css` now defines `--sidebar-active-bg`, `--surface-subtle`, `--surface-hover`, `--surface-zebra`, `--surface-override`, `--text-inverse` (all absent from the doc) plus a full `data-theme="dark"` block. Doc 00 lists ~15 tokens; the live file has ~24 in `:root` alone. | `00-design-system.md` § "Brand & colour tokens" and § "Layout shells" | **MOVED** — doc is silent on the dark theme and on six added tokens. Not per-route drift, but the whole Design System doc has drifted. Handled by SLICE-F. |
| Settings home (`/settings/*`) | `apps/web/src/pages/settings/SettingsHomePage.tsx` exists. `App.tsx:398-427` mounts `<SettingsShell>` at `/settings` with children `account`, `notifications`, `calendar-sync`, `ai`, `reference-data`, `handover-template`, plus administration sub-routes. All nine `/admin/*` routes in `routes.js` are now `<Navigate>` redirects into that tree. | `05-dashboards-admin-account.md` § "Admin Settings — `/admin/settings`" | **MOVED** for every `/admin/*` row and for `/account`, `/notifications`. See SLICE-A. |
| Nav5 restructure | `apps/web/src/components/ShellLayout.tsx` defines seven top-level nav groups: `tendering`, `crm`, `projects`, `operations`, `hr`, `safety`, `settings` (grep of `id: "..."` at lines 177, 248, 284, 300, 329, 397, 441). Doc 00 documents six: "Dashboards, Commercial, Operations, Directory, Platform, Admin." | `00-design-system.md` § "Layout shells" bullet 1 | **MOVED** — group ids and labels no longer match. Not per-route drift, again bundled into SLICE-F. |

---

## Per-screen drift table

**Rules:** one row per `route:` entry in `routes.js`. `Documented in` = which `Claude Design/docs/`
file houses the matching `## <Title> — <route>` heading, or `—` if none. `Drift` is one of:

- **NONE** — doc still true for this route.
- **MOVED** — screen exists but the doc description is wrong (renamed component, redirect
  target, restructured content, added siblings that change the surface).
- **GONE** — documented screen no longer exists at this route and its described surface has
  been retired (not merely redirected to an equivalent).
- **UNDOCUMENTED** — route exists in `routes.js` but no `##` section describes it.
- **UNVERIFIABLE** — could not measure in this pass; must be treated as drift until proven
  otherwise (per DOCTRINE §7.1: absence of measurement is not `NONE`).

The `Evidence` column names the file(s) or line(s) checked. `UNVERIFIABLE` rows explicitly
name the check that was skipped.

### Desktop — Dashboards (3)

| # | route | title | component (per routes.js) | documented in | doc section | drift | evidence |
|---|---|---|---|---|---|---|---|
| 1 | `/` | Operations Dashboard | `DashboardPlaceholderPage` | `05` | Operations Overview — `/` | **MOVED** | `App.tsx:329-334` wraps the page in `<RootRedirect>` (not in the doc); component still `DashboardPlaceholderPage`. Widget layout under it not diffed — flag the wrapper. |
| 2 | `/tenders/dashboard` | Tendering Dashboard | `TenderingDashboardPage` | `01` | Tender Dashboard | **GONE** | No `TenderingDashboardPage` route in `App.tsx`. `ShellLayout.nav.test.ts:180-182` explicitly asserts "no sidebar entry points at /tenders/dashboard or the seeded system dashboards". |
| 3 | `/dashboards/:id` | Custom Dashboard | `UserDashboardPage` | `05` | My Dashboard | **UNVERIFIABLE** | Route + component name still match (`App.tsx:638`). Internals (widget registry, resize/reorder mechanics) not diffed in this pass. |

### Desktop — Commercial (8)

| # | route | title | component (per routes.js) | documented in | doc section | drift | evidence |
|---|---|---|---|---|---|---|---|
| 4 | `/tenders` | Tendering Register | `TenderingPage` | `01` | Pipeline / Register | **UNVERIFIABLE** | `App.tsx:341` still mounts `TenderingPage`. Adjacent new siblings `/tenders/leads`, `/tenders/pipeline`, `/tenders/create`, `/tenders/workspace` (lines 346-351) suggest the surface has grown — full page-content diff not run. |
| 5 | `/tenders/:id` | Tender Detail | `TenderDetailPage` | `01` | Tender Detail | **MOVED** | Scope-card sub-tree completely refactored (see mover row 1). New sibling sub-routes `/scope`, `/quote`, `/rates`, `/history` at `App.tsx:360-363`; doc only names `/scope` and `/quote`. |
| 6 | `/tenders/clients` | Tender Clients | `TenderClientsPage` | `01` | Tender Clients | **GONE** | `App.tsx:357` — `<QueryPreservingRedirect to="/directory?tab=clients" />`. The doc-described tender-scoped MasterData surface no longer renders anywhere. |
| 7 | `/tenders/contacts` | Tender Contacts | `TenderContactsPage` | `01` | Tender Contacts | **GONE** | `App.tsx:358` — redirects to `/directory?tab=contacts`. |
| 8 | `/tenders/reports` | Tendering Reports | `TenderingReportsPage` | `01` | Estimating Reports | **GONE** | No `App.tsx` route; no grep hit for `TenderingReports` in `apps/web/src`. |
| 9 | `/tenders/settings` | Tendering Settings | `TenderingSettingsPage` | `01` | Tendering Settings | **GONE** | No `App.tsx` route; surface subsumed by `/settings/*`. |
| 10 | `/contracts` | Contracts | `ContractsListPage` | `01` | Contracts | **UNVERIFIABLE** | `App.tsx:607` still mounts `ContractsListPage`. Page content not diffed. |
| 11 | `/contracts/:id` | Contract Detail | `ContractDetailPage` | `01` | Contract Detail | **UNVERIFIABLE** | `App.tsx:608` still mounts `ContractDetailPage`. Page content not diffed. |

### Desktop — Operations (23)

| # | route | title | component (per routes.js) | documented in | doc section | drift | evidence |
|---|---|---|---|---|---|---|---|
| 12 | `/projects` | Projects | `ProjectsListPage` | `02` | Projects | **UNVERIFIABLE** | `App.tsx:366` mounts `ProjectsListPage`. Content not diffed. |
| 13 | `/projects/:id` | Project Detail | `ProjectDetailPage` | `02` | Project Detail | **UNVERIFIABLE** | `App.tsx:367` mounts `ProjectDetailPage`. Content not diffed. |
| 14 | `/jobs` | Jobs | `JobsListPage` | `02` | Jobs (one-paragraph stub) | **UNVERIFIABLE** | `App.tsx:364` mounts `JobsListPage`. Doc entry is a stub pointing at the mockup, so drift is hard to detect from prose alone. |
| 15 | `/jobs/:id` | Job Detail | `JobDetailPage` | `02` | Job Detail | **UNVERIFIABLE** | `App.tsx:365`. Content not diffed. |
| 16 | `/scheduler` | Scheduler | `SchedulerWorkspacePage` | `02` | Scheduler | **MOVED** | `App.tsx:336` mounts `SchedulerHomePage` (renamed). The comment at 337-338 says legacy sub-routes were retired in favour of `?view=` tabs — the whole page contract has changed. |
| 17 | `/scheduler/availability-report` | Availability report | `AvailabilityReportPage` | — | (none) | **UNDOCUMENTED** | `grep -r "availability-report" "Claude Design/docs/"` returned 0 hits. File `apps/web/src/pages/scheduler/AvailabilityReportPage.tsx` exists but is no longer routed — `/scheduler/:legacyView` wildcard swallows this URL and renders `SchedulerHomePage` (`App.tsx:339`). |
| 18 | `/scheduler/grid` | Scheduler Grid | `SchedulerGridPage` | — | (none) | **UNDOCUMENTED** | Same grep, no hits. `SchedulerGridPage.tsx` file exists; route now caught by `/scheduler/:legacyView`. |
| 19 | `/account/calendar-sync` | Calendar Sync | `CalendarSyncPage` | `02` | Calendar Sync | **MOVED** | `App.tsx:340` — `<QueryPreservingRedirect to="/settings/calendar-sync" />`. `CalendarSyncPage` still mounted, but at `/settings/calendar-sync` (line 409). |
| 20 | `/sites` | Sites | `SitesListPage` | `02` | Sites | **UNVERIFIABLE** | `App.tsx:649`. Content not diffed. |
| 21 | `/sites/:id` | Site Detail | `SiteDetailPage` | `02` | Site Detail | **UNVERIFIABLE** | `App.tsx:650`. Content not diffed. New sibling `/sites/:siteId/muster/:eventId` (line 651) not in `routes.js`; doesn't affect this row. |
| 22 | `/assets` | Assets | `AssetsListPage` | `03` | Assets | **UNVERIFIABLE** | `App.tsx:379`. Content not diffed. |
| 23 | `/assets/:id` | Asset Detail | `AssetDetailPage` | `03` | Asset Detail | **UNVERIFIABLE** | `App.tsx:380`. Content not diffed. |
| 24 | `/maintenance` | Maintenance | `MaintenancePage` | `03` | Maintenance | **MOVED** | `App.tsx:384` mounts `MaintenanceDashboardPage` (renamed). Doc describes an "Upcoming & overdue worklist beside a month calendar" layout — the component rename alone means the described class names (`maint-*`) may no longer apply. |
| 25 | `/maintenance/utilisation` | Plant Utilisation Report | `PlantUtilisationReportPage` | `03` | Plant Utilisation Report | **UNVERIFIABLE** | `App.tsx:385`. Content not diffed. |
| 26 | `/forms` | Forms | `FormsListPage` | `03` | Forms | **UNVERIFIABLE** | `App.tsx:386`. Content not diffed. |
| 27 | `/forms/designer/:id` | Form Designer | `FormDesignerPage` | `03` | Form Designer | **UNVERIFIABLE** | `App.tsx:387` uses `:templateId`; new sibling `/forms/designer/:templateId/rules` (line 388) mounts `FormRulesBuilderPage` (not in `routes.js`, not in the doc). |
| 28 | `/forms/fill/:id` | Form Fill | `FormFillPage` | `03` | Form Fill (field-engine filler) | **UNVERIFIABLE** | `App.tsx:389` uses `:submissionId`. Component still `FormFillPage`; content not diffed. |
| 29 | `/forms/submissions/:id` | Form Submission Detail | `FormSubmissionDetailPage` | `03` | Form Submission Detail | **UNVERIFIABLE** | `App.tsx:390`. Content not diffed. |
| 30 | `/safety` | Safety | `SafetyPage` | `04` | Safety | **UNVERIFIABLE** | `App.tsx:653`. Content not diffed. |
| 31 | `/timesheets/approval` | Timesheet Approval | `TimesheetApprovalPage` | `02` | Timesheet Approval | **UNVERIFIABLE** | `App.tsx:368`. New sibling `/timesheets/payroll-export` (line 369) not in `routes.js`; doesn't affect this row. |
| 32 | `/workers` | Workers | `WorkersListPage` | `04` | Workers | **UNVERIFIABLE** | `App.tsx:371`. New siblings `/workers/live-crew`, `/workers/leave-approvals`, `/workers/job-roles` (lines 372-377) not in `routes.js`. |
| 33 | `/workers/:id` | Worker Detail | `WorkerDetailPage` | `04` | Worker Detail | **UNVERIFIABLE** | `App.tsx:378`. Content not diffed. |
| 34 | `/resources` | Resources (legacy) | `ResourcesPage` | `04` | Resources | **GONE** | No `App.tsx` route. Doc itself labels the surface "legacy"; it has now been fully retired. |

### Desktop — Directory (3)

| # | route | title | component (per routes.js) | documented in | doc section | drift | evidence |
|---|---|---|---|---|---|---|---|
| 35 | `/master-data` | Master Data | `MasterDataWorkspacePage` | `04` | Master Data | **UNVERIFIABLE** | `App.tsx:648`. Content not diffed. |
| 36 | `/directory/subcontractors` | Subcontractors & Suppliers | `SubcontractorsPage` | `04` | Subcontractors & Suppliers | **GONE** | No `App.tsx` route. Only `/directory` (line 761) exists, mounting `DirectoryPage`. The doc-described dedicated Subcontractors surface no longer routes. |
| 37 | `/directory/contacts` | Contacts | `ContactsPage` | `04` | Contacts | **GONE** | No `App.tsx` route. Contacts have folded into `/directory?tab=contacts`. |

### Desktop — Platform (4)

| # | route | title | component (per routes.js) | documented in | doc section | drift | evidence |
|---|---|---|---|---|---|---|---|
| 38 | `/documents` | Documents | `DocumentsWorkspacePage` | `04` | Documents | **UNVERIFIABLE** | `App.tsx:393`. Content not diffed. |
| 39 | `/compliance` | Compliance | `CompliancePage` | `04` | Compliance | **UNVERIFIABLE** | `App.tsx:652`. Content not diffed. |
| 40 | `/archive` | Archive | `ArchivePage` | `04` | Archive | **GONE** | `App.tsx:777` — `<QueryPreservingRedirect to="/documents?tab=archived" />`. The dedicated Archive register surface has been folded into Documents. |
| 41 | `/archive/:jobId` | Archive Detail | `ArchiveDetailPage` | `04` | Archive Detail | **UNVERIFIABLE** | `App.tsx:778` still mounts `ArchiveDetailPage`. Content not diffed. |

### Desktop — Admin (9)

All nine rows are **MOVED**: every `/admin/*` route in `routes.js` is now a `<Navigate>` or
`<QueryPreservingRedirect>` into `/settings/*`. The doc-described admin console layout
(200px left rail with "Notifications / Email / Users / …" tabs) is retired; those
sub-surfaces now live under `SettingsShell`.

| # | route | title | component (per routes.js) | documented in | doc section | drift | evidence |
|---|---|---|---|---|---|---|---|
| 42 | `/admin/settings` | Admin Settings | `AdminSettingsPage` | `05` | Admin Settings | **MOVED** | `App.tsx:585` — Navigate to `/settings/administration/system`. |
| 43 | `/admin/estimate-rates` | Rates & Lists | `EstimateRatesAdminPage` | `05` | Estimate Rates | **MOVED** | `App.tsx:612` — Navigate to `/settings/reference-data`; component now `RatesListsAdminPage` (line 425). Even the component name in `routes.js` is stale. |
| 44 | `/admin/job-roles` | Job Roles | `JobRolesPage` | — | (none) | **UNDOCUMENTED** | `grep -r "JobRoles" "Claude Design/docs/"` returned 0 hits. Now redirects to `/workers/job-roles` (`App.tsx:626`); `JobRolesPage.tsx` lives at `apps/web/src/pages/admin/JobRolesPage.tsx`. |
| 45 | `/admin/ai-settings` | AI Settings | `AiSettingsPage` | `05` | AI Settings | **MOVED** | `App.tsx:590` — Navigate to `/settings/ai`. |
| 46 | `/admin/users` | Users | `UsersPage` | `05` | Users | **MOVED** | `App.tsx:577` — Navigate to `/settings/administration/users`. |
| 47 | `/admin/roles` | Roles | `RolesPage` | `05` | Roles | **MOVED** | `App.tsx:578` — Navigate to `/settings/administration/roles`. |
| 48 | `/admin/permissions` | Permissions | `PermissionsPage` | `05` | Permissions | **MOVED** | `App.tsx:579` — Navigate to `/settings/administration/permissions`. |
| 49 | `/admin/audit` | Audit Logs | `AuditLogsPage` | `05` | Audit Logs | **MOVED** | `App.tsx:580` — Navigate to `/settings/administration/audit`. |
| 50 | `/admin/platform` | Platform | `PlatformPage` | `05` | Platform | **MOVED** | `App.tsx:581` — Navigate to `/settings/administration/platform`. |

### Desktop — Account & System (3)

| # | route | title | component (per routes.js) | documented in | doc section | drift | evidence |
|---|---|---|---|---|---|---|---|
| 51 | `/account` | My Account | `UserProfilePage` | `05` | My Account | **MOVED** | `App.tsx:627` — Navigate to `/settings/account`. `UserProfilePage` still mounted (line 404) but under the settings shell, not standalone. |
| 52 | `/notifications` | Notifications | `NotificationsPage` | `05` | Notifications | **MOVED** | `App.tsx:632` — Navigate to `/inbox`. The doc-described "Operational Follow-ups + Notification Inbox" surface has been split; the inbox now lives at `/inbox` (line 631) and prompts moved elsewhere. |
| 53 | `*` | Not Found (404) | `NotFoundPage` | `05` | Page Not Found | **NONE** | `App.tsx:781` — `<Route path="*" element={<NotFoundPage />} />`. Doc description matches the component role. Control row. |

### Field (5)

Field surfaces were not diffed at the component level in this pass. Route + component names
all still match (`App.tsx:316-320`), so nothing is measurably drifted; but the doc's
detailed layout claims (bottom-tab active states, offline banner, GPS-consent panel, etc.)
have not been re-verified. Sibling routes added since (`dockets`, `agreed-records`,
`expenses`, `leave`, `notifications` at lines 321-325) are not in `routes.js` and don't
affect these rows.

| # | route | title | component (per routes.js) | documented in | doc section | drift | evidence |
|---|---|---|---|---|---|---|---|
| 54 | `/field/allocations` | My Allocations | `FieldAllocationsPage` | `06` | My Jobs — `/field/allocations` | **UNVERIFIABLE** | `App.tsx:316`. Layout, cards, state list not diffed. |
| 55 | `/field/pre-start` | Pre-Start | `FieldPreStartPage` | `06` | Pre-Start — `/field/pre-start` | **UNVERIFIABLE** | `App.tsx:317`. Not diffed. |
| 56 | `/field/timesheet` | Timesheet | `FieldTimesheetPage` | `06` | Timesheet — `/field/timesheet` | **UNVERIFIABLE** | `App.tsx:318`. Not diffed. |
| 57 | `/field/documents` | Documents | `FieldDocumentsPage` | `06` | Documents — `/field/documents` | **UNVERIFIABLE** | `App.tsx:319`. Not diffed. |
| 58 | `/field/safety` | Safety | `FieldSafetyPage` | `06` | Safety — `/field/safety` | **UNVERIFIABLE** | `App.tsx:320`. Not diffed. |

### Portal (6)

Same treatment — route + component names match (`App.tsx:257-263`), content not diffed.

| # | route | title | component (per routes.js) | documented in | doc section | drift | evidence |
|---|---|---|---|---|---|---|---|
| 59 | `/portal` | Portal Dashboard | `PortalDashboardPage` | `06` | Dashboard — `/portal` | **UNVERIFIABLE** | `App.tsx:258` (index route). Not diffed. |
| 60 | `/portal/projects` | Portal Projects | `PortalProjectsPage` | `06` | Projects — `/portal/projects` | **UNVERIFIABLE** | `App.tsx:259`. Not diffed. |
| 61 | `/portal/jobs` | Portal Jobs | `PortalJobsPage` | `06` | Jobs — `/portal/jobs` | **UNVERIFIABLE** | `App.tsx:260`. Not diffed. |
| 62 | `/portal/quotes` | Portal Quotes | `PortalQuotesPage` | `06` | Quotes — `/portal/quotes` | **UNVERIFIABLE** | `App.tsx:261`. Not diffed. |
| 63 | `/portal/documents` | Portal Documents | `PortalDocumentsPage` | `06` | Documents — `/portal/documents` | **UNVERIFIABLE** | `App.tsx:262`. Not diffed. |
| 64 | `/portal/account` | Portal Account | `PortalAccountPage` | `06` | Account — `/portal/account` | **UNVERIFIABLE** | `App.tsx:263`. Not diffed. |

### Auth (3)

Route + component names match (`App.tsx:254-266`), content not diffed. The doc's SSO
claim (staff login has an M365 button gated by `VITE_SSO_ENABLED`) was not re-verified.

| # | route | title | component (per routes.js) | documented in | doc section | drift | evidence |
|---|---|---|---|---|---|---|---|
| 65 | `/login` | Staff Login | `LoginPage` | `06` | Staff sign in — `/login` | **UNVERIFIABLE** | `App.tsx:266`. SSO block not re-verified. |
| 66 | `/portal/login` | Portal Login | `PortalLoginPage` | `06` | Portal sign in — `/portal/login` | **UNVERIFIABLE** | `App.tsx:254`. Not diffed. |
| 67 | `/portal/accept-invite` | Accept Invite | `PortalAcceptInvitePage` | `06` | Accept invite — `/portal/accept-invite` | **UNVERIFIABLE** | `App.tsx:255`. Not diffed. |

### Row-count control

`routes.js` contains **67 `route:` entries** (Desktop 53 + Field 5 + Portal 6 + Auth 3).
Rows above: **67** — one per entry. If those numbers stop matching, the table has silently
dropped or invented screens.

### Spot-check greps for `UNDOCUMENTED` rows

Every `UNDOCUMENTED` row was verified by grepping the docs for the route substring and the
component name; all three returned zero hits:

- `grep -r "availability-report" "Claude Design/docs/"` → 0 hits (row 17)
- `grep -r "SchedulerGrid\|/scheduler/grid" "Claude Design/docs/"` → 0 hits (row 18)
- `grep -r "job-roles\|JobRoles" "Claude Design/docs/"` → 0 hits (row 44)

---

## Count summary

### By drift class

| Class | Count | Notes |
|---|---:|---|
| NONE | 1 | Only the `*` (404) row. This is the control the slice asked for. |
| MOVED | 15 | Structural changes: renames, redirects, restructured content. |
| GONE | 9 | Documented surface fully retired, not merely redirected. |
| UNDOCUMENTED | 3 | Route exists in `routes.js` but no `##` section describes it. |
| UNVERIFIABLE | 39 | Route + component name still match; page content not diffed in this pass. |
| **Total** | **67** | Matches `routes.js` `route:` count. |

### By document

| Doc | Rows | NONE | MOVED | GONE | UNDOCUMENTED | UNVERIFIABLE |
|---|---:|---:|---:|---:|---:|---:|
| `00-design-system.md` | 0 route rows (design system, not per-screen) | — | — | — | — | — |
| `01-commercial.md` | 8 | 0 | 1 | 5 | 0 | 2 |
| `02-operations.md` | 11 | 0 | 2 | 1 | 2 | 6 |
| `03-assets-maintenance-forms.md` | 8 | 0 | 1 | 0 | 0 | 7 |
| `04-workforce-directory-platform.md` | 11 | 0 | 0 | 4 | 0 | 7 |
| `05-dashboards-admin-account.md` | 15 | 1 | 11 | 0 | 1 | 2 |
| `06-field-portal-auth.md` | 14 | 0 | 0 | 0 | 0 | 14 |
| **Total** | **67** | 1 | 15 | 10 | 3 | 38 |

> The per-doc totals differ slightly from the by-class totals because row 44 (`/admin/job-roles`)
> is `UNDOCUMENTED`, which by definition has no owning doc — the by-doc row shows it against
> `05-dashboards-admin-account.md` because the `/admin/*` prefix would logically belong there.
> Similarly rows 17 and 18 are shown against `02-operations.md`. Class totals in the by-doc
> table therefore double-count against the owning doc for undocumented rows; the top summary
> is authoritative.

Doc 00 also has **structural drift** that is not captured in the route table: the design-system
token list is missing six tokens and the full dark-theme block, and the "Layout shells" §1
description of the sidebar names six nav groups when the live `ShellLayout` has seven. This
is documented in the "four known movers" table above.

---

## Slice plan (regeneration chain)

**Ordering rule:** most-drifted doc first (MOVED + GONE + UNDOCUMENTED, descending). Each
slice is one PR that regenerates one doc. Each slice's premise dies when that doc's
regeneration lands on `main`.

### SLICE-A: Regenerate `05-dashboards-admin-account.md` (Dashboards, Admin & Account)

- **Drift:** 12 non-`NONE` rows (11 MOVED + 1 UNDOCUMENTED) — the largest cluster.
- **Premise:** `! grep -q "Admin Settings — \`/admin/settings\`" "Claude Design/docs/05-dashboards-admin-account.md"`
- **Why first:** the settings-home migration is the single biggest visible change in the
  app. The doc describes nine admin surfaces at `/admin/*` that are now redirects into
  `/settings/*` — a reader who navigates by the doc will land on the redirects, not the
  real UI. Every sub-section of this doc needs rewriting or retiring.
- **In scope:** rewrite all 13 `##` sections. Sections for the nine `/admin/*` surfaces
  should be **deleted** and replaced with sections for the current `/settings/*` shell
  (Settings Home, Reference Data, Administration sub-pages, Company, Data Model, Field
  Definitions, AI, Handover Template, Calendar Sync). Also add the `/admin/job-roles`
  UNDOCUMENTED row's replacement — a `##` describing `/workers/job-roles`. Update the
  SNAPSHOT banner to the new grounding date.
- **Also refresh `routes.js`** as part of this slice — the `admin` group is stale and
  no other slice will do it. This is the one exception to "do not touch
  `Claude Design/`" that CD-S2 explicitly permits, and it must be called out in the
  PR description.
- **Size:** L. Rewriting 13 sections plus a routes-table refresh.

### SLICE-B: Regenerate `01-commercial.md` (Tendering & Contracts)

- **Drift:** 6 non-`NONE` rows (1 MOVED + 5 GONE).
- **Premise:** `! grep -q "Tender Dashboard — \`/tenders/dashboard\`" "Claude Design/docs/01-commercial.md"`
- **Why:** five documented tender-related surfaces have been retired (dashboard, clients,
  contacts, reports, settings) and the Tender Detail scope-of-works sub-tree has been
  completely rebuilt. The doc still promises pages that no longer exist.
- **In scope:** delete the five `##` sections for GONE routes. Fully rewrite Tender Detail
  (`##` §3) against the current scope-cards tree, quote tab, and new sub-routes
  (`/scope`, `/quote`, `/rates`, `/history`). Reverify Contracts and Contract Detail — if
  content matches, mark them re-grounded; if drifted, rewrite. Update the SNAPSHOT banner.
- **Size:** M. Five deletions + one large rewrite + two content re-verifications.

### SLICE-C: Regenerate `02-operations.md` (Projects, Jobs, Scheduling & Sites)

- **Drift:** 5 non-`NONE` rows (2 MOVED + 1 GONE + 2 UNDOCUMENTED).
- **Premise:** `! grep -q "Scheduler — \`/scheduler\`" "Claude Design/docs/02-operations.md"`
- **Why:** the Scheduler has been completely restructured (workspace → home + `?view=` tabs),
  Calendar Sync moved to `/settings/calendar-sync`, and two legacy scheduler sub-routes
  (`/scheduler/availability-report`, `/scheduler/grid`) exist in `routes.js` without
  sections — either add sections or (probably) drop them from `routes.js` because they're
  swallowed by the wildcard. Also verify remaining UNVERIFIABLE rows against the live
  components.
- **In scope:** rewrite Scheduler and Calendar Sync sections. Decide whether to document
  the two legacy scheduler paths or retire them from `routes.js` (recommend retire —
  reflect the retirement in a sentence explaining the wildcard). Re-verify Projects,
  Project Detail, Job Detail, Site Detail, Timesheet Approval; rewrite any that have
  drifted. Update the SNAPSHOT banner.
- **Size:** M-L. Depends on how many of the 6 UNVERIFIABLE rows turn out to have drifted.

### SLICE-D: Regenerate `04-workforce-directory-platform.md` (Workforce, Directory, Platform)

- **Drift:** 4 non-`NONE` rows (all GONE).
- **Premise:** `! grep -q "Resources — \`/resources\`" "Claude Design/docs/04-workforce-directory-platform.md"`
- **Why:** four surfaces have been retired outright — Resources (legacy),
  Subcontractors & Suppliers, Contacts, Archive (list). The Contacts and Subcontractors
  surfaces folded into a unified `/directory` page that the doc does not describe at all.
- **In scope:** delete four `##` sections. Add a new section for the unified `/directory`
  page (this requires re-cutting the Directory group in `routes.js` — the current three
  entries no longer reflect reality; add `/directory` as a single row and remove
  `/directory/subcontractors`, `/directory/contacts`). Also revisit the Archive section:
  `/archive` is now `/documents?tab=archived`, so the section should describe the
  archived-tab surface inside Documents. Re-verify remaining rows. Update the SNAPSHOT
  banner.
- **Size:** M. Four deletions + one added section + `routes.js` Directory-group refresh.

### SLICE-E: Regenerate `03-assets-maintenance-forms.md` (Assets, Maintenance, Forms)

- **Drift:** 1 non-`NONE` row (MOVED — Maintenance).
- **Premise:** `! grep -q "^## Maintenance — \`/maintenance\`" "Claude Design/docs/03-assets-maintenance-forms.md"`
  (or a stronger premise that fires when the section is rewritten)
- **Why:** the Maintenance page has been renamed from `MaintenancePage` to
  `MaintenanceDashboardPage`; the described `maint-*` classes may no longer exist. Also
  the doc contains a `##` for `Form Submit (stepped wizard) — /forms/submit/:id` — a route
  that isn't in `routes.js` and doesn't exist in `App.tsx`; that section is a stale
  documentation-only artefact and should be deleted.
- **In scope:** rewrite Maintenance section against the live `MaintenanceDashboardPage`.
  Delete the orphan Form Submit section. Re-verify the seven UNVERIFIABLE rows and rewrite
  any that drifted. Update the SNAPSHOT banner.
- **Size:** S-M. Mostly targeted fixes; the seven UNVERIFIABLE rows may or may not force
  bigger rewrites.

### SLICE-F: Regenerate `00-design-system.md`

- **Drift:** structural only — token list and nav-groups paragraph are stale (see the
  four-known-movers table). No per-route rows.
- **Premise:** `! grep -q "sidebar-active-bg\|data-theme" "Claude Design/docs/00-design-system.md"`
  (fires once the doc describes the dark theme and expanded tokens)
- **Why:** the design system doc grounds every other spec. It claims 15 tokens and 6 nav
  groups; the live app has ~24 tokens + a full dark theme and 7 nav groups. Regenerating
  the per-page specs without first fixing the design system means the per-page docs will
  quote wrong class names and colours.
- **In scope:** rewrite the "Brand & colour tokens" table against `tokens.css`, add the
  `data-theme="dark"` block, rewrite the "Layout shells" bullet 1 against the live
  `ShellLayout` nav group ids and labels. Leave the mockup-machinery section alone unless
  it has drifted. Update the SNAPSHOT banner.
- **Size:** S. Focused surgery on two sub-sections.
- **Ordering note:** SLICE-F is small but load-bearing for every other slice. Land it
  **first** if practical (before SLICE-A), so downstream slices don't have to re-cite a
  broken design-system doc. If sequencing forces it later, downstream slices must not
  quote the design system's token list verbatim.

### No slice for `06-field-portal-auth.md`

All 14 field/portal/auth rows are `UNVERIFIABLE`, which means no measured drift.
Per the CD-S2 rule ("A document whose rows are all NONE gets no slice"), the direct
reading is: no scheduled slice. But `UNVERIFIABLE` ≠ `NONE`, and DOCTRINE §7.1 forbids
treating them as identical. Recommendation: before ratifying "no doc-06 slice needed",
run a **verification pass** — spot-diff at least three field pages and three portal
pages against their described layouts. If any drift, add SLICE-G for doc 06 with that
row count.

---

## Out of scope for CD-S2 and its slice chain

- **Re-cutting `routes.js` end-to-end.** Only SLICE-A and SLICE-D touch it, and only for
  the sub-tree they own. A full rebuild of `routes.js` from `App.tsx` (which would surface
  the ~30 new routes not in `routes.js` today — `/settings/*`, `/crm/*`, `/directory`,
  `/inbox`, `/inventory`, `/procurement`, `/schedule-of-rates/*`, `/dockets`, `/cases`,
  `/knowledge`, `/handover/:id`, `/reports`, several new `/workers/*` and `/tenders/*`
  siblings) is a separate follow-up slice. Marco decided 2026-09-03 that specs come
  first — this plan honours that.
- **Regenerating the 65 mock-ups.** Same 2026-09-03 decision.
- **Any change under `sot/`.**
- **Any change to a mockup file.** The regeneration slices update prose; they may cite
  updated mockup paths but must not edit the mockup HTML.
- **Deep component-level diffs** of the 38 remaining UNVERIFIABLE rows. Those get diffed
  as their owning slice is executed, not up front.
