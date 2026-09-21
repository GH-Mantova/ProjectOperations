VERDICT: MERGE

Scope compliance:
- In scope: One new prompt file `docs/pr-prompts/pr-scopecards-s2a-quote-destination-api-HOLD.md` (311 lines, docs-only). No code, no migrations, no sot/. Correct file name and HOLD suffix.
- Out of scope: None.

Self-verification claims:
- [md5 hash and grounding references present] — VERIFIED
- [Lint check performed against S1 marker gate] — VERIFIED (GATE_NOT_RELEASED due to S1 not yet on main; PROMOTE when gated correctly)
- [No code, no migrations, no sot/ touched] — VERIFIED
- [Prompt is sound per Marco's 2026-09-15 approval] — VERIFIED (five design calls documented in PR body)
- [CI all green] — VERIFIED (path filters, CodeQL, linter, PR gates all PASS; code-build jobs correctly skipped)

Risks Marco should know:
- None. This is a documentation-only PR staging a prompt. No execution, no runtime impact. The prompt itself (S2a) requires S1 (SCOPE_OPERATIONAL_COSTS_PRICED_V1) to be on main before an agent can execute it; that gate is correctly wired in the prompt's `requires_on_main` field and the linter caught the gate-not-released state. The HOLD suffix confirms Marco has not yet released it.

Recommendation: Merge. Safe documentation update, no code risk, all checks pass.
