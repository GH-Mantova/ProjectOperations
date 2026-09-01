---
premise: '! grep -rq "SCOPE_DISCBAR_V1" apps/web/src/pages/tendering'
premise_means: >-
  The scope-card screen opens straight onto a card with no per-discipline header. An estimator
  cannot see the discipline's item count, manpower/plant split or running total without adding up
  the card themselves, and the approved mock-up puts all of it in one bar above the card.
scope:
  - apps/web/src/pages/tendering/scope-cards/DisciplineSummaryBar.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/discipline-summary-bar.test.tsx
done_when: pnpm build && pnpm lint && grep -rq "SCOPE_DISCBAR_V1" apps/web/src/pages/tendering
size: 3
gate_allow: none
seed_only: false
escalates: true
backfill: false
cluster: scope-card-redesign
cluster_order: 1
rollback_strategy: >-
  One new presentational component plus its mount point. No API, no schema, no data. Revert the
  commit and the card renders exactly as it does today.
---

# The discipline summary bar

First slice of the card redesign. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

## What to build

`DisciplineSummaryBar`, mounted in `ScopeCardsTab.tsx` between the tab strip and the card, exactly
as the mock-up's `.discbar` renders it:

- **Left:** the card code (`DEM1`) in Syne 800, the card name beside it, and a muted meta line.
- **Middle:** stat chips on `rgba(255,255,255,.14)` - item count, manpower days, plant days.
- **Right:** the discipline total, label above, figure below in tabular numerals.

The bar sits on `--brand-primary` with white text. **Brand tokens only** - sot/01 SECTION 5 is
permanent, and the mock-up's own comment records that the shipped dark theme never lightens
`--status-active`, so do not introduce a hardcoded colour to work around contrast.

Mark the component with the token `SCOPE_DISCBAR_V1` in a comment so the next slice can gate on it.

## Where the numbers come from

Every figure is already computed for the card footer (`Subtotal: $0 - with markup: $0`) and the
header (`Peak crew`, `Labour days`). **Read those, do not recompute.** A second implementation of
the card total is how the bar and the footer start disagreeing, and the estimator will believe
whichever is wrong.

## Do NOT

- Do not touch `ScopeQuantitiesTable.tsx`. The item rows are slice 2 and later.
- Do not add or change any API route, service method or DTO. Web-only.
- Do not change the tab strip, the Waste section, or the card header controls.
- Do not touch `/sot/`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] The bar's total is byte-identical to the card footer's "with markup" figure for a card with
      mixed manpower, plant and markup override. State the two figures in the PR body.
- [ ] Legible in both themes. No hardcoded colour values.
- [ ] Bar does not overflow at 1280px with a long card name and five stat chips.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
There is no human in this run; finishing the work and then asking permission is indistinguishable
from failing.
