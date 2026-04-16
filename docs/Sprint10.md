# Sprint 10 Handover

Date: 2026-04-14
Workspace: `C:\Dev\ProjectOperations`

## Objective

Continue Tendering toward a CRM-style deal desk flow, reduce workflow friction in the workspace rail, and move browser verification from blocked to passing.

## What Was Done

- Continued Tendering UI refinement in the local workspace only.
- Improved stakeholder editing flow in the workspace rail:
  - local draft state for stakeholder role/notes
  - save-on-blur instead of patching every keystroke
  - explicit `Save stakeholder` and `Revert` actions
  - saved / unsaved / saving state surfaced in the UI
- Tightened CRM-style relationship and communication context:
  - normalized stakeholder role labels
  - denser relationship cards
  - communication summaries framed as `Coverage / Owners / Cadence / Recent voices`
  - added a communication queue sourced from unified activity items
  - fixed communication queue ordering to sort by real due time
- Strengthened runtime/browser support:
  - Playwright config expanded to `chromium`, `firefox`, and `webkit`
  - GitHub Actions Playwright workflow added for future CI use
  - Playwright webServer wiring fixed so app/API use `127.0.0.1` correctly during E2E
  - Tendering smoke tests updated to current UI copy and exact selectors
  - browser launch block was resolved locally
  - Tendering browser smoke now passes locally across Chromium, Firefox, and WebKit
- Fixed interaction issues uncovered by runtime:
  - removed invalid nested interactive patterns in Tender register surfaces
  - made workspace modal open immediately while detail hydration completes
- Expanded logic/test coverage:
  - added helper coverage for probability bands
  - added stage-readiness coverage for `IN_PROGRESS` and `AWARDED`
- Rewrote `docs/continuation-log.md` into a cleaner low-token handover, but do not update it further unless explicitly asked by the user.

## Key Fixes

### 1. Stakeholder editing was too chatty

Problem:
- stakeholder role/note persistence was effectively too noisy for a CRM-style workflow

Fix:
- local drafts + save-on-blur
- explicit save/revert controls

Result:
- lower patch churn
- clearer user control in the relationship rail

### 2. Communication context was descriptive but not operational

Problem:
- workspace rail showed context but not enough immediate actionability

Fix:
- added communication queue from unified activity stream
- surfaced owner and overdue state
- improved card hierarchy and CRM framing

Result:
- rail is more useful as a deal desk workspace

### 3. Playwright runtime initially failed at login

Problem:
- login hit `Failed to fetch`
- API/web runtime mismatch during E2E (`localhost` vs `127.0.0.1`)

Fix:
- updated Playwright `webServer` commands to inject:
  - `CORS_ORIGIN=http://127.0.0.1:4173`
  - `VITE_API_BASE_URL=http://127.0.0.1:3000/api/v1`

Result:
- browser runtime reached the app correctly

### 4. Register interaction bugs were exposed by browser tests

Problem:
- register surfaces used invalid nested interactive patterns
- workspace open flow had timing friction

Fix:
- corrected register card interaction structure
- improved workspace open timing so modal opens immediately while data loads

Result:
- Tendering smoke test passes in real browsers

### 5. Smoke spec had drifted from the UI

Problem:
- broader selectors like `getByText("Pipeline")` collided with denser UI

Fix:
- updated smoke test to use more exact role-based selectors and current UI wording

Result:
- stable browser verification again

## Files Created Or Changed

### Created

- [Sprint10.md](C:\Dev\ProjectOperations\docs\Sprint10.md)
- [playwright.yml](C:\Dev\ProjectOperations\.github\workflows\playwright.yml)

### Changed

- [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx)
  - stakeholder draft/save workflow
  - communication rail + queue
  - register interaction fixes
  - workspace open timing
- [styles.css](C:\Dev\ProjectOperations\apps\web\src\styles.css)
  - stakeholder/communication UI styling updates
- [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts)
  - multi-browser projects
  - E2E-safe env wiring for API/web runtime
- [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts)
  - current runtime/browser smoke coverage
- [tendering-page-helpers.test.ts](C:\Dev\ProjectOperations\apps\web\src\pages\tendering-page-helpers.test.ts)
  - expanded helper coverage
- [ShellLayout.tsx](C:\Dev\ProjectOperations\apps\web\src\components\ShellLayout.tsx)
  - typing fix for stricter web typecheck
- [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md)
  - rewritten earlier in the sprint; do not update unless explicitly asked

## Current State

- Tendering now has:
  - dashboard
  - pipeline
  - create
  - workspace
  - clients
  - contacts
  - settings
- Register surfaces are active:
  - board
  - list
  - forecast
- Workspace has:
  - overview
  - activity
  - documents
  - conversion
- Unified activity workflow is working in code.
- Stakeholder role/note UI is working in code.
- Communication queue is working in code.
- Browser smoke is passing locally.

## Validation Performed

- `pnpm --filter @project-ops/api build`
- `pnpm test:api:serial`
- `pnpm --filter @project-ops/web exec -- tsc -p . --noEmit`
- `pnpm test:web:logic`
- `pnpm --filter @project-ops/web test`
- `pnpm exec playwright --version`
- `pnpm exec playwright test tests/e2e/tendering.spec.ts --list`
- `pnpm test:tendering:e2e`

Browser smoke currently passes:
- `/tenders`
- `/tenders/pipeline`
- `/tenders/create`
- `/tenders/workspace`
- probability filter
- forecast view
- workspace open
- activity tab context

## Remaining Gaps / Roadmap

### Highest-value next steps

1. Extend Playwright coverage further:
   - board drag/drop across stages
   - popup close / reopen / inner scroll behavior
   - dedicated workspace route with tender-id preselection
   - stakeholder save/revert browser checks
   - communication queue behavior in-browser

2. Continue CRM polish only if runtime evidence justifies it:
   - verify relationship cards are not redundant
   - verify communication queue is helpful rather than noisy

3. If repo wiring becomes available:
   - attach this workspace to a real git repo
   - ensure Codex GitHub app has access
   - use `.github/workflows/playwright.yml` for remote browser verification

## Known Environment Notes

- Browser launch is no longer blocked locally.
- `git` is still not on PATH.
- This workspace still does not expose a `.git` directory.
- GitHub connector/repo publishing path is still blocked by repo wiring, not by Tendering code.
- `rg.exe` may still fail in this environment; prefer PowerShell search when needed.
- `tsx prisma/seed.ts` can still hit `spawn EPERM`.

## Instructions For The Next AI Agent

- Work only in `C:\Dev\ProjectOperations`.
- Trust `docs/continuation-log.md` as the compact source of truth.
- Do not update `docs/continuation-log.md` unless the user explicitly asks.
- Start by extending Playwright coverage for the remaining Tendering runtime gaps:
  - board drag/drop
  - popup modal behavior
  - dedicated workspace route with tender-id context
  - stakeholder save/revert browser checks
- Do not casually re-merge popup and dedicated workspace modes.
- Do not introduce schema changes unless runtime evidence clearly requires them.
