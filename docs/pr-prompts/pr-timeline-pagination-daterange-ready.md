---
premise: grep -q "slice(0, limit)" apps/api/src/modules/platform/timeline.service.ts && ! grep -q "nextCursor" apps/api/src/modules/platform/timeline.service.ts
premise_means: TimelineService.list returns a single newest-first slice(0, limit) window with no cursor pagination and no date-range filter; the universal timeline panel has no way to see events older than the last 50, and no from/to filter.
scope:
  - apps/api/src/modules/platform/timeline.service.ts
  - apps/api/src/modules/platform/timeline.controller.ts
  - apps/web/src/components/timeline/Timeline.tsx
  - tests/e2e/pr-acceptance/batch7-universal-timeline.spec.ts
done_when: pnpm build && pnpm lint && grep -q "nextCursor" apps/api/src/modules/platform/timeline.service.ts && grep -q "nextCursor" apps/web/src/components/timeline/Timeline.tsx && grep -q "timeline-load-older" apps/web/src/components/timeline/Timeline.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# feat(timeline): cursor pagination + date-range filter for the universal timeline

## What exists on main

- `apps/api/src/modules/platform/timeline.service.ts` — `list(entityType, entityId, {limit, kinds})`
  merges four sources (ActivityEntry, DocumentLink, Job signals, correspondence), sorts newest-first
  by `createdAt` only, and returns `filtered.slice(0, limit)` (DEFAULT_LIMIT=50, MAX_LIMIT=200). There
  is NO cursor/offset paging and NO date-range filter — events older than the newest 50 are unreachable.
- `apps/api/src/modules/platform/timeline.controller.ts` — GET route with `@Query("limit")` and a
  kinds filter; returns `{ entityType, entityId, items[] }`.
- `apps/web/src/components/timeline/Timeline.tsx` — the shared panel (test ids `timeline-panel`,
  `timeline-list`, `timeline-item`, `timeline-filter-<kind>`, `timeline-note-save`). Renders one page.
- Lands on Job/Tender/Client/Contact alike — the panel + service are entity-generic.
- **Tie hazard (must handle):** the current sort is by `createdAt` ONLY. Seed/batch data routinely
  shares timestamps, so a cursor keyed on `createdAt` alone would skip or repeat rows across pages.

## What to build

1. **Service — stable sort + cursor + date filter.** In `list`:
   - Change the sort to a STABLE compound order: `createdAt` DESC, then `id` DESC (tiebreaker). Apply
     the same order everywhere the merged array is sorted.
   - Add optional `from?: Date` / `to?: Date` to `opts`. Filter the merged stream to
     `createdAt >= from` (if set) and `createdAt <= endOfDay(to)` (if set, inclusive). If both set and
     `from > to`, throw `BadRequestException`.
   - Add optional `cursor?: { createdAt: Date; id: string }`. After sorting+filtering, drop every item
     at-or-before the cursor (compound compare), then take `limit`.
   - Return `{ items, nextCursor, entityType, entityId }` where `nextCursor` is the compound key of the
     LAST returned item when a further page exists, else `null`. The cursor is only valid within the
     SAME from/to/kinds filter — document that in a comment.
   - Keep the in-memory merge as-is. Add a one-line comment noting pagination is response-level (the
     merge still reads all rows); DB-level paging across four heterogeneous sources is a future follow-up.
2. **Controller.** Accept `@Query("from")`, `@Query("to")` (ISO date strings; parse to Date, 400 on
   invalid) and `@Query("cursor")` (opaque base64 of `{createdAt,id}`; decode, 400 on malformed).
   Pass through; return `nextCursor` (re-encoded opaque string, or null) alongside `items`.
3. **Web panel.** In `Timeline.tsx`:
   - Add a date-range picker (test ids `timeline-from`, `timeline-to`). Changing it RESETS the list to
     page 1 of the filtered set and refetches.
   - Add a **"Load older"** button (test id `timeline-load-older`), shown only when the last response
     had a non-null `nextCursor`. Clicking it fetches the next page WITH the active from/to/kinds AND
     the cursor, and APPENDS to the list (newest-first preserved). Hide it when `nextCursor` is null.
   - Keep the existing kind-filter working and combinable with the date range.
4. **E2E.** Extend `tests/e2e/pr-acceptance/batch7-universal-timeline.spec.ts`: with >50 seeded entries,
   assert an item beyond the first 50 is NOT visible initially, becomes visible after clicking
   `timeline-load-older`; and assert the date-range inputs narrow the visible set. Use presence-by-title
   assertions (not count deltas).

## Do NOT

- Do NOT add a Prisma migration, schema change, or seed change — this is read-path only (`gate_allow: none`).
- Do NOT change the four merge sources, `addNote`, `requireEntity`, or `SUPPORTED_ENTITIES`.
- Do NOT change any permission/guard on the route.
- Do NOT switch to infinite-scroll — the explicit "Load older" button is the agreed interaction.
- Do NOT touch other pages/components — the panel is shared, so wiring it once covers every host.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt; if genuinely impossible, say `NO-OP: <reason>` instead of stopping quietly.
- `pnpm build` and `pnpm lint` must both pass before opening the PR.
- If CI fails, read the actual job log before diagnosing — don't guess.
- Never ask for or wait on approval.
