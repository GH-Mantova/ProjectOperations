# Deployment Guide

## Phase 4 scope

This guide covers Azure deployment readiness only:

- web hosting
- API hosting
- PostgreSQL hosting
- environment settings
- startup/build commands

It does not change:

- module business logic
- RBAC behavior
- local JWT auth
- Entra auth flow
- Prisma schema
- SharePoint's role as a portal/document layer

## Recommended Azure shape

### Lowest-risk initial deployment

Recommended first production deployment:

1. Azure App Service hosting the NestJS API
2. The same API process serving the built React app from `apps/web/dist`
3. Azure Database for PostgreSQL Flexible Server

Why this is the safest first move:

- the API already serves static frontend assets in [create-app.ts](C:\Dev\ProjectOperations\apps\api\src\bootstrap\create-app.ts)
- there is only one deployed application unit to build, release, and troubleshoot
- the browser can call the API on the same origin
- CORS becomes simpler and less fragile
- no architecture change is required

### Supported later shape

The codebase can also support:

- separate hosted web frontend
- separate hosted API

That shape is operationally valid, but it is not the recommended first move when minimal disruption is the priority.

## Azure services

Recommended Azure services:

- `Azure App Service` for the application runtime
- `Azure Database for PostgreSQL Flexible Server` for the database
- `Azure App Service application settings` for environment variables

Optional later additions:

- `Azure Key Vault` for secret storage
- `Azure Front Door` or another reverse-proxy layer if the company later wants more advanced routing or WAF controls

These are optional for the first rollout. They are not required to deploy safely.

## Build and startup commands

### Recommended build command

From the repository root:

```powershell
pnpm build:azure
```

This does:

1. build the React frontend
2. build the NestJS API

### Recommended startup command

From the repository root:

```powershell
pnpm start:azure
```

This starts:

- the NestJS API from `apps/api/dist/src/main.js`
- static serving of `apps/web/dist` when the build output is present

## Deployment artifact expectation

For the one-unit Azure App Service deployment, the deployed artifact must contain:

- `apps/api/dist`
- `apps/web/dist`
- runtime dependencies

The API must be started from the repository root or another working directory that still allows the existing frontend dist lookup logic to find `apps/web/dist`.

The current static asset resolution already supports the typical repo-root deployment path.

## Environment variables

At minimum, configure the following in Azure App Service settings.

### Shared

- `NODE_ENV=production`

### Database

- `DATABASE_URL`

### API

- `API_PORT`
- `API_PREFIX`
- `CORS_ORIGIN`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `AUTH_MODE`
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_ISSUER` if not using the derived default
- `ENTRA_JWKS_URI` if not using the derived default
- `ENTRA_AUTHORITY` if not using the derived default
- `SHAREPOINT_MODE`
- `SHAREPOINT_SITE_ID`
- `SHAREPOINT_LIBRARY_ID`
- `SHAREPOINT_ROOT_FOLDER`

### Web build

- `VITE_API_BASE_URL`

## Recommended hosted values

### One-unit App Service deployment

Recommended values:

- public app URL: `https://project-operations.initialservices.com.au`
- `CORS_ORIGIN=https://project-operations.initialservices.com.au`
- `VITE_API_BASE_URL=/api/v1`

Why `VITE_API_BASE_URL=/api/v1` is preferred here:

- it keeps frontend API calls same-origin
- it avoids cross-origin browser behavior
- it keeps the deployment simpler than managing a separate public API hostname

### Separate web + API deployment

If the company later splits the hosting units:

- web: `https://project-operations.initialservices.com.au`
- API: `https://project-operations-api.initialservices.com.au`
- `CORS_ORIGIN=https://project-operations.initialservices.com.au`
- `VITE_API_BASE_URL=https://project-operations-api.initialservices.com.au/api/v1`

This remains supported, but it is not the recommended first deployment path.

## Database rollout

Recommended production database target:

- Azure Database for PostgreSQL Flexible Server

Deployment expectation:

1. provision PostgreSQL
2. set `DATABASE_URL`
3. run Prisma migrations
4. run seed only if the target environment needs initial reference/demo data

The database remains:

- single
- transactional
- authoritative

No database splitting is part of this rollout.

## Authentication behavior in Azure

Authentication behavior remains unchanged by this deployment phase:

- `AUTH_MODE=local` keeps current local JWT login working
- `AUTH_MODE=entra` keeps the current server-validated Entra exchange flow
- RBAC still depends on the internal PostgreSQL user, role, and permission model

This phase does not redesign authentication. It only prepares the deployment model and documentation around it.

## SharePoint role

SharePoint remains:

- portal / launch surface
- document repository layer

Current SharePoint integration remains mock-backed by default. The backend now has a Graph-ready adapter seam for future rollout work, but that seam is disabled by default and is not part of the current deployment baseline.

SharePoint does not become:

- the application runtime host
- the transactional system of record

The current application runtime remains Azure-hosted.

## Local workflow

Local development remains unchanged:

- `pnpm dev`
- `pnpm dev:api`
- `pnpm dev:web`
- local Docker PostgreSQL via [docker-compose.yml](C:\Dev\ProjectOperations\docker-compose.yml)

The new Azure scripts are additive only. They do not replace the local workflow.

## Validation baseline

Deployment readiness should continue to preserve these backend checks:

- `pnpm --filter @project-ops/api build`
- `pnpm test:api:serial`
- `pnpm compliance:smoke`

Local auth regression should also remain valid:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`

## Manual Azure provisioning checklist

Use this checklist once `deploy.yml` has proven the pipeline can publish green. Do the steps in
the Azure portal / Entra in this order — none of them are automatable today.

1. Azure Database for PostgreSQL Flexible Server: smallest burstable tier is fine for the initial
   pilot (~3 users); private networking or firewall to the Web App's outbound IPs; create db
   `project_operations`; capture admin DSN.
2. Web App (API) configuration → set: `DATABASE_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`
   (fresh 64-char randoms — NOT the dev values), `CORS_ORIGIN` (the Static Web App URL),
   `SHAREPOINT_MODE=live` + the five `SHAREPOINT_*` values (tenant/client/secret/site/library —
   from the existing Entra app), `SSO_ENABLED=true` + `ENTRA_*`, `AZURE_MAIL_*` (sender mailbox
   for quotes).
3. Static Web App configuration: `VITE_API_BASE_URL` (the Web App URL + /api/v1),
   `VITE_SSO_ENABLED=true`, `VITE_ENTRA_*`.
4. Entra app registration: add the production redirect URIs (Static Web App URL) for SSO;
   confirm Graph permissions for SharePoint + Mail.Send are admin-consented.
5. GitHub repo secrets: whatever the deploy workflow's diagnosis says it needs (likely refreshed
   publish profiles / OIDC creds).
6. Run the deploy (push to main or manual dispatch) → green → continue to verification.

## First-deploy verification

In order, ~30 minutes:

1. `GET https://<api>/api/v1/health` → 200 with the enriched body
   `{ status, service, db, version, commit, uptimeSec, timestamp }` — confirm `db: "up"` and that
   `version` matches the deployed `apps/api/package.json` (`commit` shows the deployed SHA once
   the workflow injects `GIT_SHA`; `"unknown"` until then). `GET …/api/v1/health/ready` → 200 —
   this readiness endpoint returns **503** when the DB is unreachable and is what the post-deploy
   health gate should poll instead of `/health`.
2. `prisma migrate deploy` ran clean in the deploy logs (102+ migrations on a fresh DB).
3. Run prod seed (`pnpm seed:prod`): reference data only. Verify rates admin shows the Cutrite
   matrix + 9 tabs, lookups populated, ZERO demo clients/tenders.
4. SSO: each of the three real accounts logs in; roles per the pilot plan (e.g. Sean Super User,
   Raj Senior Estimator, Marco Admin+WHS). Confirm the seed/dev local-login users do NOT exist.
5. Create a real test tender end-to-end: client → tender (check number format) → scope → quote →
   PDF → send via Outlook to yourself → log an interaction.
6. SharePoint: upload a tender document; verify it lands in the live site path.
7. Backups: confirm the Flexible Server's automated backups are on (7-day minimum) and note the
   restore procedure in this doc.

### Troubleshooting

- **`Application Error` page + `Error: Cannot find module '@nestjs/config'` (MODULE_NOT_FOUND) in
  Log stream** — the deployed artifact was not self-contained: `apps/api/node_modules` are pnpm
  workspace symlinks into the repo-root store, which break when the directory is copied. Fixed in
  `deploy.yml` by shipping a `pnpm deploy --prod --legacy --config.node-linker=hoisted` bundle
  (`deploy-api/`, physical node_modules + regenerated Prisma client) with a pre-deploy
  `require()` smoke probe. If this recurs, check the "Smoke-probe bundle before deploy" step in
  the failed run first.

## Related references

- [setup-and-local-development.md](setup-and-local-development.md) (env-vars reference section)
- [azure-pilot-runbook.md](azure-pilot-runbook.md) — pilot-specific gap analysis, PR firing order, and operating model
- `apps/api/src/bootstrap/create-app.ts`
- `docker-compose.yml`
