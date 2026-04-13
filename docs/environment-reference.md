# Environment Reference

## Shared

- `NODE_ENV`: application mode

## Database

- `POSTGRES_DB`: Docker Compose database name
- `POSTGRES_USER`: Docker Compose database user
- `POSTGRES_PASSWORD`: Docker Compose database password
- `DATABASE_URL`: Prisma and API PostgreSQL connection string

## API

- `API_PORT`: NestJS HTTP port
- `API_PREFIX`: global API prefix, default `api/v1`
- `CORS_ORIGIN`: allowed frontend origin
- `JWT_ACCESS_SECRET`: reserved for later auth module
- `JWT_REFRESH_SECRET`: reserved for later auth module
- `JWT_ACCESS_TTL`: reserved for later auth module
- `JWT_REFRESH_TTL`: reserved for later auth module
- `SHAREPOINT_MODE`: adapter mode, currently `mock`
- `SHAREPOINT_SITE_ID`: SharePoint site identifier placeholder
- `SHAREPOINT_LIBRARY_ID`: SharePoint library / drive identifier placeholder
- `SHAREPOINT_ROOT_FOLDER`: root folder name used by the platform

## Web

- `VITE_API_BASE_URL`: browser API base URL
