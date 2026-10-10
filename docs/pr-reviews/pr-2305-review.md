VERDICT: MERGE
REVIEWED-SHA: 90531833e7a889842ed0bc174b854d9f433874a7

Scope compliance:
- In scope: Archive 0315 and 0416 breadcrumbs to docs/pr-prompts/archive/; add current cycle (0614) breadcrumb to docs/pr-prompts/ root; file F3 escalation to docs/pr-prompts/needs-marco/ about SPENT_HOLD gate collision between two written rules.
- Out of scope: None detected.

Self-verification claims:
- Breadcrumb validator (`node scripts/pipeline/check-breadcrumb.mjs`) passes: ✓ stated in PR body
- Files present in correct locations (archive, root, needs-marco): ✓ verified
- No other files changed (docs-only, four file adds, no edits to code or sot/): ✓ verified
- No arms, merges, label changes, machine repairs: ✓ verified against "WHAT I DID NOT DO" section

Risks Marco should know:
- F3 escalation correctly identifies a genuine design collision: SPENT_HOLD gate (PR #2303) shells gh pr list and fails closed on probe error (DOCTRINE §7 fail-loud), but nine pre-existing HOLD test fixtures expect fail-safe behaviour ("broken instrument bins nothing"). Both rules are written down; neither was reconciled. Escalation filed with three complete-and-additive options, recommending Option 1 (probe absence-aware: missing gh → ADMIT+WARN, answered gh → REJECT). Does not block merge.
- F5 and F6 escalations carried forward from prior cycles (#2294 do-not-merge, INSTRUMENT_LANE_V1 gate lane scope). Not re-filed (§10.5). Correct.
- Breadcrumb includes 12 findings; all disposed per DOCTRINE (defered/actioned/dispatched/escalated as appropriate). Station 00 correctly stayed in lane (no repairs, no prompt staging).

Recommendation: Merge. PR correctly executes the supervisor's documented scope, CI is green, scope is clean, and escalations are properly filed for Marco's design decisions.
