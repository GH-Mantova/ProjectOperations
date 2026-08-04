# SLICE-0 plan — Real-time updates (websockets) for scheduler + safety

**Status:** PLAN ONLY (Marco 2026-08-04). Justification: 2+ people are logged in editing/checking the
scheduler at once, so stale-until-refresh boards cause collisions. No sub-slice armed.

## Problem / goal

Push live changes so a scheduler reallocation or a logged safety hazard updates every open screen
instantly, without refresh. Scope v1 = scheduler (allocations) + safety (hazard/incident + muster).

## Current state

Boards update on navigate/refetch only. Stack is NestJS (API) + React (web); auth is JWT. No realtime
transport exists today.

## ⛔ Infra dependency (Marco / Azure — hard stop)

Azure App Service must have **WebSockets enabled** (App Service setting) for a socket transport to work.
That is an Azure config change → **Marco only** (Azure/Entra/App-Service hard stop). The build can be
written and tested locally, but going live needs Marco to flip that setting. If we prefer to avoid the
Azure dependency, the fallback transport is **SSE (server-sent events)** over plain HTTP — one-way
push, which covers "someone else changed it, refresh this row" without App Service config.

## Design (decision needed at build time)

- **Transport:** NestJS `@WebSocketGateway` (socket.io) if WebSockets are enabled; else SSE fallback.
  Recommend deciding this with Marco when WS-1 is armed.
- **Auth:** reuse the JWT on the socket handshake; reject unauthenticated. Never open an unauthenticated channel.
- **Rooms:** one channel per resource scope (e.g. `scheduler:site:{id}`, `safety:site:{id}`) so a client
  only receives events for what it's viewing. Server emits on mutation (after the DB write commits).
- **Client:** a thin realtime hook that invalidates/refetches the affected query on an event (do NOT try
  to merge server state optimistically in v1 — event says "this changed", client refetches). Explicit,
  simple, conflict-safe.

## Sub-slices (ordered)

- **WS-1 — transport + auth + scheduler allocations channel** (`feat/realtime-scheduler`). Gateway/SSE
  endpoint, JWT handshake, emit on ScheduleAllocation mutation, client hook refetches the grid. Proof of
  the whole path on one surface. Premise: no realtime gateway/SSE endpoint on main.
- **WS-2 — safety live** (`feat/realtime-safety`). Hazard/incident + muster events push to the safety
  board + muster headcount widget. Dep: WS-1.
- **WS-3 — presence / edit-conflict indicator** (`feat/realtime-presence`). Show who else is on the same
  scheduler view + a "someone edited this" nudge to prevent silent overwrites. Dep: WS-1.

## Risks

- **Single-instance assumption:** one App Service instance = in-process rooms are fine; if we ever scale
  out, a shared adapter (Redis) is needed. Note it; don't build it in v1.
- **Auth on the socket** is the security-critical bit — cover it with tests in WS-1.
- Reconnect/backoff + fall back to normal polling if the socket drops (never leave the board frozen).

## Start

Arm **WS-1** first, but confirm the transport (WebSocket vs SSE) with Marco at arm time, since it
depends on whether he'll enable App Service WebSockets.
