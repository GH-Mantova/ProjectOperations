# Sprint 6 Handover

This document exports the work completed in this chat for the next AI agent. It is intentionally separate from `C:\Dev\ProjectOperations\docs\continuation-log.md`, which was not updated as part of this request.

## Ultimate Goal

Continue evolving the ERP toward a cleaner CRM-style tender pipeline and workspace experience, with:

- a more compact and readable tender register
- reliable drag/drop lifecycle control across tender stages
- a unified tender-to-job conversion workflow with safe recovery paths
- a clearer separation between register view and tender workspace behavior

## What Was Completed

### Tender lifecycle and drag/drop

- Fixed drag/drop so tenders can move across pre-award, awarded, contract, and converted stages.
- Enabled rollback from later stages back to earlier stages.
- Added logic so moving back to pre-award clears awarded state while keeping client details attached to the tender.
- Added client-selection popup when moving into awarded/contract/converted without a safe awarded client already set.
- Added cancel/abort paths so accidental drops do not mutate state.
- Added same-client confirmation flow for rollback from contract/converted to awarded or contract.

### Tender to job conversion

- Added confirmation flow before converting a tender into a live job.
- Changed converted rollback behavior from delete to archive, so Jobs/Scheduler history is preserved.
- Added archived-job conflict handling:
  - if a matching archived job already exists, prompt whether this is a new stage
  - if yes, collect stage name and reuse the archived job
  - if no, stop and instruct the user to change tender details
- Fixed the backend reuse path so archived jobs are reactivated correctly instead of failing duplicate checks.
- Fixed active/archive job register behavior so reactivated jobs can appear in the active Jobs view.

### Layout and UI compaction

- Compacted the tender pipeline header, controls, and filter layout.
- Removed multiple summary/status strips that were wasting vertical space.
- Capped search width and redistributed controls to use horizontal space more efficiently.
- Reworked top toolbar spacing so stage, momentum/owner, due/value/relationship filters, actions, and summary value fit more naturally.
- Moved KPI tiles into the main card header area so they align with the title/subtitle instead of floating below.

### Workspace popup attempt

- Removed the always-open workspace panel from the main tender register flow in code.
- Added modal-style state and double-click handlers intended to open tender workspace as a popup from the full register view.
- Added modal wrapper styling and close controls.

## Key Fixes

### Jobs conversion fixes

- `convert-to-job` now returns enough conflict metadata to support archived-job reuse.
- Archived-job reuse now uses the exact archived job identity instead of relying on fragile rediscovery.
- Reused archived jobs are reactivated and linked back to the tender.
- New stages can be created under an archived/reused job.
- Job listing logic now better distinguishes active vs archived jobs.

### Award/client workflow fixes

- Award/client selection is now part of the drag/drop flow when required.
- Rollback flows from contract/converted preserve or replace awarded client intentionally instead of silently failing.

### CRM register UX fixes

- Significant reduction in wasted top-of-page space.
- Filters and actions were consolidated into denser, more CRM-like rows.

## Files Created or Changed

Primary implementation files touched during this sprint:

- `C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx`
- `C:\Dev\ProjectOperations\apps\web\src\styles.css`
- `C:\Dev\ProjectOperations\apps\api\src\modules\jobs\jobs.service.ts`
- `C:\Dev\ProjectOperations\apps\api\src\modules\jobs\jobs.service.spec.ts`
- `C:\Dev\ProjectOperations\apps\api\src\modules\jobs\dto\job-conversion.dto.ts`

Important reference/debug files:

- `C:\Dev\ProjectOperations\apps\web\src\App.tsx`
- `C:\Dev\ProjectOperations\apps\web\src\pages\TenderWorkspacePage.tsx`
- `C:\Dev\ProjectOperations\docs\continuation-log.md`

This handover file created for Sprint 6:

- `C:\Dev\ProjectOperations\docs\Sprint6.md`

## System Mapping

### UI entry points

- `C:\Dev\ProjectOperations\apps\web\src\App.tsx`
  - owns route wiring
  - `/tenders` leads into the full CRM/tender register experience
  - `/tenders/workspace` routes to the dedicated workspace page

- `C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx`
  - central tender CRM page
  - owns register/list/forecast/pipeline UI
  - owns drag/drop interactions
  - owns most tender-stage modal logic
  - owns conversion flow triggers and popup orchestration
  - now contains modal-opening logic for workspace in `mode="full"`

- `C:\Dev\ProjectOperations\apps\web\src\pages\TenderWorkspacePage.tsx`
  - wrapper page for dedicated workspace route
  - currently renders `TendersPage` with `mode="workspace"`

- `C:\Dev\ProjectOperations\apps\web\src\styles.css`
  - shared styling for the tender register and workspace layout
  - contains all recent compaction and modal styling work

### API / backend conversion flow

- `C:\Dev\ProjectOperations\apps\api\src\modules\jobs\jobs.service.ts`
  - core job creation, archived-job reuse, rollback/archive behavior
  - source of truth for tender-to-job conversion side effects

- `C:\Dev\ProjectOperations\apps\api\src\modules\jobs\dto\job-conversion.dto.ts`
  - payload shapes for conversion/reuse flows

- `C:\Dev\ProjectOperations\apps\api\src\modules\jobs\jobs.service.spec.ts`
  - regression coverage for conversion, reuse, and rollback behavior

### Relationship summary

- Tender register UI triggers drag/drop and modal decisions in `TendersPage.tsx`.
- Conversion actions call Jobs API service flows.
- Jobs service creates/reactivates/archives jobs and stages.
- Dedicated workspace route is structurally separate from the full register route.

## What Is Working

- Drag/drop across tender lifecycle stages is working in the main CRM flow.
- Award/client selection flows are working.
- Contract/converted rollback flows are working.
- Archived-job “new stage” reuse path was repaired and confirmed working by the user.
- New-job conversion path works.
- Layout is noticeably more compact than before.

## Known Issue Still Open

### Workspace popup behavior is not complete

The tender workspace still does not consistently behave like a popup window in the way the user wants.

#### Root cause already identified

- The popup logic was added to `TendersPage.tsx` for `mode="full"`.
- The dedicated route `/tenders/workspace` still renders `TenderWorkspacePage.tsx`.
- `TenderWorkspacePage.tsx` renders `TendersPage` with `mode="workspace"`.
- In that mode, inline workspace rendering is still expected.

#### Practical meaning

If testing is happening on `/tenders/workspace`, the workspace appearing inline at the bottom is not a CSS bug alone. It is a route/mode architecture issue.

## What Did Not Work and What Was Done to Fix It

### Archived-job reuse initially failed

Problem:

- Converting a tender where a matching archived job existed produced errors such as:
  - `A reusable archived job with this number and source tender was not found.`
  - job not appearing active after reuse
  - tender not visibly landing in `Converted`

Fixes made:

- switched reuse flow to carry the exact archived job identity through the UI/API path
- stopped relying on a stale `sourceTenderId` lookup
- reactivated reused archived jobs properly
- improved active/archive list logic

### Workspace popup attempt was incomplete

Problem:

- after initial implementation, the workspace still appeared inline/bottom-of-page

Fix attempted:

- added modal state, double-click handlers, modal container classes, and close controls in `TendersPage.tsx`

Why issue remains:

- dedicated workspace route still intentionally renders inline workspace via `mode="workspace"`
- next sprint needs to decide whether to keep that route, redesign it, or route all workspace access through modal behavior

## Validation Performed

Preferred safe commands used during this sprint:

```powershell
pnpm --filter @project-ops/web exec tsc -p . --noEmit
pnpm test:web:logic
pnpm --filter @project-ops/api build
pnpm test:api:serial
```

Notes:

- These commands were repeatedly used instead of relying on Vite/Vitest dev startup due to the managed Windows environment and recurring `spawn EPERM` behavior.
- Browser/runtime confirmation was still necessary for some UI behaviors.

## Current State

- Tender pipeline lifecycle logic is substantially improved and user-confirmed for the major drag/drop and conversion cases.
- Jobs conversion and archived-job stage reuse are functioning again.
- Register layout is more condensed.
- The remaining important UX/architecture gap is the tender workspace behavior:
  - user wants the workspace removed from inline page layout
  - user wants it opened as a popup on double click
  - current implementation only partially moves toward that behavior

## Roadmap / Recommended Next Steps

1. Finish the workspace popup architecture.
2. Decide whether `/tenders/workspace` should:
   - remain a dedicated full-page route, or
   - be deprecated in favor of modal-only workspace access from `/tenders`, or
   - support both explicitly with clearer intent
3. If popup behavior remains the goal, refactor `TenderWorkspacePage.tsx` and route handling so inline `mode="workspace"` does not conflict with modal expectations.
4. After route behavior is settled, do a focused polish pass on modal sizing, backdrop, z-index, and close interactions.
5. Continue CRM-style refinement on the register once the workspace interaction model is stable.

## Clear Instructions For The Next AI Agent

Start by reading:

- `C:\Dev\ProjectOperations\docs\continuation-log.md`
- `C:\Dev\ProjectOperations\docs\Sprint6.md`

Then inspect these files before making changes:

- `C:\Dev\ProjectOperations\apps\web\src\App.tsx`
- `C:\Dev\ProjectOperations\apps\web\src\pages\TendersPage.tsx`
- `C:\Dev\ProjectOperations\apps\web\src\pages\TenderWorkspacePage.tsx`
- `C:\Dev\ProjectOperations\apps\web\src\styles.css`

Do not redo the tender-to-job conversion fixes unless runtime evidence proves a regression. Those flows were already repaired and user-confirmed.

Focus next on the workspace interaction model:

- verify whether the user is testing `/tenders` or `/tenders/workspace`
- resolve the route/mode split so the workspace behaves as the intended popup experience
- keep using the safe validation commands instead of relying on local Vite startup

Do not update `C:\Dev\ProjectOperations\docs\continuation-log.md` unless the user explicitly asks for it.

Start from the workspace route/mode split and finish the popup behavior cleanly.
