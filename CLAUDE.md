# ProjectOperations — Claude Code Instructions

You are working on the `GH-Mantova/ProjectOperations` repository.
Read this file fully before doing anything. Follow every rule here for every task.

---

## Project overview

**Initial Services** — a browser-based Project Operations Platform for an Australian
construction and civil works company operating across South East Queensland.

Modular monolith with a NestJS API, React frontend, PostgreSQL, Prisma ORM,
and SharePoint-ready integration boundaries.

---

## Tech stack

| Layer | Technology |
|---|---|
| API | NestJS (Node 22), TypeScript strict |
| Frontend | React + Vite + TypeScript strict |
| Database | PostgreSQL 16 via Prisma ORM |
| Auth | Local JWT (access + refresh tokens) + M365 SSO foundation |
| File storage | SharePoint mock adapter (live Graph adapter in progress) |
| Testing | Jest (unit/serial), Playwright (E2E, Chromium + Firefox + WebKit) |
| Package manager | pnpm 10+ workspaces monorepo |
| Containerisation | Docker Compose (local PostgreSQL only) |
| CI/CD | GitHub Actions (`.github/workflows/`) |
| Deployment | Azure (API = Web App, Web = Static Web Apps) |

---

## Workspace structure

```
ProjectOperations/
├── apps/
│   ├── api/          # NestJS backend (@project-ops/api)
│   └── web/          # React + Vite frontend (@project-ops/web)
├── packages/
│   ├── config/       # Shared runtime config helpers (@project-ops/config)
│   └── ui/           # Shared UI components (@project-ops/ui)
├── docs/             # Architecture, setup, deployment, module notes
├── e2e/              # Legacy E2E location
├── tests/e2e/        # Active Playwright E2E specs
├── scripts/          # PowerShell sync scripts (SharePoint ↔ local)
├── .github/workflows/
├── docker-compose.yml
├── package.json      # Root workspace
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── playwright.config.ts
└── playwright.reuse.config.ts
```

### Package scopes and path aliases

- `@project-ops/api` → `apps/api`
- `@project-ops/web` → `apps/web`
- `@project-ops/ui` → `packages/ui/src/*`
- `@project-ops/config` → `packages/config/src/*`

---

## Commands

### Development

```bash
pnpm dev                  # Start API + web in parallel
pnpm dev:api              # API only
pnpm dev:web              # Web only
```

### Build

```bash
pnpm build                # Full monorepo build
pnpm build:azure          # Web build + API build for Azure deploy
```

### Database

```bash
pnpm prisma:generate      # Generate Prisma client
pnpm prisma:migrate       # Apply migrations (dev)
pnpm seed                 # Seed database
```

### Testing

```bash
pnpm lint                 # Lint all packages
pnpm test                 # All tests
pnpm test:api:serial      # API tests (serial — required for DB tests)
pnpm test:web:logic       # Web unit/logic tests
pnpm compliance:smoke     # Full compliance smoke runner
```

### E2E

```bash
pnpm test:tendering:e2e           # Tendering E2E
pnpm test:tendering:e2e:reuse     # Tendering E2E (reuse server)
```

---

## Seed login

- **Email**: `admin@projectops.local`
- **Password**: `Password123!`
- All seed users share password: `Password123!`

---

## Environment

Copy `.env.example` to `.env` before running. Key variables:

```
DATABASE_URL=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
SHAREPOINT_MODE=mock        # 'mock' or 'live'
SHAREPOINT_TENANT_ID=       # live only
SHAREPOINT_CLIENT_ID=       # live only
SHAREPOINT_CLIENT_SECRET=   # live only
ENTRA_TENANT_ID=            # SSO only
ENTRA_CLIENT_ID=            # SSO only
SSO_ENABLED=false
VITE_SSO_ENABLED=false
VITE_ENTRA_CLIENT_ID=       # SSO only
VITE_ENTRA_TENANT_ID=       # SSO only
VITE_API_BASE_URL=http://localhost:3000/api/v1
CORS_ORIGIN=http://localhost:5173
```

Local dev URLs:
- Web: http://localhost:5173
- API: http://localhost:3000
- API docs (Swagger): http://localhost:3000/api/docs
- Health: http://localhost:3000/api/v1/health

---

## TypeScript rules

- `strict: true` is enforced globally — no exceptions
- `moduleResolution` target: `Bundler` for web app, `NodeNext` for API
  (base currently uses legacy `Node` — fix on sight in new files)
- No `any` types on component props or function signatures in new code
- `forceConsistentCasingInFileNames: true` — honour this on all new files
- Path aliases defined in `tsconfig.base.json` — use them, don't use relative `../../`

---

## API conventions (NestJS)

- Every new endpoint must have Swagger decorators:
  `@ApiOperation`, `@ApiResponse`, and `@ApiQuery` (where applicable)
- Use DTOs with `class-validator` for all request bodies
- Inject config — never hardcode values
- SharePoint adapter injected by token — use `SHAREPOINT_MODE` to switch mock/live
- All Prisma access through the service layer, not directly in controllers

---

## Frontend conventions (React)

- Recharts for all chart components (installed in `@project-ops/web`)
- Shared UI components live in `packages/ui` — re-export from `packages/ui/src/index.ts`
- Chart components: `KpiCard`, `BarChartWidget`, `LineChartWidget`, `DonutChartWidget`
- Design tokens in `apps/web/src/styles/tokens.css`
- CSS variable naming: `--brand-primary`, `--surface-*`, `--text-*`, `--status-*`, `--radius-*`
- Skeleton loaders on all data-fetching areas — never a blank screen
- Empty states on all lists/tables with icon + heading + CTA
- All touch targets minimum 44×44px
- Sidebar collapses to bottom tab bar below 768px

---

## Git and branching rules

**Never commit directly to `main`.**

Branch naming:
```
improvement/s{N}-{short-slug}    # for master prompt sections
fix/{short-slug}                  # for bug fixes
feat/{short-slug}                 # for standalone features
```

Pre-work steps before any branch:
1. `git fetch origin`
2. Check for conflicts: `git log --oneline --all -- <file>` for each planned file
3. If conflict found — stop and report, do not proceed

---

## Pull request requirements

Every PR to `main` must include:
- **Title**: `[Section N] Short description`
- **Body**:
  - Summary of changes
  - Files added / modified
  - New dependencies (if any)
  - New env vars (if any)
  - Migration files (if any)
  - Checklist: `pnpm build` ✓, `pnpm lint` ✓, `pnpm compliance:smoke` ✓
- **Reviewer**: `GH-Mantova`

---

## pnpm discipline

- Always use `--frozen-lockfile` unless intentionally adding a dependency
- Add new deps in a single `pnpm add` call — not incrementally
- Commit updated `pnpm-lock.yaml` in the same commit as `package.json` changes
- Never edit `pnpm-lock.yaml` manually
- `cross-env` is the standard for env vars in npm scripts — no `set VAR=val&&` syntax

---

## Prisma discipline

- Never run `prisma migrate dev` on `main`
- All schema changes on a section branch
- Migration naming: `{YYYYMMDD}_{section_slug}_{description}`
  e.g. `20260418_s4_sso_user_flag`
- Migration files committed in the same commit as the schema change
- Check `prisma/migrations/` for unapplied migrations from other branches before running

---

## Seed data rules

- Seed must be **idempotent** — use upserts, not inserts
- Use stable deterministic IDs: `'client-001'`, `'worker-001'`, `'job-001'`, etc.
- Business context: **Initial Services**, South East Queensland construction company
- Running `pnpm seed` multiple times on the same database must produce the same result

---

## Modules in scope

| # | Module |
|---|---|
| 1 | Platform Foundation |
| 2 | Auth / Users / Roles / Permissions / Audit |
| 3 | SharePoint + Platform Services Foundation |
| 4 | Master Data (clients, contacts, sites, lookups) |
| 5 | Tendering and Estimating |
| 6 | Tender Documents |
| 7 | Award / Contract / Job Conversion |
| 8 | Jobs and Delivery |
| 9 | Scheduler and Work Planning |
| 10 | Resources and Competencies |
| 11 | Assets and Equipment |
| 12 | Maintenance |
| 13 | Forms and Compliance |
| 14 | Documents |
| 15 | Dashboards and Reporting |
| 16 | Closeout and Archive |

---

## Improvement sections (master prompt v2)

These are the active improvement branches — execute one at a time, in this order:

| Section | Branch | Description | Status |
|---|---|---|---|
| S1 | `improvement/s1-cross-env` | Cross-platform script fix | — |
| S2 | `improvement/s2-ci-cd` | GitHub Actions CI + deploy | — |
| S8 | `improvement/s8-seed-data` | Comprehensive seed data | — |
| S5 | `improvement/s5-dashboard-charts` | Recharts chart components | After S8 |
| S3 | `improvement/s3-sharepoint-graph` | SharePoint Graph live adapter | — |
| S4 | `improvement/s4-m365-sso` | Microsoft 365 SSO | — |
| S6 | `improvement/s6-archive-route` | Archive as standalone route | — |
| S7 | `improvement/s7-ui-ux-overhaul` | Full UI/UX overhaul | Last before S9 |
| S9 | `improvement/s9-quality-pass` | Lint, type check, docs | After all |

Do not skip sections. Do not run multiple sections simultaneously.
Merge each PR before starting the next section.

---

## Before marking any task complete

- [ ] On the correct branch (not `main`)
- [ ] Pre-work conflict check passed
- [ ] `pnpm build` passes — zero errors
- [ ] `pnpm lint` passes — zero errors
- [ ] `pnpm compliance:smoke` passes (for API-touching sections)
- [ ] Prisma changes have migration files in same commit
- [ ] New API endpoints have Swagger decorators
- [ ] `pnpm-lock.yaml` committed with any `package.json` changes
- [ ] PR opened with full body and reviewer set to `GH-Mantova`
