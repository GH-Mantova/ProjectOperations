VERDICT: MERGE

Scope compliance:
- In scope: single file rename (pr-scopecards-s7-one-cutting-total-HOLD.md → superseded/) + header comment explaining retirement.
- Out of scope: none.

Self-verification claims:
- N/A (this is a documentation-only retirement, not feature work with self-verification steps).

Risks Marco should know:
- None. PR #2093 (CUTTING_ONE_TOTAL_V1 / S7) confirmed merged at 2026-09-22T21:24:16Z on main. The HOLD prompt is correctly retired.

The PR body notes the reason accurately: the premise greps `cuttingLines.reduce`, but the string survives S7 because the reduce now sums `l.lineTotal` instead of `qty x rate`. The prompt cannot distinguish shipped from outstanding, so arming it would rebuild completed work. Retiring the HOLD is the correct action.

CI: all checks green (changed-path filter, CodeQL, PR gates, pipeline linter, arm-prompt tests, e2e markers).

Recommendation: safe to merge. This is a single-commit, housekeeping PR that documents closure of a shipped feature slice.
