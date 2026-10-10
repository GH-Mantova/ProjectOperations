VERDICT: MERGE

Scope compliance:
- In scope: scripts/pipeline/lint-prompt.mjs (new `SEED_GRANT_UNDELIVERABLE` check, 42 additions)
- In scope: scripts/pipeline/__tests__/lint-prompt.seed-grant-undeliverable.test.mjs (7-case test suite, 178 additions)
- Out of scope: none

Self-verification claims:
- [✓] pnpm build — CI: API + Web both green
- [✓] pnpm lint — CI: lint step passed
- [✓] node --test "scripts/pipeline/__tests__/*.mjs" — CI: 385/385 tests pass (Pipeline — watcher + linter tests)
- [✓] grep -q "SEED_GRANT_UNDELIVERABLE" scripts/pipeline/lint-prompt.mjs — confirmed in diff
- [✓] test -f scripts/pipeline/__tests__/lint-prompt.seed-grant-undeliverable.test.mjs — confirmed in diff
- [✓] Originating HOLD prompt lints STALE (end-to-end proof) — stated in PR body
- [✓] HOLD survey: fires=0/36 (no new contradictions across depth-1 HOLDs) — stated in PR body

Test coverage verification:
- Case 1: seed + forbid wording + no gate → REJECT ✓
- Case 2: all 5 forbid phrasings fire the code ✓
- Case 3: seed + gate_allow:migrations + migrations path → not this code ✓
- Case 4: seed + forbid wording + `SEED-ONLY: dev` → not this code ✓
- Case 5: seed, no forbid wording → not this code ✓
- Case 6: negative control (forbid wording, no seed scope) → not this code ✓
- Case 7: precedence (GATE_ALLOW_MISMATCH fires first) → not this code ✓

Logic verification:
- Correctly checks all 4 conditions: seed path, no migrations path, no gate_allow:migrations, forbid wording ✓
- Correctly clears on `SEED-ONLY: dev` body marker ✓
- Placed beside existing GATE_ALLOW_MISMATCH block as specified ✓
- Reuses already-parsed front-matter and body; no new I/O ✓
- Error message aligns with prompt's required text ✓

CI status:
- All 14+ checks green (PR gates, CodeQL, pipeline tests, API, web, E2E, smoke)
- Mergeable: CLEAN
- No regressions

Risks Marco should know:
- None. This is a lint-time safety gate with comprehensive test coverage. No data changes, no migrations, no production surface. Rollback is trivial (remove one rule and one test file).

Recommendation: Safe to merge. The rule is well-motivated by a measured incident (PR #1823), tightly scoped to a specific contradiction, and thoroughly tested.
