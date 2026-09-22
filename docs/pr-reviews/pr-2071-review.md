VERDICT: MERGE

Scope compliance:
- In scope: Deletes CuttingSection.tsx (820 lines) and cutting-section.test.tsx (1039 lines); rewrites ScopeCuttingSheet.tsx with full mock-up column set (Goes to, From, Type, Description, Equipment, Elevation, Material, Depth, Ø, Qty, Method, Rate, Markup, Total); updates ScopeCardsTab, waste-section.test.tsx, sub-tab.test.tsx, and batch3-scope-cutting.spec.ts; adds cutting-one-surface.test.tsx (326 lines). All changes are web-only. No API beyond two NO-OP deletions (sanitiseSawElevation and METHODS_BY_EQUIPMENT remain in scope-redesign.service.ts because they still have callers inside resolveCuttingRate, breaking S5 equivalence spec if removed).
- Out of scope: None. SubQuotePicker and ScopeQuantitiesTable mentioned in prompt as "follow references" but correctly contain no imports of CuttingSection on main, so no edits needed. wbs-inputs-money-inheritance.test.tsx guards the ASB no-cutting rule which S6 preserves, so no change required.

Self-verification claims:
- [GREEN] CuttingSection.tsx marked as DELETED in diff (819 deletions)
- [GREEN] cutting-section.test.tsx marked as DELETED in diff (1038 deletions)
- [GREEN] cutting-one-surface.test.tsx marked as ADDED in diff (326 additions)
- [GREEN] CUTTING_ONE_SURFACE_V1 sentinel in PR body (export at line 45, mentions at lines 1, 44 in file comments)
- [GREEN] Sentinel searchable in commit message: "CUTTING_ONE_SURFACE_V1" cited as verification target
- [GREEN] Exactly one "Concrete cutting" heading in ScopeCuttingSheet.tsx (per PR body VERIFY section confirms grep -c = 1)
- [GREEN] shift/shiftLoading removed from UI but kept in model/DTO/estimate-export for legacy compatibility (PR body confirms "kept as DEPRECATED type fields")
- [GREEN] All 14 mock-up columns cited in PR summary: "Goes to, From, Type, Description, Equipment, Elevation, Material, Depth, O, Qty, Method, Rate, Markup, Total"
- [GREEN] E2E test assertion uses toHaveCount(1) with getByRole("heading", { name: /^Concrete cutting\s*\(\d+ items?\)$/ }) — single-element selector, not weakened to .first() or getAllBy*

CI status (at HEAD 5b6ab08cb):
- [GREEN] Web — lint, logic tests, vitest, build (1m21s)
- [GREEN] API — lint, test, compliance smoke (5m58s)
- [GREEN] tendering-e2e (15m3s, including batch3-scope-cutting)
- [GREEN] Pipeline — watcher + linter tests (17s) — title retitled to feat(tendering)
- [GREEN] Pipeline — arm-prompt tests (1m6s)
- [GREEN] E2E restoration markers (8s)
- [GREEN] Data model — generator sanity (7s)
- [GREEN] raw-error-envelope gate (7s)
- [GREEN] CodeQL Analyze (actions: 46s, javascript-typescript: 1m48s)
- [GREEN] Changed-path filter (two instances, both 5-6s)
- [FAIL] PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23) — label-driven, not code issue
- [FAIL] Approval receipt (CP-26) — label-driven, not code issue

Risks Marco should know:
- None beyond those already noted in the prompt: this slice deletes a component the estimator uses and changes the surface they price cutting on (hence escalates: true). Marco merges, not automation. Label-gated CI failures are expected and not defects (Marco removes labels before merge).
- The prompt's NO-OP note (sanitiseSawElevation/METHODS_BY_EQUIPMENT) is correctly documented in the PR body and git commit message, and verified: S5 equivalence spec still passes because those functions are still called by resolveCuttingRate at lines 238/243.
- E2E test progression is sound: 5 commits from initial Sonnet 4.6 draft through 4x Opus 5 fixes (hex ratchet flag, heading selector, spacing, per-type tab removal). Each fix targeted a specific CI failure; all now green.

Recommendation: Merge. The work is substantively complete per the prompt, CI is green on all non-label checks, and the e2e assertion correctly enforces the single-element invariant with toHaveCount(1).
