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
