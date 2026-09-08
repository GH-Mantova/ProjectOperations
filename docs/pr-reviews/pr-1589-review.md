VERDICT: MERGE

Scope compliance:
- In scope: scripts/pipeline/lint-prompt.mjs (removes shell:true), scripts/pipeline/__tests__/lint-prompt.file-gate-not-released.test.mjs (adds PRESENT_PATH_WITH_SPACE constant and regression test)
- Out of scope: none; ghFetchPrState() left untouched as required; pr-claudedesign-s2-spec-regeneration-plan-HOLD.md not modified

Self-verification claims:
- [✓] `pnpm build` green (documented in PR body)
- [✓] `pnpm lint` green (documented in PR body)
- [✓] `node --test scripts/pipeline/__tests__/*.mjs` 152/152 pass (documented in PR body; "Pipeline — watcher + linter tests" CI check PASSED)
- [✓] Regression test name carries exact phrase "gate path containing a space" (confirmed: "HOLD with requires_file_on_main gate path containing a space that is on main → GATE_RELEASED (regression)")
- [✓] Manual verify: pr-claudedesign-s2-spec-regeneration-plan-HOLD.md before/after states documented in PR body (REJECT FILE_GATE_NOT_RELEASED → PROMOTE GATE_RELEASED)

Risks Marco should know:
- None. Surgical fix to a single-purpose function; regression test pins exact defect; no collateral changes; implementation matches specification exactly. The Windows-specific shell: true was the bug, not a feature—removing it restores the code to what Linux CI already exercises.

Recommendation: Merge. PR gates pass, CI green on test job that directly exercises this code, and substantive self-verification (test passing, manual gate check) documented.
