VERDICT: MERGE

Scope compliance:
- In scope: Single new HOLD prompt file `pr-settings-home-s1-cards-tabs-counts-HOLD.md` added to docs/pr-prompts queue. Docs-only, no code changes.
- Out of scope: None observed. Correctly limited to prompt staging.

Self-verification claims:
- [GREEN] File is a valid HOLD prompt (gate_allow: none, escalates: false, backfill: false)
- [GREEN] Prompt linted cleanly per PR body ("Lint: ADMIT · size 5 · exit 0")
- [GREEN] Premise verified true at staging time: tabs absent from SettingsHomePage.tsx on origin/main
- [GREEN] All done_when tokens verified absent: "tabs", "All items", "need access" not in current page
- [GREEN] Prompt scope properly defined and justified
- [GREEN] Standing authority noted ("no human in this run")

Risks Marco should know:
- None for this PR itself. It is documentation staging only.
- The prompt contains thoughtful guards against half-building (e.g., forbidding unconfirmed tabs, requiring computed counts not hard-coded mock-up numbers). The prompt quality is high.
- The prompt correctly anticipates that the mock-up may show tabs the app does not have and requires the agent to confirm by reading page components rather than blindly implementing.

CI status:
- All checks green: Changed-path filter, CodeQL, PR gates, pipeline tests all SUCCESS.
- Correctly skipped web/api/schema tests since this is docs-only.
- Mergeable: true

Recommendation: Safe to merge. This is a properly staged, high-quality prompt with clear scope and good risk guards.
