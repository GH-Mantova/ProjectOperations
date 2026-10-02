VERDICT: MERGE

Scope compliance:
- In scope: `.claude/hooks/guard.mjs` (DEVTREE_RESET deny-only rule added), `scripts/pipeline/__tests__/guard-devtree-reset.test.mjs` (new test file with 12 test cases: 6 block, 6 allow)
- Out of scope: none

Self-verification claims:
- [PASS] `grep -q "DEVTREE_RESET" .claude/hooks/guard.mjs` — marker token present in diff at lines 166, 169, 173
- [PASS] `node --test scripts/pipeline/__tests__/guard-devtree-reset.test.mjs` — 12/12 pass per PR body; CI job "Pipeline — watcher + linter tests" GREEN
- [PASS] `node .claude/hooks/test-guard.mjs` — 37/37 pass per PR body; same CI job GREEN
- [PASS] Test cases include false-positive trap `git commit -m "reset foo"` and all required allow-cases (worktrees, watcher tree, embedded cd/-C, forward slashes)
- [PASS] Title fixed: `feat(pipeline)` (blocker from 2026-09-23 FIX verdict resolved; `guard` not in vocabulary, `pipeline` confirmed present)

Risks Marco should know:
- Tendering-e2e smoke test in progress (non-blocking; all critical gates already green)
- All other CI checks green: CodeQL, PR gates (CP-09–13, CP-17, CP-22, CP-23), approval receipt, watcher tests, arm-prompt tests, lint, data model sanity
- Guard doctrine preserved: deny-only (never ask), narrow blast radius (dev tree top-level only), fail-open on hook errors
- Diff confirms no scope creep: exactly two files, 65+154 lines added, 0 deleted

Recommendation: Safe to merge once tendering-e2e completes (will pass, as this PR touches only scripts/pipeline and .claude/hooks, outside smoke scope).
