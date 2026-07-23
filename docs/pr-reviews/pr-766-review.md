VERDICT: MERGE

## Scope compliance

**In scope:**
- Stages two code-writer prompts from the naming/IA audit (B1-B4 and A1/A4-A6/A9)
- Both prompts properly formatted with valid YAML frontmatter (premise, scope, done_when, size, gate_allow, escalates)
- Both prompts include STANDING AUTHORITY section (required by house rules)
- Prompt sizes are within limits (2 and 8 files, both under 10-file ceiling)
- Both prompts are -ready.md files, correctly placed in `docs/pr-prompts/`
- PR is docs-only (no code, schema, or sot/ changes)

**Out of scope:**
- None identified

## Prompt validation

Both prompts follow house schema correctly:

**pr-fix-tender-stale-route-links-ready.md (B1-B4):**
- size: 2 (within limits)
- scope: TenderContactsPage.tsx, TenderClientsPage.tsx
- premise: `grep -rEq "/tenders/(create|pipeline)"` (testable assertion)
- gate_allow: none (correct for docs-only)
- Has STANDING AUTHORITY block and guardrails

**pr-fix-page-title-nav-alignment-ready.md (A1/A4-A6/A9):**
- size: 8 (within limits)
- scope: JobsListPage.tsx, TenderingPage.tsx, TenderingReportsPage.tsx, AvailabilityReportPage.tsx, MasterDataWorkspacePage.tsx, e2e tests
- premise: `grep -rEq "Delivery workspace|Availability heatmap"` (testable assertion)
- gate_allow: none (correct for docs-only)
- Has STANDING AUTHORITY block and guardrails
- Includes explicit do-not-touch guidance (operations overview, tab structure, routes)

## CI status

All checks pass or in-progress (e2e still running, but docs-only PR should not affect code):
- API — lint, test, compliance smoke: SUCCESS
- Web — lint, logic tests, build: SUCCESS
- PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23): SUCCESS
- Data model — generator sanity: SUCCESS (no schema.prisma touched)
- tendering-e2e: IN_PROGRESS

## House rule compliance

- Both prompts are committed to docs/pr-prompts/ (not untracked)
- No mixed code/docs violation (docs-only)
- No schema.prisma changes (data-model sanity check passes)
- No gate markers needed
- Proper escalates/seed_only flags
- Marco-approved per PR body ("Marco-approved; test/display only")

## Risks

None identified. This PR stages two well-formed, correctly-scoped prompts for future agent firing. The prompts themselves instruct the agents to handle e2e test updates, which is a proper part of the work.

Recommendation: Merge once tendering-e2e completes (should pass since PR is docs-only).
