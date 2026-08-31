VERDICT: MERGE

Scope compliance:
- In scope: scripts/pipeline/lint-prompt.mjs (breadcrumb verdict, exit logic, --all filter, tally), scripts/pipeline/test-lint-prompt.mjs (6 new test cases covering all verification requirements)
- Out of scope: none detected

Self-verification claims:
- [x] grep -q "NOT_A_PROMPT" scripts/pipeline/lint-prompt.mjs — verified in diff
- [x] node scripts/pipeline/test-lint-prompt.mjs — CI "Pipeline — watcher + linter tests" PASSED
- [x] Single breadcrumb → exit 1, NOT_A_PROMPT (not NO_FRONT_MATTER) — test case added
- [x] DISARMED pr-* with no front matter → still NO_FRONT_MATTER — test case added, path-class preserved
- [x] --all sweep of clean prompts + breadcrumbs → exit 0, breadcrumbs tallied separately — test case added
- [x] --all sweep with broken pr-* + breadcrumbs → exit 1 (real failure not masked) — test case added
- [x] --all sweep of only breadcrumbs → exit 0 (does not manufacture exit 1) — test case added
- [x] Single stale prompt regression guard (mode-dependency intact) — test case added
- [x] arm-prompt.ps1 still refuses breadcrumbs — CI "Pipeline — arm-prompt tests" PASSED

Risks Marco should know:
- E2e ("tendering-e2e") job still in progress at verdict time, but all critical pipeline tests (linter, arm-prompt, gates, API, Web, DataModel) completed green. No risk: this PR only modifies dev-tools scripts, not product code.
- Exit code logic follows the existing "single-file mode actionable, sweep mode tallied" precedent for stale prompts — no new exit code added, codes 0/1/3 preserved per constraint.
- Path-class correctly limited to `^00-.*\.md$` — non-breadcrumb DISARMED file preserved as NO_FRONT_MATTER per "Do NOT widen" requirement.
- New verdict "NOT_A_PROMPT" stops ~116 breadcrumbs from reporting false NO_FRONT_MATTER rejections in sweeps, fixing the Station 00 lint-pass reporting bug cited in the defect.

Recommendation: Merge. Implementation matches the prompt's intent and requirements exactly; all CI gates that depend on the changed code passed green.
