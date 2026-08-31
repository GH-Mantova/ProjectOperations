VERDICT: MERGE

Scope compliance:
- In scope: Single documentation file (docs/pr-prompts/00-06-pr-master-2026-08-31-0137-scope-sub-and-charging-methods.md) recording measurements and corrections to Station 06 breadcrumb. Docs-only satisfies CP-24. Contents include: real lint-prompt.mjs output for nine prompts (seven new + two hygiene slices), check-breadcrumb.mjs validation (exit 0 CLEAN), measured premise checks (all PASS), live queue state validation, and three corrections to findings from the earlier 02:08 breadcrumb copy.
- Out of scope: None identified.

Self-verification claims:
- [VERIFIED] Lint output recorded: three ungated heads ADMIT (est#1 size 5, sub#1 size 6, hyg#1 size 3); six gated HOLDs return GATE_NOT_RELEASED (correct for parked slices). No exit 3 anywhere.
- [VERIFIED] Breadcrumb validation: check-breadcrumb.mjs --station 06 → exit 0 CLEAN.
- [VERIFIED] Correction 1 (DOCTRINE §9.2): correctly clarified that the ban applies to git THROUGH the device bridge (Linux VM), not all git. Desktop Commander (native Windows process) is not affected. Every git call in the run was read-only and section text correctly states Desktop Commander cannot produce the orphaned index.lock signature.
- [VERIFIED] Correction 2 (GitHub MCP 403): tested and confirmed. API token is read-only: create_branch, create_or_update_file both return "403 Resource not accessible by integration". Get_me succeeding does not indicate write access.
- [VERIFIED] Correction 3 (F5 RateColumn conflict): retracted in place per author's statement. Re-reading confirms no RateColumn semantics conflict: pr-rates-value-column-units sets unit on rows (not semantics), pr-estpricing-s3 adds RateTable column (not RateColumn), only real overlap is one file (RatesListsAdminPage.tsx) which is a dependency, not a conflict.
- [VERIFIED] GROUND SHAs filled in at 02:15Z (origin/main c1244317, dev tree main @ c1244317).

Risks Marco should know:
- None. This is a documentation-only update recording measurements and correcting three factual claims from a prior breadcrumb. No code changes, no prompts armed, no mutations to board/queue/git state. Both commits (content by PR Supervisor agent, merge from main by GH-Mantova) are appropriate. All CI checks pass (appropriate jobs green, docs-only skips in place).

Recommendation: Merge. Breadcrumb is complete, measurements are recorded, and three corrections improve accuracy of findings record for future reference.
