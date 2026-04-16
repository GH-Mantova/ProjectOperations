# SharePoint + Local Workflow

Use SharePoint as the synced storage location, but run the app from a normal local folder on each computer.

## Why

The current workspace runs into Windows `esbuild` / `vite` `spawn EPERM` errors when build tools run directly inside the SharePoint-synced path.

Keeping the project on SharePoint is fine.
Running the build from the SharePoint-synced folder is the part that causes trouble.

## Recommended pattern

1. Keep the master copy in the SharePoint-synced folder.
2. Create a local working folder on each machine, for example:

```powershell
C:\Dev\ProjectOperations
```

3. Copy the project from SharePoint to the local working folder before development.
4. Run Docker, Node, Prisma, and Vite from the local working folder only.
5. Sync source changes back to SharePoint when finished.

## Sync from SharePoint to local

```powershell
.\scripts\sync-from-sharepoint.ps1 `
  -SharePointPath "C:\Users\marco\Initial Services Pty Ltd\Initial Services Office - Documents\4. Reports\App Dev\Project Operations" `
  -LocalPath "C:\Dev\ProjectOperations"
```

## Sync from local back to SharePoint

```powershell
.\scripts\sync-to-sharepoint.ps1 `
  -LocalPath "C:\Dev\ProjectOperations" `
  -SharePointPath "C:\Users\marco\Initial Services Pty Ltd\Initial Services Office - Documents\4. Reports\App Dev\Project Operations"
```

## What is excluded

The sync scripts intentionally exclude runtime/build artifacts such as:

- `node_modules`
- `dist`
- `build`
- `.vite`
- `.next`
- logs
- local-only env files

This keeps SharePoint cleaner and reduces sync conflicts.

## Daily workflow

1. Sync from SharePoint to local.
2. Open the local folder in your terminal/editor.
3. Run:

```powershell
docker compose up -d postgres
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

4. Work normally from the local folder.
5. Sync local changes back to SharePoint.

## Managed-Windows validation note

This environment has recurring `spawn EPERM` issues. For reliable verification, prefer the local safe validation path instead of assuming generic frontend tooling is always the best signal:

```powershell
pnpm --filter @project-ops/api build
pnpm test:api:serial
pnpm --filter @project-ops/web exec -- tsc -p . --noEmit
pnpm test:web:logic
```

For Tendering browser verification, prefer:

```powershell
pnpm dev:api:e2e
pnpm dev:web:e2e
pnpm test:tendering:e2e:reuse
```

## Operational SharePoint note

SharePoint currently serves two different purposes around this project:

1. Sync/storage for the source tree when using the local-workflow pattern in this document
2. Future operational environment support for the live app, where:
   - the Intranet site can act as the launch surface
   - the Initialservices site can act as the document/backups repository

The app-side SharePoint integration is still mock-backed, so this document remains specifically about source/workspace sync rather than full live document integration inside the app.

## Important note

If you are switching between multiple computers, always sync from SharePoint first before starting work on a machine so you do not overwrite newer changes.
