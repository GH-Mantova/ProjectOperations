VERDICT: REJECT-AND-REDO

Scope compliance:
- In scope: File renames (pr-erp-muster-headcount-HOLD.md -> -ready.md, pr-ops-m1b-map-page-HOLD.md -> -ready.md), status updates in frontmatter/body
- Out of scope: None

Self-verification claims:
- [FAIL] PR body claims gates are satisfied on origin/main b6e63cb, but verification shows:
  - `model SiteAttendance` absent from apps/api/prisma/schema.prisma (gate requirement)
  - `model MapLocation` absent from apps/api/prisma/schema.prisma (gate requirement)
  - apps/api/src/modules/map-locations/map-locations.module.ts does not exist (gate requirement)

Risks Marco should know:
- The PR body falsely certifies that gate conditions are met. ARMED prompts will fire expecting their prerequisite code (site sign-in for muster, locations-register for map-page) to already exist on main, but they do not. This will cause the autonomous agents to discover unmet prerequisites and likely fail with NO-OP or incorrect implementation.
- The pr-erp-muster-headcount prompt's premise is `! grep -q "model MusterEvent" apps/api/prisma/schema.prisma` (must NOT exist yet), which is still true. However, the prompt's gate-allow and scope assume SiteAttendance is already on main as the attendance source. If armed now, the agent will find no SiteAttendance and the work will be incomplete or wrong.
- The pr-ops-m1b-map-page prompt's requires_file_on_main guards (model MapLocation, map-locations.module.ts) are documented in the prompt frontmatter but will NOT pass when the agent checks, causing an early NO-OP.

Recommendation:
Do NOT merge. The gates referenced in the PR body do not exist on main yet. Either (1) wait until the predecessor PRs (pr-erp-site-signin and pr-ops-m1-locations-register) have actually merged to main, then re-fire this PR, or (2) if those PRs have been merged elsewhere, fetch the current main and verify the gates locally before re-submitting. The prompt files themselves are correct; only the factual claims in the status lines are wrong.
