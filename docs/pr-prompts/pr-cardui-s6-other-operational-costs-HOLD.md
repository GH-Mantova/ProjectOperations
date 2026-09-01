---
premise: '! grep -rq "SCOPE_OTHER_COSTS_V1" apps/web/src/pages/tendering'
premise_means: >-
  A card can price manpower, plant and waste and nothing else. Every cost that is neither a crew nor
  a machine - permits, traffic control, scaffolding, site fees - has no home on the card, so it gets
  buried inside a WBS item's description or left out of the tender altogether.
scope:
  - apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/other-operational-costs.test.tsx
done_when: pnpm build && pnpm lint && grep -rq "SCOPE_OTHER_COSTS_V1" apps/web/src/pages/tendering
size: 6
gate_allow: none
seed_only: false
escalates: true
backfill: false
cluster: scope-card-redesign
cluster_order: 6
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_WBS_ACTIONS_V1'
rollback_strategy: >-
  Web-only section plus its mount point. No API, no schema, no migration. If the API cannot already
  persist these lines the slice is a NO-OP rather than a schema change - see Do NOT. Revert and the
  card renders without the section.
---

# Other operational costs

Sixth slice. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

The mock-up fixes the order inside a card:
`WBS items -> Other operational costs -> Waste -> Concrete cutting -> + Add WBS item -> subtotal`.
This slice builds the second of those and puts it in that position.

## What to build

A section under the WBS table, in the same visual language as the table above it, with columns
**Item, Qty, Unit, Rate, Total** and a row-add / row-remove of its own.

- The item picker is **the same picker the mock-up uses for a subcontract quote** - its own comment
  says "One picker, used by both Other operational costs and a subcontract quote." Build it as a
  shared component here so slice 8 can reuse it rather than growing a second one.
- Rate follows the override pattern the manpower and plant columns already use: locked rate as
  placeholder, typing overrides, revert control names what it returns to.
- The section total rolls into the card subtotal and therefore into the discipline summary bar from
  slice 1. **Read the total the card already computes; do not add a second sum.**
- Where a line's unit carries no duration - `Ea`, `Lump sum` - the days field is pinned at 1 and
  greyed, as the mock-up records. Do not let an estimator type days against a lump sum.

Mark the component with `SCOPE_OTHER_COSTS_V1`.

## Do NOT

- **Do not add, change or remove any API route, service method, DTO or schema field.** This is a
  web slice. If the API cannot already persist an operational-cost line against a card, do not
  invent one: say `NO-OP: no persistence for operational cost lines - needs an API slice first` and
  stop. A UI that silently loses what the estimator typed is worse than no UI.
- Do not touch the WBS table, the Waste section, the cutting section, or `/sot/`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] A lump-sum line cannot be given days, and its total is rate x qty.
- [ ] The card subtotal and the slice-1 summary bar both move by exactly the section total when a
      line is added. Give the three figures.
- [ ] Section sits between the WBS table and Waste, per the mock-up's order. Say so in the PR body.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
