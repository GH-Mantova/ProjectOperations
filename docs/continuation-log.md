# Continuation Log

Last updated: 2026-04-14 (latest session, post-merge handover)

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
  - PowerShell only
  - seed via `tsx prisma/seed.ts` still hits `spawn EPERM`
  - `rg.exe` can still fail with access denied; prefer PowerShell `Select-String`
  - local git branch creation is currently blocked by a `.git/refs` permission issue in this managed environment, even though the repo and remote now exist
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
- Wired this workspace to the real GitHub repo:
  - remote: `https://github.com/GH-Mantova/ProjectOperations.git`
  - local branch remains `main`
- Published the Playwright CI compatibility follow-up through the GitHub connector because local git could not create branch lockfiles:
  - remote branch: `codex/playwright-ci-compat`
  - PR: [#1 Make Playwright startup CI-compatible](https://github.com/GH-Mantova/ProjectOperations/pull/1)
- PR [#1](https://github.com/GH-Mantova/ProjectOperations/pull/1) has now been merged into `main`.
- The merged PR also added a Prisma client generation step to [playwright.yml](C:\Dev\ProjectOperations\.github\workflows\playwright.yml) before API build in GitHub Actions.

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
- GitHub repo wiring, PR flow, and merge path are now working through the connector.

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
    - GitHub PR follow-up:
      - `pnpm --filter @project-ops/web exec -- tsc -p . --noEmit`
      - `pnpm test:web:logic`
      - merged remote follow-up:
        - PR [#1](https://github.com/GH-Mantova/ProjectOperations/pull/1) merged into `main`

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

- Local git write operations inside `.git/refs` are unreliable in this managed environment:
  - branch creation from the shell failed with permission-denied lockfile errors
  - GitHub connector publishing worked around this for PR creation
- Seed still cannot be relied on through `tsx` because of `spawn EPERM`.
- Keep remembering that local seed-like runtime data can drift after browser writes, so future tests should continue preferring runtime discovery over hard-coded pristine-state assumptions.

## Next Best Steps

1. Continue CRM polish only if runtime evidence justifies it.
   - the latest pass already reduced duplication in the relationship cards and communication rail
   - next UI work should only happen if a fresh live browser review still shows clutter

2. Extend browser coverage only where it still adds signal.
   - deeper lifecycle flows are the next candidate, but only if browser evidence justifies the runtime cost

3. Keep GitHub follow-through lightweight unless a real CI issue appears.
   - repo wiring and the cross-platform Playwright startup fix are already merged
   - only return to GitHub Actions work if a new failure shows up on future changes

## Rules For The Next AI Agent

- Trust this file as source of truth.
- Work only in `C:\Dev\ProjectOperations`.
- Do not redo stale `.js` cleanup.
- Do not casually change popup-vs-dedicated workspace model.
- Do not rework conversion plumbing unless runtime evidence shows regression.
- Prefer the GitHub connector if local git branch creation keeps failing with `.git/refs` lockfile permission errors.
- Prefer the working manual E2E path when browser verification is needed:
  - `pnpm dev:api:e2e`
  - `pnpm dev:web:e2e`
  - `pnpm test:tendering:e2e:reuse`
- Default Playwright startup is now aligned with those same scripts in [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts).
- Only update `docs/continuation-log.md` when the user explicitly asks.

## Command To The Next AI Agent

Start in `C:\Dev\ProjectOperations` and trust this log. Continue from the current local state, not from a clean seed assumption. The latest local code changes are in [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts), [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts), [playwright.reuse.config.ts](C:\Dev\ProjectOperations\playwright.reuse.config.ts), [apps/web/package.json](C:\Dev\ProjectOperations\apps\web\package.json), [package.json](C:\Dev\ProjectOperations\package.json), [vite.config.js](C:\Dev\ProjectOperations\apps\web\vite.config.js), and [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx). Full Tendering E2E is green through the reuse-runtime path, and PR [#1](https://github.com/GH-Mantova/ProjectOperations/pull/1) has already been merged to land the cross-platform Playwright startup fix. Continue from here only if fresh live browser evidence shows another high-signal UX issue; otherwise treat Tendering as stable and move to the next high-value module or workflow.

---

## Update 2026-04-16 - Post-Tendering Workflow Spine, Ownership Model, Sanity Sweep

This update captures the work completed after Tendering was treated as stable. The main product focus moved into the award-to-delivery handoff, Jobs/Scheduler/Documents/Notifications coordination, ownership-aware execution queues, and a whole-app sanity/debug pass.

## What Was Added Since The Previous Log

- Extended tender-to-job handover in [jobs.service.ts](C:\Dev\ProjectOperations\apps\api\src\modules\jobs\jobs.service.ts) so converted jobs now carry forward richer source-tender context:
  - tender due date
  - estimated value
  - probability
  - estimator
  - awarded tender-client contact / relationship / notes
- Reworked [JobsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\JobsPage.tsx) into a much stronger delivery workspace:
  - handover summary band
  - read-first delivery brief
  - handover brief for awarded client/contact/stakeholder context
  - clearer documents/closeout continuity
  - delivery pulse metrics
  - scan-friendly issues / variations / recent progress / status history
- Bridged Jobs into Scheduler:
  - job activity responses now include lightweight shift summaries
  - Jobs shows scheduling-readiness counts
  - unscheduled activities can jump into Scheduler with `Plan in Scheduler`
  - Scheduler reads the handoff state and preselects job / stage / activity
  - Scheduler adds a planner-handoff band with smarter first-shift defaults
- Strengthened Scheduler into a real planning command surface in [SchedulerPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\SchedulerPage.tsx):
  - job/stage readiness pills in the planning tree
  - selected-shift coverage guidance
  - direct shift role-requirement create/edit controls
  - role-aware worker assignment
  - grouped assigned workers by role requirement
  - direct worker and asset removal from selected shift
  - best-fit worker suggestions
  - best-fit asset suggestions
  - maintenance-aware asset dispatch labels:
    - `Dispatch ready`
    - `Review before dispatch`
    - `Do not dispatch`
  - dedicated `Why this shift is flagged` panel with conflict reasons
- Pushed planning intelligence back into Jobs:
  - planning blockers digest
  - planning pressure summary
  - direct `Open in Scheduler` actions from blocker items and upcoming shifts
  - reverse handoff from Scheduler back into Jobs with focused delivery context
  - focused delivery action panel in Jobs for status changes and progress notes
  - recommendation logic for likely next delivery action after planning review
- Elevated planning signals into portfolio surfaces:
  - Jobs register now has a `Planning health` column
  - [DashboardsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\DashboardsPage.tsx) now includes:
    - `Delivery and planning health`
    - top at-risk jobs
    - `Open in Jobs` actions
  - [DashboardPlaceholderPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\DashboardPlaceholderPage.tsx) is no longer a placeholder and now acts as a real operational home:
    - priority actions
    - planning/delivery snapshot
    - at-risk jobs
    - quick navigation cards
- Extended document continuity:
  - Jobs can open focused job documents
  - [DocumentsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\DocumentsPage.tsx) reads route context, shows a document-focus banner, scopes the register to the job, and prefills the create form
- Turned Notifications into a shared coordination engine:
  - [NotificationsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\NotificationsPage.tsx) now combines:
    - blocked planning prompts
    - warning planning prompts
    - first-shift-needed prompts
    - missing document follow-up prompts
  - prompts became ownership-aware and user-aware
  - urgency labels added:
    - `Urgent today`
    - `Due soon`
    - `Upcoming`
  - triage actions added:
    - `I'm handling this`
    - `Watch only`
    - reset to `Open`
  - triage attribution and recency are now shared, not local only
- Moved shared live follow-up generation to the backend:
  - [notifications.service.ts](C:\Dev\ProjectOperations\apps\api\src\modules\platform\notifications.service.ts)
  - [notifications.controller.ts](C:\Dev\ProjectOperations\apps\api\src\modules\platform\notifications.controller.ts)
  - added DTOs:
    - [assign-follow-up-notification.dto.ts](C:\Dev\ProjectOperations\apps\api\src\modules\platform\dto\assign-follow-up-notification.dto.ts)
    - [sync-follow-up-notifications.dto.ts](C:\Dev\ProjectOperations\apps\api\src\modules\platform\dto\sync-follow-up-notifications.dto.ts)
    - [triage-follow-up-notification.dto.ts](C:\Dev\ProjectOperations\apps\api\src\modules\platform\dto\triage-follow-up-notification.dto.ts)
  - follow-ups now refresh after Jobs / Scheduler / Documents mutations
  - stale generated follow-ups are reconciled on the backend
- Surfaced the coordination engine outside Notifications:
  - [ShellLayout.tsx](C:\Dev\ProjectOperations\apps\web\src\components\ShellLayout.tsx) now has a compact global `Action Center`
  - dashboards include an action-center snapshot
  - home route includes priority actions
- Added explicit ownership controls beyond inferred PM/supervisor defaults:
  - job-level `Planning owner`
  - job-level `Document owner`
  - scheduler-side control to save the parent job planning owner
  - direct reassignment of follow-up prompts from Notifications / Jobs / Scheduler
- Added execution-level owners as first-class data:
  - [schema.prisma](C:\Dev\ProjectOperations\apps\api\prisma\schema.prisma)
  - `JobActivity.ownerUserId`
  - `Shift.leadUserId`
  - matching DTO / service / UI wiring in Jobs and Scheduler
  - follow-up routing now prefers:
    - shift lead
    - activity owner
    - planning owner
    - document owner
- Added execution-owner visibility:
  - `My activities` in Jobs
  - `My shifts` in Scheduler
  - `My activities` / `My shifts` counts on Home and Dashboards
  - `My Execution Queue` on the home surface

## Documentation And UX Cleanup

- Rewrote outdated docs so they align with the real product state:
  - [setup-guide.md](C:\Dev\ProjectOperations\docs\setup-guide.md)
  - [local-development.md](C:\Dev\ProjectOperations\docs\local-development.md)
  - [deployment-guide.md](C:\Dev\ProjectOperations\docs\deployment-guide.md)
  - [environment-reference.md](C:\Dev\ProjectOperations\docs\environment-reference.md)
  - [tendering-pipedrive-roadmap.txt](C:\Dev\ProjectOperations\docs\tendering-pipedrive-roadmap.txt)
- Aligned supporting docs:
  - [architecture-overview.md](C:\Dev\ProjectOperations\docs\architecture-overview.md)
  - [module-build-log.md](C:\Dev\ProjectOperations\docs\module-build-log.md)
  - [sharepoint-local-workflow.md](C:\Dev\ProjectOperations\docs\sharepoint-local-workflow.md)
- Added historical/handover docs:
  - [Project-History-Sprints-1-to-12.md](C:\Dev\ProjectOperations\docs\Project-History-Sprints-1-to-12.md)
  - [Sprint1.md](C:\Dev\ProjectOperations\docs\Sprint1.md) through [Sprint12.md](C:\Dev\ProjectOperations\docs\Sprint12.md)
- Ran a UI density/polish pass across thinner admin/support modules:
  - [AuditLogsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\AuditLogsPage.tsx)
  - [PermissionsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\PermissionsPage.tsx)
  - [UsersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\UsersPage.tsx)
  - [RolesPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\RolesPage.tsx)
  - [PlatformPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\PlatformPage.tsx)
  - shared layout refinements in [styles.css](C:\Dev\ProjectOperations\apps\web\src\styles.css)

## Database / Prisma Changes

- Added migration:
  - [202604160001_execution_level_owners/migration.sql](C:\Dev\ProjectOperations\apps\api\prisma\migrations\202604160001_execution_level_owners\migration.sql)
- Applied the migration locally using `psql` because Prisma schema/migrate CLI remains unreliable under managed-Windows `spawn EPERM`
- Verified live local DB alignment:
  - `job_activities.owner_user_id` exists
  - `shifts.lead_user_id` exists
  - `_prisma_migrations` includes `202604160001_execution_level_owners`
- Fixed a real runtime blocker in [prisma.service.ts](C:\Dev\ProjectOperations\apps\api\src\prisma\prisma.service.ts):
  - this environment intermittently selected the wrong Prisma engine path
  - the service now pins `PRISMA_CLIENT_ENGINE_TYPE=library` unless the caller explicitly overrides it
  - this restored normal local Prisma connectivity and unblocked the compliance smoke

## Sanity Check And Debugging Results

Performed a thorough sanity pass across the current codebase and fixed the concrete issues found.

### Real issues found and fixed

- API spec drift after service constructor changes:
  - [jobs.service.spec.ts](C:\Dev\ProjectOperations\apps\api\src\modules\jobs\jobs.service.spec.ts)
  - [documents.service.spec.ts](C:\Dev\ProjectOperations\apps\api\src\modules\documents\documents.service.spec.ts)
  - [scheduler.service.spec.ts](C:\Dev\ProjectOperations\apps\api\src\modules\scheduler\scheduler.service.spec.ts)
  - root cause: `NotificationsService` had become a required dependency and older tests still constructed services with stale argument lists
  - fix: added explicit mocked notifications-service constructor args
- Prisma runtime bug during compliance smoke:
  - symptom: Prisma could fall into a wrong engine-selection path and reject the normal `postgresql://...` datasource URL
  - fix: pin library engine in [prisma.service.ts](C:\Dev\ProjectOperations\apps\api\src\prisma\prisma.service.ts)

### Sanity checks run

- Passing:
  - `pnpm --filter @project-ops/api build`
  - `pnpm test:api:serial`
  - `node .\node_modules\typescript\bin\tsc -p . --noEmit` from [apps/web](C:\Dev\ProjectOperations\apps\web)
  - `pnpm test:web:logic`
  - `pnpm compliance:smoke`
- Compliance smoke now passes end-to-end and exercises:
  - auth/login
  - master data fetches
  - tender creation
  - tender document creation
  - award / contract / conversion
  - job stage + activity creation
  - shift creation and assignment
  - scheduler workspace
  - maintenance dataset
  - forms flow
  - documents flow
  - dashboard rendering

### Environment limitations still worth remembering

- `pnpm build` can still hit managed-Windows `spawn EPERM` because the recursive lifecycle is less reliable here than targeted package builds.
- `pnpm --filter @project-ops/web test` / generic Vitest paths remain less reliable than the safe logic path in this environment.
- For meaningful validation in this workspace, prefer:
  - targeted API build
  - serial API tests
  - web `tsc --noEmit`
  - `pnpm test:web:logic`
  - `pnpm compliance:smoke`
  - Tendering reuse-runtime Playwright path when browser verification is needed

## Current State

- Tendering remains stable and pilot-ready.
- Award-to-job handover is materially stronger.
- Jobs, Scheduler, Documents, Notifications, Home, Dashboards, and the shell now form a coherent operational spine.
- Shared coordination prompts are backend-generated and ownership-aware.
- Execution-level owners now exist in schema, local DB, API, and web UI.
- The latest local codebase now passes the strongest reliable sanity checks available in this managed environment.

## Best Next Steps

1. If the user wants more product work, the next high-value area is explicit execution-owner control and daily queue behavior beyond visibility alone.
   - let activity owners and shift leads acknowledge / action work directly from Home / Dashboards / Notifications
   - keep driving from explicit ownership, not inferred defaults

2. If the user wants rollout work, Tendering can now be launched online while Jobs/Scheduler/Notifications continue maturing behind it.

3. Keep future verification realistic for this environment.
   - prefer the safe targeted validation path over generic recursive build/test commands

## Rules For The Next AI Agent

- Trust this file plus the current codebase.
- Do not remove older continuation-log history; continue appending.
- Keep using `C:\Dev\ProjectOperations`.
- Treat Tendering as stable unless fresh browser evidence shows otherwise.
- Prefer targeted safe checks over generic recursive commands in this managed Windows environment.
- Remember that execution-level owners are now live in the local DB, not just in code.

---

## Update 2026-04-16 - Whole-App Sanity Pass, Debug Sweep, And UI Consistency Hardening

This update captures a deeper sanity pass after the execution-owner and coordination-engine work. The goal here was not to add another new workflow first, but to verify that the broader system still behaves coherently module by module, fix concrete regressions, tighten weaker layouts, and document the remaining environment limits honestly.

## What Was Checked

A broad hardening sweep was run across:

- API module integrity
- web TypeScript integrity
- shared compliance smoke flow touching multiple modules
- thinner module surfaces that still felt more scaffold-like than the stronger operational modules
- browser-validation entry points and their current environment constraints

## Issues Found And Fixed In This Pass

### 1. API spec drift after service dependency growth

The serial API suite exposed real stale-constructor issues after more modules started depending on [NotificationsService](C:\Dev\ProjectOperations\apps\api\src\modules\platform\notifications.service.ts).

Fixed:
- [jobs.service.spec.ts](C:\Dev\ProjectOperations\apps\api\src\modules\jobs\jobs.service.spec.ts)
- [documents.service.spec.ts](C:\Dev\ProjectOperations\apps\api\src\modules\documents\documents.service.spec.ts)
- [scheduler.service.spec.ts](C:\Dev\ProjectOperations\apps\api\src\modules\scheduler\scheduler.service.spec.ts)

Root cause:
- tests were still constructing services with outdated argument lists

Fix:
- added explicit mocked `NotificationsService` constructor args so the specs match the real service shape again

### 2. Prisma runtime engine-selection bug

The API build passed, but compliance smoke had previously shown that this environment could sometimes push Prisma down the wrong engine path unless the engine type was forced.

Fix already landed and confirmed in this pass:
- [prisma.service.ts](C:\Dev\ProjectOperations\apps\api\src\prisma\prisma.service.ts)

Result:
- Prisma now pins the normal local library engine unless intentionally overridden
- compliance smoke now runs cleanly end to end again

### 3. Thin/inconsistent module surfaces

Some modules were not broken, but they still felt visually thinner or more utility-like than the stronger Tendering / Jobs / Scheduler / Notifications surfaces. This pass lifted the weakest of those modules.

Improved:
- [ResourcesPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\ResourcesPage.tsx)
  - reworked into a clearer CRM-style split layout
  - added summary cards
  - added capped resource directory list
  - made the form side more balanced with the rest of the operations modules
- [PlatformPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\PlatformPage.tsx)
  - added clearer operating-posture guidance
  - improved folder-provisioning framing so the page reads more like a real admin workspace than a raw utility form
- [TenderingSettingsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TenderingSettingsPage.tsx)
  - added summary cards
  - added explicit “safe rename surface” guidance
  - made the page more read-first and less bare

### 4. Text rendering / mojibake cleanup

Found and fixed a visible text glitch in:
- [AssetsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\AssetsPage.tsx)

Fix:
- replaced the serial-number separator with a safe ASCII `|` separator to avoid character-encoding noise in managed Windows terminals and some render paths

Note:
- a similar decorative separator still appears in one small section of [SchedulerPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\SchedulerPage.tsx), but it did not affect function or validation. If that UI noise still appears in live runtime review, it can be cleaned in a very small follow-up.

## Validation Results

Passing in this pass:
- `pnpm --filter @project-ops/api build`
- `pnpm test:api:serial`
- `node .\\node_modules\\typescript\\bin\\tsc -p . --noEmit` from [apps/web](C:\Dev\ProjectOperations\apps\web)
- `pnpm test:web:logic`
- `pnpm compliance:smoke`

What the passing compliance smoke exercised again:
- auth/login
- master-data lookups
- tender creation
- tender documents
- award / contract / conversion
- jobs / stages / activities
- shift creation and assignments
- scheduler workspace
- maintenance dataset
- forms and submissions
- generic documents flow
- dashboard rendering

## Browser Validation Status In This Pass

- `pnpm test:tendering:e2e`
  - still fails here with managed-Windows `spawn EPERM`
- live reuse-runtime browser validation remains the correct path for this workspace:
  - `pnpm dev:api:e2e`
  - `pnpm dev:web:e2e`
  - `pnpm test:tendering:e2e:reuse`

Important current limitation:
- in this session, detached server startup is blocked by the environment policy, and no reuse-runtime servers were already running
- that means the live Tendering browser suite could not be re-run inside this exact turn even though the code path is still the known-good path from earlier passes

So the honest state is:
- code-level validation is green
- API and cross-module operational smoke is green
- default Playwright spawn is still environment-blocked
- reuse-runtime Playwright remains the browser-validation path to use when interactive terminals are available

## Current State After This Pass

- The system is in a stronger state than before this sweep:
  - the real regressions found in specs/runtime were fixed
  - thinner module layouts were improved
  - shared cross-module flow still passes the strongest reliable validations available here
- Tendering remains stable
- Jobs / Scheduler / Notifications / Documents / Home / Dashboards remain the strongest operational spine in the app
- Resources / Platform / Tendering Settings now feel more consistent with the rest of the ERP

## Best Next Steps

1. When a live terminal/browser is available again, re-run:
   - `pnpm dev:api:e2e`
   - `pnpm dev:web:e2e`
   - `pnpm test:tendering:e2e:reuse`
   to refresh live browser evidence after this broader hardening pass

2. If another polish pass is needed, target the smallest remaining visual inconsistencies rather than reworking already-strong modules.

3. If product development resumes instead of hardening, continue from the coordination/ownership spine rather than circling back into module foundation work.

---

# Update - 2026-04-16 (Follow-up Hardening Pass + Action Surface Controls)

## What Was Done

Completed another full sanity pass, fixed a real Tendering register regression, re-ran the live browser suite successfully, and then resumed development by turning the shell/home/dashboard action surfaces into true triage points rather than read-only summaries.

## Real Regression Fixed

### Tendering register was silently truncating the live pipeline

Found in:
- [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx)

Root cause:
- the Tendering page was loading `/tenders` without an explicit page size
- the API default page size only returned the first 10 records
- that meant the board/list/forecast UI quietly hid older live tenders even though the module had no pagination affordance
- this also caused the Tendering Playwright suite to fail in realistic runtime conditions because:
  - the `OVER_70` filter could collapse to zero records inside the truncated dataset
  - the expected seeded tender `Western corridor traffic switch` could exist in the database but not in the UI response

Fix:
- changed the Tendering register load path to request:
  - `/tenders?page=1&pageSize=100`

Outcome:
- the full working pipeline is now visible again
- board/list/forecast behavior is consistent with what users expect
- the Tendering browser suite returned to green

## Development Resumed After Hardening

### Shell / Home / Dashboards are now actionable, not just informative

Updated:
- [ShellLayout.tsx](C:\Dev\ProjectOperations\apps\web\src\components\ShellLayout.tsx)
- [DashboardPlaceholderPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\DashboardPlaceholderPage.tsx)
- [DashboardsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\DashboardsPage.tsx)

What changed:
- the shared live follow-up feed shown in the shell `Action Center` can now be triaged directly
- the `Priority Actions` section on the Overview / home page can now be triaged directly
- the `Action center snapshot` section in Dashboards can now be triaged directly

Supported actions from those surfaces now include:
- `Open action`
- `I'm handling this`
- `Watch only`
- `Reset`

This means:
- users no longer need to go into Notifications for every small coordination acknowledgment
- home/dashboard/shell surfaces now work as real daily control points
- the shared follow-up engine remains the source of truth, but top-level ERP surfaces are now better aligned with how people actually work

## Validation Results

Passing in this pass:
- `pnpm --filter @project-ops/api build`
- `pnpm test:api:serial`
- `node .\\node_modules\\typescript\\bin\\tsc -p . --noEmit` from [apps/web](C:\Dev\ProjectOperations\apps\web)
- `pnpm test:web:logic`
- `pnpm compliance:smoke`
- `pnpm test:tendering:e2e:reuse`

Browser result:
- Tendering reuse-runtime E2E is green again
- latest live result:
  - `18 passed`

## Current State After This Pass

- Tendering register no longer silently drops live records because of backend default pagination
- Tendering board/list/forecast behavior is back in line with the actual live dataset
- the full Tendering browser suite is passing again
- shell/home/dashboard coordination surfaces are now writable triage points, not passive visibility panels
- the cross-module operational spine is stronger and more usable:
  - Shell -> Jobs / Documents
  - Overview -> Jobs / Scheduler / Notifications / Dashboards
  - Dashboards -> Jobs / Documents / Scheduler
  - Notifications -> Jobs / Documents
  - Jobs <-> Scheduler

## Best Next Steps

1. If development continues, keep building from the coordination / execution spine rather than revisiting stable foundations.
2. The strongest next product step is to extend shared triage farther into ownership workflows:
   - expose direct reassignment or acknowledgment for execution queue items themselves
   - continue tightening the daily-use surfaces rather than adding disconnected module features
3. If another polish pass is needed later, focus only on small remaining visual inconsistencies rather than any broad redesign.

---

# Update - 2026-04-16 (Roadmap Refresh + Execution Queue Direct Actions)

## Documentation Updated

Updated:
- [tendering-pipedrive-roadmap.txt](C:\Dev\ProjectOperations\docs\tendering-pipedrive-roadmap.txt)
- [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md)

What changed in the roadmap:
- clarified that Tendering is now a stable pilot-ready baseline
- added a broader platform development note so the roadmap reflects the current multi-module operational spine
- recorded that the main product direction is now execution / coordination maturity rather than isolated Tendering redesign
- added the current next-stage priority order:
  - deeper execution-queue actions
  - stronger ownership workflows
  - document continuity maturity
  - online rollout preparation

## Development Resumed

### Home and Dashboards execution queues can now move work forward directly

Updated:
- [DashboardPlaceholderPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\DashboardPlaceholderPage.tsx)
- [DashboardsPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\DashboardsPage.tsx)

What changed:
- execution queue items now carry enough activity context to support direct top-surface actions
- owned activity items on Home and Dashboards can now:
  - `Mark Active`
  - `Log progress`
- items that still need planner intervention continue to route into Scheduler
- items already in a Jobs-ready state can now be advanced from the top surfaces without forcing a deeper page transition first

What this means:
- the product has moved one step further from visibility-only coordination into lightweight direct execution
- activity owners can now progress owned work from the surfaces they are most likely to open first
- the execution queue is becoming a real daily work surface rather than just a navigation layer

## Suggested Next Product Step

The strongest next step after this change is:
- extend the same direct-action model to shift leads and escalation flows

Examples:
- acknowledge or escalate a blocked shift directly from top-level execution surfaces
- add lightweight "waiting on planner" / "handoff complete" actions
- keep deep module pages for richer work, but continue pulling the most common daily actions upward
