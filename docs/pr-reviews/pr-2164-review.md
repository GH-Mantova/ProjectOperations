VERDICT: MERGE

Scope compliance:
- In scope: ScopeWasteTab.tsx (travel strip, editable allowance, provenance chips, totals, infeasible-cycle, fallback, Find-tip mapLocationId fix, WASTE_TRAVEL_INDEX_UI_V1 export), TipFinderDrawer.tsx (distance note under finder list), waste-travel-index.test.tsx (NEW, 37 test scenarios), waste-section.test.tsx (S8h mapLocationId regression test). Exactly the four files listed in pr-scopecards-s8h-traffic-index-ui-ready.md.
- Out of scope: None. All changes are web-only (apps/web/src); no API, schema, migrations, env vars, tokens.css, or /sot/ touched.

Self-verification claims:
- [PASS] WASTE_TRAVEL_INDEX_UI_V1 exported in ScopeWasteTab.tsx (grep confirms)
- [PASS] _mapLocationId discard removed; mapLocationId patch added to handleTipChosen (grep -v confirms absence; diff shows mapLocationId patch)
- [PASS] pnpm build (web): PR body reports pass; CI log confirms Web — lint, logic tests, vitest, build SUCCESS
- [PASS] pnpm lint (web): Confirmed in CI log SUCCESS
- [PASS] Tests: 3548/3548 pass (PR body claim; CI log confirms all vitest passing)

CI status:
- CP-11 (migrations): PASS — no migration files
- CP-12 (env-vars): PASS — no new env vars
- CP-13 (dependencies): PASS — no new runtime dependencies
- CP-17 (dto-validation): PASS — no DTO files changed
- CP-23 (seed-without-migration): PASS — no seed files changed
- CP-24 (sot-purity): PASS — no sot/ files changed
- CP-25 (failure-honesty): PASS — no permission-redirect pages in diff
- CP-26 (do-not-merge label): FAIL as expected. Prompt says "escalates: true" and guardrails say "label the PR `do-not-merge` for Marco". Label is on PR. This is the required gate; it does not indicate a problem.
- Web — lint, logic tests, vitest, build: PASS
- Pipeline — watcher + linter tests: PASS (design-token fixes verified clean)
- tendering-e2e: Known WebKit IS-kanban-stage-columns flake twice (19 passed, 1 failed, locator.waitFor timeout); passed on re-run. Acceptable known issue.

Supervisor commits (Station 00, scheduled on-box):
- Commit beb3894f: Fixed 40 hard-coded colour literals (fallbacks of form `var(--token, #hex)` where tokens were undefined, or redundant fallbacks on tokens that already exist). Mapped each to an existing token; no new hex literal added, no file's ratchet count grew. Valid correction per DOCTRINE §8 (hex ratchet enforcement).
- Commit 8073b250: Re-pointed test assertion from removed `ok-border` literal (undefined token) to `var(--status-active)` (the new token the chip now uses). All 67 assertions in file remain; assertion count unchanged. Valid fix.

Design notes:
- Editable allowance correctly implements min 1.00, Manual chip on type, Return-to-automatic action (patches travelIndex: null).
- Provenance chips (From cycle / Matrix / Manual) correctly render with Return-to-automatic for edited fields.
- Infeasible-cycle state (loadsSource === "cycle" AND loadsPerTruckPerDay === null) renders red chip, blanks trips/duration/price, row still saves. Correct per spec.
- Fallback state (no route) renders "Straight line ... Estimated, no route" and allowance 1.00 with explanation. Matches mock-up.
- Find-tip fix: handleTipChosen now patches both wasteFacility AND mapLocationId (same as dropdown); server receives the id for travel re-resolve. Tests confirm mapLocationId is included in patch and _mapLocationId discard is gone.
- Travel strip uses server fields only (travelKm, travelMinutesOneWay, travelIndex, travelIndexSource, travelPlanningMinutesOneWay, travelSource, totalTripKm, loadsSource, dailyKmSource). No client-side computation of rates, distances, cycles, trips, duration, or price.
- Allowance description says "modelled" not "measured" or "peak-hour". Correct per spec.
- TipFinderDrawer note explains straight-line vs real-route distance discrepancy. Correct per spec.

Risks Marco should know:
- do-not-merge label blocks merge until manually removed. Correct per prompt (escalates:true).
- Design token references use existing tokens only; no new tokens added.
- Supervisor's hex-literal fixes are implemention corrections of the S8h work already described in the prompt, not scope additions. Diff confirms no scope creep.
- tendering-e2e WebKit flake is pre-existing infrastructure issue (IS-kanban-stage-columns), not a regression in this PR. Test passed on re-run.

Recommendation: Safe to merge once Marco removes the do-not-merge label. CI green (except the label gate), scope clean, self-verification complete, tests passing, supervisor's implementation fixes valid.
