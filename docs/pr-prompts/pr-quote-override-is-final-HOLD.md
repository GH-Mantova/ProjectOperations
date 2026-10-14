---
premise: '! grep -q "QUOTE_OVERRIDE_IS_FINAL_V1" apps/api/src/modules/client-quotes/client-quotes.service.ts'
premise_means: >-
  When a cost line on a client quote is overridden, the quote's rows no longer add up to its printed
  total. getSummary (client-quotes.service.ts:294-362) works out the adjustment from every visible
  line's ORIGINAL price, then shows overridden lines at their override and pushes the whole
  adjustment onto the other lines. Example: A $80,000 overridden to $75,000, B $20,000, +10%. The
  rows print $75,000 + $30,000 = $105,000 against a TOTAL of $110,000. With no adjustment the rows
  are $95,000 against $100,000. A second copy of the maths, computeAdjustedCostLines (:892), is the
  one with tests (compute-adjusted-cost-lines.spec.ts), and production never calls it. MEASURED at
  origin/main ed2543df. Estimating Module Review W5, punch list 1.2.21.
design_ref: Claude Design/proposed/quote-override/quote-override-options.html
done_when: >-
  pnpm build && pnpm lint &&
  pnpm --filter @project-ops/api test -- client-quotes &&
  grep -q "QUOTE_OVERRIDE_IS_FINAL_V1" apps/api/src/modules/client-quotes/client-quotes.service.ts
scope:
  - apps/api/src/modules/client-quotes/client-quotes.service.ts
  - apps/api/src/modules/client-quotes/compute-adjusted-cost-lines.spec.ts
  - apps/api/src/modules/client-quotes/quote-pdf.service.ts
  - apps/api/src/modules/client-quotes/__tests__/quote-override-is-final.spec.ts
  - apps/web/src/pages/tendering/ClientQuotesPanel.tsx
  - docs/pr-prompts/superseded/pr-quote-override-is-final-HOLD.md
size: 3
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Revert the PR. The summary goes back to the old maths. No schema or data change: overrides and
  adjustments are stored exactly as before, and only the calculation over them changes.
escalates: true
module: client-quotes
---

# An overridden quote line is final: the adjustment applies only to the other lines

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-07)

**Option 1: the overridden price is final.** An overridden line shows exactly what was typed. The %
and $ adjustment applies only to the lines that are **not** overridden. The total is the sum of the
rows. Worked example (the one Marco chose from):

| Line | Cost | Override | Shows |
|---|---|---|---|
| A Demolition | $80,000 | $75,000 | **$75,000** |
| B Waste removal | $20,000 | — | $20,000 × 1.10 = **$22,000** |
| **Total** | | | **$97,000** |

Tag the code with `QUOTE_OVERRIDE_IS_FINAL_V1`. The visual Marco chose from is at the `design_ref` path, which is **committed to `origin/main`** alongside this prompt (Option 1 is the second card). `.gitignore` un-ignores `Claude Design/proposed/`, so the mock-up is tracked and retrievable; do not treat it as a local-only file.

## 1. One calculation: `computeAdjustedCostLines` (pure, exported)

Rewrite it to Option 1 and make `getSummary` call it. **Delete the inline copy in `getSummary`.**
Afterwards there must be exactly one place that computes line allocations.

Using visible lines only, as today (hidden lines never count):

```
fixedTotal      = sum(override)   over overridden lines
allocBase       = sum(price)      over non-overridden lines
allocAdjusted   = allocBase × (1 + pct/100) + dollar
adjustmentAmount = allocAdjusted − allocBase
adjustedTotal   = fixedTotal + allocAdjusted          (= clientFacingTotal)
```

Then split the adjustment:

- each non-overridden line shows `price + adjustmentAmount × (price / allocBase)`, rounded to cents;
- any rounding remainder goes to the largest non-overridden line, as today;
- overridden lines show their override.

**Every line is overridden, or allocBase is 0:** nothing can carry the adjustment. In that case:

- `adjustedTotal = fixedTotal`;
- `adjustmentAmount = 0`;
- return `adjustmentUnapplied: true`, with the pct and dollar that were not applied.

Never divide by zero.

Keep every field `getSummary` returns today, so the web editor and the PDF keep working:
`baseTotalCostLines` (still the sum of visible costs), `adjustmentAmount`, `adjustedTotal`,
`provisionalTotal`, `costOptionsTotal`, `clientFacingTotal` and `lineAppropriations` (same shape).
Add `adjustmentUnapplied` (boolean) and `overriddenTotal` (= fixedTotal).

**No overrides:** the results must equal today's to the cent. Assert this in the tests.

## 2. The rows-sum guard

- After computing, assert that the sum of `lineAppropriations[].displayedAmount` equals
  `clientFacingTotal`, to the cent.
- `quote-pdf.service.ts` must **refuse to render** if they differ: throw a 409 whose message names
  both figures. A wrong total must never reach a PDF again.
- The summary endpoint itself doesn't throw. It returns the figures and logs an error, so the
  editor can still open the quote to fix it.

## 3. Web: `ClientQuotesPanel.tsx`

Change only one thing:

- When `summary.adjustmentUnapplied` is true, show a one-line warning beside the adjustment inputs:
  `Adjustment not applied — every line has an overridden price.` Use the existing warning style,
  with no new colours.
- The line inputs, the revert-override control and the total display are unchanged. They already
  read `displayedAmount` and `clientFacingTotal`.

## Tests

**Rewrite** `compute-adjusted-cost-lines.spec.ts` to the new rule, and **add**
`__tests__/quote-override-is-final.spec.ts` (through `getSummary`, with Prisma mocked):

1. Marco's example: A 80,000 overridden to 75,000, B 20,000, +10%. Rows 75,000 and 22,000;
   total 97,000; `overriddenTotal` 75,000.
2. Same lines, no adjustment: rows 75,000 and 20,000; total 95,000.
3. A dollar adjustment (+$5,000) with one overridden line: the whole $5,000 lands on the
   non-overridden lines.
4. Every line overridden, +10%: total = sum of overrides, and `adjustmentUnapplied` is true.
5. **No overrides: identical to the old maths**, to the cent, on three fixtures including a
   rounding remainder.
6. A hidden line (overridden or not) never affects anything.
7. **Property check:** 200 generated quotes (random prices, random overrides, pct −20..+30, dollar
   −5,000..+5,000, fixed seed). For every one, the displayed rows sum to `clientFacingTotal` exactly.
8. PDF guard: force a mismatch (stub the summary) and expect a 409 naming both figures. A matching
   summary renders.
9. **Single source:** a source check that `getSummary` calls `computeAdjustedCostLines` and that
   the file contains no second allocation loop.

## Note for Marco (put this in the PR body)

Any quote that already has an overridden line **and** an adjustment shows a different total the
next time it's opened or printed. The new total is the correct one: the rows now add up to it. A
PDF already sent to a client keeps the old figures. If any of those exist, check them before
re-issuing.

`escalates: true`: it changes the money on client quotes. The PR opens labelled `do-not-merge`,
and Marco releases it.
