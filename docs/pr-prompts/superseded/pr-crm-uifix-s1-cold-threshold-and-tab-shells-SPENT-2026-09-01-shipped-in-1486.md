---
premise: '! grep -q "CRM_COLD_V2" apps/api/src/modules/crm/accounts/accounts.service.ts'
premise_means: >-
  Four defects ship together because they are the same class: a slice built the thing and left the
  surface the user actually reaches untouched. Win rate renders at 20000% from a private formatter
  #1322 missed; the Tenders and Comms pages each render two tab bars where the outer one advertises
  shipped work as pending; and "going cold" has two contradictory definitions, so the KPI tile reads 0
  while the tab beneath it lists 9.
scope:
  - apps/web/src/pages/crm/RelationshipsPage.tsx
  - apps/web/src/pages/crm/TendersPage.tsx
  - apps/web/src/pages/crm/CommsPage.tsx
  - apps/web/src/pages/crm/TendersRegisterPage.tsx
  - apps/web/src/pages/crm/CommsHubPage.tsx
  - apps/web/src/pages/crm/AccountsListPage.tsx
  - apps/web/src/pages/crm/__tests__/**
  - apps/api/src/modules/crm/accounts/accounts.service.ts
  - apps/api/src/modules/crm/relationships/relationships.service.ts
  - apps/api/src/modules/crm/**/__tests__/**
done_when: 'pnpm build && pnpm lint && grep -q "CRM_COLD_V2" apps/api/src/modules/crm/accounts/accounts.service.ts'
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# CRM UIFIX S1 - one cold threshold, one tab bar, one win-rate formatter

**Web and two API constants. No schema, no migration, no new endpoint.**

## The measured gap

Four defects, all on `origin/main` at `1efd079c`, all verified by file and line.

1. **Win rate renders at 20000%.** `client-stats.service.ts:57-66` stores `win_rate` already multiplied
   by 100. The shared helper knows this - `formatWinRate.ts` clamps above 100 and its docblock says
   "Do NOT multiply by 100 here", because **#1322 fixed exactly this bug**. It missed a private copy:
   `RelationshipsPage.tsx:92` does `` `${(num * 100).toFixed(0)}%` ``. Two wins over one tender stores
   200 and renders 20000%.

2. **Two tab bars on Tenders, two on Comms.** S2 (#1369) built outer tab shells and stubbed two of
   them. S8 (#1447) and S10 (#1461) then built the real tabs *inside* the inner page and left the outer
   shell alone. Today: `TendersPage.tsx:54` renders "Follow-ups coming in S8" and `CommsPage.tsx:56,79`
   render "Threads coming in S10" / "To-dos coming in S10" - all three shipped. The inner bars are
   `TendersRegisterPage.tsx:681` and `CommsHubPage.tsx:125`.

3. **Going cold has two definitions.** `accounts.service.ts:64` uses 14 days and treats a null
   `lastContactedAt` as NOT cold; `relationships.service.ts:47` uses 30 days and treats null as cold.
   Same screen, opposite answers - the KPI tile reads 0 while the tab lists 9.

4. **The threshold is hardcoded in the web.** The API already accepts it -
   `relationships.controller.ts:138-148`, `GoingColdQueryDto` with `@IsOptional() @Min(1)` - but
   `RelationshipsPage.tsx:349` fetches `?thresholdDays=30` as a literal.

## Marco's decisions (2026-09-01)

- An account with **no logged contact at all counts as COLD**. Never-contacted is the coldest state in
  the system, not the warmest.
- The default threshold is **60 days**, and it is user-selectable.

## Do

1. **Retire the private `fmtPct` helper** in `RelationshipsPage.tsx`; import the shared `formatWinRate` instead.
   One formatter for win rate across the CRM.

2. **Introduce `CRM_COLD_V2`** as the single shared going-cold contract. Both services must read the
   same threshold constant (**60**) and the same null rule (**null = cold**). `deriveGoingCold` in
   `accounts.service.ts:80` currently returns `false` when `lastContactedAt` is null - that inverts.
   `computeGoingCold` in `AccountsListPage.tsx:46` mirrors it and must move in step, since its docblock
   claims to mirror the server.

3. **Wire the outer tab bars to real content, and delete the inner ones.** The outer bar is the
   designed IA - one nav item per page, tabs inside the page carrying what would otherwise be nav
   children. `AccountsPage.tsx` already does this correctly (it renders `RelationshipsPage` for real);
   follow that pattern:
   - `TendersPage` drives Register / Follow-ups from `?tab=`, passing the active view into
     `TendersRegisterPage` as a prop. Remove the inner `role="tablist"` at `TendersRegisterPage.tsx:681`
     and the `FollowUpsEmptyState` stub.
   - `CommsPage` drives Inbox / Threads / To-dos from `?tab=`, passing the active tab into
     `CommsHubPage` as a prop. Remove `CommsHubPage`'s internal `inboxTab` state (`:125`) and its bar,
     and both empty-state stubs in `CommsPage`.
   - URLs stay linkable and shareable. `/crm/register` and `/crm/comms` keep working unchanged.

4. **Add a threshold selector** on the Relationships going-cold tab: 30 / 60 / 90, defaulting to 60,
   passed through as `?thresholdDays=`. Replace the literal at `RelationshipsPage.tsx:349`.

## Do NOT

- **Do NOT delete the outer tab bars.** They are the design. The inner duplicates are the defect. If
  the work seems to want the opposite, stop and report - this exact call was got backwards once already.
- **Do NOT change `formatWinRate.ts` itself.** It is correct. The bug is the private copy.
- **Do NOT touch `client-stats.service.ts`.** The stored scale is correct and is the single writer of
  record for those counters.
- Do NOT add a migration, an endpoint, or a new query parameter - the API already takes `thresholdDays`.
- Do NOT alter the going-cold query's `contacts: { some: ... }` shape. It is a separate known defect
  (accounts with no linked contact can never appear) and belongs to the data-hygiene work, not here.

## Tests

1. `formatWinRate(200)` renders as clamped, and `RelationshipsPage` no longer contains `* 100`.
   Assert the absence - this is the regression that #1322 already fixed once.
2. `deriveGoingCold(lifecycle, null)` returns **true** for PROSPECT and ACTIVE, **false** for PAST.
3. `deriveGoingCold` and `computeGoingCold` agree across the same four cases - server and web mirror.
4. Both services report the same threshold default. Assert the number, not the constant name.
5. `/crm/register?tab=follow-ups` renders the real follow-ups view, not an empty state.
6. `/crm/comms?tab=threads` renders real threads, not an empty state.
7. Exactly one element with `role="tablist"` renders on each of the Tenders and Comms pages.

## STOP AND REPORT

- If removing `CommsHubPage`'s internal tab state cascades into its data-fetching effects in a way that
  changes what is fetched per tab, say so before rewriting the fetch logic. Lifting tab state is in
  scope; restructuring the inbox's paging is not.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**
