# Architecture Overview

## Architectural style

The platform is a modular monolith with:

- one backend codebase
- one frontend codebase
- one PostgreSQL database
- clear module boundaries for later expansion

## Current foundations

- `apps/api` contains transport, configuration, health, authentication, RBAC, audit, SharePoint service abstraction, notifications, search, dashboards/reporting, assets, maintenance, forms, documents, closeout/archive, and API documentation bootstrap layers.
- `apps/web` contains the responsive shell, login flow, admin routes for users/roles/permissions/audit, platform foundation screens, the master data workspace, tendering screens with tender document integration, the jobs-and-delivery workspace with closeout/archive visibility, the scheduler planning workspace, the resources/competencies workspace, the assets register/detail workspace, the maintenance workspace, the forms/compliance workspace, the documents workspace, and the rendered dashboards/reporting workspace.
- `packages/config` contains shared environment helpers used by both apps.
- `packages/ui` contains shared UI primitives for consistent presentation.

## Planned module sequence

The implementation sequence follows the master build pack:

1. Platform Foundation
2. Auth / Users / Roles / Permissions / Audit
3. SharePoint Integration + Platform Services Foundation
4. Master Data
5. Tendering and Estimating
6. Tender Documents
7. Award / Contract / Job Conversion
8. Jobs and Delivery
9. Scheduler and Work Planning
10. Resources and Competencies
11. Assets and Equipment
12. Maintenance
13. Forms and Compliance
14. Documents
15. Dashboards and Reporting
16. Closeout and Archive
17. Hardening and Consolidation

## Persistence split

- PostgreSQL will hold transactional and operational data.
- SharePoint will hold files and folders once the live SharePoint integration layer replaces the current mock foundation.

## Current rollout posture

- Tendering is now in a strong, pilot-ready state.
- The recommended deployment shape is hosted web + hosted API + PostgreSQL.
- SharePoint is currently best treated as:
  - launch surface via the Intranet site
  - document and backup repository via the Initialservices documents site
- The app-side SharePoint integration is still mock-backed and has not yet been replaced with live Microsoft Graph folder/file operations.

## API conventions

- base prefix: `/api/v1`
- DTO validation at module boundaries
- paginated list shape: `items`, `total`, `page`, `pageSize`
- Swagger/OpenAPI published from the API bootstrap
- shared bootstrap configuration reused by both runtime startup and automated compliance verification
- consistent JSON error envelope from the global API exception filter

## Operational verification

- `pnpm compliance:smoke` runs a repeatable backend smoke flow across the core lifecycle: login, tender creation, tender award/contract, job conversion, scheduler planning, maintenance visibility, forms, documents, dashboards, and closeout/archive
- Tendering also has local browser verification coverage via Playwright. In the managed Windows environment, the most reliable browser-validation path is the manual reuse-runtime flow documented in:
  - [local-development.md](C:\Dev\ProjectOperations\docs\local-development.md)

## V2 Improvements (April 2026) — architecture delta

The v2 cycle (sections S1–S9 in `codex_master_prompt.md`) refined the platform
along four axes: developer ergonomics, adapter patterns, UI/UX coverage, and
observability. The baseline sections above remain accurate; this section captures
what changed.

### New / reshaped routes (`apps/web`)

All legacy routes are preserved under `/{route}/legacy` so existing deep links,
tests, and seed data continue to work.

| Path | Component | Notes |
|---|---|---|
| `/` | `DashboardPlaceholderPage` | Spec-compliant Operations dashboard — 4 KPI grid + 2-col chart grid + "Customise" slide-over with localStorage widget toggles |
| `/tenders` | `TenderingPage` | Kanban pipeline (default) + Register toggle + "New tender" slide-over |
| `/tenders/:id` | `TenderDetailPage` | 60/40 split with sticky rail, activity timeline, inline note/clarification/follow-up forms |
| `/jobs` | `JobsListPage` | Card grid (default) + table toggle + 7 filters + "New job" slide-over |
| `/jobs/:id` | `JobDetailPage` | 7 tabs with clickable activity completion toggle |
| `/scheduler` | `SchedulerWorkspacePage` | 3-pane layout (hierarchy \| timeline \| resource panel) with week/month views |
| `/resources` | `WorkersListPage` | Worker card grid with search + role + availability filters |
| `/resources/:id` | `WorkerDetailPage` | 5 tabs (Profile / Competencies / Availability / Assigned shifts / Documents) |
| `/assets` | `AssetsListPage` | Card grid with 4 filters |
| `/assets/:id` | `AssetDetailPage` | 4 tabs with derived last/next service + total downtime KPIs |
| `/maintenance` | `MaintenancePage` (v2) | Upcoming/overdue list + month calendar + "Log event" slide-over |
| `/forms` | `FormsListPage` | Tabs: Templates (card grid) + Submissions (filterable table) |
| `/forms/designer/:templateId` | `FormDesignerPage` | 3-pane designer with draggable field chips, property editor, rules editor, Preview modal |
| `/forms/submit/:templateId` | `FormSubmitPage` | Distraction-free wizard with signature canvas + photo upload |
| `/documents` | `DocumentsWorkspacePage` | Context tree + list with drag-and-drop upload zone |
| `/master-data` | `MasterDataWorkspacePage` | Clients + Sites tabs with cards/table toggle and slide-over forms |
| `/archive` | `ArchivePage` | Standalone archive register with CSV export |
| `/archive/:jobId` | `ArchiveDetailPage` | Read-only with 7 collapsible panels + JSON record export |
| `/login` | `LoginPage` (v2) | Dark full-screen background, centred card, conditional Microsoft SSO button |

The sidebar (`ShellLayout`) is now a dark 240px/64px-collapsed rail with five role-
gated nav groups, a 56px top bar with breadcrumb / notifications bell /
Cmd-Ctrl-K search / user avatar, and a bottom tab bar below 768px.

### New API endpoints (v2 cycle)

| Method + path | Module | Notes |
|---|---|---|
| `POST /api/v1/auth/sso` | `auth` | Microsoft 365 SSO with auto-provision |
| `PATCH /api/v1/notifications/read-all` | `platform/notifications` | Bulk-mark-read for current user |
| `GET /api/v1/archive` | `archive` | Paginated archive list |
| `GET /api/v1/archive/:jobId/export` | `archive` | Full read-only archive snapshot |
| `PATCH /api/v1/tenders/:id/status` | `tendering` | Lightweight stage update used by Kanban drag-drop |
| `GET /api/v1/resources/workers/:id` | `resources` | Worker detail with eager-loaded relations |
| `POST /api/v1/documents` (multipart) | `documents` | Optional multipart file upload via `FileInterceptor('file')` |
| `POST /api/v1/documents/:id/versions` (multipart) | `documents` | Same as above for new versions |
| `POST /api/v1/tenders/:tenderId/documents` (multipart) | `tender-documents` | Same pattern for tender documents |

Every new endpoint carries `@ApiOperation` + `@ApiResponse` (and `@ApiQuery` where
applicable) for Swagger coverage.

### Adapter pattern updates

**SharePoint.** The `SharePointAdapter` interface (`apps/api/src/modules/platform/
sharepoint.adapter.ts`) now exposes three methods: `ensureFolder`, `uploadFile`,
`getDownloadUrl`. `GraphSharePointAdapter` is no longer a stub — it uses
`@microsoft/microsoft-graph-client` with a `TokenCredentialAuthenticationProvider`
backed by `ClientSecretCredential` from `@azure/identity`. `MockSharePointAdapter`
preserves the existing mock behaviour for all three methods. The adapter is
selected by `platform.module.ts` based on `SHAREPOINT_MODE`:
- `"mock"` (default) → `MockSharePointAdapter`
- `"live"` (canonical per CLAUDE.md) or `"graph"` (legacy) → `GraphSharePointAdapter`

**Authentication.** The existing `EntraTokenValidatorService` is unchanged and
still used by both the legacy `POST /auth/entra` path and the new `POST /auth/sso`
path. The `EntraAuthService` gained an `authenticateWithSso` method that either
returns an existing active user or auto-provisions a new one with the
lowest-privilege available role (Viewer → Field → Planner → Admin), `ssoOnly: true`,
and an empty password hash (blocking local login for that user).

### New packages / dependencies

Across the v2 cycle:
- **`@project-ops/api`** — `@microsoft/microsoft-graph-client`, `@azure/identity`,
  `@types/multer`, `jwks-rsa`, `jsonwebtoken`, `@types/jsonwebtoken`, `eslint` +
  `@typescript-eslint/*`.
- **`@project-ops/web`** — `recharts`, `@azure/msal-browser`, `@azure/msal-react`,
  `eslint` + `@typescript-eslint/*` + `eslint-plugin-react-hooks`.
- **`@project-ops/ui`** — `recharts` (so the new `KpiCard` / `BarChartWidget` /
  `LineChartWidget` / `DonutChartWidget` can import it directly).
- **Root workspace** — `cross-env` (root dev dep for cross-platform scripts).

Chart components (`packages/ui/src/charts/`) and feedback primitives
(`packages/ui/src/feedback/EmptyState.tsx`, `Skeleton.tsx`) are re-exported from
`packages/ui/src/index.ts`.

### New environment variables

| Var | Mode required | Purpose |
|---|---|---|
| `SHAREPOINT_TENANT_ID` | live | Entra tenant for Graph auth |
| `SHAREPOINT_CLIENT_ID` | live | Entra app registration client id |
| `SHAREPOINT_CLIENT_SECRET` | live | Entra app registration secret |
| `ENTRA_TENANT_ID` | SSO enabled | SSO tenant for backend token validation |
| `ENTRA_CLIENT_ID` | SSO enabled | SSO client id for backend token validation |
| `SSO_ENABLED` | optional | Backend feature flag (currently advisory) |
| `VITE_SSO_ENABLED` | SSO enabled | Frontend MSAL bootstrap flag |
| `VITE_ENTRA_CLIENT_ID` | SSO enabled | Frontend MSAL client id |
| `VITE_ENTRA_TENANT_ID` | SSO enabled | Frontend MSAL tenant |

SharePoint and SSO are opt-in: when the required vars are absent, the mock
adapter / local-login flow remain active and nothing in the UI changes.

### Schema change

One migration in the v2 cycle:
- `apps/api/prisma/migrations/20260418_s4_sso_user_flag/migration.sql` — adds
  `sso_only BOOLEAN NOT NULL DEFAULT false` to `users` (`User.ssoOnly` in Prisma).

### Dev tooling

- `pnpm lint` now works across the monorepo. Each of `@project-ops/api` and
  `@project-ops/web` has a flat-config `eslint.config.(js|cjs)` with a
  conservative ruleset (parses TS/TSX correctly, no style enforcement that would
  require bulk refactors).
- `.github/workflows/ci.yml` runs the api job (Postgres 16 service + prisma
  migrate + seed + lint + tests + compliance smoke) and the web job (lint +
  logic tests + build) on every PR and push to `main`.
- `.github/workflows/deploy.yml` runs `pnpm build:azure` and pushes to Azure App
  Service (API) and Azure Static Web Apps (web) on merges to `main`, gated by
  the four `AZURE_*` / `PROD_API_BASE_URL` repo secrets.
- The root `packageManager` field pins pnpm to `10.0.0`; the pnpm GitHub Action
  reads that directly so the workflows and the repo can never disagree.
