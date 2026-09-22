---
premise: 'grep -q "Cutting: no per-line markup; goes to both figures at cost" apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx'
premise_means: The card total counts cutting at cost and counts every destination, while the server's tender summary applies each cutting line's markup and leaves Internal-only out of the price. The card and the tender disagree about what a card is worth whenever a cutting line carries markup or is not In the price.
scope:
  - apps/web/src/pages/tendering/ScopeCuttingSheet.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/cutting-one-surface.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/cutting-card-fold.test.tsx
done_when: pnpm build && pnpm lint && grep -q "CUTTING_IN_THE_FOLD_V1" apps/web/src/pages/tendering/ScopeCuttingSheet.tsx
size: 3
gate_allow: none
seed_only: false
escalates: true
module: tendering
cluster: scopecards
cluster_order: 10
requires_on_main: 'apps/web/src/pages/tendering/ScopeCuttingSheet.tsx :: CUTTING_ONE_SURFACE_V1'
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
---

# Scope Cards S7b - cutting joins the card fold on the same terms as every other section

**Web only. No API change, no migration.** S6 put one cutting surface on the card and had it report
its total upward; it reports **one number, at cost, with every destination in it**. Every other
section reports the pair `{ subtotal, withMarkup }` and reports only the **In the price** slice. This
slice makes cutting behave like the others.

**This moves figures on screen.** That is the point of the slice, and it is why it is separate from
S7: a card with a marked-up cutting line, or with an Internal-only cutting row, will show a different
card total after this lands. Nothing in the database changes.

## Grounded on origin/main 25aa3115 - re-verify before you edit

- `ScopeCuttingSheet.tsx:~232-243` - `subtotal` is `disciplineItems.reduce(... i.lineTotal ...)` and
  is reported through `onSectionTotalChange(cardId, subtotal)` (`:173` declares the prop as
  `(cardId: string, total: number) => void`).
- Each row already carries what is needed, from the server: `lineTotal`, `lineTotalWithMarkup`
  (`:74`), `markupOverride` (`:76`) and `quoteDestination` (`:77`). The row display already uses
  `item.lineTotalWithMarkup ?? item.lineTotal` (`:858`) and the destination control (`:567`, `:584`).
- `ScopeCardsTab.tsx:~336-341` - `handleCuttingTotal(cardId, total)` into `cuttingTotals`;
  `:~390-392` adds `cutting` to **both** `subtotal` and `subtotalWithMarkup`, with the comment
  *"Cutting: no per-line markup; goes to both figures at cost"*.
- The pattern to copy is the operational-costs section: `OtherOperationalCosts.tsx:~204-221`
  (`{ subtotal, withMarkup }`, summing `lineTotal` and `lineTotalWithMarkup`) and `:~241-266`
  (the same shape partitioned by `quoteDestination`, `PRICE` when the field is null).
  `ScopeCardsTab.tsx:~318-331` shows the handler shape for a `{ subtotal, withMarkup }` report.
- The server already does it this way: `scope-redesign.service.ts:~1180-1195` routes each cutting
  line by `quoteDestination` and adds `lineTotalWithMarkup`, with `INTERNAL` reported but not summed
  into the price.

## What to build

1. **`ScopeCuttingSheet.tsx`**
   - `export const CUTTING_IN_THE_FOLD_V1 = "scopecards-s7b";`
   - Replace the single `subtotal` fold with the operational-costs shape: sum `lineTotal` into
     `subtotal` and `lineTotalWithMarkup ?? lineTotal` into `withMarkup`, **for rows whose
     `quoteDestination` is `PRICE` or null only**.
   - `onSectionTotalChange?: (cardId: string, totals: { subtotal: number; withMarkup: number }) => void`.
   - The sheet computes no markup and no rate itself - it folds the server's own per-row figures,
     exactly as it does today.
   - The visible section subtotal on the sheet keeps counting **all** rows, as it does now: the sheet
     is the cutting worksheet, and an estimator must still see what an Internal-only row costs. Only
     what is reported **upward** is the price slice. Say this in a comment.
2. **`ScopeCardsTab.tsx`**
   - `cuttingTotals` becomes `Record<string, { subtotal: number; withMarkup: number }>`, with the
     same identity-stable handler shape as `handleOtherCostTotal`.
   - In the fold: `subtotal + cuttingEntry.subtotal` and `subtotalWithMarkup + cuttingEntry.withMarkup`.
   - Replace the stale comment. The new one says: cutting reports the price slice of the server's own
     per-row totals, markup included, on the same terms as operational costs.

## Tests
- `cutting-card-fold.test.tsx` (NEW): a card with four cutting rows - one PRICE with no markup, one
  PRICE with a line markup override, one INTERNAL, one OPTION - reports a `subtotal` and `withMarkup`
  that contain only the two PRICE rows, and the `withMarkup` figure uses the server's
  `lineTotalWithMarkup`; a row with a null `quoteDestination` counts as PRICE; a card with no cutting
  section reports nothing and reads as 0.
- `cutting-one-surface.test.tsx` (EDIT): its `onSectionTotalChange` assertions take the new shape.
- Include one before/after worked example in the PR body: the card total for a card with a 10%
  cutting markup and one Internal-only row, before and after.

## Do NOT
- Do NOT touch the API, the database, or any figure the server computes.
- Do NOT compute a rate, a markup or a destination in the web. Fold server figures only.
- Do NOT change the sheet's own visible subtotal, the row display, or the 14 columns.
- Do NOT add a second fold point anywhere. ScopeCardsTab stays THE place card money is computed.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never ask a question or stand by.
- Read the CI job log before diagnosing a failure. `pnpm build` + `pnpm lint` must pass.
- This changes a figure on screen: label the PR `do-not-merge` so Marco sees the before/after first.
