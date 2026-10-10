VERDICT: MERGE

Scope compliance:
- In scope: All three files are explicitly listed in the prompt's scope
  - docs/pr-prompts/superseded/pr-watcher-pr-number-from-the-board-HOLD.md (renamed from docs/pr-prompts/pr-watcher-pr-number-from-the-board-HOLD.md)
  - scripts/pr-watcher/__tests__/pr-number-from-board.test.mjs (new, 317 lines with 19 test cases)
  - scripts/pr-watcher/index.mjs (modified with resolveBuiltPr, matchesGlob, prTouchesScope, scope front-matter extraction)
- Out of scope: None

Self-verification claims:
- [GREEN] grep -q "PR_NUMBER_FROM_THE_BOARD_V1" scripts/pr-watcher/index.mjs — Tag present in function comment, implementation, and call site
- [GREEN] test -f scripts/pr-watcher/__tests__/pr-number-from-board.test.mjs — File added with all required test coverage
- [GREEN] node --test scripts/pr-watcher/__tests__/ — 19 new tests pass; full suite: 374 pass, 1 pre-existing failure in watchdog-restart-grace.test.mjs (not caused by this PR)
- [GREEN] ! test -f docs/pr-prompts/pr-watcher-pr-number-from-the-board-HOLD.md — Original file moved to superseded/ subdirectory

Implementation verification:
- resolveBuiltPr() correctly queries GitHub board (gh pr list) within 60s window; filters candidates by scope-glob intersection; returns number (one candidate) | null (zero) | {ambiguous: [...]} (2+) | {error: string} (gh failure)
- matchesGlob() pure function handles literal paths, * (single-segment wildcard), ** (multi-segment wildcard) correctly per test suite
- prTouchesScope() correctly checks if any PR file matches any scope glob; handles both string and {path, ...} file object forms
- Scope extraction from prompt front matter extended to parse scope YAML list and thread it through parseWatcherFrontMatter and call site
- extractPrNumber kept as cross-check (logs DISAGREE when board differs from prose, but board always wins)
- No deleteion of extractPrNumber per spec

CI status:
- Two expected failures: "PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)" and "Approval receipt (CP-26)" both fail because escalates:true correctly applies do-not-merge label — human review required before merge, as specified
- "Pipeline — watcher + linter tests" PASSED with all watcher tests green
- All other checks (CodeQL, smoke tests, data model, web, error envelope) PASSED

Risks Marco should know:
- None. Implementation is conservative (fail-closed on ambiguous/network-error cases, never falls back to prose scrape), thoroughly unit-tested (19 tests covering all decision paths and boundary cases), and scope-constrained. This fixes the measured false-positive and false-negative PR detection bugs (PR #1866 false-positive, PR #1870/#2196 false-negative from markdown emphasis in prose).

Recommendation: Safe to merge after Marco removes the escalates:true do-not-merge label (manual gate is correctly set; the PR implements the gate check cleanly).
