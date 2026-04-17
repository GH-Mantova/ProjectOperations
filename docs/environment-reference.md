# Environment Reference

## Scope

This file documents the current environment variables used by:

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

## Recommended first Azure deployment

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

- [deployment-guide.md](C:\Dev\ProjectOperations\docs\deployment-guide.md)
- [app.config.ts](C:\Dev\ProjectOperations\apps\api\src\config\app.config.ts)
- [auth.config.ts](C:\Dev\ProjectOperations\apps\api\src\config\auth.config.ts)
