# Sprint 8 Handover

Date: 2026-04-14
Workspace: `C:\Dev\ProjectOperations`

## Summary

This sprint continued Tendering CRM refinement, added repo-local Playwright browser-verification scaffolding, deepened workspace communication/stakeholder context, and debugged repeatability issues in the local seed path.

The continuation log was intentionally not updated in this session.

## What Was Done

- Added Tendering browser-verification scaffolding with Playwright.
- Added Tendering smoke coverage for login + core Tendering route checks.
- Extended Tendering pipeline filters with probability-band filtering.
- Strengthened pipeline/register context with last-touch and overdue/open activity signals.
- Added card-level `Add activity` shortcuts from board/list/forecast into workspace activity mode.
- Added focused activity views in workspace:
  - all
  - open
  - overdue
  - completed
  - by owner
- Deepened workspace stakeholder/communication context using existing backend fields:
  - stakeholder roles from `TenderClient.relationshipType`
  - relationship notes from `TenderClient.notes`
  - richer stakeholder cards in overview and workspace rail
  - communication summary panel in workspace rail
- Fixed a real idempotency bug in the seed flow for converted jobs.
- Removed the accidental root dependency `flag`.

## Key Fixes

### 1. Tendering browser verification harness

Created repo-local Playwright setup so Tendering browser verification can be run from the workspace once browser execution is allowed.

Added:
- root Playwright config
- Tendering E2E smoke spec
- root script: `pnpm test:tendering:e2e`

### 2. Seed idempotency fix

The converted-job seed path used `create` against a unique `jobNumber`, which could fail on reseed if partial prior data existed.

Fixed:
- converted job now uses `upsert`
- job conversion now uses `upsert`

This makes the seed logic materially safer for repeatable local setup, though the seed command still hits the known `spawn EPERM` path in this environment through `tsx`/`esbuild`.

### 3. Workspace communication/stakeholder enrichment

The backend already supported stakeholder role and notes through `TenderClient.relationshipType` and `TenderClient.notes`, but the workspace did not surface them.

Now surfaced in UI:
- stakeholder role labels
- stakeholder notes
- richer relationship cards
- communication summary tied back to unified activity/ownership context

## Files Created

- [playwright.config.ts](C:\Dev\ProjectOperations\playwright.config.ts)
- [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts)

## Files Changed

- [package.json](C:\Dev\ProjectOperations\package.json)
- [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx)
- [tendering-page-helpers.ts](C:\Dev\ProjectOperations\apps\web\src\pages\tendering-page-helpers.ts)
- [styles.css](C:\Dev\ProjectOperations\apps\web\src\styles.css)
- [seed.ts](C:\Dev\ProjectOperations\apps\api\prisma\seed.ts)

## Validation / Debug Results

Passed:
- `pnpm --filter @project-ops/api build`
- `pnpm test:api:serial`
- `pnpm --filter @project-ops/web exec tsc -p . --noEmit`
- `pnpm test:web:logic`
- `pnpm exec playwright --version`
- `pnpm exec playwright test --list`

Failed due environment:
- `pnpm test:tendering:e2e`
  - blocker: Chromium launch fails with `spawn EPERM`
- `pnpm seed`
  - blocker: `tsx`/`esbuild` hits `spawn EPERM`

## Current State

- Tendering code is functionally ahead of the last browser-verified point.
- Playwright is installed and the Tendering smoke suite exists.
- Playwright test discovery works.
- Actual browser execution is blocked by environment policy, not missing code.
- Tendering workspace now has stronger CRM-style stakeholder and communication context.
- Seed path is more correct and more idempotent than before.

## Roadmap / Recommendations

### Immediate next step

Unblock browser execution in the environment, then run:

```powershell
pnpm test:tendering:e2e
```

### Browser-verification focus areas

Verify:
- `/tenders`
- `/tenders/pipeline`
- `/tenders/create`
- `/tenders/workspace`
- board drag/drop
- popup workspace behavior
- dedicated workspace route rendering
- probability filter behavior
- card-level `Add activity` flows
- activity owner/view filters
- stakeholder role/note editing
- communication-view rail content

### After runtime verification

If runtime is clean:
- continue CRM polish in workspace communication/stakeholder surfaces
- make stakeholder cards denser if they feel too tall
- refine distinctions such as:
  - procurement contact
  - approver
  - reviewer
  - awarded party
- keep communication context anchored to unified activity model

If stakeholder editing feels too chatty in-browser:
- move immediate persistence from `onChange` to `onBlur` or explicit save
- avoid schema changes unless clearly necessary

If popup workspace behavior is wrong:
- fix `mode="full"` only
- do not merge popup and dedicated workspace shells again

## Notes For The Next AI Agent

- Work only in `C:\Dev\ProjectOperations`.
- Do not use the SharePoint-synced workspace.
- Do not update `docs/continuation-log.md` unless explicitly asked.
- The main blocker is environment/browser execution permissions, not missing Tendering code.
- Treat Playwright/browser verification as the first missing step before further UI refinement.
- Do not casually rework popup-vs-dedicated workspace mode behavior.
- Do not assume green typecheck means runtime is verified.

## Suggested Start Command For The Next AI Agent

Start in `C:\Dev\ProjectOperations`. Do not update `docs/continuation-log.md` unless asked. First verify whether browser-process execution is now permitted. If yes, run `pnpm test:tendering:e2e`, inspect failures/screenshots/videos, and use those runtime findings for the next Tendering polish pass. If browser execution is still blocked, document the blocker precisely and continue only with low-risk code/debug work that does not pretend browser verification has happened.
