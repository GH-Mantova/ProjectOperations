VERDICT: MERGE

Reviewed at commit fafd5f63fa6cf88114ac03c12a2d17e4c6e4f027 (GH-Mantova/ProjectOperations).

## Scope compliance

In scope (all verified):
- apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx — marker export added, optionLetter wiring in place
- apps/web/src/pages/tendering/scope-cards/DisciplineSummaryBar.tsx — isProvisional logic removed, partitions by quoteDestination only, bar renders split, nomine chip when internalLinesLeftOut > 0
- apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx — buildOptionLettersForItems extracted and exported, useMemo wires optionLettersByCard
- useScopeCards.ts — option/internal pairs and internalLinesLeftOut propagated
- discipline-rollup.ts — option/internal fields sum across cards and stages
- Test files (discipline-rollup, discipline-summary-bar, quote-destination) — all updated with destination-partition cases, cascade cases, nomine logic

Note: diff against main includes deletions of docs/pr-prompts/ and docs/decisions/ files from PR #1993 (separate, already merged); the S2b-c commit itself touches only the 9 scoped files.

## Self-verification claims

- [x] `pnpm build && pnpm lint` pass (Web — lint, logic tests, vitest, build job: SUCCESS)
- [x] `grep -c 'isProvisional' DisciplineSummaryBar.tsx` = 0 (verified: 0 matches)
- [x] `grep -rn "optionLetter={undefined}"` only in test assertions (verified: no source matches)
- [x] `grep -n "SCOPE_QUOTE_DESTINATION_UI_V1"` line 53 (comment), 55 (export), 1914 (prop doc) — all present
- [x] Tests pass: Web lint/vitest job reports 3378 passed tests (claimed in PR body, CI confirmed)

## Risks Marco should know

- **CI gate failures are EXPECTED and CORRECT:** CP-26 (do-not-merge label applied because escalates:true) and CP-09–13 gate both fail. This is intentional — the prompt's `escalates: true` and the watcher applied `do-not-merge`. Marco must review the side-by-side and remove the label to permit merge.
- **API build skipped:** PR body notes API build fails in worktree (Prisma client not generated — pre-existing). This is not a blocker; web build passes cleanly.
- **tendering-e2e is pending:** still in progress at review time (IN_PROGRESS status). Should complete; watch for timeout.
- **Marker is the release gate for S3:** SCOPE_QUOTE_DESTINATION_UI_V1 on main unblocks S3 — this slice is the final piece of S2b and was deliberately held until all four sections report their four-way money split correctly.

## Recommendation

Merge when Marco approves the side-by-side (destination sort, option letter cascade, nomine chip, discipline bar split). Remove the do-not-merge label to release to merge queue. All substantive work is complete and CI is green on required checks (Web build/lint/test pass, E2E pending).
