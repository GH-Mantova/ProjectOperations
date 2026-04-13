# Local Development Guide

## Start services

```bash
docker compose up -d postgres
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

## Common commands

```bash
pnpm dev:api
pnpm dev:web
pnpm build
pnpm test
```

## Notes

- The current repository contains hand-authored scaffolding and will require dependency installation before it can run.
- The scheduler is a placeholder entry in the navigation only at this stage.
- If the project is stored in a SharePoint-synced folder, prefer running/building from a normal local working folder and syncing source changes in/out. See [SharePoint + Local Workflow](./sharepoint-local-workflow.md).
