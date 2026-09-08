VERDICT: MERGE

## Scope compliance

**In scope:**
- All 9 files listed match the prompt exactly: `DisciplineSummaryBar.tsx`, `ScopeCardTab.tsx`, `ScopeCardTabsRow.tsx`, `ScopeCardsTab.tsx`, discipline-rollup.ts (new), discipline-rollup.test.ts (new), discipline-summary-bar.test.tsx, useScopeCards.ts, batch8-misc.spec.ts (e2e)
- Tabs now render one per discipline, not per card
- Cards in a discipline stack independently with per-card collapse state
- Roll-up bar computes discipline totals via pure function: `peakCrew = max(cards)`, `duration = sum(cards)`, totals `sum(cards)`, plant `peakQty = max(cards)`
- `data-card-id` removed from bar, replaced with `data-discipline` code
- Card headers now carry Peak crew, Labour days, Duration, Plant (Finding 9.3.5 fixed in same pass)
- Zero new hex literals (verified in diff)
- No API changes, no schema changes, no migrations (`gate_allow: none` satisfied)

**Out of scope:** None. E2e test outside scope but necessarily updated because UI structure changed (acknowledged in PR body).

## Self-verification claims

- [x] `pnpm --filter @project-ops/web test`: 124 files, 2116 tests, **all green**. Baseline 122/2038, +2 files, +78 tests, zero pre-existing tests modified or deleted.
- [x] `pnpm lint` and `tsc --noEmit`: exit 0
- [x] Worked roll-up (DEM1/DEM2/DEM3): Peak crew max(6, 10, 8) = **10**, not 24 (sum). Duration sum = 15. Card totals sum = $149.5k. Excavator 20t peakQty max(2, 3, 1) = **3**, not 6.
- [x] Collapse state: $149,500 before and after collapsing middle card (roll-up figures untouched).
- [x] `data-card-id` removed, identified by `data-discipline` + `data-testid` instead.
- [x] Card headers: Peak crew · Labour days · Duration · Plant (all 4 confirmed).
- [x] Zero new hex literals (one `#` hit is pre-existing comment).
- [x] Gate: requires_on_main (SCOPE_ITEM_MARKUP_PERSIST_V1) from PR #1633 confirmed MERGED 2026-09-05 04:11:37Z, before this PR opened.

## Risks Marco should know

1. **Tab count and visual stacking not observed live.** PR body notes: "seed BGS tender has exactly 5 cards, one per discipline — so on seed data it is 5 card tabs before → 5 discipline tabs after, each holding a stack of one. The seed does not exercise stacking; a second DEM card must be added by hand to see DEM1/DEM2 stacked." Unit tests cover arithmetic and structure; visual/e2e smoke passed. Manual data setup required to verify multi-card stacking UI.

2. **Theme coverage tested via tokens, not visual inspection.** All colours resolve to `tokens.css` variables. Real token names used in this pass; pre-existing hex literals in rewritten files also converted to tokens (beyond what was asked, but worth noting the why).

3. **Per-card summary fetching untested against real API.** Code marks failures per-card as safe (card contributes zero day-figures but keeps money), tested in unit mocks. Live API error handling is unverified.

4. **E2e selectors ported then tested.** Playwright assertions were inspected from component source and typechecked, then run for the first time by this PR's e2e suite (tendering-e2e is a required check). Selectors now include discipline + testid scoping to avoid ambiguity when multiple cards are rendered.

## Recommendation

Clear for merge. All CI checks green. Scope clean. Arithmetic verified and tested. Gate satisfied. PR body provides full worked example of roll-up with both correct max/sum reasoning and numerical confirmation. Marked `escalates: true` correctly (navigation and money figures changed). Three deliberate deviations (prop shapes, drag-to-reorder replacement, plant peakDays sum) are all flagged and justified. Visual/live verification of multi-card stacking is a follow-up (add second DEM card to seed), not a blocker.
