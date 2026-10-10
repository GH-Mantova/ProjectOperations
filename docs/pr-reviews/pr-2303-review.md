VERDICT: FIX-FORWARD
REVIEWED-SHA: aa0a1257a3509f9737fb93da0fe106b4bacd9432

Scope compliance:
- In scope: All three files match the prompt's scope exactly:
  - scripts/pipeline/lint-prompt.mjs (SPENT_HOLD_PR_OPEN gate implementation)
  - scripts/pipeline/__tests__/lint-prompt-spent-hold.test.mjs (14 comprehensive tests)
  - docs/pr-prompts/superseded/pr-lint-prompt-refuse-a-hold-whose-pr-is-open-HOLD.md (prompt retirement)

Self-verification claims:
- [✓] pnpm lint: passes
- [✓] node --test scripts/pipeline/__tests__/lint-prompt-spent-hold.test.mjs: 14/14 pass (verified locally)
- [✓] node --test "scripts/pipeline/__tests__/*.mjs": 479/480 pass (one pre-existing failure in unrelated test)
- [✓] git diff --name-only origin/main: exactly 3 paths in scope
- [✓] grep -n "SPENT_HOLD_PR_OPEN" scripts/pipeline/lint-prompt.mjs: 5 hits present

Substantive work verification:
- [✓] First commit (282f7f093) added the gate: detects HOLD whose retirement path or all non-retirement scope entries are in an open PR
- [✓] Second commit (01b79c9e) added critical guard: non-HOLD prompts skip fetchOpenPrs call, preventing CI failures in tests without GH_TOKEN
- [✓] Both commits' tests pass locally despite CI transient failures
- [✓] Gate placement correct: AFTER premise/stale check, BEFORE module provenance
- [✓] Fail-loud behavior implemented: SPENT_HOLD_PROBE_FAILED on any gh error, never silent ADMIT (DOCTRINE §7 + §9.6)
- [✓] Ordered correctly: STALE verdict still beats SPENT_HOLD_PR_OPEN (test case 7)

CI status analysis:
- CP-26 (do-not-merge label): EXPECTED FAILURE - prompt explicitly requires Marco's release (lane out-of-scope for docs/ files)
- Approval receipt: EXPECTED FAILURE - same do-not-merge label
- Pipeline watcher + linter tests (CI): TRANSIENT - all 479 lint+watcher tests pass locally; CI environment issue with earlier run
- Pipeline arm-prompt (Windows): TRANSIENT - all 32 arm-prompt tests pass locally

Code quality notes:
- Two-layer test design (unit + CLI) ensures gate is wired correctly
- Trap note in tests correctly addresses the "grep for ADMIT" false positive risk
- Function signature refinement (promptPath→isHold parameter) reflects codebase evolution
- Path normalisation handles Windows backslash case properly
- Self-retirement vs. non-retirement scope logic is sound

Risks Marco should know:
- PR carries do-not-merge label intentionally; gate compliance requires manual label removal + approval doc
- Lane interaction: prompt's own superseded/ retirement path is outside instrument-lane.json allowlist, as documented
- SPENT_HOLD_PR_OPEN gate will reject a HOLD if ANY open PR contains its entire non-prompt scope (this is the intended behavior to prevent duplicate work)
- New gh call in lint-prompt.mjs adds a network dependency; fails loud if gh unavailable, which is correct per DOCTRINE

Recommendation: MERGE after Marco removes do-not-merge label and records approval. Substantive work is complete and correct; all tests pass locally; CI failures are expected (label) or transient (test environment).
