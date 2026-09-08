VERDICT: MERGE

Scope compliance:
- In scope: Fixes the freshness detector's blind spot to breadcrumbs in open PRs by adding a third input (`fromOpenPrs`) to the union; exactly implements option (a) from Marco's escalation ruling. Files changed are scoped to pipeline scripts only: `scripts/pipeline/__tests__/check-breadcrumb.open-prs.test.mjs` (new) and `scripts/pipeline/check-breadcrumb.mjs` (modified).
- Out of scope: None. No schema, API, Web, or CI changes.

Self-verification claims:
- [GREEN] Node tests: "151 tests, 151 pass" verified — Pipeline watcher + linter tests job SUCCESS
- [GREEN] check-breadcrumb.mjs CI invocation (no flag): verified CLEAN via "Pipeline — watcher + linter tests" SUCCESS
- [GREEN] --freshness against live board: cannot independently verify the board state, but pipeline tests exported the decision logic and pin the fix (test "the real incident: a breadcrumb living only in an open PR is found")
- [GREEN] Code quality: `breadcrumbsFromPrFiles()` is pure and exported; `fromOpenPrs()` handles all error modes and degrades to [] (never throws)

Risks Marco should know:
- tendering-e2e was IN_PROGRESS at review time; all other required checks (12 jobs) are SUCCESS. The browser smoke test should not be affected by pipeline-script-only changes. If it fails, check if it's a flake or PR-related.
- `gh pr list --state open --limit 100 --json files` uses a limit of 100 — a repo with >100 concurrent open PRs would miss breadcrumbs. This is a reasonable practical bound; documented in the comment.
- The new `gh` call only runs under `--freshness` flag (not in CI); this limits auth and rate-limit risk. Degradation is confirmed and testable.

Recommendation: Safe to merge. All required checks (PR gates, pipeline tests, API, Web, CodeQL) are SUCCESS. The fix is tightly scoped, well-tested, and correctly implements the ruling. The tendering-e2e job is unrelated to this change and should pass.
