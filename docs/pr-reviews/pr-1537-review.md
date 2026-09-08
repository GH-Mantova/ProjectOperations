VERDICT: MERGE

Scope compliance:
- In scope: VS-S1 correctly carried the rule-6 VISION REVIEW contract from Station 02 into 00-supervisor.md item 3. The vision review instructions (capture via visual-smoke.mjs, open and judge PNGs, record PASS/FAIL, treat FAIL as SMOKE FAIL, escalate only on ambiguous aesthetic calls) are faithfully copied. The "EXIT CODE decides" sentence is now scoped explicitly to smoke-pr.ps1, resolving the rule contradiction. A sync pointer is left at 02-board-driver.md rule 6 with a timestamp and cross-reference to prevent drift.
- Out of scope: None. Canonical block (lines 15-149) untouched; visual-smoke.mjs untouched; sot/ untouched; rule 6 in 02 not deleted (only noted with sync pointer).

Self-verification claims:
- [PASS] grep -c "VISION REVIEW" docs/pipeline/stations/00-supervisor.md returns 1
- [PASS] grep -q "visual-smoke.mjs" docs/pipeline/stations/00-supervisor.md succeeds (two matches in the new section)
- [PASS] node scripts/pipeline/lint-station.mjs exits 0 (Pipeline — linter tests job SUCCESS)
- [PASS] git diff shows no change inside canonical-block markers (lines 15-149 unchanged; new VISION REVIEW section starts after line 251)
- [PASS] "EXIT CODE decides" preserved and scoped to smoke-pr.ps1; text now reads "the EXIT CODE of `smoke-pr.ps1` decides"
- [PASS] CI: all checks green (PR gates SUCCESS, approval receipt SUCCESS, linter tests SUCCESS, CodeQL SUCCESS)

Risks Marco should know:
- None. Docs-only change to a governance document (pipeline stations). No code changes, no migration, no schema drift. The edit is substantive but confined to narrative clarification and operator guidance.

Recommendation: Merge. All scope, verification, and CI requirements met. PR already merged; review confirms no issues.
