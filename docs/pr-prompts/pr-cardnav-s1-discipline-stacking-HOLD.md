---
premise: '! grep -rq "SCOPE_DISCIPLINE_STACK_V1" apps/web/src/pages/tendering/scope-cards'
premise_means: >-
  The scope-card screen puts one tab per CARD across the top and shows exactly one card at a time.
  There is no stacking, no per-card collapse, and no discipline roll-up anywhere in the app - the
  bar labelled "Discipline total" renders a single card's total. An estimator cannot see the three
  stages of one demolition programme together, and nothing tells them what the discipline as a
  whole costs, needs as a peak crew, or takes in days.
scope:
  - apps/web/src/pages/tendering/scope-cards/ScopeCardTabsRow.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardTab.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/DisciplineSummaryBar.tsx
  - apps/web/src/pages/tendering/scope-cards/useScopeCards.ts
  - apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts
  - apps/web/src/pages/tendering/scope-cards/__tests__/discipline-rollup.test.ts
  - apps/web/src/pages/tendering/scope-cards/__tests__/discipline-summary-bar.test.tsx
done_when: pnpm build && pnpm lint && grep -rq "SCOPE_DISCIPLINE_STACK_V1" apps/web/src/pages/tendering/scope-cards
size: 9
gate_allow: none
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: scope-card-navigation
cluster_order: 1
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_ITEM_MARKUP_PERSIST_V1'
rollback_strategy: >-
  Web-only: the tab strip, the card container, the summary bar, one new pure roll-up helper and two
  specs. No API route, no service method, no DTO, no schema, no migration, no new dependency.
  Revert and the screen goes back to one-tab-per-card with one card visible.
---

# One tab per discipline, every card in it stacked down the page

First slice of the card-navigation cluster. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

**The ruling.** Marco, 2026-09-04, Decision 4 of the four decisions behind package 9:
**(a) rebuild to the mock-up.** One tab per **discipline**; every card in that discipline stacks
down the page, each card independently collapsible, with a discipline roll-up bar above the stack
and a card total on each card.

**What is there today**, measured 2026-09-04 against `origin/main`:

- `ScopeCardTabsRow.tsx:106-115` renders one `SortableTab` per **card** - `cards.map(...)`.
- `ScopeCardsTab.tsx:163-170` filters `items` to `i.cardId === activeCard.id`, and `:303` renders
  the body only for `activeCard`. One card is visible at a time.
- Nothing stacks, nothing collapses, and no discipline roll-up exists anywhere in the repo.
- The active card comes from the `?card=` URL parameter (`ScopeCardsTab.tsx:63`, resolved at
  `:108-115`, written by `setActiveCard` at `:117`+).
- `getCardSummary` is fetched for the active card only (`ScopeCardsTab.tsx:154-156`).

This predates the redesign - the tab strip carries `// PR B1.5` at `ScopeCardTabsRow.tsx:22` and
`ScopeCardTab.tsx:6` - so no `cardui` slice covers it. This one does.

**Why it sits behind the persistence cluster.** `requires_on_main` is
`apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_ITEM_MARKUP_PERSIST_V1`, the
artifact `pr-cardpersist-s3` introduces. Rebuilding navigation over columns that do not persist
means doing the roll-up twice - once against local React state, and again against stored state once
the persistence cluster lands. Do not remove the gate to make the lint go green.

## The domain fact this is built on

**From Marco, and not recoverable from the code: cards within a discipline are STAGES OF THE SAME
JOB, and they run ALWAYS SEQUENTIALLY.** DEM1, DEM2 and DEM3 are one demolition programme in
sequence, not three parallel work fronts. That single fact settles every line of the roll-up
arithmetic. Follow this table exactly:

| Figure | Discipline roll-up | Why |
| --- | --- | --- |
| **Peak crew** | **`max()` across the cards. NEVER a sum.** | The stages never run at once, so the job never needs more than the largest stage's crew. Summing a three-stage demolition claims roughly triple the real peak. |
| **Peak plant** | **`max()`. Never a sum.** | Same reason: the same machine moves from stage to stage. |
| Person-days | sum | Every stage's work is really done. |
| Labour days | sum | As above. |
| Duration | sum | Stages run end to end, so the programme is as long as all of them together. |
| Subtotal, markup, total | sum | Money is money. |

Two implementation notes that follow from the code, so the arithmetic is not re-derived wrongly:

- **Sum the per-card `labourDays` the API already returns. Do not re-derive it at discipline
  level.** `getCardSummary` computes `labourDays = totalPersonDays / peakCrew` per card
  (`apps/api/src/modules/tendering/scope-of-works.service.ts:1192-1194`). Dividing a discipline's
  person-days by the discipline's *max* peak crew would understate the days badly. Sum the card
  figures.
- **Person-days is not on the API surface.** `totalPersonDays` is accumulated at
  `scope-of-works.service.ts:1102` and never returned; `computed` carries only `peakCrew`,
  `labourDays`, `plantSummary` and `duration` (`:1198-1203`). Per card, person-days is
  `peakCrew x labourDays`, which is exact by that same line. Derive it web-side. Do not add an API
  field - see Do NOT.
- **Peak plant** is per (category, variant): `plantSummary[].items[]` each carry `peakQty` and
  `peakDays` (`scope-of-works.service.ts:1171-1190`). Roll up by taking `max(peakQty)` for each
  (category, variant) across the cards.

**No stage-order field and no dates are needed** - sequence is a property of the job, not data to
be captured. **Overlapping stages are explicitly not to be built for.** If a discipline ever needs
concurrent stages that is a new decision for Marco, not a generalisation to design in now.

## This also subsumes finding 9.3.5 - do not fix that separately first

The bar that says "Discipline total" is not one. In `DisciplineSummaryBar.tsx`:

- `:216` labels the right-hand figure **"Discipline total"**, and `:217` renders
  `stats.subtotalWithMarkup`, which `computeCardBarStats` (`:37-48`) sums over **one card's items**.
- `:197` keys the whole bar `data-card-id={card.id}`. It is a card bar wearing a discipline label.
- `:209-211` its chips read **Items / Manpower days / Plant days**, against the mock-up's crew
  figures.
- `ScopeCardsTab.tsx:313` passes `cardSummary?.computed.duration` into the prop named `plantDays`,
  so the chip labelled "Plant days" is showing the card's **duration**.
- The mock-up's card-header chips are printed a **second** time in a separate grid below:
  `CardHeaderSummary` at `ScopeCardsTab.tsx:649-723`, a three-column grid labelled **Peak crew /
  Labour days / Plant** (`:677-679`). **Duration is missing from it** even though
  `computed.duration` is in its own `SummaryData` type (`:639`) and has an override field
  (`durationOverride`, `:645`).

Relabelling the bar and then rebuilding around it is two passes over the same component for one
outcome. Do it once: the bar becomes a real discipline roll-up above the stack, and the per-card
figures live on each card's own header.

## What to build

**1. Tabs become disciplines.** `ScopeCardTabsRow` renders one tab per discipline that has at least
one card, not one tab per card. Discipline codes and labels already exist and are the single source
of truth - `DISCIPLINE_CODES` and `DISCIPLINE_LABELS` in `scope-cards/utils/card-display.ts:25-36`,
derived from `apps/web/src/constants/disciplines.ts`. Use them; do not build a second list.

**2. The URL parameter selects a discipline.** `?card=` at `ScopeCardsTab.tsx:63` becomes a
discipline selector. Keep a card id working as an inbound value by resolving it to that card's
discipline, so an existing deep link still lands somewhere sensible rather than on an empty screen.

**3. Every card in the discipline stacks down the page.** Replace the single-`activeCard` render at
`ScopeCardsTab.tsx:303` with the full ordered list of that discipline's cards. `cardItems`
(`:163-170`) becomes a per-card filter inside the stack, not one filter for one active card.

**4. Each card collapses independently**, with its own header carrying the card code
(`formatCardCode`, `card-display.ts:5-7`), its name, and **its own card total**. Collapse state is
per card and per viewer; it is local UI state and must not be sent to the server.

**5. One roll-up bar above the stack, computed by one pure function.** Put the arithmetic in a new
`scope-cards/utils/discipline-rollup.ts` and test it as a pure function, so the table above is
checkable without rendering anything. `DisciplineSummaryBar` is rebuilt to take the roll-up: it
loses `data-card-id`, its chips carry the mock-up's crew figures, and its right-hand figure is
finally the discipline total its label has been claiming.

**6. The roll-up needs a summary per card.** Today `getCardSummary` is fetched for the active card
only (`ScopeCardsTab.tsx:154-156`). Fetch one per card in the visible discipline and fold them with
the pure function. Do not add a new endpoint for this - see Do NOT.

Mark `apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx` with
`SCOPE_DISCIPLINE_STACK_V1`.

## Do NOT

- **Do not sum peak crew or peak plant.** This is the one mistake this slice exists to prevent. If
  a figure in the bar is a sum of per-card peaks, the slice is wrong however good it looks.
- **Do not build for overlapping stages.** No stage-order field, no start or end dates, no
  concurrency model, no "parallel" toggle. Sequential is the ruling.
- **Do not add, change or remove any API route, service method, DTO field, schema field or
  migration.** `gate_allow` is `none`. If the roll-up seems to need a new endpoint, fold the
  existing per-card summaries client-side instead and say so in the PR body.
- **Do not fix the "Discipline total" labelling as a separate change.** It is subsumed here, and a
  separate pass means touching the same component twice for one outcome.
- **Do not touch `ScopeQuantitiesTable.tsx` or anything inside a card's body.** The WBS table, its
  columns, its persistence and its money formatting belong to the corrections and persistence
  clusters.
- Do not touch the Waste, cutting or other-operational-costs sections - `pr-cardui-s7`,
  `pr-cardui-s8` and `pr-cardui-s6` own those.
- Do not change what a card total means. Read the totals that already exist; do not add a second
  sum of rates and quantities.
- Do not touch `/sot/`, the API, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] State the tab count before and after for the same tender, and say what each tab now
      represents. Name the disciplines rendered.
- [ ] **Worked roll-up, stated in full.** Take a discipline with three cards - e.g. DEM1, DEM2,
      DEM3. Give **each card's peak crew** as three numbers, then the discipline peak crew, and
      confirm in the PR body that it equals the **max** of the three and **not** the sum. State
      both candidate figures so the difference is visible (e.g. "cards 6 / 10 / 8 -> discipline
      **10**, not 24").
- [ ] For the same three cards give duration per card and the discipline duration, and confirm it
      is the **sum**.
- [ ] For the same three cards give the card totals and the discipline total, and confirm the bar's
      figure equals their sum.
- [ ] Give one (category, variant) of plant that appears on more than one card, with its `peakQty`
      per card and the discipline figure, and confirm it is the max.
- [ ] Collapse the middle card, confirm the other two are unaffected and the roll-up figures do not
      move. State the discipline total before and after collapsing.
- [ ] Confirm `data-card-id` no longer appears on the roll-up bar, and say what identifies it now.
- [ ] Confirm the card-header figures now include Duration, and name all the figures on a card
      header after the change.
- [ ] Both themes checked. Any colour this slice introduces comes from a token; grep the diff for
      new hex literals and report zero. (`disciplineColor` in `utils/card-display.ts:51-53` already
      returns hex literals and is not this slice's to change.)

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco. It is
`true` here because this slice replaces the estimator's primary navigation and changes what the
figures on screen mean.
