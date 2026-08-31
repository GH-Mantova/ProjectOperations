VERDICT: MERGE

Scope compliance:
- In scope: Supervisory breadcrumb (Station 00 findings document) containing self-correction of F3 (CP-26 mechanism claim).
- No code, migrations, or schema changes — docs-only PR.
- No out-of-scope files.

Self-verification claims:
- Measured four required status checks via GitHub API (CodeQL, API lint/test/compliance smoke, Web lint/vitest/build, tendering-e2e). ✓
- Confirmed PR gates — diff checks is NOT in the required list, so CP-26 is advisory. ✓
- Retracted overstated claim that CP-26 can refuse a merge. ✓
- Re-stated the finding correctly: CP-26 colours a non-required check; label removal destroyed the visible marker, not the gate. ✓

Risks Marco should know:
- None at code/schema level. Breadcrumb is operational documentation of findings from the 06:09Z run.
- The core question to Marco remains unchanged: did you remove do-not-merge from #1431 at 05:53:54Z? (Label removal is documented and measured; attribution is not.)

CI status: All required checks pass. Optional checks (api/web/e2e) skipped due to docs-only path filter. MERGED.

Recommendation: Already merged and safe. No follow-up needed.
