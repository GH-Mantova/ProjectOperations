VERDICT: MERGE

Scope compliance:
- In scope: DisciplineSummaryBar component creation, mount point in ScopeCardsTab, unit test file, SCOPE_DISCBAR_V1 marker placement
- Out of scope (none): All changes confined to web/src/pages/tendering/scope-cards/; no API, schema, migration, or /sot/ modifications

Self-verification claims:
- [✓] SCOPE_DISCBAR_V1 marker present in DisciplineSummaryBar.tsx, ScopeCardsTab.tsx (at mount), and test file
- [✓] Byte-identical totals verified: test "matches ScopeQuantitiesTable footer formula exactly for a mixed card" confirms subtotal=$3,500 and subtotalWithMarkup=$3,900 match the footer formula exactly; the test uses the same algebraic approach as ScopeQuantitiesTable's footer
- [✓] No hardcoded colour values; uses only brand tokens (--brand-primary, --text-inverse) and permitted rgba(255,255,255,.14) for chip wash
- [✓] Tabular numerals applied via fontVariantNumeric: "tabular-nums"
- [✓] 8 unit tests covering helper function edge cases (all items excluded, mixed status, type coercion)
- [✓] pnpm build, lint, test all passing in CI

Risk assessment:
- None identified. Pure presentational component with no schema drift, no API surface changes, no breaking changes to existing components. Mount point is surgically placed between existing tab strip and card controls. All totals are sourced from existing server-computed per-row values rather than recomputing from rates.

CI status:
- All 12 status checks COMPLETED and passing:
  - Web — lint, logic tests, vitest, build
  - tendering-e2e
  - API — lint, test, compliance smoke
  - PR gates, CodeQL, Data model sanity
  - All other checks passing

Recommendation: Safe to merge. Implementation is tight, self-tests are thorough, and the component integrates cleanly into ScopeCardsTab without side effects.
