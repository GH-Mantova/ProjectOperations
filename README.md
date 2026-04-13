# Project Operations Platform

Browser-based Project Operations Platform built as a modular monolith with a NestJS API, React frontend, PostgreSQL, Prisma, and SharePoint-ready integration boundaries.

## Current scope

This repository currently implements:

- Module 1: Platform Foundation
- Module 2: Auth / Users / Roles / Permissions / Audit
- Module 3: SharePoint + Platform Services Foundation
- Module 4: Master Data
- Module 5: Tendering and Estimating
- Module 6: Tender Documents
- Module 7: Award / Contract / Job Conversion
- Module 8: Jobs and Delivery
- Module 9: Scheduler and Work Planning
- Module 10: Resources and Competencies
- Module 11: Assets and Equipment
- Module 12: Maintenance
- Module 13: Forms and Compliance
- Module 14: Documents
- Module 15: Dashboards and Reporting
- Module 16: Closeout and Archive

Included:

- monorepo workspace structure
- NestJS-style API foundation
- React + TypeScript + Vite frontend foundation
- PostgreSQL + Prisma setup
- Docker Compose for local PostgreSQL
- environment-based configuration
- `/api/v1/health` endpoint
- Swagger/OpenAPI bootstrap
- responsive app shell with left navigation
- login flow
- user, role, permission, and audit admin screens
- local JWT auth with refresh tokens
- mock-backed SharePoint service foundation
- notifications, search, and dashboard base entities
- platform configuration and dashboard foundation screens
- master data APIs and responsive screens for clients, contacts, sites, workers, crews, assets, resource types, competencies, worker competencies, and lookup values
- tender list/detail/create flows with multi-client tender linking, notes, clarifications, follow-ups, pricing snapshots, and outcome tracking
- tender-linked document registration backed by the SharePoint foundation
- awarded-client selection, contract issuance, and tender-to-job conversion workflow
- jobs register/detail delivery workspace with stages, activities, issues, variations, progress entries, and status history
- scheduler workspace with shifts, worker assignments, asset assignments, weekly/monthly planning modes, and conflict signals
- worker availability windows, role suitability, shift role requirements, and competency-aware scheduler warnings
- asset categories, enriched asset register/details, and scheduler asset-panel filtering with assignment visibility
- maintenance plans, events, inspections, breakdowns, asset status history, and maintenance-driven scheduler warnings
- versioned configurable forms, form submissions by operational context, signatures, attachments, and submission review screens
- generic SharePoint-backed documents workspace with job, asset, and form-linked document tracking, version history, tags, and access rules
- live dashboards with user and role ownership, KPI/chart/table widgets, and seeded operations/planner reporting views
- job closeout records, read-only archive behavior, and historical archive visibility
- repeatable compliance smoke runner covering login, tender lifecycle, scheduler, maintenance, forms, documents, dashboards, and closeout

Not yet included:

- live SharePoint Graph integration
- downstream operational modules after closeout
- Microsoft 365 SSO

## Workspace structure

- `apps/api` - backend API
- `apps/web` - frontend web client
- `packages/config` - shared runtime config helpers
- `packages/ui` - shared UI building blocks
- `docs` - setup, architecture, deployment, and module notes

## Quick start

1. Install Node.js 22+ and pnpm 10+.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL:

```bash
docker compose up -d postgres
```

4. Install dependencies:

```bash
pnpm install
```

5. Generate Prisma client and apply the initial migration:

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

6. Start the apps:

```bash
pnpm dev
```

Optional verification:

```bash
pnpm compliance:smoke
```

## SharePoint workflow

If you want to keep the repository in a SharePoint-synced folder and still work across multiple computers, use SharePoint as the synced storage location but run the app from a normal local folder.

Use:

```powershell
.\scripts\sync-from-sharepoint.ps1 -SharePointPath "<sharepoint-folder>" -LocalPath "C:\Dev\ProjectOperations"
.\scripts\sync-to-sharepoint.ps1 -LocalPath "C:\Dev\ProjectOperations" -SharePointPath "<sharepoint-folder>"
```

Details:

- [SharePoint + Local Workflow](./docs/sharepoint-local-workflow.md)

7. Open:

- Web: [http://localhost:5173](http://localhost:5173)
- API docs: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- Health: [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)

## Seed login

- Email: `admin@projectops.local`
- Password: `Password123!`

## Documentation

- [Setup Guide](./docs/setup-guide.md)
- [Environment Reference](./docs/environment-reference.md)
- [Architecture Overview](./docs/architecture-overview.md)
- [Local Development Guide](./docs/local-development.md)
- [SharePoint + Local Workflow](./docs/sharepoint-local-workflow.md)
- [Deployment Guide](./docs/deployment-guide.md)
- [Module Build Log](./docs/module-build-log.md)
