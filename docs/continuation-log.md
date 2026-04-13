# Continuation Log

Last updated: 2026-04-14 (latest session, CRM polish follow-up)

## Goal

- Workspace: `C:\Dev\ProjectOperations` only.
- Product goal: Tendering should feel like a CRM / deal desk, not an admin form stack.
- Desired end state:
  - compact `Dashboard / Pipeline / Create / Workspace` flow
  - unified activity workflow
  - reliable lifecycle stage movement
  - safe tender-to-job conversion
  - denser stakeholder and communication context
  - verified browser behavior across supported browsers

## Environment

- Managed Windows environment.
- Known constraints:
  - `git` still not on PATH
  - this workspace currently has no `.git` directory
  - Codex GitHub connector currently has no accessible repositories installed
  - PowerShell only
  - seed via `tsx prisma/seed.ts` still hits `spawn EPERM`
  - `rg.exe` can still fail with access denied; prefer PowerShell `Select-String`
- Important update:
  - browser launch is now working locally for Playwright `chromium`, `msedge`, `firefox`, and `webkit`
- manual user verification narrowed the real workaround further:
  - API starts correctly when run manually
  - Vite starts manually, but the detached background launcher is not reliable in this environment
  - do not keep investing in `start-playwright-servers.cjs`; use explicit foreground startup commands instead
  - later browser retry exposed an additional host/CORS mismatch in the manual flow:
    - web was still reading `VITE_API_BASE_URL=http://localhost:3000/api/v1` from `.env`
    - manual API startup did not inject `CORS_ORIGIN=http://127.0.0.1:4173`
    - result: login page stayed on `Failed to fetch`

## Safe Validation

```powershell
pnpm --filter @project-ops/api build
pnpm test:api:serial
pnpm --filter @project-ops/web exec -- tsc -p . --noEmit
pnpm test:web:logic
pnpm --filter @project-ops/web test
pnpm test:tendering:e2e
```

## System Map

- App shell:
  - [App.tsx](C:\Dev\ProjectOperations\apps\web\src\App.tsx)
    - wraps app in `AuthProvider`
    - `ProtectedRoute` gates all non-login routes
    - mounts Tendering routes under `ShellLayout`
  - [ShellLayout.tsx](C:\Dev\ProjectOperations\apps\web\src\components\ShellLayout.tsx)
    - owns left-nav + Tendering submenu
    - `Tendering` parent route points to `/tenders`
    - submenu exposes `Pipeline`, `Create Tender`, `Clients`, `Contacts`, `Settings`

- Auth:
  - [AuthContext.tsx](C:\Dev\ProjectOperations\apps\web\src\auth\AuthContext.tsx)
    - login posts to `VITE_API_BASE_URL/auth/login`
    - refresh flow posts to `/auth/refresh`
    - stores tokens + user in localStorage
    - all web data fetches go through `authFetch`

- Tendering routes:
  - `/tenders` -> [TenderingDashboardPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TenderingDashboardPage.tsx)
  - `/tenders/pipeline` -> [TenderPipelinePage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TenderPipelinePage.tsx) -> `TendersPage mode="full"`
  - `/tenders/create` -> [CreateTenderPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\CreateTenderPage.tsx) -> `TendersPage mode="create"`
  - `/tenders/workspace` -> [TenderWorkspacePage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TenderWorkspacePage.tsx) -> `TendersPage mode="workspace"`
  - `/tenders/clients` -> [TenderClientsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TenderClientsPage.tsx)
  - `/tenders/contacts` -> [TenderContactsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TenderContactsPage.tsx)
  - `/tenders/settings` -> [TenderingSettingsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TenderingSettingsPage.tsx)

- Main Tendering UI:
  - [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx)
  - Modes:
    - `full`: pipeline/register + modal workspace
    - `workspace`: dedicated full-page workspace
    - `create`: create-only page
  - Register surfaces:
    - board
    - list
    - forecast
  - Workspace tabs:
    - overview
    - activity
    - documents
    - conversion
  - Key local state domains inside `TendersPage`:
    - register filters / sort / view
    - selected tender + activities
    - stakeholder drafts + saving state
    - board drag/drop lifecycle prompts
    - conversion prompt / archived conversion handling

- Shared Tendering helpers:
  - [tendering-page-helpers.ts](C:\Dev\ProjectOperations\apps\web\src\pages\tendering-page-helpers.ts)
    - attention state
    - create readiness
    - load notices
    - due/value/probability filters
    - stage readiness
  - [tendering-page-helpers.test.ts](C:\Dev\ProjectOperations\apps\web\src\pages\tendering-page-helpers.test.ts)
    - helper coverage for attention, readiness, due/value/probability filters
  - [tendering-labels.ts](C:\Dev\ProjectOperations\apps\web\src\tendering-labels.ts)
    - user-facing Tendering nav / copy
  - [styles.css](C:\Dev\ProjectOperations\apps\web\src\styles.css)
    - all Tendering shell/register/workspace styling

- API:
  - [tendering.controller.ts](C:\Dev\ProjectOperations\apps\api\src\modules\tendering\tendering.controller.ts)
    - guarded by JWT + permissions
    - exposes list/get/create/update, note/clarification/follow-up, unified activities, CSV import
  - [tendering.service.ts](C:\Dev\ProjectOperations\apps\api\src\modules\tendering\tendering.service.ts)
    - owns Tender CRUD
    - deletes + recreates related collections on update
    - maps note/clarification/follow-up into unified activity read model
    - CSV import preview + commit
  - [tender.dto.ts](C:\Dev\ProjectOperations\apps\api\src\modules\tendering\dto\tender.dto.ts)
    - DTO contract for Tender, unified activity, and CSV import

- Schema:
  - [schema.prisma](C:\Dev\ProjectOperations\apps\api\prisma\schema.prisma)
  - Tendering relationships:
    - `Tender`
      - optional `estimator -> User`
      - optional `sourceJob -> Job`
      - many `TenderClient`
      - many `TenderNote`
      - many `TenderClarification`
      - many `TenderFollowUp`
      - many `TenderOutcome`
      - many `TenderDocumentLink`
    - `TenderClient`
      - links `Tender -> Client`
      - optional `Contact`
      - supports `isAwarded`, `contractIssued`, `contractIssuedAt`
      - supports `relationshipType`, `notes`
    - `TenderFollowUp`
      - optional `assignedUser -> User`
    - conversion flows into `Job`

- Browser harness:
  - [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts)
    - projects: `chromium`, `firefox`, `webkit`
    - starts API + web servers for E2E
    - injects E2E-safe `CORS_ORIGIN` and `VITE_API_BASE_URL` using `127.0.0.1`
  - [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts)
    - verifies login
    - verifies dashboard / pipeline / create / workspace routes
    - verifies probability filter
    - verifies forecast switch
    - verifies workspace open and activity context

## What Was Done

- Fixed route/mode split so `workspace` no longer inherits broken register layout.
- Kept popup workspace and dedicated workspace as separate behaviors.
- Cleaned Tendering nav and route model.
- Built denser CRM-style pipeline register across board/list/forecast.
- Added probability-band filtering and richer next-action / last-touch surfacing.
- Added card-level `Add activity` shortcuts.
- Unified activities from notes / clarifications / follow-ups.
- Added focused activity views including owner-focused mode.
- Added stakeholder role/note surfacing from existing `TenderClient` fields.
- Added communication-focused workspace rail with:
  - stakeholder cards
  - communication summaries
  - communication queue
- Reduced stakeholder edit chatter:
  - local drafts
  - save-on-blur
  - explicit `Save stakeholder` / `Revert`
- Wired lifecycle actions:
  - award
  - contract
  - convert
  - rollback
  - archived-job reuse prompt flow
- Added Playwright Tendering smoke coverage across Chromium / Firefox / WebKit.
- Fixed E2E wiring:
  - `localhost` vs `127.0.0.1` API/CORS mismatch
  - stale/broad Playwright assertions
- Fixed invalid nested interactive patterns in register surfaces.
- Made workspace modal open immediately while detail hydration completes.
- Strengthened helper tests and queue ordering.
- Began the next Playwright extension pass for:
  - board drag/drop prompt coverage
  - popup close/reopen plus modal inner-scroll behavior
  - dedicated workspace `tenderId` loading
  - stakeholder save/revert browser flow
- Added a browser-side helper in [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts) to load the live tender index and target seeded records by runtime data instead of hard-coded assumptions.
- Fixed a real stakeholder UX bug in [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx):
  - blur-save now skips when focus is moving onto explicit stakeholder action buttons
  - this prevents `Revert` / `Save stakeholder` clicks from being pre-empted by the field blur handler
- Finished the Playwright extension pass:
  - board drag/drop prompt coverage is now exercised
  - popup close/reopen plus inner-scroll behavior is covered
  - dedicated workspace `tenderId` loading is covered
  - stakeholder explicit revert and explicit save browser flow is covered
- Fixed a workspace behavior bug in [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx):
  - opening a tender workspace with `targetTab="activity"` no longer gets reset back to `overview` during tender selection
- Extended [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts) further to:
  - discover live tender activities through authenticated browser fetches
  - verify communication queue ordering against runtime due-time priority
  - verify overdue labeling in the communication queue
  - verify dedicated workspace switching between two tenders through direct `tenderId` links
- Updated [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts) to use PowerShell-native `webServer` startup commands instead of `cmd /c`, matching the workspace constraint better
- Fixed [vite.config.js](C:\Dev\ProjectOperations\apps\web\vite.config.js) so it is ESM-safe under Vite's native config loader:
  - replaced `__dirname` usage with `fileURLToPath(import.meta.url)` + `dirname(...)`
  - mirrored the extension resolution from the TS config
- Added explicit manual E2E-friendly scripts instead of the broken detached launcher:
  - [apps/web/package.json](C:\Dev\ProjectOperations\apps\web\package.json)
    - added `dev:e2e` -> `vite --configLoader native --host 127.0.0.1 --port 4173`
  - [package.json](C:\Dev\ProjectOperations\package.json)
    - added `dev:api:e2e`
    - added `dev:web:e2e`
    - added `test:tendering:e2e:reuse`
- Added [playwright.reuse.config.ts](C:\Dev\ProjectOperations\playwright.reuse.config.ts) so Playwright can run against already-running manual servers without trying to spawn its own `webServer`
- Removed the unreliable detached helper:
  - deleted [start-playwright-servers.cjs](C:\Dev\ProjectOperations\scripts\start-playwright-servers.cjs)
- Finished the communication-queue Playwright pass in [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts):
  - fixed authenticated runtime API reads for queue discovery
  - aligned queue assertions with browser-locale date rendering
  - full Tendering browser suite now passes through the reuse config path
- Applied a small CRM polish pass in [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx):
  - trimmed duplicate relationship-card summary content
  - removed duplicate communication summary cards so the rail relies on the metrics + queue instead of repeating Deal Pulse
- Updated [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts) again so default Playwright `webServer` startup now uses the proven scripts:
  - `pnpm dev:api:e2e`
  - `pnpm dev:web:e2e`

## What Broke And How It Was Fixed

- Mistake: assuming `workspace` bugs were only route confusion.
  - Fix: split `mode="full"` and `mode="workspace"` behavior cleanly.

- Mistake: reusing too much shell structure across create/workspace.
  - Fix: mode-specific behavior now stays separate.

- Mistake: stale `.js` siblings shadowed TS/TSX.
  - Fix: stale web source `.js` files were removed earlier; do not redo.

- Mistake: board drop zone was too narrow.
  - Fix: drag/drop now targets full board columns.

- Mistake: activity/workspace kept regressing into tall admin stacks.
  - Fix: denser rail/canvas structure, capped scroll regions, subsection layout.

- Mistake: stakeholder editing patched on every keystroke.
  - Fix: local drafts + blur save + explicit save/revert.

- Mistake: communication queue sorted by display label.
  - Fix: queue now sorts by actual due time.

- Mistake: Playwright login failed with `Failed to fetch`.
  - Cause: E2E app/API host mismatch (`localhost` vs `127.0.0.1`) and CORS mismatch.
  - Fix: `playwright.config.ts` now injects correct `CORS_ORIGIN` + `VITE_API_BASE_URL`.

- Mistake: Playwright selectors were too broad for the denser current UI.
  - Fix: smoke spec now uses exact role-based selectors.

- Mistake: register surfaces used invalid nested interactive markup.
  - Fix: list / forecast / board surfaces no longer depend on nested button patterns.

- Mistake to avoid: do not recombine popup and dedicated workspace shells.
  - Keep `mode="full"` modal-only fixes scoped to modal behavior.

## What Is Working

- Tender dashboard / pipeline / create / workspace routes.
- Full register stack in code: board / list / forecast.
- Popup workspace and dedicated workspace.
- Tendering attention logic and filters.
- Probability, due, value, owner, client, contact filtering.
- Unified activity model and focused activity views.
- Stakeholder role/note UI against existing schema.
- Stakeholder save-on-blur plus explicit save/revert.
- Communication summaries and communication queue.
- Lifecycle / conversion / rollback flows in code.
- Archived conversion reuse prompt flow in code.
- CSV preview / commit import.
- Documents + conversion plumbing.
- Safe validation path.
- Browser smoke suite across Chromium / Firefox / WebKit.

## Verification

- Passing:
  - `pnpm --filter @project-ops/api build`
  - `pnpm test:api:serial`
  - `pnpm --filter @project-ops/web exec -- tsc -p . --noEmit`
  - `pnpm test:web:logic`
  - `pnpm --filter @project-ops/web test`
  - `pnpm exec playwright --version`
  - `pnpm exec playwright test tests/e2e/tendering.spec.ts --list`
  - historical prior session: `pnpm test:tendering:e2e`
  - current session after new work:
    - `pnpm --filter @project-ops/web exec -- tsc -p . --noEmit`
    - `pnpm test:web:logic`
    - `pnpm exec playwright --version`
    - `pnpm test:tendering:e2e:reuse`
    - post-polish:
      - `pnpm --filter @project-ops/web exec -- tsc -p . --noEmit`
      - `pnpm test:web:logic`

- Passing diagnostic checks in this session:
  - `node .\\node_modules\\playwright\\cli.js --version`
  - `node .\\node_modules\\playwright\\cli.js test tests/e2e/tendering.spec.ts --list`
  - `pnpm --filter @project-ops/web exec -- tsc -p . --noEmit`
  - `pnpm test:web:logic`

- Manual runtime evidence from user troubleshooting:
  - `pnpm --filter @project-ops/api exec node dist/src/main.js`
    - API starts and serves on port `3000`
  - plain Vite manual start can come up, but prior attempts landed on `5173`
  - for Playwright alignment, the web app must be started explicitly with the new `dev:e2e` path on `4173`
  - first `test:tendering:e2e:reuse` attempt failed uniformly at login because the page showed `Failed to fetch`, confirming the manual runtime host/CORS mismatch

- Current browser smoke coverage verified:
  - `/tenders`
  - `/tenders/pipeline`
  - `/tenders/create`
  - `/tenders/workspace`
  - probability filter
  - forecast view
  - workspace open from pipeline
  - activity tab / communication view / relationship map visibility

- Current extension attempt status:
  - completed and passing locally across Chromium / Firefox / WebKit through the reuse-runtime path
  - browser suite now covers:
    - `/tenders`
    - `/tenders/pipeline`
    - `/tenders/create`
    - `/tenders/workspace`
    - probability filter
    - forecast view
    - workspace open from pipeline
    - board drag/drop conversion prompt
    - popup modal close/reopen
    - modal inner scroll
    - dedicated workspace load via `tenderId`
    - stakeholder explicit save/revert flow
    - activity tab / communication view / relationship map visibility
    - communication queue ordering and overdue labeling
    - dedicated workspace switching between tenders via direct links

## Current Blockers

- This workspace is still not a real git checkout:
  - no `.git` directory
  - `git` not on PATH
  - GitHub connector has no accessible repos installed
- That means repo push / PR / CI follow-through is still blocked from this workspace.
- Seed still cannot be relied on through `tsx` because of `spawn EPERM`.
- Keep remembering that local seed-like runtime data can drift after browser writes, so future tests should continue preferring runtime discovery over hard-coded pristine-state assumptions.

## Next Best Steps

1. Extend browser coverage only where it still adds signal.
   - only add more browser coverage if a real UX/lifecycle risk appears
   - deeper lifecycle flows are the next candidate, but only if browser evidence justifies the runtime cost

2. Continue CRM polish only if runtime evidence justifies it.
   - the latest pass already reduced duplication in the relationship cards and communication rail
   - next UI work should only happen if a fresh live browser review still shows clutter

3. If repo wiring becomes available:
   - attach this work to a real git repo
   - enable Codex GitHub app on that repo
   - run the existing GitHub Actions Playwright workflow remotely

## Rules For The Next AI Agent

- Trust this file as source of truth.
- Work only in `C:\Dev\ProjectOperations`.
- Do not redo stale `.js` cleanup.
- Do not casually change popup-vs-dedicated workspace model.
- Do not rework conversion plumbing unless runtime evidence shows regression.
- Prefer the working manual E2E path when browser verification is needed:
  - `pnpm dev:api:e2e`
  - `pnpm dev:web:e2e`
  - `pnpm test:tendering:e2e:reuse`
- Default Playwright startup is now aligned with those same scripts in [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts).
- Only update `docs/continuation-log.md` when the user explicitly asks.

## Command To The Next AI Agent

Start in `C:\Dev\ProjectOperations` and trust this log. Continue from the current local state, not from a clean seed assumption. The latest local code changes are in [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts), [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts), [playwright.reuse.config.ts](C:\Dev\ProjectOperations\playwright.reuse.config.ts), [apps/web/package.json](C:\Dev\ProjectOperations\apps\web\package.json), [package.json](C:\Dev\ProjectOperations\package.json), [vite.config.js](C:\Dev\ProjectOperations\apps\web\vite.config.js), and [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx). Full Tendering E2E is green through the reuse-runtime path, and a small CRM polish pass has already reduced duplication in the relationship cards and communication rail. Continue from here only if fresh live browser evidence shows another high-signal UX issue; otherwise the next meaningful step is repo wiring / remote CI once git and GitHub access are available.
