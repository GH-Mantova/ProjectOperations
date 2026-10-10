VERDICT: MERGE

Scope compliance:
- In scope: adds two files only — the `-HOLD.md` prompt (`pr-quote-pdf-fixes-s1-revision-date-terms-HOLD.md`, 137 lines) and its approved design_ref mockup (`quote-pdf-fixes-mockup.html`, 149 lines). No code, no schema, no migrations, no sot/.
- Out of scope: none identified.

Self-verification claims:
- Prompt lints ADMIT at origin/main 7d9926ae: ✓ verified in PR body
- Mockup approved and cited as design_ref: ✓ present in diff with correct path
- Docs-only staging PR: ✓ confirmed by file list and CI skips
- CI gates all pass: ✓ PR gates, linter tests, arm-prompt tests, CodeQL all SUCCESS

Risks Marco should know:
- None. This is a documentation-staging PR with no production code or schema changes. The prompt itself (HOLD file) will be executed by watcher in a follow-on PR after Marco arms it per RULE 4.

Recommendation: Merge. This completes the staging of the quote-pdf-fixes batch (five defects: sent date, revision, terms line breaks, cost-options header, client name). The implementation prompt is ready for arming.
