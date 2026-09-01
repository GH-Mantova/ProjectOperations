---
premise: '! grep -rq "SCOPE_CUTTING_V1" apps/web/src/pages/tendering'
premise_means: >-
  Cutting is a tickbox on a measurement and nothing more. The card never shows what was ticked, what
  rig it will be cut with, or what it costs, so the estimator prices concrete cutting blind and only
  finds out at export.
scope:
  - apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/cutting-section.test.tsx
done_when: pnpm build && pnpm lint && grep -rq "SCOPE_CUTTING_V1" apps/web/src/pages/tendering
size: 7
gate_allow: none
seed_only: false
escalates: true
backfill: false
cluster: scope-card-redesign
cluster_order: 7
requires_on_main: 'apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx :: SCOPE_OTHER_COSTS_V1'
rollback_strategy: >-
  Web-only section plus its mount point. No API, no schema, no migration, and no change to how
  cutting is priced - the section reads the take-off the server already returns. Revert and the card
  renders without it; the cutting ticks and their prices are untouched either way.
---

# The concrete cutting section

Seventh and last slice of the card redesign. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

Sits directly under Waste, per the mock-up's card order. **Asbestos cards never cut** - the section
does not render at all there, and the ERP already carries the per-discipline cutting flag. Read it.

## What to build

The cutting take-off for the card: every measurement ticked `Cutting?` in slice 5, with its rig,
method, depth, length and price, and a section total that rolls into the card subtotal.

## The rig rules are already decided - do not re-derive them

These shipped in `pr-estpricing-s2-cutting-rate-corrections-b` (#1437) and the mock-up encodes the
same three. The UI must **show** them, not re-implement them:

- **Roadsaw is floor-only**, and prices asphalt separately from concrete.
- **Demosaw floor is material-blind** on the Cutrite sheet; its wall rows are priced in the sheet
  itself, so no elevation multiplier is applied on top - applying one double-loads the rate.
- **Ringsaw wall rows already carry the premium** the old x1.1 used to apply.
- Depth scaling for Tracksaw and Flush-cut derives from the seeded 25mm floor row.

**Every figure comes from the server's cutting take-off.** Do not compute a cutting price in the
client, do not apply a multiplier in TypeScript, and do not re-select a rig row. If the take-off is
not on the payload, say `NO-OP: cutting take-off not on the payload` and stop. A second
implementation of these rules in the browser is precisely the double-loading defect #1437 fixed.

Where a rig cannot do what the measurement asks - a wall cut on a Roadsaw - the row must say so in
words rather than showing a price that cannot be bought.

Mark the component with `SCOPE_CUTTING_V1`.

## Do NOT

- Do not add, change or remove any API route, service method, DTO or schema field. Web-only.
- Do not change the `Cutting?` tick, the measurement blocks, or the waste section.
- Do not render the section on a discipline whose cutting flag is off.
- Do not touch `/sot/`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green, including a Roadsaw wall cut rendering its
      cannot-cut state rather than a price.
- [ ] The section total plus the WBS, other-costs and waste totals equal the card subtotal exactly.
      Give the five figures.
- [ ] Section absent on an asbestos card, present on demolition. State how you checked.
- [ ] No arithmetic on a rate anywhere in the diff. Say so explicitly in the PR body.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
