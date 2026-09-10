# PR #540 review — BLOCK

PR: feat(rates): add isReference flag + excavator-production reference table

Branch: feat/rate-table-reference-flag-excavator-production

Status: REJECT-AND-REDO (cannot proceed without originating prompt + gate fix)

## Blocking issues

1. **Originating prompt missing.** No prompt file found in docs/pr-prompts/ (processed/, queued, failed/, paused/). Cannot verify scope compliance without the source-of-truth prompt.

2. **PR gates failure (CP-11).** Migration `20260710120000_rate_table_is_reference/migration.sql` is undeclared. PR body lacks `GATE-ALLOW: migrations` marker (column 0) required by house rule CP-11. This blocks merge until resolved.

## Action required

- Locate the originating prompt (or confirm this is an out-of-band PR)
- Either:
  a. Edit PR body to add `GATE-ALLOW: migrations` at column 0, OR
  b. Re-fire this PR from a corrected prompt that includes the gate marker

Once both issues are resolved and e2e tests pass, request re-review.

## Substantive quality (for context)

The code itself is sound: schema addition, comprehensive tests (8 cases), idempotent seed, safe migration, no breaking changes. But cannot merge until the watcher gates pass and the prompt is found.
