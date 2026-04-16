# Local Development Guide

## Workspace

Use:

- `C:\Dev\ProjectOperations`

Do not run active development from the SharePoint-synced workspace.

## Standard local startup

```powershell
docker compose up -d postgres
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

Useful direct commands:

```powershell
pnpm dev:api
pnpm dev:web
pnpm build
```

## Managed-Windows safe validation path

This project runs in a managed Windows environment where some child-process-heavy tools can fail with `spawn EPERM`.

For reliable local verification, prefer:

```powershell
pnpm --filter @project-ops/api build
pnpm test:api:serial
pnpm --filter @project-ops/web exec -- tsc -p . --noEmit
pnpm test:web:logic
```

These commands have been the safest repeatable validation path during Tendering hardening.

## Tendering browser verification

For Tendering-specific browser checks, prefer the reuse-runtime path instead of relying on Playwright to boot servers itself in this environment.

1. Start API:

```powershell
cd C:\Dev\ProjectOperations
pnpm dev:api:e2e
```

2. Start web:

```powershell
cd C:\Dev\ProjectOperations
pnpm dev:web:e2e
```

3. Run Tendering E2E against those running servers:

```powershell
cd C:\Dev\ProjectOperations
pnpm test:tendering:e2e:reuse
```

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

## Current product reality

This is not an early scaffold anymore. The repo includes:

- Tendering and Estimating
- Tender Documents
- Award / Contract / Job Conversion
- Jobs and Delivery
- Scheduler and Work Planning
- Resources and Competencies
- Assets and Equipment
- Maintenance
- Forms and Compliance
- Documents
- Dashboards and Reporting
- Closeout and Archive

## SharePoint workflow

If SharePoint is used for synchronization/storage across machines, use the local-copy workflow:

- [sharepoint-local-workflow.md](C:\Dev\ProjectOperations\docs\sharepoint-local-workflow.md)

## Operational notes

- Scheduler is implemented and is not just a placeholder nav item.
- Tendering is in a strong, pilot-ready state and has broad local Playwright coverage.
- SharePoint inside the app is still mock-backed for now; live Graph-backed integration remains future work.
