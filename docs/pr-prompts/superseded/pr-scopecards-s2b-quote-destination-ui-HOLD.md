---
premise: '! grep -q "quoteDestination" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: The server (S2a) stores where every estimating line goes on the client quote, but the screen cannot show or set it - there is no destination control on any row, a covered item still renders greyed "priced on SUB1.1" cells that the server no longer honours, the card bar still sorts money by the retired isProvisional flag, an Internal-only line still counts in the card's crew and duration on screen, and cost options have no figure anywhere.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/ScopeWasteTab.tsx
  - apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx
  - apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx
  - apps/web/src/pages/tendering/scope-cards/SubLinkPicker.tsx
  - apps/web/src/pages/tendering/scope-cards/DisciplineSummaryBar.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardTab.tsx
  - apps/web/src/pages/tendering/scope-cards/useScopeCards.ts
  - apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts
  - apps/web/src/pages/tendering/scope-cards/QuoteDestinationSelect.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/quote-destination.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/discipline-summary-bar.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/discipline-rollup.test.ts
  - apps/web/src/pages/tendering/scope-cards/utils/__tests__/discipline-rollup.test.ts
  - apps/web/src/pages/tendering/scope-cards/__tests__/sub-tab.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/cutting-section.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/other-operational-costs.test.tsx
  - apps/web/src/pages/tendering/__tests__/waste-section.test.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-expandables.test.tsx
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test -- quote-destination discipline-summary-bar discipline-rollup sub-tab cutting-section other-operational-costs waste-section wbs-expandables rates-gate && grep -q "SCOPE_QUOTE_DESTINATION_UI_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx && test -f apps/web/src/pages/tendering/scope-cards/QuoteDestinationSelect.tsx && test "$(grep -c 'isProvisional' apps/web/src/pages/tendering/scope-cards/DisciplineSummaryBar.tsx)" = "0" && test "$(grep -c 'CoveredGroupCells' apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx)" = "0" && grep -q "Rejected proposals" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
module: tendering
cluster: scopecards
cluster_order: 3
requires_on_main: 'apps/api/src/modules/tendering/scope-redesign.service.ts :: SCOPE_QUOTE_DESTINATION_V1'
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
---

# Scope Cards S2b - where a line goes, on the screen

**Second of nine, second half.** S2a put `quoteDestination` on the server; this slice puts it on
every row of every section and makes the card, the discipline bar and the programme figures read
it. Web only - no API, no schema. The Discipline Cards mock-up (`design_ref`, v26) is the standard,
literally: the `WHERE A LINE GOES` CSS block, `destSel()`, `destCell()`, `destNote()`,
`optionLetter()`, `notOurs()`, the `nomine` chip and the `db-split` figures on the discipline bar.
S3 arms only when this slice's marker is on `main`. (`cluster_order` counts prompts, not plan rows:
S1 = 1, S2a = 2, S2b = 3, S3 = 4 and so on.)

> Marco, 2026-09-10: *Hiding a line - never in a drawer. Whatever its destination the row stays in
> place on the card, greyed and railed, because a comparison you cannot see is not a comparison.*
> Marco, 2026-09-11: *Internal only leaves the money AND the programme. One meaning per control.*

## Grounded on origin/main c1094ced, 2026-09-15 - re-verify line numbers before you edit

- **The row type and the wire.** `ScopeItem` (`ScopeQuantitiesTable.tsx:321-430`) declares
  `pricedBySubItemId` (`:413`) and `isProvisional` (`:424`, *"declaring it adds NO API surface"* -
  `listItems` returns the whole row, so `quoteDestination` is already arriving from S2a the same
  way). Item writes go through `authFetch(... method: "PATCH")` on the item route; confirm / exclude
  at `:2780-2794`; link / unlink at `:2296-2320` (`linkItemToSubLine(coveredItemId, subItemId)`,
  wired to `SubLinkPicker` at `:3558-3564`).
- **Covered items are drawn as dead.** `isCoveredBySubLine` (`:3043-3046`) switches the Manpower
  and Plant column groups to `CoveredGroupCells` (`:3779-3865`, *"greyed, centred, italic, and
  carrying the words 'priced on SUB1.1' where six inputs used to be"*) and the total cell to
  `COVERED_ITEM_TOTAL` (`:3850-3862`). After S2a the server prices those items normally, so this
  rendering now lies about the money. `sub-tab.test.tsx` pins it.
- **The drawer is for rejected proposals.** `excluded` rows (`:2837-2838`) render in a `<details>`
  titled *Excluded (n)* (`:3624-3635`); the only way in is the `x` on an AI-proposed pending row
  (`:3124-3132`, beside *ok* = confirm). A confirmed row has *Remove WBS item* instead
  (`:3135-3140`). So the drawer never held "our working" - it holds proposals the estimator turned
  down. It stays; it gets its right name.
- **Card money is sorted by the retired flag.** `computeCardBarStats` (`DisciplineSummaryBar.tsx:69-95`)
  partitions non-excluded rows by `isProvisional === true || discipline === "Other"` into
  `subtotal / subtotalWithMarkup` (everything) and `provisionalSubtotal / provisionalWithMarkup`.
  `ScopeCardsTab.tsx:334-354` folds `otherCostTotals` and `cuttingTotals` into the priced side
  (after S1 the operational section reports `{ subtotal, withMarkup }`). The bar (`:359-400`) shows
  *In the quote* = `subtotalWithMarkup − provisionalWithMarkup`, *Provisional*, *Discipline total*
  = `subtotalWithMarkup`, only when provisional money exists.
- **The roll-up is pure arithmetic** over `CardMoneyStats` / `CardRollupInput` / `DisciplineRollup`
  (`utils/discipline-rollup.ts:102-190`, `rollUpDisciplineStages` `:381-480`) and over
  `getCardSummary`'s envelope (`useScopeCards.ts:54-66` - after S2a it also carries
  `computed.internalLinesLeftOut`). Two test files pin the fold field by field.
- **The other sections.** `CuttingSection.tsx:399-409` (columns WBS · Description · Rig · Method ·
  Elevation · Depth · Length · Rate · Total, PATCH at `:488`), `ScopeWasteTab.tsx:685-704` (waste
  rows), `OtherOperationalCosts.tsx:670-673` (S1's columns). Each row already carries the server's
  own line total; none carries a destination.
- **Dialogs.** `components/ConfirmDialog.tsx` is the house confirm; `CenteredModal` is used in this
  very file (`:3638`). `window.confirm` appears once in `TenderingPage.tsx:622` and is not the
  pattern to copy.

## Build this

`export const SCOPE_QUOTE_DESTINATION_UI_V1 = "scopecards-s2b"` in `ScopeQuantitiesTable.tsx`.

### 1. One control - `QuoteDestinationSelect.tsx`

A `<select>` with the four options in the quote's words - **In the price · Provisional · Cost
option · Internal only** - values `PRICE | PROVISIONAL | OPTION | INTERNAL`, classes
`destsel d-price | d-prov | d-option | d-internal` styled as the mock-up's `select.destsel` block
(provisional = accent border on the override surface, option = primary border on the primary-light
surface, internal = dashed border, muted text). Title text verbatim from `destSel()`: *"Where this
line goes on the client quote. It is priced either way - the destination only decides where the
money lands."* Props: `value`, `onChange(next)`, `optionLetter?: string | null` - when set, the
`Opt A` pill (`.optlbl`) renders beside the select with title *"Grouped as Option A on the quote"*.
Brand tokens only; nothing hard-coded.

### 2. Every row of every section - `ScopeQuantitiesTable`, `CuttingSection`, `ScopeWasteTab`, `OtherOperationalCosts`

- A **Goes to** column (`th.inc` / `td.inc`, 1% width, no wrap) holding the control, placed where
  the mock-up puts it: first column on the operational-cost section (its `Goes to · From · Item
  description …` order), after the description on cutting and waste, and in the item row's
  actions-side cell group on the WBS table (the mock-up's `destCell`, spanning the item's rows).
  Changing it PATCHes `{ quoteDestination }` on that row's own route and refreshes the row; a
  failed write reverts the control and shows the section's normal error line.
- **The row stays where it is.** Row classes `d-prov | d-option | d-internal` reproduce the
  mock-up's rail: a 3px inset left rail in the destination's colour (accent-dark, primary, muted);
  an INTERNAL row additionally sits on `--surface-subtle` with its non-control cells at `.55`
  opacity and its **total struck through** (1.5px), the *base + N%* sub-line not struck.
- **A note under the total** (`destNote()`): *provisional sum* / *cost option* / *internal only* as
  a small uppercase `.exclnote` in the destination's colour; nothing for PRICE.
- **Cost options are lettered Opt A, B, C in card order** across all four sections of the card
  (`optionLetter()`: items, then operational, then waste, then cutting, in row order), computed once
  per card in `ScopeCardsTab` from the loaded rows and passed down - never computed per section, or
  two sections would both have an Opt A.
- **Covered items come back to life.** Delete `CoveredGroupCells` and `COVERED_ITEM_TOTAL`; a
  covered item renders its inputs and its real total like any other, plus the mock-up's `vsbadge`
  under the total: *⇄ quoted on SUB1.1* with title *"A subcontract quote sits against this scope on
  SUB1.1. Both are priced; the destination decides which one the total counts."* `pricedOnLabel`
  survives only to build that chip.
- **The drawer is renamed *Rejected proposals (n)*** and its rows keep the strike-through; nothing
  else about it changes. Nothing with a destination is ever hidden in it.

### 3. The link offers - `SubLinkPicker` + `ScopeQuantitiesTable`

When the estimator links an item to a SUB line and that item is not already INTERNAL, a
`ConfirmDialog`: title *Set DEM1.2 to Internal only?*, body *"AsbestosCo's quote on SUB1.1 now sits
against this scope. Keep DEM1.2 priced on the card for comparison but out of the tender price and
the programme?"*, buttons **Internal only** / **Keep in the price**. Confirm sends
`{ subItemId, setInternal: true }` (S2a's flag) in the one link write; decline sends the link
alone. Unlink never asks and never changes the destination. Bulk / already-linked / already-INTERNAL
cases: no dialog.

### 4. Card and discipline money - `DisciplineSummaryBar`, `ScopeCardsTab`, `discipline-rollup`, `ScopeCardTab`

- `computeCardBarStats` partitions by `quoteDestination` and nothing else - delete the `isProvisional`
  read and the `discipline === "Other"` half (the server backfilled both into the column). `CardBarStats`
  keeps `subtotal / subtotalWithMarkup` **= PRICE + PROVISIONAL** (the card total, exactly as today so
  no figure an estimator has quoted from moves), keeps `provisional*`, and gains `optionSubtotal /
  optionWithMarkup` and `internalSubtotal / internalWithMarkup` - reported, summed into nothing.
- The operational-cost and cutting sections report `{ price, provisional, option, internal }` each
  `{ subtotal, withMarkup }` (the same server row figures they report today, sorted by the row's
  destination); `ScopeCardsTab`'s fold adds `price` to the card total, `provisional` to the
  provisional pair, `option` and `internal` to theirs. Waste money is not in the card fold today and
  is not added by this slice.
- `CardMoneyStats`, `CardRollupInput` and `DisciplineRollup` gain the option / internal pairs and
  `internalLinesLeftOut` (a SUM across cards, from `computed.internalLinesLeftOut`); the flat-fold
  equivalence the module header demands still holds field by field for the existing fields.
- The bar's right side becomes the mock-up's `db-r`: when provisional **or option** money exists,
  *in the price* · *provisional* (if any) · *cost options* (if any) · *DEM total* (= price +
  provisional, unchanged); otherwise the total alone, as today. Options are never in the total.
- The programme chips (peak crew, person-days, labour days, duration, peak plant) already exclude
  INTERNAL lines because S2a's `getCardSummary` does; this slice adds the mock-up's `nomine` chip -
  *−N internal only* on the card header (`ScopeCardTab`), *−N internal only, not in these figures*
  on the discipline bar - only when N > 0, title text verbatim from the mock-up.

### 5. Tests

- **`quote-destination.test.tsx`** (new): the control renders the four labels and PATCHes
  `{ quoteDestination }` on change; a PROVISIONAL row carries `d-prov` and *provisional sum*; an
  INTERNAL row carries `d-internal`, a struck total and *internal only*; three OPTION rows across
  items, operational and cutting on one card read Opt A, B, C in that order and a second card starts
  again at A; a covered item renders inputs, a real total and *quoted on SUB1.1* - no
  `data-covered` cell exists; the drawer reads *Rejected proposals (1)* for one excluded row and is
  absent for none; the link dialog appears on link (not on unlink, not when already INTERNAL),
  confirm sends `setInternal: true`, decline sends the link alone.
- **`discipline-summary-bar.test.tsx`**: the SCOPE_PROVISIONAL_SPLIT_V1 block (`:394-500`) becomes
  destination cases - partition by column, `subtotalWithMarkup === price + provisional`, option and
  internal outside it, the bar shows *cost options* only when > 0, the `nomine` chip only when
  `internalLinesLeftOut > 0`; the *"discipline 'Other' makes every row provisional"* case (`:418`)
  is deleted - that rule left with S2a.
- **Both `discipline-rollup` tests**: option / internal pairs sum across cards and stages;
  `internalLinesLeftOut` sums; the flat-fold equivalence still pins every pre-existing field.
- **`sub-tab.test.tsx`**: the covered-cells assertions invert; the chip and the dialog are pinned.
- **`cutting-section`, `other-operational-costs`, `waste-section`**: the Goes-to column is present,
  the PATCH carries `quoteDestination`, the section reports the four-way money shape.
- **`wbs-expandables.test.tsx:752`**: the excluded skip stays (rejected proposals expand nothing).

## Do NOT

- Do NOT price anything in the browser. Every figure is a server row figure sorted into a pile.
- Do NOT change what *Card total* / *DEM total* mean (PRICE + PROVISIONAL) and do NOT add options
  or internal money to either.
- Do NOT hide a row for any destination, and do NOT put a destination on rejected proposals.
- Do NOT delete the `excluded` status, the `x` on AI proposals, or the exclude route call.
- Do NOT set INTERNAL automatically - the dialog asks, the estimator answers.
- Do NOT touch the API, `schema.prisma`, `tokens.css` (Marco's kit), the SUB tab's quote table, or
  `/sot/`. Row rails and pills are page-local styles on brand tokens.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/web test -- quote-destination discipline-summary-bar discipline-rollup sub-tab cutting-section other-operational-costs waste-section wbs-expandables rates-gate
pnpm build && pnpm lint
grep -n "isProvisional\|\"Other\"" apps/web/src/pages/tendering/scope-cards/DisciplineSummaryBar.tsx apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx   # must be empty
grep -n "CoveredGroupCells\|COVERED_ITEM_TOTAL" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx                                                            # must be empty
grep -n "SCOPE_QUOTE_DESTINATION_UI_V1\|Rejected proposals\|quoted on" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
```

PR body: a screenshot of one card holding one line of each destination (rail, note, Opt A, struck
INTERNAL total, *−1 internal only* chip) and of its discipline bar showing the three-way split;
the card total on screen and `GET /tenders/:id/scope/summary`'s PRICE + PROVISIONAL for that card
agreeing to the cent.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Never ask a question or "stand by" for approval. A dismissed or unanswered question is the
  absence of a human, not a stop signal. Proceed on best judgement and record the assumption in
  the PR body.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR; this section is never a reason to wait. Second
half of S2 in the `scopecards` chain; dispatches once `SCOPE_QUOTE_DESTINATION_V1` (S2a) is on
`main`. S3 is authored once `SCOPE_QUOTE_DESTINATION_UI_V1` is on `main`.
