# PR 550 — Review block reason

PR #550 ("docs(scheduler): design spec + phased plan for unified resourcing") is BLOCK because its own PR body contains an explicit gate: "Do not merge until Marco reviews" and "Do NOT merge this PR until the above is done" (referring to Marco reading the spec and answering four conflict questions). However, the PR was merged to main before that gate was satisfied.

The spec content itself is sound (accurate analysis of schema, reasonable phased plan, D1–D6 conflict identification). The blocker is procedural: Marco's answers on D1 (WBS depth), D3 (activity floor), and D6 (transitional window timing) are required to resolve ambiguity in the build phases, but were never collected on record before merge.

**Action:** Revert PR 550 to draft state (close without merge, or restore main). Have Marco read docs/architecture/drafts/scheduler-resourcing-spec.md and docs/pr-prompts/needs-marco/scheduler-spec-conflicts.md, record his three answers (A/B/C options) as a comment on the PR thread, then re-fire the prompt to promote durable parts into sot/06-active-specs.md with recorded decisions.
