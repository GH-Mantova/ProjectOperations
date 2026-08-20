---
premise: '! grep -rq "SchedulerRealtimeService\|scheduler-realtime" apps/api/src/modules/safety'
premise_means: The safety module (incidents, hazards, muster) does not yet reuse the RT-1 SSE realtime seam — the safety board and the muster headcount widget only update on manual reload/poll.
scope:
  - apps/api/src/modules/safety/realtime/**
  - apps/api/src/modules/safety/safety.service.ts
  - apps/api/src/modules/safety/muster.service.ts
  - apps/api/src/modules/safety/safety.module.ts
  - apps/web/src/pages/sites/SiteHeadcountWidget.tsx
  - apps/web/src/pages/sites/MusterPage.tsx
  - apps/api/src/modules/safety/__tests__/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/safety/realtime/safety-realtime.emitter.ts && grep -rq "safety-realtime" apps/api/src/modules/safety/safety.service.ts
size: 8
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# RT-2: Safety live — hazard/incident + muster events push to the safety board + headcount widget

**Locked design (Marco 2026-08-04, `docs/plans/realtime-websockets-plan.md`):** transport = SSE, reuse
the seam RT-1 built for the scheduler — do NOT re-invent a second SSE controller class shape, do NOT
add a socket library, do NOT touch Azure/App Service.

On main today: `apps/api/src/modules/safety/safety.service.ts` handles incident/hazard reporting
(`safety.controller.ts`, `SafetyController`), and `apps/api/src/modules/safety/muster.service.ts`
handles muster events, guarded the same way as the rest of the API (`JwtAuthGuard` + `PermissionsGuard`,
`safety.view`/`safety.manage`/`safety.admin` permissions in `apps/api/src/common/permissions/permission-registry.ts`).
On the frontend, `apps/web/src/pages/sites/SiteHeadcountWidget.tsx` polls
`GET /safety/muster/headcount/:siteId` on an interval (see its own doc-comment) and
`apps/web/src/pages/sites/MusterPage.tsx` is the roll-call screen. RT-1 (predecessor slice, gated via
`requires_file_on_main`) added the SSE controller/emitter pattern under
`apps/api/src/modules/scheduler/realtime/` — mirror that shape here, do not copy-paste it wholesale;
extract only what's genuinely shared if an obvious extraction exists, otherwise duplicate the small
amount of boilerplate rather than forcing a premature shared abstraction across modules.

## What to build

### 1. API — safety realtime emitter (`apps/api/src/modules/safety/realtime/`)
- New file `safety-realtime.emitter.ts` (or `.service.ts`) providing the same `emit(event)` shape RT-1
  established, reusable by both the incident/hazard path and the muster path. If RT-1 exposed a
  generic reusable SSE-stream base (controller + connection registry) under a shared location, extend
  it; if RT-1 kept everything scheduler-scoped, add a parallel safety-scoped SSE endpoint (e.g.
  `GET /safety/realtime/stream`) following the exact same auth-on-the-request pattern RT-1 used
  (JWT as query param, validated the same way, unauthenticated/invalid token rejected before the
  stream opens — cover this with a test, same as RT-1 did).
- Wire the emitter into `safety.module.ts`.

### 2. Emit after the DB write commits
- In `safety.service.ts`: after a hazard observation or incident report is successfully created/updated
  (strictly after the Prisma write commits, not inside the transaction), emit a safety event (e.g.
  `{ type: "safety.incident.changed" }` / `{ type: "safety.hazard.changed" }`).
- In `muster.service.ts`: after a muster event starts, an attendee is checked off, or the muster event
  closes (again strictly post-commit), emit a muster event (e.g. `{ type: "safety.muster.changed",
  siteId }`) — include the `siteId` so the client can filter to the site it's viewing, matching the
  plan doc's "one stream scope per resource" design (`safety:site:{id}`-style scoping).
- Keep event payloads minimal — the client refetches on receipt, it does not consume event payloads as
  state (same conflict-safe design as RT-1).

### 3. Web — wire the safety board + headcount widget
- `SiteHeadcountWidget.tsx`: replace or supplement its polling interval with the SSE push — on a
  `safety.muster.changed` event for the widget's `siteId`, trigger the same refetch its existing poll
  already does. Keep the poll as a fallback (per the plan doc: "fall back to polling if the stream
  can't be held") rather than removing it outright — widen the poll interval if you keep both, so SSE
  is doing the real-time work and polling is just the safety net.
- `MusterPage.tsx` (roll-call screen): refetch the attendee list on a `safety.muster.changed` event for
  the active muster event's site, so a second admin's check-off shows up live.
- Reuse RT-1's `useSchedulerRealtime`-shaped hook pattern (or a small generalised version of it under
  `apps/web/src/hooks/` or `apps/web/src/pages/sites/`) rather than writing a third from-scratch
  `EventSource` wrapper. Follow the naming/shape precedent RT-1 set for the predecessor file.

### 4. Tests
- Unit test proving the emitter fires after a successful hazard/incident create and after a muster
  attendee check-off (mock the emitter, assert call order relative to the Prisma mock resolving).
- Keep `apps/api/src/modules/safety/__tests__/safety.service.spec.ts` and
  `apps/api/src/modules/safety/__tests__/muster-gps.spec.ts` green — update any
  `toHaveBeenCalledWith(...)` expectations that the new emitter call changes, but do not weaken them.

## Do NOT
- Do NOT build a WebSocket gateway or add a socket library.
- Do NOT touch Azure, App Service configuration, Entra, or SharePoint.
- Do NOT add a Redis/pub-sub backplane.
- Do NOT change `apps/api/prisma/schema.prisma` or add a migration — transport-only slice.
- Do NOT touch the scheduler grid or `ScheduleAllocation` — that is RT-1's surface, already merged.
- Do NOT touch GPS/mandatory-location capture logic in muster (`muster-gps.spec.ts` covers a separate,
  already-shipped concern) beyond what's needed to trigger a refetch.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if safety already emits realtime events on main, say
  `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must pass.
