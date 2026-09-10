# PR #559 Review — Requires Marco Clarification

## Summary

PR #559 ("feat(pipeline): evidence gate, smoke harness, intake-lint fix, numbered agent stations") claims to be merged but commits are not on main. Additionally, no originating prompt file exists in any standard location. Cannot verdict without (1) merge state clarification, (2) originating prompt, and (3) confirmation on agent doctrine training/enforcement.

See full review: `docs/pr-reviews/pr-559-review.md`

## Key Blockers

1. **Merge state inconsistency** — GitHub API reports merged=true, merged_at set, but commits 86becc4 and ba30edc exist only on remote feature branch, not on main HEAD (672502c).

2. **Missing originating prompt** — exhaustive search found zero prompt file across docs/pr-prompts/processed/, needs-marco/, failed/, paused/, or candidate patterns (pr-*559*, *evidence-gate*, *smoke-harness*).

3. **Agent doctrine training unknown** — six numbered stations (.claude/agents/00-05) carry doctrine prose but no mechanism for agents to learn or enforce hard stops. Risk of repeating LL-38 (supervisor merge-in-watcher-repo incident).

## Action Required

Clarify merge status, locate or confirm hand-written origin, and validate agent station training/enforcement model before proceeding.
