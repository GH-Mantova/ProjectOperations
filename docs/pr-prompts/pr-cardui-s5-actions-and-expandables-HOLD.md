---
premise: '! grep -q "SCOPE_WBS_ACTIONS_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: >-
  Every measurement field is on screen for every row whether or not the row measures anything, so a
  card of ten items shows ninety empty boxes. There is nowhere to put a note against an item, and
  asbestos items have no way to record ACM type or enclosure and monitoring.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/scope-cards/WbsMeasurementBlock.tsx
  - apps/web/src/pages/tendering/scope-cards/WbsCommentBlock.tsx
  - apps/web/src/pages/tendering/scope-cards/WbsAcmBlock.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-expandables.test.tsx
done_when: pnpm build && pnpm lint && grep -q "SCOPE_WBS_ACTIONS_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 7
gate_allow: none
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: scope-card-redesign
cluster_order: 5
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_WBS_PLANT_V1'
rollback_strategy: >-
  Web-only. Relocates existing fields into expandable blocks and adds two new ones. No API, no
  schema, no migration, and no measurement record is created, changed or deleted - the same fields
  bind to the same records, in a different place on screen. Revert and every measurement reappears
  inline exactly as before.
---

# The actions column and the three expandables

Fifth slice, and the one that finishes the WBS table. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

## What to build

1. **A collapsible actions column** on the right of the table, `rowspan`-ed across each item's rows,
   holding: `+ Add another row to this WBS`, `+ Add measurement`, `+ Add comment`, and on asbestos
   cards only, `+ Add enclosure / monitoring`. Each button shows a tick and a count once the item
   has that thing. The column header carries the collapse toggle; collapsed, it shrinks to a single
   re-open control and the money columns keep their right edge.

2. **The Measurement block.** This is a **relocation, not a new feature.** The fields currently
   inline on every row - Waste group, Waste item, Material, L, H, D, Qty, and the derived Sqm, M3,
   Density, Tonnes, plus the `Waste?` and `Cutting?` ticks - move into an expandable table under the
   item, one row per measurement, with its own remove control. The derived columns stay derived and
   read-only. **The `Cutting?` column renders only on cards whose discipline can cut** - asbestos
   never cuts, and the ERP already carries that per-discipline flag; read it, do not hardcode a list
   of discipline codes.

3. **The Comment block.** A textarea against the WBS item, with the mock-up's own placeholder text:
   a note that rolls into the card summary and can be ticked through to the quote or the handover.

4. **The ACM block**, asbestos cards only: ACM type and ACM material selects, and a class badge
   derived from the type - Friable reads Class A, Non-friable reads Class B. Derive the badge; do
   not let it be set independently of the type.

Mark the table with `SCOPE_WBS_ACTIONS_V1`.

## The relocation is the risk in this slice

Every measurement an estimator has already entered must still be there, still bound to the same
record, and still feeding Waste and Cutting exactly as it did. If a measurement stops reaching the
Waste section because it now lives behind a disclosure, the tender price changes silently and
nobody sees it happen. **Prove this, do not assert it:** the PR body must state the tender price of
a real card with measurements before and after, and they must be identical.

## Do NOT

- Do not add, change or remove any API route, service method or DTO. Web-only.
- Do not change how tonnes, sqm or m3 are derived. Move the fields; leave the arithmetic alone.
- Do not change `ScopeWasteTab.tsx`, the cutting take-off, or `/sot/`.
- Do not make any block open by default. An item with nothing in it shows four buttons and no boxes.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green, including: adding and removing a measurement;
      the `Cutting?` column absent on an asbestos card and present on a demolition card; the ACM
      badge following the type.
- [ ] Tender price identical before and after for a card with at least three measurements across
      two items. **Give both figures in the PR body.** If they differ, the slice is not done.
- [ ] The actions column collapses and re-opens without the money columns moving.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
