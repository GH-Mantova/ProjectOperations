# Sprint 2 Handover

Date: 2026-04-14
Workspace: `C:\Dev\ProjectOperations`

## Scope

This sprint continued Tendering development in the local workspace only.

Primary themes:
- harden verification on managed Windows
- improve Tendering UX/workflow toward a more Pipedrive-like model
- implement a first-class unified Tender activity layer without risky schema changes
- clean up the Tender Pipeline / workspace presentation

The continuation log was reviewed and used as the source of truth during this sprint, but it was not updated in this final handoff because the user explicitly requested that it remain untouched.

## What Was Done

### 1. Tendering attention and pipeline UX

Implemented and refined Tender attention-management across the Tendering experience:
- idle / rotting heuristics
- last activity
- next action
- stage age
- tender age
- estimator / due / value / client / contact / attention filtering

Added and refined:
- Tender dashboard attention signals
- stale/rotting dashboard panel
- weighted forecast by due month
- pipeline sort/export/filter tools
- workspace focus / next-actions presentation
- stage readiness messaging before key stage moves

### 2. Tender Pipeline redesign pass

Started reshaping the Tender Pipeline and workspace using Pipedrive screenshots as the reference:
- reduced the bulky KPI-ribbon feel
- introduced a slimmer pipeline summary/header
- tightened toolbar hierarchy
- calmed list/board card density
- rebalanced the workspace split toward a CRM-style rail + main canvas

This is an improvement, but it is not yet the final polish pass. The next agent should continue the visual refinement using the Pipedrive screenshots and the current layout as the new baseline.

### 3. Unified Tender Activity model in API/UI

Added a unified Tender Activity API layer over the existing persistence model so the product now has a first-class activity workflow without introducing Prisma/schema risk yet.

Implemented:
- `GET /tenders/:id/activities`
- `POST /tenders/:id/activities`
- `PATCH /tenders/:id/activities/:activityId`

Current activity behavior:
- notes, clarifications, and follow-ups are exposed as one unified activity feed
- unified activity capture exists in the Tender Workspace
- supported activities can be marked done / reopened / closed from the workspace feed

Important note:
- this is currently an adapter layer over `TenderNote`, `TenderClarification`, and `TenderFollowUp`
- there is not yet a dedicated persisted `TenderActivity` database model

### 4. Managed-Windows verification fixes

The environment repeatedly hit `spawn EPERM` on managed Windows when child processes were spawned by tools like Vite/esbuild/Jest workers.

To avoid repeating the same problem, two stable fallback verification paths were added:

#### Web no-spawn logic lane

Added a web smoke-test path that avoids Vite/Vitest/esbuild boot:
- `pnpm test:web:logic`

This compiles a small Tendering smoke test with `tsc` and runs it with plain `node`.

#### API serial Jest lane

Added a single-process API test path that avoids Jest worker fork issues:
- `pnpm test:api:serial`

## Key Fixes / Pitfalls Avoided

### Tender create/workspace load regression

Previously fixed and still important:
- do not change Tendering client/contact list requests back to `pageSize=200`
- API pagination caps at `100`
- use `Promise.allSettled` on the Tendering load path so optional refs do not take down the page

### Verification on managed Windows

Do not rely on:
- `pnpm --filter @project-ops/web test`
- default parallel Jest worker mode

Prefer:
- `pnpm --filter @project-ops/web exec tsc -p . --noEmit`
- `pnpm test:web:logic`
- `pnpm test:api:serial`
- `pnpm --filter @project-ops/api build`

### Workspace choice

Do not switch back to the SharePoint-synced workspace for active development.
Use only:
- `C:\Dev\ProjectOperations`

## Files Created / Changed

### Web

- `C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx`
- `C:\Dev\ProjectOperations\apps\web\src\pages\TenderingDashboardPage.tsx`
- `C:\Dev\ProjectOperations\apps\web\src\pages\tendering-page-helpers.ts`
- `C:\Dev\ProjectOperations\apps\web\src\pages\tendering-page-helpers.test.ts`
- `C:\Dev\ProjectOperations\apps\web\src\pages\tendering-page-helpers.smoke.ts`
- `C:\Dev\ProjectOperations\apps\web\src\styles.css`
- `C:\Dev\ProjectOperations\apps\web\tsconfig.tendering-smoke.json`
- `C:\Dev\ProjectOperations\apps\web\package.json`

### API

- `C:\Dev\ProjectOperations\apps\api\src\modules\tendering\tendering.controller.ts`
- `C:\Dev\ProjectOperations\apps\api\src\modules\tendering\tendering.service.ts`
- `C:\Dev\ProjectOperations\apps\api\src\modules\tendering\tendering.service.spec.ts`
- `C:\Dev\ProjectOperations\apps\api\src\modules\tendering\dto\tender.dto.ts`
- `C:\Dev\ProjectOperations\apps\api\package.json`

### Root / Docs

- `C:\Dev\ProjectOperations\package.json`
- `C:\Dev\ProjectOperations\docs\continuation-log.md` was updated during the sprint but should not be modified again unless the user explicitly requests it
- `C:\Dev\ProjectOperations\docs\Sprint2.md` created by this handoff

## Current State

Working now:
- API build passes
- API serial tests pass
- web typecheck passes
- web Tendering smoke logic check passes
- Tender workspace unified activity feed is present and actionable
- Tender dashboard includes stale/rotting and forecast concepts
- Tender pipeline has been visually improved from the earlier clunky ribbon-heavy state

Not fully complete yet:
- Tender Pipeline/workspace still needs another polish pass to really match the Pipedrive reference
- unified activity is first-class in API/UI but still backed by separate legacy persistence tables
- no dedicated `TenderActivity` Prisma model yet
- no persistent custom fields yet
- no bulk register update / fully configurable visible column system yet
- communication/contact panel is still lighter than the Pipedrive reference
- web Vitest/Vite startup is still not a reliable validation path in this environment

## Recommended Next Steps

1. Continue the Tender Pipeline / workspace visual refinement.
   Focus on:
   - calmer board spacing
   - tighter control hierarchy
   - stronger deal-card scanning
   - more Pipedrive-like rail + activity/history workspace composition

2. Continue the unified activity model.
   Focus on:
   - richer editing from the feed
   - clearer activity-type semantics
   - additional supported activity types
   - possibly deciding whether to keep the adapter model longer or migrate toward a true persisted `TenderActivity` table

3. Add register/list operational power.
   Focus on:
   - configurable visible columns
   - bulk actions
   - more spreadsheet-like list handling

4. Revisit persistent custom fields only after runtime stability remains good.

## Safe Command Set

From `C:\Dev\ProjectOperations`:

```powershell
pnpm --filter @project-ops/api build
pnpm test:api:serial
pnpm --filter @project-ops/web exec tsc -p . --noEmit
pnpm test:web:logic
```

## Instructions For The Next AI Agent

- Start in `C:\Dev\ProjectOperations`
- Read:
  - `C:\Dev\ProjectOperations\docs\continuation-log.md`
  - `C:\Dev\ProjectOperations\docs\Sprint2.md`
- Treat the local workspace as authoritative
- Do not use the SharePoint-synced workspace for implementation
- Do not rely on Vite/Vitest startup as the main validation path
- Use the safe command set above
- Continue from the latest Tender Pipeline / workspace polish and unified Tender Activity improvements rather than redoing already-completed work
