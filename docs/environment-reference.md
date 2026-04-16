# Environment Reference

## Shared

- `NODE_ENV`: application mode

## Database

- `POSTGRES_DB`: local Docker Compose database name
- `POSTGRES_USER`: local Docker Compose database user
- `POSTGRES_PASSWORD`: local Docker Compose database password
- `DATABASE_URL`: Prisma and API PostgreSQL connection string

## API

- `API_PORT`: NestJS HTTP port
- `API_PREFIX`: global API prefix, default `api/v1`
- `CORS_ORIGIN`: allowed frontend origin
- `JWT_ACCESS_SECRET`: JWT access-token secret
- `JWT_REFRESH_SECRET`: JWT refresh-token secret
- `JWT_ACCESS_TTL`: JWT access-token lifetime
- `JWT_REFRESH_TTL`: JWT refresh-token lifetime
- `SHAREPOINT_MODE`: adapter mode, currently `mock`
- `SHAREPOINT_SITE_ID`: SharePoint site identifier
- `SHAREPOINT_LIBRARY_ID`: SharePoint library / drive identifier
- `SHAREPOINT_ROOT_FOLDER`: root folder name used by the platform

## Web

- `VITE_API_BASE_URL`: browser API base URL

## Local development notes

The current managed Windows environment has recurring `spawn EPERM` issues in some toolchains. For Tendering/browser work, the project has adopted a practical local E2E convention:

- web should run on `127.0.0.1:4173`
- API should run on `127.0.0.1:3000`
- `CORS_ORIGIN` should match the web host
- `VITE_API_BASE_URL` should match the API host

## Local E2E-friendly values

When running the documented Tendering browser validation path locally, the effective values are:

### API

- `CORS_ORIGIN=http://127.0.0.1:4173`

### Web

- `VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1`

These are wired through the existing package scripts and Playwright config rather than needing to be manually edited into `.env` for every run.

## Hosted deployment guidance

In a real hosted deployment, set:

- `CORS_ORIGIN` to the public frontend origin
- `VITE_API_BASE_URL` to the public API base URL

Example shape:

- web: `https://tendering.initialservices.com.au`
- API: `https://tendering-api.initialservices.com.au/api/v1`

Or, if the API is reverse-proxied behind the same host:

- web: `https://tendering.initialservices.com.au`
- API base URL: `https://tendering.initialservices.com.au/api/v1`

## SharePoint note

SharePoint-related env vars currently configure the SharePoint abstraction layer, but the app still uses a mock adapter rather than live Microsoft Graph-backed document operations.

That means these values are important for future integration planning, but they do not yet mean the app is performing full live SharePoint folder/file creation in production.
