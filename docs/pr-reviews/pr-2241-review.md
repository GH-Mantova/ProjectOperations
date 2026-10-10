VERDICT: MERGE
REVIEWED-SHA: 4ff2e924b7b16c042f429aae79dc981cecc2064d

## Scope compliance

**In scope:**
- Single-line rewording of the CAUTION text in the board-lease HOLD prompt (line 105).
- Avoids triggering the `arm-prompt.ps1` DO NOT ARM guard by changing "Do not arm" to "Hold off arming".
- Minimal change; preserves meaning and intent of the caution.
- Same pattern as PR #2232 (S7a brand-theme-builder HOLD).

**Out of scope:**
- None.

## Self-verification claims

- [PASS] One file changed (+1, -1) — wording-only edit.
- [PASS] Commit message accurately describes the fix and the reason.
- [PASS] PR body explains the DO NOT ARM false positive and the solution.

## CI status

All checks passed (9/9):
- Changed-path filter (CI): SUCCESS
- Changed-path filter (Tendering Browser Smoke): SUCCESS
- PR gates (diff checks): SUCCESS
- Approval receipt (CP-26): SUCCESS
- Pipeline watcher + linter tests: SUCCESS
- Pipeline arm-prompt tests (Windows): SUCCESS
- E2E restoration markers: SUCCESS
- CodeQL (actions, javascript-typescript): SUCCESS

## Risks Marco should know

None. This is a documentation fix to an unpublished HOLD prompt. The board-lease feature work itself is deferred (status: escalates: true, Marco-only). The reword aligns with Marco's 2026-10-03 ruling and removes a false-positive gate block that would prevent the feature's own HOLD from being armed.

## Recommendation

Safe to merge. Surgical fix, green CI, no code changes.
