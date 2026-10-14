---
premise: '! grep -q "ESTIMATE_EXPORT_FULL_PRICE_V1" apps/api/src/modules/estimate-export/estimate-export.service.ts'
premise_means: >-
  The tender's estimate export (Export PDF / Export Excel) prints a total that is not the tender
  price. scope-redesign.service.ts summary() already returns cutting.withMarkup, a waste bucket
  (subtotal, withMarkup) and operationalCosts, and its tenderPrice includes all of them. But
  estimate-export.service.ts (fetchTenderForExport, ~line 570) copies only cutting
  { itemCount, subtotal } and no waste at all. estimate-excel.builder.ts:119-126 adds the
  un-marked-up cutting.subtotal and no waste. quote-html.builder.ts's estimate path (~:478-500) adds
  cutting.subtotal and leaves out both waste and operational costs. Example: Demolition $10,000,
  cutting $2,000, waste $3,000, operational $1,000, all at 30%, gives a tender price of $20,800.
  The PDF prints $15,000 and the Excel prints $16,300. MEASURED at origin/main ed2543df.
  Estimating Module Review W2, punch list 1.2.20.
design_ref: Claude Design/proposed/estimate-export/estimate-export-options.html
done_when: >-
  pnpm build && pnpm lint &&
  pnpm --filter @project-ops/api test -- estimate-export &&
  pnpm --filter @project-ops/api test -- quote-html &&
  grep -q "ESTIMATE_EXPORT_FULL_PRICE_V1" apps/api/src/modules/estimate-export/estimate-export.service.ts
scope:
  - apps/api/src/modules/estimate-export/estimate-export.service.ts
  - apps/api/src/modules/estimate-export/excel/estimate-excel.builder.ts
  - apps/api/src/modules/estimate-export/test-support/make-summary.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.spec.ts
  - apps/api/src/modules/estimate-export/__tests__/estimate-export-full-price.spec.ts
  - apps/api/src/modules/pdf-rendering/builders/quote-html.builder.ts
  - docs/pr-prompts/superseded/pr-estimate-export-full-price-HOLD.md
size: 5
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Revert the PR. The exports go back to the old (wrong) summary. No schema or data change; the
  export only reads figures the summary already computes.
escalates: true
module: estimate-export
---

# The estimate export prints the full tender price: PDF shows sell only, Excel shows cost, markup and sell

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-07)

**Two layouts, one row list:**
- **PDF: Option A, sell price only.** Same layout as today, with no cost or markup columns.
- **Excel: Option B, cost, markup and sell on every row.**

Both files use the same rows: Demolition / Civil / Asbestos / Subcontract (as today), plus
**Concrete cutting, Waste disposal and Operational costs**. In both, the **Sell total must equal
the tender price**. The visual Marco chose from is at the `design_ref` path, which is
**committed to `origin/main`** alongside this prompt (Option A is the second card, Option B
the third). `.gitignore` un-ignores `Claude Design/proposed/`, so the mock-up is tracked and
retrievable; do not treat it as a local-only file.

Tag the code with `ESTIMATE_EXPORT_FULL_PRICE_V1`.

**Out of scope:** the client quote PDF, meaning the `overlay` path in `quote-html.builder.ts` that
renders quote cost lines and `clientFacingTotal`. Do not change its rows, columns or total.

## 1. Payload (`fetchTenderForExport`)

- `summary.cutting` becomes `{ itemCount, subtotal, withMarkup }`.
- Add `summary.waste: { itemCount, subtotal, withMarkup }`.
- `operationalCosts` already carries both figures. Keep it.
- **Copy these figures from `summary()`. Do not recompute markup in the export.**
- Add `wasteItems[]` for the detail sheet. Each row has `code`, `cardCode`, `description`,
  `wasteType`, `wasteFacility`, `wasteTonnes`, `wasteLoads`, `cost`, `effectiveMarkup` and `sell`,
  priced with the **same helper and markup chain summary() uses** (line → card
  `wasteMarkupOverride` → tender markup). If that helper isn't exported, export it from where it
  lives rather than copying it, and name it in the PR body.
- Include only waste lines whose destination counts toward the tender price, as summary() does.
  Add the scope-redesign file to the PR if an export is needed.
- Update `test-support/make-summary.ts` to the new shape.

## 2. One row list, used by both files

Add one pure function, `buildEstimateSummaryRows(payload)`. It returns rows of
`{ code, label, cost, markup, sell }` in this order:

1. DEM, CIV, ASB, SUB, using each bucket's `subtotal` and `withMarkup`. Skip a bucket that has no
   items and no money, as today. `Other` stays in Provisional Sums.
2. Concrete cutting.
3. Waste disposal.
4. Operational costs. Show each of these three only if it has items or money.

Here `markup = sell − cost`. It also returns the totals of each column.

**Guard:** if the rows' Sell total ≠ `summary.tenderPrice` (to the cent), the PDF and Excel exports
both **refuse**. Throw a 409 naming both figures. Never produce a file whose total disagrees with
the tender price.

## 3. Estimate PDF (non-overlay path of `quote-html.builder.ts`)

- **Option A: keep today's three columns, SCOPE · DESCRIPTION · AMOUNT (EX GST).** Do not add cost
  or markup to the PDF.
- Build the rows from `buildEstimateSummaryRows` and print each row's **sell** figure. The TOTAL row
  shows the sell total, which equals the tender price.
- New rows: Concrete cutting (with markup), Waste disposal and Operational costs.
- Nothing else in the PDF changes.

## 4. Excel (`estimate-excel.builder.ts`)

- **Summary sheet:** the same rows and columns (Cost, Markup, Sell) from `buildEstimateSummaryRows`,
  plus a TOTAL row. Remove the old `cutting.subtotal` addition, and stop adding operational costs
  separately: they now come from the row list.
- **New sheet `Waste Detail`**, after Cutting Detail, with columns Code, Card, Description, Type,
  Facility, Tonnes, Loads, Cost, Markup %, Sell, and a total row. Its Sell total must equal the
  Waste disposal row on the Summary sheet. Add this to the guard.
- Format money columns as currency.

## Tests: `__tests__/estimate-export-full-price.spec.ts`, plus updates to the existing spec

1. **Marco's example:** DEM 10,000, cutting 2,000, waste 3,000, operational 1,000, all at 30%,
   tender price 20,800. Assert:
   - the rows are Demolition 10,000 / 3,000 / 13,000, Cutting 2,000 / 600 / 2,600, Waste 3,000 /
     900 / 3,900 and Operational 1,000 / 300 / 1,300;
   - the totals are 16,000 / 4,800 / 20,800;
   - the Excel Summary sheet contains all three columns;
   - the PDF HTML contains only the sell figures (13,000 / 2,600 / 3,900 / 1,300 / total 20,800);
   - the PDF HTML contains **no** cost or markup figures and no COST or MARKUP header.
2. Per-card and per-line markup overrides on waste and cutting flow through: the row's sell equals
   summary()'s `withMarkup`.
3. Waste Detail sheet: one row per counted waste line, and its Sell total equals the Summary's
   Waste row.
4. A tender with no cutting, waste or operational lines shows none of those rows, and its total
   still equals the tender price.
5. **Guard:** a stubbed summary whose tenderPrice disagrees with the rows makes both exports throw
   a 409 naming both figures.
6. **Client quote untouched:** an overlay render (quote with cost lines) produces the same HTML
   before and after this change. Snapshot the table section.
7. **Negative control:** with waste removed from the row list, test 1 fails on the total. This
   proves the guard and the waste row are both load-bearing.

## Note for Marco (put this in the PR body)

Re-export any estimate you exported before this change: the old files understated the price by the
cutting markup, all of the waste, and (PDF only) operational costs. Client quotes from the Quotes
tab were never affected.

`escalates: true`: it changes the money on an exported document. The PR opens labelled
`do-not-merge`, and Marco releases it.
