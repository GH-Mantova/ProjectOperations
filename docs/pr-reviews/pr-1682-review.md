VERDICT: MERGE

Scope compliance:
- In scope: Three web files (CuttingSection.tsx, ScopeCardsTab.tsx, cutting-section.test.tsx) form a read-only take-off display for concrete cutting, fed by the server's existing cutting endpoint and pinned to the card order (WBS → Other Costs → Waste → Concrete Cutting → CuttingSheet).
- Out of scope: None. No API routes, controllers, services, DTOs, schema fields, or migrations touched. Web-only as required.

Self-verification claims:
- pnpm --filter @project-ops/web test green (40 new tests, 0 regressions): CONFIRMED by "Web — lint, logic tests, vitest, build: SUCCESS"
- Five figures reconcile exactly ($16,500 + $4,550 + $0 + $2,219.50 = $23,269.50): CONFIRMED by test assertion and PR body walkthrough
- Section absent on asbestos, present on demolition: CONFIRMED by gate `showsCuttingColumn(discipline)` and test cases covering both
- No arithmetic on a rate: CONFIRMED by multiple guards: scan for `*` and `/` (zero), scan for multiplier names and constants (zero), per-line check for rate operands (zero), single `+` assertion for sumCuttingTakeOff only

Risks Marco should know:
- Two CI jobs (tendering-e2e, API smoke) are still in-progress, but they are not blockers for a web-only PR touching no API surfaces — all critical path checks (Web lint/test/build, PR gates, Data model, CodeQL) are green.
- The PR makes two substantive interpretations flagged for review: (1) take-off includes saw-cut rows only, excluding core-hole and other-rate rows which live on separate Cutrite sheet tabs, and (2) CuttingSheet stays mounted below the new CuttingSection for CRUD. Both are sound: interpretation (1) matches the prompt's "every measurement ticked Cutting?" and is enforced by the `sawCutTakeOff` filter and test; interpretation (2) is necessary for the estimator to pick rigs and is asserted by the mount-order test.
- Single fold point constraint is preserved: `cuttingTotals[card.id]` appears exactly once in the fold, tested. The fold logic mirrors slice 6's pattern exactly.
- Rate guards are comprehensive: the agent confirmed guards fail (6 test failures) when component is mutated to `Number(row.lineTotal) * 1.1`, then verified green after revert. Guards scan code with comments stripped to avoid prose interference.

Recommendation: Merge. Scope is tight, CI is green on all critical checks, self-verification is complete and testable, and the two interpretations are both sound and covered by tests.
