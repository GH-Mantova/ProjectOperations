---
premise: '! grep -q "SCOPE_QUOTE_DESTINATION_UI_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: Every row of every section can now show and set its destination, but nothing reads it. The card bar still sorts money by the retired isProvisional flag and the discipline === "Other" rule, cost options have no letter anywhere, and an Internal-only line leaves the programme figures with nothing on screen saying so.
scope:
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardTab.tsx
  - apps/web/src/pages/tendering/scope-cards/DisciplineSummaryBar.tsx
  - apps/web/src/pages/tendering/scope-cards/useScopeCards.ts
  - apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/discipline-summary-bar.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/discipline-rollup.test.ts
  - apps/web/src/pages/tendering/scope-cards/utils/__tests__/discipline-rollup.test.ts
  - apps/web/src/pages/tendering/scope-cards/__tests__/quote-destination.test.tsx
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test -- quote-destination discipline-summary-bar discipline-rollup sub-tab cutting-section other-operational-costs waste-section wbs-expandables rates-gate && grep -q "SCOPE_QUOTE_DESTINATION_UI_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx && test "$(grep -c 'isProvisional' apps/web/src/pages/tendering/scope-cards/DisciplineSummaryBar.tsx)" = "0"
size: 6
gate_allow: none
seed_only: false
escalates: true
module: tendering
requires_on_main: 'apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx :: SCOPE_QD_UI_SECTIONS_V1'
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
---

# Scope Cards S2b-c - the money, the lettering, the chips

**Third of three, and the one that finishes S2b.** The original S2b was one slice over 20 files;
two `01-code-writer` runs truncated before commit (see
`docs/pr-prompts/needs-marco/scopecards-s2b-runtime-truncation-2026-09-16.md`) and Marco chose on
2026-09-16 to split it. S2b-a built the control and the item rows; S2b-b put it on the other three
sections and had each report its money four ways. This slice makes the card, the discipline bar and
the programme chips read it.

**This slice sets `SCOPE_QUOTE_DESTINATION_UI_V1`** in `ScopeQuantitiesTable.tsx`. S3 gates on that
marker, which is why the two earlier slices deliberately did not set it. Set it **last**, once
everything below is green - it is the signal that the screen is finished.

`escalates: true`: this is where figures estimators quote from change. Marco judges the side-by-side
before the label comes off. CI green is not acceptance.

> Marco, 2026-09-11: *Internal only leaves the money AND the programme. One meaning per control.*

## Grounded on origin/main c1094ced - re-verify line numbers before you edit

- **Card money is sorted by the retired flag.** `computeCardBarStats`
  (`DisciplineSummaryBar.tsx:69-95`) partitions non-excluded rows by
  `isProvisional === true || discipline === "Other"` into `subtotal / subtotalWithMarkup`
  (everything) and `provisionalSubtotal / provisionalWithMarkup`. `ScopeCardsTab.tsx:334-354` folds
  `otherCostTotals` and `cuttingTotals` into the priced side. The bar (`:359-400`) shows
  *In the quote* = `subtotalWithMarkup − provisionalWithMarkup`, *Provisional*, *Discipline total*
  = `subtotalWithMarkup`, only when provisional money exists.
- **The roll-up is pure arithmetic** over `CardMoneyStats` / `CardRollupInput` / `DisciplineRollup`
  (`utils/discipline-rollup.ts:102-190`, `rollUpDisciplineStages` `:381-480`) and over
  `getCardSummary`'s envelope (`useScopeCards.ts:54-66` - after S2a it also carries
  `computed.internalLinesLeftOut`). Two test files pin the fold field by field.
- **The sections already report four ways** after S2b-b: `{ price, provisional, option, internal }`,
  each `{ subtotal, withMarkup }`. Read that shape; do not recompute it.
- **The control already takes an `optionLetter` prop** (S2b-a) and nothing passes it yet. That is
  this slice's job.

## Build this

`export const SCOPE_QUOTE_DESTINATION_UI_V1 = "scopecards-s2b"` in `ScopeQuantitiesTable.tsx`.
This is the only line this slice changes in that file.

### 1. Card money by destination - `DisciplineSummaryBar`, `ScopeCardsTab`

- `computeCardBarStats` partitions by `quoteDestination` **and nothing else** - delete the
  `isProvisional` read and the `discipline === "Other"` half. The server backfilled both into the
  column in S2a.
- `CardBarStats` keeps `subtotal / subtotalWithMarkup` **= PRICE + PROVISIONAL** (the card total,
  exactly as today, so **no figure an estimator has quoted from moves**), keeps `provisional*`, and
  gains `optionSubtotal / optionWithMarkup` and `internalSubtotal / internalWithMarkup` - reported,
  summed into nothing.
- `ScopeCardsTab`'s fold adds each section's `price` to the card total, `provisional` to the
  provisional pair, and `option` and `internal` to theirs. **Waste money is not in the card fold
  today and is not added by this slice.**

### 2. The roll-up - `discipline-rollup`, `useScopeCards`

`CardMoneyStats`, `CardRollupInput` and `DisciplineRollup` gain the option / internal pairs and
`internalLinesLeftOut` (a SUM across cards, from `computed.internalLinesLeftOut`). The flat-fold
equivalence the module header demands still holds field by field for every pre-existing field.

### 3. The bar - `DisciplineSummaryBar`

The bar's right side becomes the mock-up's `db-r`: when provisional **or option** money exists,
*in the price* · *provisional* (if any) · *cost options* (if any) · *DEM total* (= price +
provisional, unchanged); otherwise the total alone, as today. **Options are never in the total.**

### 4. The Opt A / B / C cascade - `ScopeCardsTab`, and every section

Cost options are lettered **Opt A, B, C in card order across all four sections** (`optionLetter()`:
items, then operational, then waste, then cutting, in row order). Compute it **once per card in
`ScopeCardsTab`** from the loaded rows and pass it down - never per section, or two sections would
both show an Opt A.

This is the reason this slice is last: the cascade cannot be correct until every section exists.
Wire the `optionLetter` prop the earlier slices deliberately left unpassed. **Passing a literal
`undefined` is not wiring it** - that is exactly what the first truncated run left behind, on both
branches of a ternary at `ScopeQuantitiesTable.tsx:3447`. If you find that shape anywhere, it is a
bug, not prior art.

### 5. The nomine chip - `ScopeCardTab`, `DisciplineSummaryBar`

The programme chips (peak crew, person-days, labour days, duration, peak plant) already exclude
INTERNAL lines because S2a's `getCardSummary` does. Add the mock-up's `nomine` chip: *−N internal
only* on the card header (`ScopeCardTab`), *−N internal only, not in these figures* on the
discipline bar - **only when N > 0**, title text verbatim from the mock-up.

### 6. Tests

- **`discipline-summary-bar.test.tsx`**: the SCOPE_PROVISIONAL_SPLIT_V1 block (`:394-500`) becomes
  destination cases - partition by column, `subtotalWithMarkup === price + provisional`, option and
  internal outside it, the bar shows *cost options* only when > 0, the `nomine` chip only when
  `internalLinesLeftOut > 0`. The *"discipline 'Other' makes every row provisional"* case (`:418`)
  is **deleted** - that rule left with S2a.
- **Both `discipline-rollup` tests**: option / internal pairs sum across cards and stages;
  `internalLinesLeftOut` sums; the flat-fold equivalence still pins every pre-existing field.
- **`quote-destination.test.tsx`** (extend the file S2b-a created): three OPTION rows across items,
  operational and cutting on one card read **Opt A, B, C in that order**, and a second card starts
  again at A.

## Do NOT

- Do NOT price anything in the browser. Every figure is a server row figure sorted into a pile.
- Do NOT change what *Card total* / *DEM total* mean (PRICE + PROVISIONAL) and do NOT add options
  or internal money to either.
- Do NOT hide a row for any destination, and do NOT put a destination on rejected proposals.
- Do NOT delete the `excluded` status, the `x` on AI proposals, or the exclude route call.
- Do NOT set INTERNAL automatically - the dialog asks, the estimator answers.
- Do NOT touch the API, `schema.prisma`, `tokens.css` (Marco's kit), the SUB tab's quote table, or
  `/sot/`. Row rails and pills are page-local styles on brand tokens.

**And two that belong to this split:**

- In `ScopeQuantitiesTable.tsx` change **only** the marker export and the `optionLetter` wiring.
  S2b-a finished that file otherwise.
- Do NOT re-open `CuttingSection`, `ScopeWasteTab`, `OtherOperationalCosts`,
  `QuoteDestinationSelect` or `SubLinkPicker`. They are not in `scope`. If a section's four-way
  money shape is wrong, say `NO-OP: <reason>` and report it rather than fixing it here.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/web test -- quote-destination discipline-summary-bar discipline-rollup sub-tab cutting-section other-operational-costs waste-section wbs-expandables rates-gate
pnpm build && pnpm lint
grep -n "isProvisional\|\"Other\"" apps/web/src/pages/tendering/scope-cards/DisciplineSummaryBar.tsx apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx   # must be empty
grep -n "optionLetter={undefined}" apps/web/src/pages/tendering/                                                                                                  # must be empty
grep -n "SCOPE_QUOTE_DESTINATION_UI_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
```

PR body: a screenshot of one card holding one line of each destination (rail, note, Opt A, struck
INTERNAL total, *−1 internal only* chip) and of its discipline bar showing the three-way split; the
card total on screen and `GET /tenders/:id/scope/summary`'s PRICE + PROVISIONAL for that card
agreeing **to the cent**.

State in the PR body that this is the third of three slices and that merging it releases S3.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Never ask a question or "stand by" for approval. A dismissed or unanswered question is the absence
  of a human, not a stop signal. Proceed on best judgement and record the assumption in the PR body.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am waiting
  for someone" - there is nobody. Open the PR.
- **Budget.** This slice is ten files, and six of them are tests or pure arithmetic, precisely
  because the twenty-file version could not finish in one turn. If you find yourself widening scope,
  stop and say `NO-OP: <reason>` instead.
- `escalates: true` - open the PR and leave it for Marco. Do not chase the label.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR; this section is never a reason to wait.
Third and last of the slices the original S2b was split into. **S3 is authored once
`SCOPE_QUOTE_DESTINATION_UI_V1` is on `main`** - which this slice puts there.
