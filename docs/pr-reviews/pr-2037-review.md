VERDICT: MERGE

Scope compliance:
  - In scope: Housekeeping move of a HOLD prompt to superseded/ after the gated work (SLICE-4c, PR #1125) shipped.
  - Out of scope: None. This PR touches only gitignored docs/pr-prompts/ and carries no code changes.

Self-verification claims:
  - [x] PR #1125 merged and verified: confirmed merged 2026-08-14 commit 62ff4332, work completed (AI-keys entry surface retired, redirect to vault panel in place).
  - [x] HOLD precondition satisfied: SLICE-4b (unified API Keys page, PR #1111) long merged; SLICE-4c work completed.
  - [x] Pure git move, no content changes: diff confirms file rename only, no modifications to the prompt itself.
  - [x] Destination directory exists and archival policy applied: superseded/ directory is the correct archive location for retired prompts.

Risks Marco should know:
  - None. The renamed file is gitignored (docs/pr-prompts is not tracked), so this move is purely administrative and has zero impact on the compiled codebase, CI gates, or runtime behavior.
  - The prompt correctly notes that ProviderKeyManager.tsx remains as dead code in apps/web/src (only referenced from a comment in App.tsx); that cleanup was explicitly deferred and will be a separate slice.

Recommendation: Safe to merge. This is a tidy archival of a completed feature spec after its gated work shipped.
