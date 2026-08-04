---
premise: '! grep -rq "someone.*edited\|edit.*conflict\|presence" apps/web/src/pages/scheduler/SchedulerGridPage.tsx'
premise_means: The scheduler grid has no presence indicator or soft edit-conflict nudge yet — two people can edit the same cell/day at once with no warning.
scope:
  - apps/web/src/pages/scheduler/useSchedulerPresence.ts
  - apps/web/src/pages/scheduler/SchedulerGridPage.tsx
  - apps/api/src/modules/scheduler/realtime/**
  - apps/api/src/modules/scheduler/schedule-allocation.service.ts
  - apps/api/src/modules/scheduler/__tests__/**
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/scheduler/useSchedulerPresence.ts && grep -q "useSchedulerPresence" apps/web/src/pages/scheduler/SchedulerGridPage.tsx
size: 8
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# RT-3: Presence / soft edit-conflict indicator on the scheduler grid

**Locked design (Marco 2026-08-04, `docs/plans/realtime-websockets-plan.md`):** this is a **soft
nudge**, not live cursors and not true co-editing. "Show who else is on the same scheduler view + a
'someone edited this' nudge to prevent silent overwrites." SSE-driven, reusing RT-1's seam. Do NOT
build a live-cursor system, do NOT add a WebSocket gateway, do NOT touch Azure/App Service.

On main today (after RT-1 and RT-2 have merged): the scheduler grid is
`apps/web/src/pages/scheduler/SchedulerGridPage.tsx`; it already refetches via `load()` on an SSE
event from RT-1's scheduler realtime channel (`apps/api/src/modules/scheduler/realtime/`,
`ScheduleAllocationService` emits post-commit). There is no presence concept and no "this cell/day
changed since you last looked" indicator anywhere in the grid today.

## What to build

### 1. What "presence" means here (keep it small)
- **Who's viewing:** when a user has the scheduler grid open, a lightweight "N people viewing" (or
  avatar list) indicator, sourced from who currently has an open SSE connection scoped to the
  scheduler channel. This does NOT require a new schema/model — track active connections in-memory in
  the realtime layer (same in-process, single-instance assumption RT-1 documented) and broadcast a
  presence-count/roster event when a connection opens or closes.
- **"Someone edited this" nudge:** when a `ScheduleAllocation` mutation event fires (the same
  post-commit event RT-1/RT-2 already emit) for a cell/row/date range the current user is looking at
  or has a picker/modal open on, show a small non-blocking nudge (e.g. a toast or an inline badge on
  the affected cell) that the data changed and was refetched — NOT a merge UI, NOT a lock, just
  "heads up, this just changed". This is exactly the plan doc's "soft, SSE-driven — not live cursors"
  requirement.

### 2. API — extend the realtime layer (do not fork it)
- Extend RT-1's connection registry (in `apps/api/src/modules/scheduler/realtime/`) to track a
  lightweight identity per open SSE connection (user id / name — whatever `CurrentUser` already
  exposes) so a presence-count/roster can be derived and broadcast on connect/disconnect. Do not add
  a new endpoint if the existing `GET /scheduler/realtime/stream` connection lifecycle already gives
  you a natural connect/disconnect hook — extend that file, don't duplicate it.
- No new emit-after-commit logic is needed beyond what RT-1/RT-2 already added to
  `schedule-allocation.service.ts` — the presence nudge consumes the SAME
  `scheduler.allocation.changed` event RT-1 emits; you are adding a client-side reaction to an
  existing event stream, not a new server-side event type, unless you find you genuinely need to
  carry which cell/date changed (in that case, extend the event payload additively — do not change
  its existing shape for RT-1/RT-2 consumers).

### 3. Web — presence hook + UI
- New `apps/web/src/pages/scheduler/useSchedulerPresence.ts`: wraps/extends RT-1's realtime hook
  (`useSchedulerRealtime.ts`) to also surface (a) a live viewer count/roster from presence events and
  (b) a callback fired when a change-event lands, so `SchedulerGridPage.tsx` can flash/badge the
  affected area and show a small transient toast. Reuse the existing `EventSource` connection RT-1
  opened — do not open a second SSE connection from the same page.
- Wire it into `SchedulerGridPage.tsx`: a small "N viewing" indicator near the grid header, and a
  transient inline badge/toast on the affected row(s) when a change lands while the user has that row
  in view. Keep it visually minimal — this is a nudge, not a notification centre.

### 4. Tests
- API: test that connection registry correctly tracks connect/disconnect counts (mock the SSE
  request/response lifecycle the way RT-1's test does).
- Web: a focused test for `useSchedulerPresence`'s callback wiring is a bonus but not required if it
  would need a fuller `EventSource` test harness than the repo currently has — do not add a new test
  framework dependency just to get one test passing.

## Do NOT
- Do NOT build live cursors, real-time collaborative cell editing, or operational-transform/merge
  logic — explicitly out of scope per the locked plan.
- Do NOT add a WebSocket gateway or socket library.
- Do NOT touch Azure, App Service configuration, Entra, or SharePoint.
- Do NOT add a Redis/pub-sub backplane.
- Do NOT change `apps/api/prisma/schema.prisma` or add a migration — presence state is in-memory only,
  never persisted.
- Do NOT touch the safety module/muster — RT-2's surface, already merged.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if a presence indicator already exists on main, say
  `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must pass.
