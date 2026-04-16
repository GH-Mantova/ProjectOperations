# Deployment Guide

## Runtime shape

The current application is designed to run as:

- hosted web frontend
- hosted NestJS API
- PostgreSQL database
- reverse-proxy compatible HTTP services

## Recommended production pattern

1. Host the web frontend online.
2. Host the API online.
3. Use a real persistent PostgreSQL instance.
4. Provide environment variables through the host/platform.
5. Put HTTPS and reverse proxying in front of the web and API.

## Recommended rollout pattern for this project

### App URL

Recommended public URL:

- `https://tendering.initialservices.com.au`

### Hosting choice

Recommended starting point:

- Azure-hosted web frontend
- Azure-hosted API

Why:

- aligns well with the Microsoft ecosystem already used by the business
- gives a straightforward path toward Microsoft 365 / Entra SSO later
- simplifies HTTPS, domain, and operational hosting compared with ad hoc local hosting

### Database choice

Recommended production database:

- Azure Database for PostgreSQL

Why:

- managed backups
- better production reliability
- clean fit for the app’s transactional data model

## SharePoint’s role in deployment

The current codebase still uses a mock SharePoint adapter. That means SharePoint is not yet the live integrated backend for file creation/upload inside the app.

Recommended use of SharePoint during the first rollout:

- Intranet site as the app launch surface
- Initialservices site as the operational file and backup repository

Known SharePoint locations discussed for rollout:

- Intranet launch surface:
  - `https://initialservices.sharepoint.com/sites/Intranet`
- documents / virtual-drive site:
  - `https://initialservices.sharepoint.com/sites/Initialservices`

Practical rollout usage:

- add a “Tendering CRM” link or tile on the Intranet site pointing to the public app URL
- use the Initialservices site for folder structure, document storage, and backups while the app remains the system of record for transactional data

## Suggested SharePoint folder structure

Under the operational SharePoint documents site, use:

- `Project Operations/`
- `Project Operations/Tendering/`
- `Project Operations/Tendering/Incoming Documents/`
- `Project Operations/Tendering/Submitted Tenders/`
- `Project Operations/Tendering/Awarded/`
- `Project Operations/Tendering/Lost/`
- `Project Operations/Jobs/`
- `Project Operations/Backups/`
- `Project Operations/Backups/App Exports/`
- `Project Operations/Backups/CSV Snapshots/`

## Production environment variables

At minimum, configure:

### Shared

- `NODE_ENV`

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
- `SHAREPOINT_MODE`
- `SHAREPOINT_SITE_ID`
- `SHAREPOINT_LIBRARY_ID`
- `SHAREPOINT_ROOT_FOLDER`

### Web

- `VITE_API_BASE_URL`

See:

- [environment-reference.md](C:\Dev\ProjectOperations\docs\environment-reference.md)

## Recommended first pilot users

Start with a small group:

- primary estimator / tender lead
- operations lead
- project delivery lead
- admin / coordination support
- reviewer / manager / director

## First rollout phases

### Phase 1: Pilot launch

- deploy web + API + Postgres
- publish the app URL
- add the Intranet launch link
- invite the pilot group
- start entering real Tendering data
- use SharePoint for surrounding documents/backups

### Phase 2: Production hardening

- fix issues discovered by pilot users
- improve permissions/reporting as needed
- refine Tendering UX only where real usage shows friction

### Phase 3: Deeper enterprise integration

- replace mock SharePoint adapter with live Microsoft Graph integration
- add Microsoft 365 / Entra SSO
- expand from Tendering into award-to-job handover and the downstream operational workflows

## Current limitations

- container images for web/API are not yet part of the current project setup
- Docker Compose in this repo currently provisions PostgreSQL for local development, not a full production stack
- SharePoint integration in the app is still mock-backed
- Microsoft 365 SSO is not yet implemented

## Recommended documentation companions

- [architecture-overview.md](C:\Dev\ProjectOperations\docs\architecture-overview.md)
- [environment-reference.md](C:\Dev\ProjectOperations\docs\environment-reference.md)
- [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md)
