---
premise: ! test -f apps/web/src/pages/tenders/CapacityBoardPage.tsx
premise_means: The capacity board UI (allocator board, estimator self-view, delegation config editor) does not exist yet.
scope:
  - apps/web/src/pages/tenders/CapacityBoardPage.tsx
  - apps/web/src/components/allocation/EstimatorGrid.tsx
  - apps/web/src/components/allocation/UnallocatedPanel.tsx
  - apps/web/src/components/allocation/RejectModal.tsx
  - apps/web/src/components/allocation/DelegateWindowEditor.tsx
  - apps/web/src/hooks/useCapacityBoard.ts
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/tenders/CapacityBoardPage.tsx && test -f apps/web/src/components/allocation/EstimatorGrid.tsx && test -f apps/web/src/components/allocation/RejectModal.tsx
size: 8
gate_allow: none
seed_only: false
escalates: false
requires_on_main: apps/api/src/modules/tendering/capacity.service.ts :: getAllEstimatorsSummary
---

# EW-5: Capacity board UI + allocation actions + delegation config UI

**Binding plan:** `docs/plans/estimator-allocation-workload-plan.md` (read sections 3.8, 8, and 10
in full before starting). This is the fifth and final slice of the estimator allocation workflow
cluster.

**Gate:** EW-4 (capacity board API) must be on main. Verify that `GET /tenders/capacity-board`
exists (grep `capacity-board` in `allocation.controller.ts` or `tendering.controller.ts`) before
starting.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- EW-4 added: `GET /tenders/capacity-board`, `GET /tenders/capacity-board/suggest`,
  `GET /tenders/allocations/:id/history`, `PUT /tenders/capacity-board/estimators/:userId/capacity`.
- EW-2 added: `POST /tenders/allocations/:id/allocate-single`, `allocate-pool`, `self-claim`,
  `reject`, `override`, `transfer`, `push-back`.
- Existing tenders list page is at `apps/web/src/pages/tenders/` — read the existing page
  structure before adding new routes to understand naming and routing conventions.
- Read the existing React query/hook patterns in the tenders module before creating new hooks.
  Reuse the same API client utilities (axios wrapper or fetch hook — check what exists).
- `tenders.allocate` and `tenders.manage` are the two permission gates. Use the existing
  `usePermissions` hook (or equivalent) to gate UI elements. Do NOT hardcode user IDs or role names.
- Anti-fatigue (plan §3.8): cap visible alerts in the board to avoid overwhelming the allocator.
  Aggregate status messages where appropriate.

## What to build

### 1. Route and page shell — `apps/web/src/pages/tenders/CapacityBoardPage.tsx`

Add a route `/tenders/capacity` (or `/tenders/allocation` — match the pattern of other tenders
sub-pages; read `apps/web/src/App.tsx` or the router file to confirm). Guard with
`tenders.allocate` — users without this permission see a "no access" state, not a 404.

The page has two tabs:
- **Board** (allocator view, requires `tenders.allocate`): `EstimatorGrid` + `UnallocatedPanel`.
- **My Queue** (estimator self-view, requires `tenders.manage`): filtered to `req.user` tenders.

### 2. `useCapacityBoard` hook — `apps/web/src/hooks/useCapacityBoard.ts`

A React Query hook that:
- Fetches `GET /tenders/capacity-board` (the full board summary).
- Provides mutation functions for `allocateSingle`, `allocatePool`, `override`, `pushBack`,
  `updateCapacity`.
- Provides `refetch` so mutation callbacks can refresh the board.
- Follows the existing hook patterns in `apps/web/src/hooks/` — read two existing hooks first.

### 3. `EstimatorGrid` — `apps/web/src/components/allocation/EstimatorGrid.tsx`

A data grid/table (reuse the existing table component pattern — do not add a new library):
- Rows: each active estimator.
- Columns: display name, load score, effective capacity, utilization % (with a colour-coded
  overload indicator — red badge when `isOverloaded`), open tender count, availability %.
- Row action: "Assign tender" button that opens a tender picker (can be a simple select/combobox
  over the UNALLOCATED tenders list from the board response).
- Clicking a row opens a slide-over or modal showing that estimator's open tenders.

### 4. `UnallocatedPanel` — `apps/web/src/components/allocation/UnallocatedPanel.tsx`

A panel listing UNALLOCATED tenders from the board response:
- Each row: tender title, client name (from existing tender data shape), age (time since
  `allocationState` became UNALLOCATED — use `updatedAt` as the proxy), suggested estimator name
  (from `suggestedEstimatorId` in the board response).
- Actions: "Assign" (triggers `allocateSingle` with the suggested estimator pre-populated but
  editable), "Pool" (triggers `allocatePool` with a multi-select of estimators).

### 5. `RejectModal` — `apps/web/src/components/allocation/RejectModal.tsx`

A modal rendered in the estimator self-view (My Queue tab):
- A required `<textarea>` for the rejection reason. Disable the submit button when reason is empty.
- On submit: calls `POST /tenders/allocations/:id/reject` with the reason.
- On success: removes the tender from the estimator's queue list without a full page reload.

### 6. Self-claim button (estimator self-view)

In the My Queue tab, for tenders with `allocationState = UNALLOCATED` or `POOL`:
- Show a "Claim" button.
- On click: calls `POST /tenders/allocations/:id/self-claim`.
- On `409 Conflict` response: show a toast "This tender was just claimed by someone else."
- On success: update the tender's displayed state to `CLAIMED`.

### 7. `DelegateWindowEditor` — `apps/web/src/components/allocation/DelegateWindowEditor.tsx`

Rendered in a settings sub-section of the capacity board (accessible only with `tenders.allocate`):
- List of existing delegate windows (active and future): delegate name, start/end dates, granted by.
- Form to create a new window: user picker (all users with `tenders.manage`), date range picker
  (start/end). Start date must be <= end date. End date must be in the future.
- Delete button to revoke a window early (soft-delete or hard-delete — match the API's
  delete endpoint; if EW-4 did not add a delete endpoint, add `DELETE /tenders/allocations/delegates/:id`
  to `AllocationController` in this slice).

## Do NOT

- Do NOT add a new Prisma model or migration. All schema is from EW-1.
- Do NOT call `NotificationsService` directly from the frontend — alerts are backend-only (EW-3).
- Do NOT hardcode any user ID or role name. Use the permission system.
- Do NOT add a new UI component library. Reuse the existing component patterns.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if `CapacityBoardPage.tsx` already exists on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
