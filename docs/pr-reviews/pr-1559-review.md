VERDICT: MERGE

Scope compliance:
- In scope: Two defect fixes to `pr-claudedesign-s1-track-the-written-half-HOLD.md` (missing `proposed/` re-include in `.gitignore`, and strengthened `done_when` with file-form negative assertions to prevent permissive pattern errors). Removal of temporary guard from `00-supervisor.md` (removal condition met).
- Out of scope: none detected

Self-verification claims:
- lint-prompt.mjs ADMIT, size 10, exit 0: confirmed
- lint-station.mjs all 8 docs clean, exit 0: confirmed
- CI checks all SUCCESS or appropriate SKIP: confirmed
- Linter verification on file form vs directory form (DOCTRINE 9.2): logic verified correct
- Guard removal condition (`!Claude Design/proposed/` in prompt body): met

Risks Marco should know:
- None. This is a documentation/gating amendment that strengthens verification of an existing (HOLD) prompt. No code paths touched, no migrations, no behavioral changes to the system. The single-commit bundling of guard removal + prompt amendment is intentional and justified to avoid an unarmable window state.

Recommendation: Safe to merge. The amendment addresses identified defects in gating logic and correctly applies DOCTRINE 9.2 on check-ignore file vs directory forms.
