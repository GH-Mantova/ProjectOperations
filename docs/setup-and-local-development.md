# Setup & Local Development

> Consolidates `setup-guide.md`, `local-development.md`, and `environment-reference.md`
> (merged 2026-06-19). The env-vars reference is preserved verbatim as the final section.

## Current project state

This repository is no longer only shell-level scaffolding. It contains:

- platform/auth/admin foundations
- SharePoint abstraction foundations
- master data
- Tendering
- tender documents
- award / contract / job conversion
- Jobs and Delivery
- Scheduler and Work Planning
- Resources and Competencies
- Assets and Equipment
- Maintenance
- Forms and Compliance
- Documents
- Dashboards and Reporting
- Closeout and Archive
- hardening/consolidation work

For the latest Tendering-specific runtime and handover details, read:

- [continuation-log.md](continuation-log.md)

For broad module inventory and current implementation coverage, see:

- [module-build-log.md](module-build-log.md)

## Prerequisites

- Node.js 22 or later
- pnpm 10 or later
- Docker Desktop or compatible Docker runtime
- PostgreSQL via Docker for local development

## Workspace rule

Use the local workspace only:

- `C:\Dev\ProjectOperations`

Do not actively develop from the SharePoint-synced path. If SharePoint is used for sync/storage, follow:

- [sharepoint-local-workflow.md](sharepoint-local-workflow.md)

## First-time setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL:

```powershell
docker compose up -d postgres
```

3. Install dependencies:

```powershell
pnpm install
```

4. Generate Prisma client:

```powershell
pnpm prisma:generate
```

5. Apply local migrations:

```powershell
pnpm prisma:migrate
```

## Standard local startup (condensed)

```powershell
docker compose up -d postgres
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

## Start the app locally

General local app startup:

```powershell
pnpm dev
```

Useful direct commands:

```powershell
pnpm dev:api
pnpm dev:web
pnpm build
```

## Managed-Windows safe validation path

This project runs in a managed Windows environment that has recurring `spawn EPERM` issues with
some child-process-heavy toolchains. For day-to-day verification, do not treat generic frontend
dev/test startup as the most reliable signal.

For reliable local verification, prefer:

```powershell
pnpm --filter @project-ops/api build
pnpm test:api:serial
pnpm --filter @project-ops/web exec -- tsc -p . --noEmit
pnpm test:web:logic
```

These commands have been the safest repeatable validation path during Tendering hardening.

## Commands to use with caution

These may still work in some environments, but they have been less reliable in this managed setup:

```powershell
pnpm test
pnpm --filter @project-ops/web test
pnpm seed
```

Reasons:

- Vite/Vitest startup can be unstable under `spawn EPERM`
- `tsx prisma/seed.ts` has also been affected by `spawn EPERM`

## Tendering browser verification

When browser verification is needed for Tendering, prefer the reuse-runtime path instead of
relying on Playwright to boot servers itself in this environment.

1. Terminal 1 — start API:

```powershell
cd C:\Dev\ProjectOperations
pnpm dev:api:e2e
```

2. Terminal 2 — start web:

```powershell
cd C:\Dev\ProjectOperations
pnpm dev:web:e2e
```

3. Terminal 3 — run Tendering E2E against those running servers:

```powershell
cd C:\Dev\ProjectOperations
pnpm test:tendering:e2e:reuse
```

## Operational notes

- Scheduler is implemented and is not just a placeholder nav item.
- Tendering is in a strong, pilot-ready state and has broad local Playwright coverage.
- SharePoint integration in the app is still mock-backed by default; live Graph-backed
  integration remains future work.
- Microsoft 365 / Entra SSO is not yet implemented.

## SharePoint workflow

If SharePoint is used for synchronization/storage across machines, use the local-copy workflow:

- [sharepoint-local-workflow.md](sharepoint-local-workflow.md)

---

# Environment Variables Reference

## Scope

This section documents the current environment variables used by:

- local development
- CI validation
- Azure-hosted deployment

It does not introduce new business behavior. It only documents the current runtime configuration surface.

## Shared

- `NODE_ENV`: application mode

Recommended hosted value:

- `production`

## Database

- `POSTGRES_DB`: local Docker Compose database name
- `POSTGRES_USER`: local Docker Compose database user
- `POSTGRES_PASSWORD`: local Docker Compose database password
- `DATABASE_URL`: Prisma and API PostgreSQL connection string

### Local default shape

The backend falls back to:

- `postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public`

### Hosted shape

For Azure Database for PostgreSQL Flexible Server, `DATABASE_URL` should point to the managed Azure database instance.

## API

- `API_PORT`: NestJS HTTP port
- `API_PREFIX`: global API prefix, default `api/v1`
- `CORS_ORIGIN`: allowed frontend origin
- `JWT_ACCESS_SECRET`: JWT access-token secret
- `JWT_REFRESH_SECRET`: JWT refresh-token secret
- `JWT_ACCESS_TTL`: JWT access-token lifetime
- `JWT_REFRESH_TTL`: JWT refresh-token lifetime
- `AUTH_MODE`: authentication mode, currently `local` or `entra`
- `ENTRA_TENANT_ID`: Entra tenant identifier
- `ENTRA_CLIENT_ID`: Entra application/client identifier
- `ENTRA_ISSUER`: optional Entra issuer override
- `ENTRA_JWKS_URI`: optional Entra JWKS URI override
- `ENTRA_AUTHORITY`: optional Entra authority override
- `SHAREPOINT_MODE`: adapter mode. Default `mock`. `graph` is reserved for a future Microsoft Graph-backed adapter seam and is disabled by default in the current rollout.
- `SHAREPOINT_SITE_ID`: SharePoint site identifier
- `SHAREPOINT_LIBRARY_ID`: SharePoint library / drive identifier
- `SHAREPOINT_ROOT_FOLDER`: root folder name used by the platform

## Web

- `VITE_API_BASE_URL`: browser API base URL

## Local development notes

The current local conventions remain:

- web on `127.0.0.1:4173` for browser E2E
- API on `127.0.0.1:3000`
- `CORS_ORIGIN` matching the web host
- `VITE_API_BASE_URL` matching the API host

## Local E2E-friendly values

### API

- `CORS_ORIGIN=http://127.0.0.1:4173`

### Web

- `VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1`

These are already wired through the existing package scripts and Playwright setup.

## Hosted deployment guidance

### Recommended first Azure deployment

Recommended first hosted shape:

- one Azure App Service hosting the API
- the same API process serving the built frontend
- one Azure Database for PostgreSQL server

### Recommended values for the one-unit deployment

- `CORS_ORIGIN=https://project-operations.initialservices.com.au`
- `VITE_API_BASE_URL=/api/v1`

Using a relative `VITE_API_BASE_URL` is preferred here because the web and API share the same public origin.

### Supported values for split hosting

If web and API are deployed separately later:

- `CORS_ORIGIN=https://project-operations.initialservices.com.au`
- `VITE_API_BASE_URL=https://project-operations-api.initialservices.com.au/api/v1`

## Authentication guidance

### Local and fallback access

Use:

- `AUTH_MODE=local`

This preserves:

- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`

### Hosted Entra authentication

Use:

- `AUTH_MODE=entra`

Required Entra settings:

- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`

Optional overrides if defaults are not sufficient:

- `ENTRA_ISSUER`
- `ENTRA_JWKS_URI`
- `ENTRA_AUTHORITY`

The backend continues to validate Entra tokens server-side. Frontend identity claims are not trusted directly.

## SharePoint integration guidance

Current SharePoint behavior remains mock-backed by default:

- `SHAREPOINT_MODE=mock`

The backend now also has a Graph-ready adapter seam behind the same boundary:

- `SHAREPOINT_MODE=graph`

That mode is not part of the current operational baseline. It exists only as a disabled-by-default scaffold so the future live adapter can be introduced without changing module-level service contracts.

## Secrets guidance

The following values should be treated as secrets in hosted environments:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

Potentially sensitive integration settings should also be managed through secure host settings:

- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_ISSUER`
- `ENTRA_JWKS_URI`
- `ENTRA_AUTHORITY`
- `SHAREPOINT_SITE_ID`
- `SHAREPOINT_LIBRARY_ID`

## Values that stay environment-specific

These values are expected to differ between local, CI, staging, and production:

- `NODE_ENV`
- `DATABASE_URL`
- `CORS_ORIGIN`
- `VITE_API_BASE_URL`
- `AUTH_MODE`
- Entra settings
- JWT secrets
- SharePoint settings

## Defaults and operational behavior

Current defaults remain intentionally local-friendly:

- `API_PORT=3000`
- `API_PREFIX=api/v1`
- local PostgreSQL connection fallback
- local JWT secret fallbacks
- `AUTH_MODE=local`
- `SHAREPOINT_MODE=mock`

These defaults should not be relied on in Azure production. Hosted deployments should set explicit values.

## Related references

- [deployment-guide.md](deployment-guide.md)
- `apps/api/src/config/app.config.ts`
- `apps/api/src/config/auth.config.ts`
