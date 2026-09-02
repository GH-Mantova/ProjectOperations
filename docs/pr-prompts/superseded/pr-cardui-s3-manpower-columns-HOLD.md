---
premise: '! grep -q "SCOPE_WBS_MANPOWER_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: >-
  Manpower on a WBS row is two bare numbers, MEN and DAYS, with no labour type, no shift and no
  rate. The row cannot say what kind of crew it is, cannot price a night shift differently, and
  gives the estimator no way to see or override the day rate it is being charged at.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-manpower-columns.test.tsx
done_when: pnpm build && pnpm lint && grep -q "SCOPE_WBS_MANPOWER_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 6
gate_allow: none
seed_only: false
escalates: true
backfill: false
cluster: scope-card-redesign
cluster_order: 3
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_WBS_TABLE_V1'
rollback_strategy: >-
  Web-only. Replaces the manpower half of the spanning cell slice 2 left in place. No API, no
  schema, no data written. Revert and MEN/DAYS come back.
---

# The Manpower column group

Third slice. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

## What to build

The six manpower columns from the mock-up, replacing the manpower half of the spanning cell slice 2
left in place: **Type, Qty, Days, Shift, Day rate, Total.**

1. **Type** is a select over the labour catalogue, with `- none -` as a real option. When no type is
   chosen, Qty, Days and Shift are **disabled, not hidden** - the column keeps its width and the
   row keeps its shape.
2. **Day rate is an override cell, not a plain input.** It renders the locked rate as a
   *placeholder*, so an untouched row visibly shows what it will be charged at without pretending
   the estimator typed it. Typing a value marks the cell overridden and reveals a revert control
   whose tooltip names the rate it will return to. This is the same pattern the card markup already
   uses; follow it rather than inventing a second one.
3. **Total** is derived and read-only, right-aligned, tabular numerals, and renders an em dash when
   the row has no manpower - never `$0.00`, which would read as "priced at nothing" rather than
   "not priced".

Mark the component with `SCOPE_WBS_MANPOWER_V1`.

## The rate must come from the API

`Day rate` shows what the tender will actually be charged. That number is resolved server-side
against the tender's locked rate snapshot, and this chain has just spent four slices making that
snapshot reach the pricing path. **Read the resolved rate; do not look up a rate table in the
client and do not multiply anything in TypeScript.** A second pricing implementation in the browser
is how the screen and the export start disagreeing, and the estimator will trust the screen.

## Do NOT

- Do not add, change or remove any API route, service method or DTO. If the resolved day rate is
  not already on the payload this row renders from, say `NO-OP: day rate not on the payload` and
  stop - do not add an endpoint to get it.
- Do not touch the plant columns - slice 4.
- Do not touch the measurement fields - slice 5 relocates them.
- Do not touch `/sot/`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green, including a case that overrides a day rate and
      reverts it.
- [ ] A row with no labour type renders disabled Qty/Days/Shift and an em dash total, and its
      column widths match a row that has one. State how you checked.
- [ ] An overridden rate survives a re-render and reverting restores the locked rate exactly.
- [ ] The card total after this slice equals the card total before it, for a card whose rows use
      only the fields that existed. Give both figures.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
