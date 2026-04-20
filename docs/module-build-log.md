# Module Build Log

## Module 1: Platform Foundation

Purpose:

- establish the monorepo
- scaffold the API and web apps
- add PostgreSQL and Prisma foundations
- add Docker-based local database startup
- provide health and API docs bootstrapping
- provide the initial responsive shell

Added:

- root workspace manifests
- API foundation and Prisma schema
- web foundation and placeholder navigation
- environment reference and setup docs

Known limitations:

- no installed dependencies in this environment
- no business modules implemented yet
- no real authentication yet
- no SharePoint integration yet

## Module 2: Auth / Users / Roles / Permissions / Audit

Purpose:

- provide local authentication
- establish user, role, permission, and audit entities
- add permission-based API protection
- add responsive admin screens

Added:

- login, refresh, and current-user endpoints
- user and role CRUD foundations
- permission registry listing
- audit log capture and listing
- responsive screens for login, users, roles, permissions, and audit logs

Known limitations:

- no password reset flow yet
- no Microsoft Entra / Microsoft 365 SSO yet
- admin screens are foundation-grade rather than final polished workflows

## Module 3: SharePoint + Platform Services Foundation

Purpose:

- provide a SharePoint integration abstraction
- add document-link metadata foundations
- add notifications, search, and dashboard base entities
- expose minimal admin/config surfaces for shared platform services

Added:

- mock-backed SharePoint adapter and service layer
- tracked SharePoint folder/file/document link entities
- notification foundation and current-user notifications endpoint
- search entry foundation and search endpoint
- dashboard and dashboard widget base entities and CRUD foundation
- responsive platform and dashboard screens

Known limitations:

- SharePoint uses a mock adapter in this module rather than live Graph calls
- generic document workflows are not built yet
- notifications and search are foundation-level and will expand as later modules register real data

## Module 4: Master Data

Purpose:

- provide reusable core records for clients, contacts, sites, workers, crews, assets, resource types, competencies, worker competencies, and lookup values
- add search/filter/pagination and duplicate protection where sensible
- keep these services reusable for later modules

Added:

- master data entities and relationships
- CRUD/list APIs with pagination and audit logging
- seed/demo master data
- responsive master data workspace in the web app

Known limitations:

- the master data UI is a compact foundation workspace, not the final polished operational design
- delete/archive flows are not yet implemented
- some advanced validation will be tightened as later modules consume these records

## Module 5: Tendering and Estimating

Purpose:

- implement the tender register and estimating workflow
- support multiple linked clients per tender
- keep awarded-client selection constrained to one linked client
- provide notes, clarifications, pricing snapshots, follow-ups, and outcomes

Added:

- tendering entities and relationships
- tender list/detail/create-update APIs
- seed tender with multiple linked clients
- responsive tender register and create workflow

Known limitations:

- tender create/edit UI is foundation-grade rather than final production polish
- contract issuance and job conversion are intentionally deferred to later modules
- tender document workflows are not included until Module 6

## Module 6: Tender Documents

Purpose:

- add tender-specific document workflows on top of the SharePoint platform foundation
- create and track Tendering folder structure usage
- store tender document metadata in the application database

Added:

- tender document link entity
- tender document APIs for list/create
- tender detail document integration in the web app
- seeded tender document backed by mock SharePoint folder/file links

Known limitations:

- uploads are mock-registered through the SharePoint abstraction rather than true binary upload
- the full generic documents module is still deferred to Module 14

## Module 7: Award / Contract / Job Conversion

Purpose:

- enforce the awarded-client and contract-issued rules on tender lifecycle records
- create one linked job from the contracted awarded client
- carry selected tender data and document links into the new job context
- provide a minimal job register/detail foundation ahead of the deeper Jobs module

Added:

- contract-issued tracking on tender clients
- jobs and job-conversion entities
- award, contract issue, and convert-to-job APIs
- audit coverage for award, contract, and conversion actions
- seeded awarded/contracted tender converted to a job
- tender detail actions and a basic job register/detail web screen

Known limitations:

- jobs remain a foundation slice until Module 8 expands delivery management
- carried documents are linked metadata records rather than copied binaries
- SharePoint folder creation still uses the mock adapter in this phase

## Module 8: Jobs and Delivery

Purpose:

- turn converted jobs into live delivery records
- add stage and activity hierarchy under each job
- track issues, variations, progress entries, daily notes, and status history
- provide a stronger operational job detail workspace ahead of the scheduler module

Added:

- job stages, activities, issues, variations, progress entries, and status history entities
- job update and status update APIs
- create/update APIs for stages, activities, issues, variations, and progress entries
- seeded delivery data for the sample converted job
- expanded jobs web workspace showing linked source tender visibility and live delivery detail

Known limitations:

- scheduler-linked shifts and allocations are still deferred to Module 9
- the jobs UI is still a compact operations workspace rather than the final high-density production experience
- generic documents remains deferred to Module 14 even though job-linked document metadata is visible

## Module 9: Scheduler and Work Planning

Purpose:

- make the scheduler a primary operating surface
- plan shifts under jobs, stages, and activities
- assign workers and assets against shifts
- surface visible red/amber conflict signals for overlapping allocations

Added:

- scheduler entities for shifts, worker assignments, asset assignments, and scheduling conflicts
- scheduler workspace API
- shift create/update APIs and worker/asset assignment APIs
- seeded scheduler data with overlapping worker and asset assignments
- three-pane scheduler web workspace with hierarchy, timeline/calendar modes, and resource assignment panel

Known limitations:

- current assignment interaction is fast-form based rather than full drag-and-drop
- conflict logic currently covers overlapping allocations and partial assignment warnings; competencies and maintenance restrictions will deepen in later modules
- resource-centric planner views will broaden further as Modules 10 to 12 land

## Module 10: Resources and Competencies

Purpose:

- manage worker availability windows, role suitability, and competency-aware assignment context
- expose resource data in a reusable service layer for the scheduler and later asset/forms modules
- warn planners when workers are unavailable, unsuitable for a role, or missing required competencies

Added:

- availability window, worker role suitability, and shift role requirement entities
- resources API for worker listing, availability capture, suitability capture, and shift requirement management
- resources web workspace for worker skills and planning constraints
- scheduler enrichment so worker competency, availability, and role-suitability data is visible in planning
- seeded resource data that triggers real scheduler warnings

Known limitations:

- crew composition support remains basic and will deepen later
- the scheduler resource interaction is still selection-based rather than drag-and-drop
- competency recommendations are rule-based warnings rather than scored recommendations

## Module 11: Assets and Equipment

Purpose:

- replace the basic asset placeholder with a real schedulable asset register
- classify assets by category/type and expose home base and current location
- show asset-to-shift and asset-to-job visibility for planners and supervisors

Added:

- asset category entity and richer asset fields
- dedicated assets API for category management, asset CRUD, and asset detail
- asset detail visibility for linked jobs and shift assignments
- assets web workspace with register, detail, category management, and asset creation
- scheduler asset-panel filtering by category and location-aware display

Known limitations:

- maintenance-driven restrictions are still deferred to Module 12
- the asset workflow is still register-first rather than deeply optimized for mobile field use
- status history and richer lifecycle tracking will expand in later modules

## Module 12: Maintenance

Purpose:

- track maintenance plans, service events, inspections, breakdowns, and asset status changes
- surface due and overdue maintenance states on asset detail and maintenance workspace screens
- feed maintenance impact back into the scheduler so unavailable assets trigger warnings or blocks

Added:

- maintenance entities for plans, events, inspections, breakdowns, and asset status history
- maintenance API for dashboard/detail views and create/update workflows
- maintenance web workspace with recurring plan, event, inspection, and breakdown forms
- asset detail maintenance summary visibility
- scheduler maintenance-aware conflict logic for blocked and warning states

Known limitations:

- maintenance configuration is currently plan-level rather than centralized admin policy
- mobile-first workshop workflows are still basic
- broader document linkage for maintenance records is deferred until the documents module

## Module 13: Forms and Compliance

Purpose:

- provide configurable form templates without code changes
- version templates so historical submissions remain fixed to the version they used
- support operational submissions across job, shift, asset, worker, and site contexts

Added:

- form template, version, section, field, rule, submission, submission value, attachment, and signature entities
- forms API for template listing/detail, version creation, submission listing/detail, and submission create
- forms web workspace for template review, template creation, submission create, and submission review
- seeded daily prestart template with two versions and two submissions bound to different versions

Known limitations:

- template editing currently creates new versions rather than offering a richer visual builder
- conditional logic is minimum viable and rule-based
- file uploads are represented as attachment metadata until the documents module expands storage workflows

## Module 14: Documents

Purpose:

- provide a general documents module backed by the SharePoint foundation
- link documents to jobs, assets, and form submissions through application metadata
- track document versions, tags, and access rules while preserving traceability to SharePoint items

Added:

- documents API for filtered list/detail, entity-scoped views, open/download link resolution, document creation, and version creation
- document tags and document access-rule entities
- version-aware fields on document and SharePoint file metadata
- documents web workspace with filters, document registration, and next-version workflow
- job and asset detail enrichment with linked document visibility
- seeded job, asset, and form-linked document records and SharePoint folder/file links

Known limitations:

- files are still mock-registered through the SharePoint abstraction rather than uploaded through Microsoft Graph
- access rules are app-side visibility controls and do not yet apply native SharePoint ACL changes
- dashboards, closeout, and final hardening still remain as downstream modules

## Module 15: Dashboards and Reporting

Purpose:

- render dashboards from live system data rather than placeholder widgets
- support user-owned and role-owned dashboards
- provide KPI, chart, and table widgets for operations, scheduler, maintenance, tender, and compliance reporting

Added:

- live dashboard render service with KPI, chart, and table widget support
- role ownership relation for dashboards
- list, render, create, and update dashboard APIs
- seeded operations and planner dashboards with live widget configs
- dashboards web workspace that displays rendered widget data and supports user/role dashboard creation via presets

Known limitations:

- widgets currently render from a curated set of metric keys rather than an unrestricted custom query builder
- charts are presented in compact textual form rather than full graphical charting components
- closeout, archive, and the final hardening pass still remain downstream

## Module 16: Closeout and Archive

Purpose:

- close jobs out through a dedicated lifecycle record instead of only a status flag
- preserve archived jobs as read-only historical records
- expose archive views for operational review, audit, and reporting continuity

Added:

- job closeout entity with summary, checklist JSON, archive timestamps, and read-only date
- archive list API and job closeout API
- read-only enforcement for archived jobs across update/create delivery actions
- jobs UI closeout form and archive panel
- seeded archived job for historical visibility

Known limitations:

- closeout checklist is currently JSON-backed rather than a richer configurable checklist builder
- archive UX currently lives inside the jobs workspace rather than a separate dedicated archive route
- the final hardening and consolidation pass still remains downstream

## Module 17: Hardening and Consolidation

Purpose:

- consolidate bootstrap and runtime setup so app initialization is reusable across the server and automated verification
- standardize API error responses for validation and runtime failures
- verify critical end-to-end business flows with a repeatable compliance smoke runner

Added:

- shared Nest app bootstrap helper reused by both `main.ts` and automated compliance checks
- global API exception filter with consistent JSON error payload shape
- repeatable compliance smoke runner that exercises login, tender creation, tender document registration, award, contract issue, tender-to-job conversion, stage/activity creation, shift assignment, conflict visibility, maintenance visibility, form template creation, form submission, documents open-link flow, dashboard rendering, and closeout/archive

Known limitations:

- the compliance runner is a smoke test, not an exhaustive UI automation suite
- SharePoint interactions are still mock-backed, so document verification covers integration flow and metadata rather than live Microsoft Graph file transfer
- scheduler interactions are still API-driven in the compliance pass rather than browser drag-and-drop automation

## Post-Module Hardening Notes

After the main module sequence, the project received additional Tendering-focused hardening and rollout work that is not captured as a separate numbered module.

Highlights:

- Tendering was reshaped toward a more CRM-style `Dashboard / Pipeline / Create / Workspace` flow
- board / list / forecast register surfaces were strengthened
- unified Tendering activity handling was introduced over notes / clarifications / follow-ups
- stakeholder role/note context and communication queue behavior were added to the Tendering workspace
- local Playwright browser coverage was extended across the major Tendering flows
- cross-platform Playwright startup compatibility was later merged into `main`

This means the module list above is accurate for implementation coverage, but the current Tendering experience is materially more mature than the original Module 5 baseline described earlier in this file.

---

## V2 Improvements (April 2026)

After the 16-module baseline documented above, a v2 improvement pass split into nine
sections (S1–S9) extended the platform with cross-platform scripts, CI/CD, the
SharePoint Graph live adapter, Microsoft 365 SSO, a Recharts-based dashboard, a
standalone Archive route, a comprehensive Initial Services seed, a full UI/UX
overhaul, and a final quality pass. Every section shipped as a dedicated
`improvement/s{N}-{slug}` branch and PR to `main`.

### Section 1 — Cross-platform script fix
- Replaced Windows CMD `set VAR=val&&` prefixes in root `dev:api:e2e` and
  `dev:web:e2e` scripts with `cross-env VAR=val`.
- Added `cross-env` as a root-workspace dev dependency. Audited every other
  workspace `package.json` for the same pattern — no other occurrences.

### Section 2 — CI/CD pipeline
- New `.github/workflows/ci.yml` — API job (Postgres 16 service, `prisma generate`
  + `migrate deploy` + seed + api lint + serial tests + compliance smoke) and Web
  job (lint + logic tests + build).
- New `.github/workflows/deploy.yml` — `pnpm build:azure`, deploy API to Azure App
  Service, deploy web `dist` to Azure Static Web Apps. Requires four repo secrets:
  `PROD_API_BASE_URL`, `AZURE_API_APP_NAME`, `AZURE_API_PUBLISH_PROFILE`,
  `AZURE_STATIC_WEB_APPS_TOKEN`.
- A follow-up `fix/ci-pnpm-version` dropped the explicit `version: '10'` input from
  `pnpm/action-setup@v4` so the action reads the version from
  `packageManager: pnpm@10.0.0` in `package.json`, resolving the conflict that was
  blocking CI.

### Section 3 — SharePoint Graph live adapter
- Installed `@microsoft/microsoft-graph-client` and `@azure/identity` in
  `@project-ops/api`, plus `@types/multer` as a dev dep for `FileInterceptor`
  typing. (The spec's `@types/jwks-rsa` was skipped — `jwks-rsa` ships its own
  types.)
- `.env.example` appended `SHAREPOINT_TENANT_ID`, `SHAREPOINT_CLIENT_ID`,
  `SHAREPOINT_CLIENT_SECRET`.
- Extended the `SharePointAdapter` interface with `uploadFile` and
  `getDownloadUrl`; replaced the stub `GraphSharePointAdapter` with a real
  implementation using `Client.initWithMiddleware({ authProvider:
  new TokenCredentialAuthenticationProvider(…) })`. Typed error logging via
  `Logger` + `ServiceUnavailableException` on config / network failure.
- `MockSharePointAdapter` grew matching implementations so CI in mock mode stays
  green.
- `platform.module.ts` factory now selects the Graph adapter when
  `SHAREPOINT_MODE === "live"` (accepts `"graph"` for backward compatibility).
- Multipart upload wired on `POST /documents`, `POST /documents/:id/versions`, and
  `POST /tenders/:tenderId/documents` via
  `@UseInterceptors(FileInterceptor('file'))` + `@UploadedFile() file?: Express.Multer.File`.
  When a file is present, the adapter is called and the returned `{ id, webUrl, eTag }`
  is persisted; when absent, the mock path is retained byte-identically.

### Section 4 — Microsoft 365 SSO foundation
- Installed `@azure/msal-browser` and `@azure/msal-react` in `@project-ops/web`;
  `jwks-rsa`, `jsonwebtoken`, and `@types/jsonwebtoken` in `@project-ops/api`.
- `.env.example` appended `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `SSO_ENABLED`,
  `VITE_SSO_ENABLED`, `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_TENANT_ID`.
- New `apps/web/src/auth/msal.config.ts` exports `msalConfig`, `loginRequest`, and
  the derived `isSsoEnabled` boolean. `main.tsx` wraps the app tree in
  `MsalProvider` only when `isSsoEnabled` is true.
- Login page renders a "Sign in with Microsoft" button below the existing form
  when SSO is on; on success it POSTs the MSAL id-token to `POST /api/v1/auth/sso`.
- Backend: new `POST /auth/sso` endpoint with auto-provisioning. Existing active
  users are returned as-is; inactive users → 403; unknown emails are created with
  `ssoOnly: true`, empty password hash, and the lowest-privilege available role
  (priority order: Viewer → Field → Planner → Admin).
- Schema: `User.ssoOnly Boolean @default(false)` added with migration
  `20260418_s4_sso_user_flag`.

### Section 5 — Visual dashboard charts
- Installed `recharts` in both `@project-ops/web` and `@project-ops/ui`.
- New `packages/ui/src/charts/` — `KpiCard`, `BarChartWidget`, `LineChartWidget`,
  `DonutChartWidget`, re-exported from `packages/ui/src/index.ts`.
- Reshaped `DashboardsService.renderWidget` to the spec output contract:
  `{ type: 'kpi', title, value, trend, trendValue }` for KPIs and
  `{ type: 'bar_chart' | 'line_chart' | 'donut_chart', title, data: [{label,value}] }`
  for charts. New metric keys wired: `tenders.pipelineValue`, `jobs.issuesOpen`,
  `maintenance.dueSoon`, `tenders.byStage`, `revenue.monthly`, `forms.byWeek`,
  `maintenance.upcoming`.
- Frontend `DashboardsPage.tsx` routes widgets by `type` through the new components;
  table rendering retained for legacy table widgets.
- S8 seed widget types renamed to the new `donut_chart` / `line_chart` /
  `bar_chart` values.

### Section 6 — Archive as standalone route
- New `ArchiveModule` with `GET /api/v1/archive` (paginated with
  `search / clientId / year / status` filters; returns
  `id, jobNumber, name, clientName, closedAt, archivedAt, status` per item) and
  `GET /api/v1/archive/:jobId/export` (full read-only snapshot of summary,
  closeout, checklist, stages, activities, issues, variations, progress entries,
  status history, documents metadata, form submissions). Full Swagger decorators
  on both endpoints.
- New `/archive` (`ArchivePage.tsx`) with header + "Export CSV" button + filters
  + paginated table.
- New `/archive/:jobId` (`ArchiveDetailPage.tsx`) — read-only with 7 collapsible
  panels and a JSON "Export record" download.
- "Archive" entry added to the sidebar navigation.
- Jobs workspace inline archive panel replaced with "View in Archive →" link; job
  detail closeout form swaps to the same link when the job is already closed /
  archived.

### Section 7 — Full UI/UX overhaul
Shipped as 13 consecutive PRs. The existing `@projectops.local` dev seed, legacy
routes, and compliance-smoke dependencies were preserved throughout — every legacy
page is reachable under `/{route}/legacy`.

- **7.0 / 7.12 / 7.13 / 7.14 foundations** — `apps/web/src/styles/tokens.css` with
  the full `:root` token block (brand palette, sidebar tones, status colours,
  radii, shadows) plus typography, card, badge, table, button, and input utility
  classes. `EmptyState` + `Skeleton` primitives in `packages/ui`. Responsive
  grid breakpoints + `.s7-table-scroll` + `.s7-touch-target`.
- **7.1 dark sidebar** — 240px / 64px-collapsed sidebar with 5 groups (Operations,
  Commercial, Resources, Data, Admin — role-gated), inline-SVG icons, user footer,
  collapse toggle. 56px white top bar with breadcrumb + bell + search icon + user
  avatar. Bottom tab bar below 768px.
- **7.11 login** — dark full-screen background, centred white card with PO logo +
  wordmark, email + password (show/hide toggle), primary button, conditional
  Microsoft SSO divider + button with the official four-square SVG logo.
- **7.15 notifications + Cmd/Ctrl+K palette** — `NotificationsDropdown` (400×480,
  severity icons, mark-all-read) with new `PATCH /notifications/read-all`
  endpoint. `CommandPalette` with Cmd/Ctrl+K shortcut, 160ms debounce, results
  grouped by entity type, full keyboard navigation. 52 additional `SearchEntry`
  seed rows covering the 7 required palette types.
- **7.2 dashboard** — KPI grid (4 cols desktop / 2 tablet / 1 mobile) with
  coloured left accent bars + 2-col chart grid, skeleton loaders, "Customise"
  slide-over with localStorage-backed widget toggles.
- **7.3 tendering** — Kanban pipeline (6 columns) with native HTML5 drag-drop
  stage changes + `PATCH /tenders/:id/status` lightweight endpoint. Register
  table with sort/filter toggle. `/tenders/:id` detail with 60/40 split, merged
  activity timeline, inline add-note / clarification / follow-up forms.
- **7.4 jobs** — card grid (default) + table toggle with 7 filters. `/jobs/:id`
  with 7 tabs. Activity completion toggles via
  `PATCH /jobs/:id/activities/:activityId`.
- **7.5 scheduler** — 3-pane layout (hierarchy | timeline | resource panel), week
  + month views, conflict-aware shift pills, click-to-open slide-over with
  worker/asset assignment management, resource-click highlight.
- **7.6 workers** — list at `/resources` with card grid + filters.
  `/resources/:id` with 5 tabs. New `GET /resources/workers/:id` endpoint for
  detail.
- **7.7 assets + maintenance** — `/assets` card grid + detail with 4 tabs.
  `/maintenance` two-pane split (upcoming/overdue + month calendar) with "Log
  event" slide-over supporting service / inspection / breakdown modes.
- **7.8 forms** — `/forms` with Templates + Submissions tabs.
  `/forms/designer/:templateId` 3-pane designer with draggable field chips,
  click-to-select fields, property editor, conditional rules editor, Preview
  modal. `/forms/submit/:templateId` distraction-free wizard with progress bar,
  one-section-at-a-time, signature canvas, photo upload, final review.
- **7.9 documents** — `/documents` split view: context tree + document list with
  file-type coloured icons, version badges, uploader, date, Download + New
  version actions. Drag-and-drop upload zone with 11-extension whitelist. Fixed
  `AuthContext.authFetch` to skip default `Content-Type` for `FormData` bodies
  so multipart uploads work.
- **7.10 master data** — `/master-data` with Clients + Sites tabs (Workers links
  to `/resources`). Card/table toggle per tab, filters, "New" slide-over with
  `<fieldset>` section groupings, inline validation (required / email / postcode),
  pinned save/cancel footer.

### Section 8 — Comprehensive seed data
- Additive Initial Services seed in `apps/api/prisma/seed-initial-services.ts`
  (~2,300 lines), called at the end of the existing `main()` in `seed.ts`.
  Preserves the existing `@projectops.local` dev-test data so
  compliance-smoke / LoginPage default / tendering e2e still pass. (Originally
  branded "Mantova Civil Works"; rebranded to Initial Services in a follow-up
  `fix/rebrand-initial-services` branch.)
- 8 Initial Services users (Admin, two PMs, Estimator, Scheduler, two Supervisors, Viewer)
  and the new `Viewer` role with 16 view-only permissions.
- 5 clients + 10 contacts, 7 sites, 7 resource types, 12 competencies, 16
  workers with competency links, 4 crews, 7 asset categories, 14 assets.
- 5 maintenance plans / 10 events / 5 inspections / 1 breakdown.
- 8 tenders across all pipeline stages with notes, clarifications, pricing
  snapshots, follow-ups, outcomes.
- 2 jobs (`job-001` Ipswich Motorway, `job-002` Sandgate Stormwater) with full
  stage / activity trees, issues, variations, weekly progress, status history.
- 20 shifts across two weeks with seeded conflicts (asset-maintenance-block,
  worker-overlap) and `worker-007`'s annual-leave availability window.
- 4 form templates (Daily Prestart / Plant Pre-Start / Incident / Concrete Pour)
  with conditional rules, plus 9 submissions covering all spec scenarios.
- 15 SharePoint folder/file mock pairs + 19 `DocumentLink` records across jobs,
  tenders, assets.
- Dashboard widgets updated to cover the 9 required 8.14 items.
- All upserts are idempotent — verified by running `pnpm seed` twice and
  comparing row counts across 16 tables.

### Section 9 — Code quality pass
- Installed `eslint`, `@typescript-eslint/parser`,
  `@typescript-eslint/eslint-plugin` (+ `eslint-plugin-react-hooks` for web) in
  `@project-ops/api` and `@project-ops/web`.
- Added flat-config `eslint.config.js` (api) and `eslint.config.cjs` (web,
  required because `apps/web/package.json` sets `"type": "module"`).
  Conservative rules — parses TS/TSX correctly without imposing style rules that
  would force a large refactor.
- `pnpm lint` now passes clean across the monorepo (previously the api package's
  `lint` script referenced `eslint` without having it installed).
- Added missing `@ApiResponse` decorators to every new endpoint created during
  the v2 cycle: `POST /auth/sso`, `PATCH /notifications/read-all`,
  `PATCH /tenders/:id/status`, `GET /resources/workers/:id`. (Existing
  controllers untouched.)
- Verified: `pnpm build`, `pnpm --filter @project-ops/api test`,
  `pnpm test:web:logic`, `pnpm seed` (idempotent across 2 runs), and
  `pnpm compliance:smoke` all pass.
- Consistency checks: 42 React Router routes with 0 duplicates, 152 API
  endpoints with 0 duplicates, `prisma generate` clean.
- Zero `any` types on component props in new files across `apps/web/src/pages`,
  `apps/web/src/components`, and `packages/ui/src`.
- Migration audit: `20260418_s4_sso_user_flag` is the only schema change from
  the v2 cycle and is present and applied.
- `docs/module-build-log.md` (this file) and `docs/architecture-overview.md`
  refreshed to describe the v2 state.
