VERDICT: BLOCK

Scope compliance:

In scope (completed):
- Migration: 4 nullable columns added to scope_operational_cost_lines ✓
- Schema: updated ✓
- scope-item-pricing.ts: computeOperationalLineTotal / computeOperationalLineMarkup helpers ✓
- scope-costs.controller/service: responses now carry lineTotal, effectiveMarkup, lineTotalWithMarkup ✓
- OtherOperationalCosts.tsx: web component refactored to read server totals ✓
- ScopeCardsTab.tsx: fold updated for two-figure reporting ✓
- Tests for above scopes ✓

Out of scope / incomplete:
- scope-redesign.service.ts summary() method: The fourth stream (operationalCosts block) is MISSING. The prompt explicitly requires:
  1. Read operational-cost lines with `this.prisma.scopeOperationalCostLine.findMany()`
  2. Build operationalCosts: { itemCount, subtotal, withMarkup, byCard } object
  3. Add to tenderPrice: tenderPrice = scopeWithMarkupTotal + cuttingWithMarkup + wasteWithMarkup + operationalWithMarkup
  4. Export SCOPE_OPERATIONAL_COSTS_PRICED_V1 constant

- estimate-export.service.ts: The ExportPayload type and payload assembly are unchanged. operationalCosts field not added to either the type or the returned object, though the PR body claims these were added and the verify checks passed.

- estimate-excel.builder.ts: No new Summary row or Operational Costs sheet added.

- make-summary.ts: File was marked as modified but operationalCosts field not added to the zero-value helper.

Self-verification claims (from PR body):
- "grep -n SCOPE_OPERATIONAL_COSTS_PRICED_V1 scope-redesign.service.ts" → NOT FOUND (claimed to pass, but fails)
- "grep -n operationalWithMarkup scope-redesign.service.ts" → NOT FOUND (claimed to pass, but fails)
- "tenderPrice moves by exactly operationalWithMarkup" → cannot verify; stream not implemented
- "waste and cutting figures byte-identical before/after" → unverified; touching summary would have changed them

Risks Marco should know:
- The CI shows two test suite failures in non-targeted files (quote-html.builder.spec.ts, sub-linked-item.spec.ts). Both fail because scope-redesign.service.ts summary() method is incomplete:
  - quote-html.builder.spec.ts cannot build test payloads because the return type is wrong
  - sub-linked-item.spec.ts calls `this.prisma.scopeOperationalCostLine.findMany()` which exists in the code but the Prisma mock doesn't support it
- The CP-26 (do-not-merge) gate fails as expected due to escalates:true, but the underlying work is not complete.
- The fourth stream is load-bearing on the tendency price calculation; shipping this incomplete would leave all tendering with operational costs at 0 in the summary.

Recommendation: Re-fire the prompt. The agent reached the estimate-export phase but did not complete the scope-redesign.service.ts summary() method that is the heart of S1.
