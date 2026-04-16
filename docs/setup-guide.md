# Setup Guide

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

- [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md)

## Prerequisites

- Node.js 22 or later
- pnpm 10 or later
- Docker Desktop or compatible Docker runtime
- PostgreSQL via Docker for local development

## Workspace rule

Use the local workspace only:

- `C:\Dev\ProjectOperations`

Do not actively develop from the SharePoint-synced path. If SharePoint is used for sync/storage, follow:

- [sharepoint-local-workflow.md](C:\Dev\ProjectOperations\docs\sharepoint-local-workflow.md)

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

## Managed-Windows note

This environment has recurring `spawn EPERM` issues with some toolchains. For day-to-day verification, do not treat generic frontend dev/test startup as the most reliable signal.

Prefer the safe validation path documented in:

- [local-development.md](C:\Dev\ProjectOperations\docs\local-development.md)

## Tendering browser verification

When browser verification is needed for Tendering, the proven manual path is:

1. Terminal 1

```powershell
cd C:\Dev\ProjectOperations
pnpm dev:api:e2e
```

2. Terminal 2

```powershell
cd C:\Dev\ProjectOperations
pnpm dev:web:e2e
```

3. Terminal 3

```powershell
cd C:\Dev\ProjectOperations
pnpm test:tendering:e2e:reuse
```

## Notes

- SharePoint integration in the app is still mock-based, even though SharePoint is part of the intended long-term operational model.
- Microsoft 365 / Entra SSO is not yet implemented.
- For broad module inventory and current implementation coverage, see:
  - [module-build-log.md](C:\Dev\ProjectOperations\docs\module-build-log.md)
