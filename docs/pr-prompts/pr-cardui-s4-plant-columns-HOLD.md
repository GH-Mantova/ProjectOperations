---
premise: '! grep -q "SCOPE_WBS_PLANT_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: >-
  Plant on a WBS row is a single "+ Plant" affordance with no type, quantity, days or rate in the
  row itself, and no way at all to price a machine the catalogue does not carry. An estimator
  hiring something unusual has nowhere to put it.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-plant-columns.test.tsx
done_when: pnpm build && pnpm lint && grep -q "SCOPE_WBS_PLANT_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 7
gate_allow: none
seed_only: false
escalates: true
backfill: false
cluster: scope-card-redesign
cluster_order: 4
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_WBS_MANPOWER_V1'
rollback_strategy: >-
  Web-only. Replaces the plant half of the spanning cell. No API, no schema, no data written.
  Revert and the "+ Plant" affordance comes back.
---

# The Plant column group

Fourth slice. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

## What to build

The five plant columns: **Type, Qty, Days, Day rate, Total** - following slice 3's manpower group
exactly, with one addition that is the reason this is its own slice.

1. **Type is either a catalogue pick or a free-typed machine.** The default is a grouped select over
   the plant catalogue. The estimator can drop out of it and name a machine that is not in the
   catalogue; the cell then renders a text input with a revert control that returns it to the list.
   A custom machine has **no locked rate**, so its Day rate cell is an override by definition and
   its placeholder reads `rate`, not a number. Do not fabricate a rate for it, and do not block the
   row for lacking one.
2. **The rate cell carries its unit.** `/day`, `/hr`, `/week` as the catalogue records it, rendered
   beside the figure. A plant rate without its unit is the kind of number that gets multiplied by
   the wrong thing.
3. Qty, Days, Total and the disabled-when-empty behaviour follow slice 3. Total renders an em dash,
   never `$0.00`, when the row has no plant.

Mark the component with `SCOPE_WBS_PLANT_V1`.

## Do NOT

- Do not add, change or remove any API route, service method or DTO. Web-only. If the plant
  catalogue, its rates or its units are not already on the payload this row renders from, say
  `NO-OP: <what is missing> not on the payload` and stop.
- Do not price anything in the client. Read the resolved rate.
- Do not touch the manpower columns, the measurement fields, or `/sot/`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green, including: picking a catalogue machine; dropping
      to a custom machine and typing a rate; reverting a custom machine back to the list.
- [ ] A custom machine with a typed rate totals correctly and its cell shows no revert-to-locked
      control, because there is no locked rate to return to.
- [ ] Column widths do not move between a row with a long catalogue name and a row with a short
      custom name. State how you measured.
- [ ] Card total unchanged for a card that uses no plant. Give both figures.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
