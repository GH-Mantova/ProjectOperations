VERDICT: MERGE
REVIEWED-SHA: 3e1add31a218f9d3a7fde45a8b12ebcfbbe66c92

Scope compliance:
- In scope: Appends correction section to breadcrumb file documenting F21 resolution (Desktop Commander timeout mechanism, not Merge-Pr defect). Two calling-convention cures identified requiring no code changes. [CANNOT MEASURE] retracted per DOCTRINE 7.1. Follows DOCTRINE 10.5 pattern (one artefact, one identity).
- Out of scope: None. Docs-only, single file, no modifications to prior content.

Self-verification claims:
- Docs-only, one file: verified via `gh pr view --json files`
- Single file is `docs/pr-prompts/00-00-supervisor-2026-10-09-0314-2261-was-released-and-no-scheduled-run-may-sign-for-it.md`: verified
- Change is append-only (no deletions, no modifications to earlier lines): verified via diff hunk `@@ -404,3 +404,79 @@`
- No code changes required for either cure: documented as fact in DISPOSITION

Self-verification substance (per prompt instructions on intent vs mechanism):
The PR's substantive intent is to document F21's full resolution by providing the measurement that was pending ("I can measure" the CANNOT_MEASURE). The breadcrumb self-documents this pattern at line 413: "This supersedes the previous correction's [CANNOT MEASURE] line, which is retracted. DOCTRINE 7.1's re-read rule: a [CANNOT MEASURE] I can measure is not a limitation, it is an unfinished probe." The correction documents both branches measured (step 4 cwd fault via #2274 proof, step 3 timing via mergedAt cross-check), root cause identified (timeout doesn't kill child process), and cures prescribed (no code change needed). This is complete substantive work, not a checklist artifact.

CI status:
- All status checks: 15 completed, 0 failures, 0 errors
- Gating checks passed: CP-26, CP-09–13, CP-17, CP-22, CP-23 all SUCCESS
- CodeQL: SUCCESS
- Smoke tests: E2E markers SUCCESS; smoke gate SUCCESS
- All CI failures would be regressions in the repository, not from this change

Risks Marco should know:
- None. Documentation only. Breadcrumb file is gitignored (`docs/pr-prompts/`) so this doesn't affect any build or runtime state.
- The correction documents a real operational issue (timeout + retry pattern) but prescribes calling-convention fixes, not code changes, so no follow-up PR is required.
- Falsifying probe is stated for the next run (sleep past 180s, check if file written after timeout).

Recommendation: Merge. Docs-only correction with full CI green, properly scoped, substantively complete, no risks.
