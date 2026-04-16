# Sprint 5 Handover

Date: 2026-04-14
Workspace: `C:\Dev\ProjectOperations`

## Purpose

This document hands the current tendering/UI work to the next AI agent without requiring it to reconstruct the sprint from chat history.

## Summary Of Work Done

- Continued ERP tendering work from the local workspace only.
- Read and followed the local continuation log as the initial source of truth.
- Extended CRM-style Tender Workspace work in `apps/web/src/pages/TendersPage.tsx` and `apps/web/src/styles.css`.
- Added/refined:
  - stronger Tender Workspace overview modules
  - stronger right-rail/deal-sidebar treatment
  - `Deal pulse` summary/pulse sections
  - multiple pipeline/workspace layout experiments
  - multiple board drag/drop experiments
- Performed a deeper runtime/debug pass when the visible UI did not match edited source.

## Key Fixes Attempted

### 1. Tender Workspace CRM pass

Work was added in `apps/web/src/pages/TendersPage.tsx` and `apps/web/src/styles.css` to push the Tender Workspace closer to a CRM deal-detail page:

- richer overview summaries
- relationship/contact snapshot cards
- stronger right rail
- `Deal pulse` section

### 2. Pipeline / workspace layout experiments

Several layout passes were attempted in `apps/web/src/styles.css`:

- widened left/right split
- stacked pipeline/workspace layout
- explicit card heights
- explicit internal scroll regions

These changes were aimed at:

- making Tender Pipeline wider/full-width
- making Tender Workspace fill the remaining screen area
- restoring dedicated scroll behavior in both areas

### 3. Board drag/drop experiments

Several board drag/drop implementations were attempted in `apps/web/src/pages/TendersPage.tsx`:

- native HTML drag source
- draggable visible card surface
- `dataTransfer`-based tender id handoff
- highlighted stage columns
- `dragend`-based fallback move

These did not produce a reliable visible drop result in the runtime the user was testing.

### 4. Resolver/runtime investigation

This sprint’s most important debugging result:

- the visible runtime almost certainly did not match the edited `.tsx` source files
- stale sibling `.js` files exist beside the `.tsx` files in `apps/web/src/pages`
- `vite.config.ts` was updated so Vite prefers `.tsx/.ts` before `.js`

This was done because the user still saw old board buttons and old tendering UI after the `.tsx` edits were made.

## Files Created / Changed

Created:

- `C:\Dev\ProjectOperations\docs\Sprint5.md`

Changed during this sprint:

- `C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx`
- `C:\Dev\ProjectOperations\apps\web\src\styles.css`
- `C:\Dev\ProjectOperations\apps\web\vite.config.ts`

Also updated during this sprint:

- `C:\Dev\ProjectOperations\docs\continuation-log.md`

Do not update `continuation-log.md` further unless the user explicitly asks.

## Critical Findings

### A. Route/source mismatch risk

`/tenders` is routed from:

- `apps/web/src/App.tsx`

to:

- `apps/web/src/pages/TenderingDashboardPage.tsx`

not directly to `TendersPage.tsx`.

### B. Stale sibling `.js` files exist beside `.tsx`

Examples confirmed during debug:

- `apps/web/src/pages/TendersPage.js`
- `apps/web/src/pages/TenderingDashboardPage.js`
- `apps/web/src/pages/CreateTenderPage.js`
- `apps/web/src/pages/TenderWorkspacePage.js`

This is likely the main reason edited `.tsx` changes did not match the visible UI.

### C. Old board buttons are still present in stale JS

The old inline board-stage buttons (`Draft`, `Estimating`, `Submitted`) were confirmed in:

- `apps/web/src/pages/TendersPage.js`

This matched the user screenshots.

### D. Current `.tsx` board markup did not match the visible runtime

`apps/web/src/pages/TendersPage.tsx` no longer matched the old board-card button UI seen by the user, which strongly suggests the runtime was not rendering the intended `.tsx` source.

## What Did Not Work

- Editing `TendersPage.tsx` alone did not reliably change the visible tender UI.
- Removing board-stage buttons from `TendersPage.tsx` did not remove them from the user-visible screen.
- Native browser drag/drop attempts did not produce a working stage-drop interaction in the user-visible board.
- Highlighted drop-zone experiments did not solve the underlying runtime mismatch.

## What Is Working

- Safe validation commands continued to pass after each change:
  - `pnpm --filter @project-ops/web exec tsc -p . --noEmit`
  - `pnpm test:web:logic`
  - `pnpm --filter @project-ops/api build`
  - `pnpm test:api:serial`
- `vite.config.ts` now prefers `.tsx/.ts` before `.js`
- `TendersPage.tsx` contains a much richer CRM-style workspace implementation than the stale UI seen in screenshots

## Current State

The workspace contains useful CRM-style Tender Workspace improvements in source, but the visible tender UI the user tested still appeared to come from an older implementation path.

The highest-confidence current assessment is:

- the next agent should treat runtime/source verification as the first task
- the next agent should not continue drag/drop or board UX work until the actual rendered tender module is confirmed

## Roadmap / Recommendations

### Immediate priority

1. Verify exactly which file the running tender UI is rendering.
2. Confirm whether the running environment is still resolving stale `.js` page files.
3. Confirm whether a running/stale bundle must be refreshed/restarted before more UI debugging.

### After runtime/source is proven

1. Re-test whether old board-stage buttons are still present.
2. Re-test whether the richer CRM-style workspace changes in `TendersPage.tsx` are visible.
3. Only then resume:
  - board drag/drop
  - board cleanup
  - final pipeline/workspace sizing
  - activity tab grouping polish

## Clear Instructions For The Next AI Agent

Start in `C:\Dev\ProjectOperations`.

Use only the local workspace.

Do not update `C:\Dev\ProjectOperations\docs\continuation-log.md` unless the user explicitly asks.

Before making any more tender UI changes:

1. Verify which page/module the running tender UI is actually rendering.
2. Confirm whether stale sibling `.js` files in `apps/web/src/pages` are shadowing the `.tsx` files.
3. Confirm whether the active `/tenders` view is coming from `TenderingDashboardPage`, `TendersPage`, or stale compiled/cached JS.

Only after that runtime/source mapping is confirmed should you continue tender UX work.

If the runtime is confirmed to be using the intended `.tsx` files, then resume with:

1. removing any remaining old board-stage buttons from the actual rendered page
2. implementing reliable board drag/drop on the actual rendered page
3. continuing CRM-style workspace refinement

## Validation Commands

Use only these validation commands:

```powershell
pnpm --filter @project-ops/api build
pnpm test:api:serial
pnpm --filter @project-ops/web exec tsc -p . --noEmit
pnpm test:web:logic
```
