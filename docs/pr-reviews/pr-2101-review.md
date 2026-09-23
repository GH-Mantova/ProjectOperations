VERDICT: MERGE

Scope compliance:
- In scope: Single file addition `docs/pr-prompts/pr-scopecards-s8a-travel-time-snapshot-HOLD.md` to stage the S8a (truck cycle travel-time) prompt as HOLD pending upstream dependency merge.
- Out of scope: None identified. No API/schema/migration code in this PR; pure documentation.

Self-verification claims:
- Prompt file structure: valid YAML frontmatter with required fields (premise, scope, done_when, gate_allow, escalates, requires_on_main) [VERIFIED via diff]
- File placement: correctly named with `-HOLD.md` suffix to indicate waiting state [VERIFIED]
- CI status: all checks passing (lint, linter tests, watcher tests, PR gates) [MEASURED - all SUCCESS or SKIPPED]
- Frontier compliance: prompt correctly identifies upstream dependency `CUTTING_ONE_SURFACE_V1` via `requires_on_main` [VERIFIED]

Risks Marco should know:
- PR carries no originating prompt reference in git history (likely created via Claude Code and watcher-fired as normal staging operation). This is low-risk for a documentation-only PR but worth noting.
- Prompt has `escalates: true`, so when this becomes `-ready.md` it will auto-acquire `do-not-merge` label per DOCTRINE.md 8.3a. That is correct behavior and requires no action now.
- Prompt declares `size: 7` and `gate_allow: migrations`, which will be enforced when the prompt runs (not now).

Recommendation: Safe to merge. This is a documentation-staging PR with clean scope and passing CI.

---

**Provenance note:** [MEASURED] via `gh pr view 2101 --json files,statusCheckRollup,body` at 2026-09-23, verified git SHA context from recent commits (a31e86d5 main tip).
