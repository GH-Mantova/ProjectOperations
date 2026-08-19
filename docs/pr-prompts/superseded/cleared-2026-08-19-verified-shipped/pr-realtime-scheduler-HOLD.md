---
premise: '! grep -rq "EventSource\|text/event-stream" apps/api/src/modules/scheduler'
premise_means: No SSE (Server-Sent Events) realtime endpoint exists yet on the scheduler module — the scheduler grid only refreshes on manual reload/re-fetch.
scope:
  - apps/api/src/modules/scheduler/realtime/**
  - apps/api/src/modules/scheduler/schedule-allocation.service.ts
  - apps/api/src/modules/scheduler/scheduler.module.ts
  - apps/web/src/pages/scheduler/useSchedulerRealtime.ts
  - apps/web/src/pages/scheduler/SchedulerGridPage.tsx
  - apps/api/src/modules/scheduler/__tests__/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/scheduler/realtime/scheduler-realtime.controller.ts && grep -q "text/event-stream" apps/api/src/modules/scheduler/realtime/scheduler-realtime.controller.ts
size: 8
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# RT-1: SSE transport + auth + scheduler allocations realtime channel

**Locked design (Marco 2026-08-04, `docs/plans/realtime-websockets-plan.md` on main):** transport =
**Server-Sent Events (SSE)**, NOT WebSockets. The need is one-way server→client push ("something
changed, refresh this") — clients still mutate via normal REST. SSE needs no Azure App Service
change and the browser `EventSource` auto-reconnects. **Do NOT build a WebSocket gateway, do NOT
touch any Azure/App-Service config.**

On main today: `apps/api/src/modules/scheduler/schedule-allocation.controller.ts` exposes
`POST /scheduler/allocations`, `POST /scheduler/allocations/range`, `DELETE
/scheduler/allocations/:id` backed by `ScheduleAllocationService` (`schedule-allocation.service.ts`),
guarded by `JwtAuthGuard` + `PermissionsGuard` (`apps/api/src/common/auth/jwt-auth.guard.ts`,
`permissions.guard.ts`). The grid UI is `apps/web/src/pages/scheduler/SchedulerGridPage.tsx`, which
holds a `load()` callback (`useCallback`) that re-fetches `/scheduler/allocations?from=...&to=...` and
sets `cells` state — this is the exact function a realtime event should trigger. There is currently
no SSE/streaming endpoint anywhere in the codebase.

This slice proves the whole path on ONE surface (scheduler allocations) so RT-2 (safety) and RT-3
(presence) can reuse the seam without re-inventing it.

## What to build

### 1. API — SSE endpoint (`apps/api/src/modules/scheduler/realtime/`)
- New file `scheduler-realtime.controller.ts` exposing `GET /scheduler/realtime/stream` (or similar,
  your call on exact path) that:
  - Sets response headers for SSE (`Content-Type: text/event-stream`, `Cache-Control: no-cache`,
    `Connection: keep-alive`) and keeps the connection open, writing `data: ...\n\n` frames.
  - **Auth on the SSE request is the security-critical bit.** A native browser `EventSource` cannot
    set an `Authorization` header, so accept the JWT as a query parameter (e.g. `?token=...`) and
    validate it through the SAME verification the existing `JwtAuthGuard`/JWT strategy uses (do not
    invent a second auth mechanism — extract/reuse the underlying verify call). Reject with 401 on a
    missing/invalid/expired token before opening the stream. Add a unit/integration test proving an
    unauthenticated or bad-token request is rejected and never opens a stream.
  - Scopes the stream — accept a query param identifying what the client is watching (e.g.
    `?scope=scheduler` today; design it so RT-2 can pass a different scope value on the same seam
    without changing this file's shape).
  - Sends periodic heartbeat/comment frames (e.g. `:\n\n`) so the connection doesn't idle-timeout
    through any intermediary proxy.
- New `scheduler-realtime.service.ts` (or an emitter class) providing an `emit(event)` method other
  services can call. Keep fan-out **in-process** (single App Service instance today — this is a known,
  accepted limitation per the plan doc; do NOT build a Redis/pub-sub backplane, that is explicitly
  out of scope for v1).
- Wire both into `scheduler.module.ts` (mirror how `ScheduleAllocationController` /
  `AvailabilityReportController` are already registered there).

### 2. Emit after the DB write commits
In `schedule-allocation.service.ts`, after each successful mutation (`upsert`, `range`, `remove`) —
**strictly after the Prisma write/transaction has committed**, not before and not inside the
transaction — call the realtime emitter with a minimal event (e.g. `{ type: "scheduler.allocation.changed" }`).
Do not put the whole allocation payload on the wire — the client hook refetches, it does not consume
event payloads as state (conflict-safe by design per the plan doc). Do not change the return shape or
status codes of the existing mutation endpoints — this is additive.

### 3. Web — client hook + wiring
- New `apps/web/src/pages/scheduler/useSchedulerRealtime.ts`: a small hook that opens an
  `EventSource` against the SSE endpoint (passing the current JWT as the query token — reuse
  whatever `useAuth()` exposes for the current access token; do not read `localStorage` directly if
  `AuthContext` already exposes the token), and on message/heartbeat calls an `onEvent` callback.
  Handle `EventSource.onerror` by letting the browser's built-in auto-reconnect do its job; do not
  hand-roll reconnect logic. Clean up (`close()`) on unmount.
- Wire it into `SchedulerGridPage.tsx`: call `useSchedulerRealtime` with a callback that invokes the
  existing `load()` function (debounce/throttle multiple rapid events into one refetch, e.g. via a
  short timeout, so a burst of writes doesn't hammer the API). Do NOT replace the existing `load()`
  polling/fetch logic — this is additive push-triggers-refetch, not a rewrite of data fetching.

### 4. Tests
- API: unit/integration test for the SSE controller's auth rejection path (see above) and a test that
  the emitter fires after a successful `ScheduleAllocationService.upsert()` (mock the emitter, assert
  it was called after the Prisma call resolves).
- Web: a test for `useSchedulerRealtime` (or the wiring in `SchedulerGridPage`) is a bonus but not
  required if it would need a fuller EventSource test harness than the repo currently has — do not
  add a new test framework dependency to get one test passing.

## Do NOT
- Do NOT build a WebSocket gateway or add a socket library (`socket.io`, `ws`, `@nestjs/websockets`).
- Do NOT touch Azure, App Service configuration, Entra, or SharePoint in any way.
- Do NOT add a Redis/pub-sub backplane — single-instance in-process fan-out is the locked v1 design.
- Do NOT change `apps/api/prisma/schema.prisma` or add a migration — this is a transport-only slice.
- Do NOT change the request/response shape of the existing `/scheduler/allocations*` REST endpoints.
- Do NOT touch the safety module or muster — that is RT-2's job, reusing this seam afterward.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if an SSE endpoint already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must pass.
