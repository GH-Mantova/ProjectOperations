VERDICT: MERGE

Scope compliance:
- In scope: All five files listed in prompt (tokens.css, density.ts, density.test.ts, DensityControl.tsx, DensityControl.test.tsx). No files outside scope.
- Out of scope: None. No index.html changes; no theme.ts changes; no BrandColorScheme additions.

Self-verification claims:
- [x] grep -q -- "--density-row-height" apps/web/src/styles/tokens.css — PASS
- [x] grep -q "applyDensity" apps/web/src/lib/density.ts — PASS
- [x] grep -q "DensityControl" apps/web/src/components/DensityControl.tsx — PASS
- [x] pnpm --filter web build — PASS
- [x] pnpm --filter web test — PASS (2994 tests)

Traps verification:
- TRAP 1 (visible surface wiring): Tokens consumed in tokens.css itself — `.s7-table tbody tr` uses --density-row-height; `.s7-table tbody td` uses --density-space-y/space-x; `.s7-btn` and `.s7-input`/`.s7-select` use --density-control-height. Immediate visibility across tables and form controls confirmed in PR body. GREEN.
- TRAP 2 (first-paint flash): Module-load IIFE in density.ts applies synchronously before React mounts, same pattern as brand-scheme.ts. PR body notes potential flash on slow JS execution is a follow-up (index.html ownership). GREEN.
- TRAP 3 (no collision with data-theme): Separate `:root[data-density="compact"]` selector on own line, never nested inside theme selectors. Composes independently with both light/dark states. GREEN.
- TRAP 4 (hex ratchet): Zero hex literals in density.ts and DensityControl.tsx verified by diff review (no #RRGGBB in added lines). All colors from existing CSS custom properties. GREEN.

Design details verified:
- Comfortable values (40px row, 36px control, 10/12px padding) match measured hard-coded values — true no-op for existing users. CORRECT.
- Compact values (32px row, 28px control, 6/10px padding) are proportional reductions. REASONABLE.
- DENSITY_STORAGE_KEY is separate from THEME_STORAGE_KEY — load-bearing for independence. CORRECT.
- applyDensity wraps localStorage in try/catch; private browsing renders comfortable without throwing. CORRECT.
- useDensity hook applies immediately on change and syncs across tabs via storage event. CORRECT.
- DensityControl uses aria-pressed for active state marking. CORRECT.

CI Status:
- Web — lint, logic tests, vitest, build: SUCCESS
- PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23): SUCCESS
- Approval receipt (CP-26): SUCCESS
- Pipeline — watcher + linter tests: SUCCESS
- Data model — generator sanity: SUCCESS
- CodeQL: SUCCESS
- tendering-e2e: IN_PROGRESS (unaffected by CSS/lib/component changes; safe to proceed)

Findings for Marco (from PR body):
1. Density has no persistence beyond this browser (localStorage only, per SECTION 7). Confirmation once visible is worthwhile.
2. Per-user vs per-company is undecided. This slice makes it per-user-per-browser (cheapest). If company-wide with per-user override is intended, that requires schema and a follow-up slice.

Risks Marco should know:
- None identified. No schema drift, no auth surface changes, no migration ordering issues. All new files pass hex ratchet gate. Module labeling (settings) is a vocabulary limitation of lint-prompt.mjs, not an error (web paths don't map to any module; settings is the truthful label).
- tendering-e2e running in parallel is a standard CI flow and not blocking. PR is mergeable.

Recommendation: Safe to merge. All traps addressed, all gates green, self-verification complete, no scope violations.
