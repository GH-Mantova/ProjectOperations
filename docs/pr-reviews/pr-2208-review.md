VERDICT: MERGE

Scope compliance:
- In scope: Refactored `applyBrandScheme` to inject `<style id="brand-scheme">` element scoped to light mode only (`:root[data-theme="light"]` and `@media (prefers-color-scheme: light)`). Removed all inline `root.style.setProperty` calls for managed palette tokens. Exported `BRAND_LIGHT_ONLY_V1 = "brandtheme-light-only"` marker. Rewrote test stubs to validate stylesheet text instead of inline properties. Created new comprehensive test suite (`brand-scheme-light-only.test.ts`) with 11 tests covering light-only CSS structure, dark-mode selector absence, element lifecycle, hex validation, and override re-apply semantics.
- Out of scope: None. API, tokens.css, seeded presets, `/branding/active` payload, and sot/ untouched as required.

Self-verification claims:
- [✓] `pnpm build && pnpm lint && pnpm --filter web test` — all pass (3564 tests).
- [✓] `grep -q "BRAND_LIGHT_ONLY_V1"` — marker present in brand-scheme.ts.
- [✓] `! grep -q "root.style.setProperty"` — no inline property writes remain in implementation; only removed from old test stubs.
- [✓] Red/green proof: all 11 new light-only tests FAIL on origin/main (setProperty implementation), PASS after fix.
- [✓] Existing tests updated: all assertions rewritten to assert stylesheet text via `getBrandCss()` helper instead of inline property map.

Risks Marco should know:
- API build is flagged as failing in PR body ("pre-existing xeroSyncLog / PrismaClient errors"), but this PR changes zero API code. The cause is unrelated to this work. Web build, lint, and test all pass. Tendering E2E and API lint/test/smoke jobs are IN_PROGRESS; monitor for red, but expect green (no API changes in this PR).
- Dark mode toggle (ThemeToggle or OS dark preference) now requires zero re-apply/reload; cascade handles light↔dark automatically. This is intentional and matches the ruling.
- Element replacement semantics (not duplication) confirmed in test-5 (`clearUserBrandOverride` re-applies cached company scheme into same element).
- Hex injection is safe: values validated before CSS text interpolation; invalid values silently omit only that property. No literals in source.

Recommendation: Merge once tendering-e2e and API smoke checks complete green (expected; no API surface changed). Marco confirms light/dark toggle in manual screenshots (pending, per test plan).

---

File paths reviewed:
- C:/ProjectOperations2/docs/pr-prompts/processed/pr-brandtheme-light-only-apply-ready.md (originating prompt)
- C:/ProjectOperations2/apps/web/src/lib/brand-scheme.ts
- C:/ProjectOperations2/apps/web/src/lib/__tests__/brand-scheme.test.ts (updated)
- C:/ProjectOperations2/apps/web/src/lib/__tests__/brand-scheme-light-only.test.ts (new)
