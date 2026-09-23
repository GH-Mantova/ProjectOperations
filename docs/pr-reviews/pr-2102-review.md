VERDICT: MERGE

Scope compliance:
- In scope: Single file addition — docs/pr-prompts/pr-scopecards-s8b-azure-maps-travel-HOLD.md (118 lines)
- The file is a valid prompt staged in HOLD state, awaiting S8a (TRAVEL_TIME_PORT_V1) to merge to main
- Out of scope: None. This is a docs-only PR adding a prompt; no code, schema, or migrations are touched

Prompt structure validation:
- Frontmatter complete and valid (premise, scope, done_when, gates, size, escalates, requires_on_main)
- Explicit do-not-arm marker present with reason: "arm only after Marco has created the Azure Maps account and told Station 06 how the API authenticates"
- Scope files correctly listed (travel-time.ts, azure-maps-travel.provider.ts, schema.prisma, migrations, ScopeWasteTab.tsx, runbook)
- Done-when criteria are testable and unambiguous
- gate_allow: migrations (correct for this feature cluster)
- Predecessor gate stated: requires S8a (TRAVEL_TIME_PORT_V1 on main)
- Instructions comprehensive: what to build (5 sections), tests, do-not section, standing authority

Self-verification claims:
- Prompt file syntax: valid YAML frontmatter and markdown structure
- HOLD filename convention: correct (-HOLD.md, not -ready.md)
- Escalates flag set appropriately (true)
- Marco-gate explicitly documented in both the comment and frontmatter
- Predecessor dependency clearly named for watcher promotion logic

Risks Marco should know:
- This prompt will auto-promote to -ready.md (and fire) the instant S8a merges to main, assuming Marco has created the Azure Maps account and gated the do-not-arm marker removal. No action by Marco is required to stage it; removal of the do-not-arm line is the only gating event.
- The prompt requires two additions to OperationsSettings (travelSampleOffPeak, travelSamplePeak) which must be deployed before the prompt fires.
- The runbook is the only output Marco sees until the prompt arms; the implementation PR itself will carry the code.
- Snapshot columns (travelMinutesOffPeak, travelMinutesPeak) are nullable and additive; no backfill or data loss.

CI status:
- All checks green (CodeQL, pipeline tests, approval receipt, e2e filters)
- Path-based CI skips are expected and correct for docs-only change

Recommendation: Merge. This is a correctly formatted prompt staging PR that introduces no risk and creates the necessary gating machinery for S8b to fire cleanly once S8a lands and Marco configures Azure Maps.
