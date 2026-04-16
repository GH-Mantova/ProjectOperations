# Sprint 11 Handover

Date: 2026-04-14
Workspace: `C:\Dev\ProjectOperations`

## Summary

This sprint completed the pending Tendering browser-coverage pass and fixed two real UX/runtime issues discovered while stabilizing Playwright coverage:

- workspace modal reopen via `Add activity` was not preserving the intended activity tab
- stakeholder explicit `Save stakeholder` / `Revert` actions could be pre-empted by the field blur auto-save path

The Tendering browser suite now passes locally across Chromium, Firefox, and WebKit using the documented validation path.

## What Was Done

- Extended Tendering Playwright coverage to verify:
  - board drag/drop conversion prompt behavior
  - popup workspace close/reopen behavior
  - modal inner-scroll behavior
  - dedicated workspace loading via `tenderId`
  - stakeholder explicit save/revert flow
- Fixed workspace tab selection so opening a tender with `targetTab="activity"` no longer gets reset back to `overview` during tender selection.
- Fixed stakeholder blur-save behavior so explicit stakeholder action buttons are not undermined by blur-triggered saves.
- Adjusted E2E selectors to prefer runtime tender discovery instead of brittle hard-coded assumptions about seed state.

## Key Fixes

### 1. Workspace Target Tab Preservation

File:
- [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx)

Fix:
- `selectTender()` now accepts an optional target tab.
- `openTenderWorkspace()` passes the desired target tab through selection rather than setting it before a later state reset.

Why it mattered:
- `Add activity` was supposed to reopen the workspace directly into the activity tab.
- Before this fix, `selectTender()` always forced the workspace back to `overview`.

### 2. Stakeholder Explicit Action Reliability

File:
- [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx)

Fix:
- stakeholder blur-save now skips when focus is moving onto the explicit stakeholder action buttons
- a small action-intent ref was added so `Save stakeholder` and `Revert` clicks are not interrupted by the blur handler

Why it mattered:
- explicit stakeholder actions were unreliable because the textarea/select blur path could save before the button click logic ran

### 3. Tendering Browser Coverage Completion

File:
- [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts)

Fix:
- added runtime tender lookup helper
- added drag/drop prompt coverage
- added modal close/reopen plus inner-scroll coverage
- added dedicated workspace `tenderId` coverage
- added stakeholder explicit save/revert coverage

Why it mattered:
- these were the exact coverage gaps called out in the continuation work

## Files Changed

Changed:
- [TendersPage.tsx](C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx)
- [tendering.spec.ts](C:\Dev\ProjectOperations\tests\e2e\tendering.spec.ts)

Created:
- [Sprint11.md](C:\Dev\ProjectOperations\docs\Sprint11.md)

Also updated earlier in the session, but do not touch for this handover task:
- [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md)

## Validation

Verified locally:

- `pnpm --filter @project-ops/web exec -- tsc -p . --noEmit`
- `pnpm test:web:logic`
- `pnpm test:tendering:e2e`

Result:
- Tendering browser suite passed across Chromium, Firefox, and WebKit.

## Current State

Working:

- Tender dashboard, pipeline, create, and workspace routes
- CRM-style Tendering register/workspace flow
- board/list/forecast register views
- popup workspace and dedicated workspace
- board drag/drop prompt coverage
- popup modal close/reopen and inner scroll coverage
- dedicated workspace `tenderId` route loading
- stakeholder explicit save/revert browser flow
- existing route/filter/activity/relationship-map browser smoke

Known environment constraints:

- use only `C:\Dev\ProjectOperations`
- managed Windows environment
- `tsx prisma/seed.ts` is still unreliable because of recurring `spawn EPERM`
- do not rely on Vite/Vitest startup as the main validation path
- prefer the documented safe commands
- this workspace still is not a normal git checkout / PR-ready environment

## Roadmap / Recommendations

Next highest-signal work:

1. Extend browser coverage for communication queue behavior
2. Add a bit more dedicated-workspace switching coverage if it reveals real UX regressions
3. Continue CRM polish only if browser/runtime evidence shows clutter or redundancy

Avoid:

- reworking conversion plumbing without runtime evidence
- recombining popup and dedicated workspace behavior
- assuming pristine local seed state in tests

## Instructions For The Next AI Agent

Start in `C:\Dev\ProjectOperations` and continue from the local workspace only.

Do this next:

1. Read [continuation-log.md](C:\Dev\ProjectOperations\docs\continuation-log.md) for the current source of truth.
2. Trust that Tendering browser coverage is now green locally.
3. Continue with high-value browser additions only:
   - communication queue ordering and overdue labeling
   - dedicated workspace switching behavior if needed
4. Prefer runtime record discovery in Playwright rather than brittle hard-coded seeded assumptions.
5. Keep the current CRM-style route/mode split intact.

Do not do this unless runtime evidence demands it:

- schema changes
- conversion-flow rewrites
- popup/dedicated workspace shell recombination
- continuation log edits for this handover request

## Short Handoff

Sprint 11 completed the Tendering browser stabilization pass. The major outcomes were:

- fixed activity-tab reopen behavior in the workspace
- fixed stakeholder explicit save/revert interactions against blur-save
- finished the previously pending Tendering Playwright coverage additions
- validated the result with the safe local commands and a passing Tendering E2E run
