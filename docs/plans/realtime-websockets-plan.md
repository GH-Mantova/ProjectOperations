# SLICE-0 plan — Real-time updates for scheduler + safety

**Status:** PLAN ONLY (Marco 2026-08-04). Justification: 2+ people are logged in editing/checking the
scheduler at once, so stale-until-refresh boards cause collisions. No sub-slice armed.

**✅ DECISION LOCKED 2026-08-04 (Marco): transport = SSE (Server-Sent Events), NOT WebSockets.**
The need is one-way **server → client** push ("something changed, refresh this") — clients still mutate
via normal REST. SSE covers that over plain HTTPS, needs **no Azure App Service change**, and the
browser `EventSource` auto-reconnects. WebSockets were only warranted for true two-way live co-editing
(cursors / simultaneous cell edits with merge), which is out of scope. The client hook is
transport-agnostic, so WS can be swapped in later if a genuinely bidirectional feature ever appears.

## Problem / goal

Push live changes so a scheduler reallocation or a logged safety hazard updates every open screen
without a manual refresh. Scope v1 = scheduler (allocations) + safety (hazard/incident + muster).

## Design (locked = SSE)

- **Transport:** a NestJS **SSE** endpoint (a `GET` that streams events) per resource scope. No socket
  library, no Azure config. Reject unauthenticated — validate the JWT on the SSE request.
- **Channels/scoping:** one stream scope per resource (e.g. `scheduler:site:{id}`, `safety:site:{id}`)
  so a client only receives events for what it is viewing. The server emits an event **after the DB
  write commits** on the relevant mutation.
- **Client:** a thin realtime hook that, on an event, **invalidates/refetches** the affected query — it
  does NOT merge server state optimistically (event says "this changed", client refetches). Simple,
  conflict-safe. On stream drop, `EventSource` auto-reconnects; fall back to normal polling if needed.

## Sub-slices (ordered)

- **RT-1 — SSE transport + auth + scheduler allocations channel** (`feat/realtime-scheduler`). SSE
  endpoint, JWT auth on the request, emit on `ScheduleAllocation` mutation, client hook refetches the
  grid. Proves the whole path on one surface. Premise: no SSE realtime endpoint on main.
- **RT-2 — safety live** (`feat/realtime-safety`). Hazard/incident + muster events push to the safety
  board + muster headcount widget. Dep: RT-1.
- **RT-3 — presence / edit-conflict indicator** (`feat/realtime-presence`). Show who else is on the same
  scheduler view + a "someone edited this" nudge to prevent silent overwrites (soft, SSE-driven — not
  live cursors). Dep: RT-1.

## Risks

- **Auth on the SSE stream** is the security-critical bit — cover it with tests in RT-1.
- **Single-instance assumption:** SSE connections live in one App Service instance's memory, so
  in-process fan-out is fine **while on one instance**. If the app is ever scaled OUT to multiple
  instances, a shared pub/sub backplane (Redis) is needed so an event on one instance reaches clients on
  another. Non-issue at current scale (single instance); note it, don't build it in v1. (This applies to
  SSE and WebSockets equally — it did not affect the transport choice.)
- Never leave a board frozen — reconnect/backoff, and fall back to polling if the stream can't be held.

## Start

Arm **RT-1** first. No Marco decision outstanding (transport locked = SSE; no Azure dependency).
