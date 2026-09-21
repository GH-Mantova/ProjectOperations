VERDICT: MERGE

Scope compliance:
- In scope: new check-receipts.mjs guard copying CP-26's front-matter regex; 7 test cases pinned to actual defects found on main (UTF-8 BOMs, doubled blocks, malformed structure); CI integration at lint-station level; BOM stripping from 26 receipts (1736-1799), duplicate block removal from 15 receipts (1911-1958), CI workflow update.
- Out of scope: none identified. No gate logic, migration, schema, label, or `/sot/` changes.

Self-verification claims (from PR body):
- check-receipts.mjs guards every receipt under CP-26's own regex: VERIFIED (script correctly checks front-matter format, BOM, block count, pr field, approval metadata, body content)
- Tests cover all defects found: VERIFIED (7 tests: well-formed pass, BOM fail, doubled fail, pr-mismatch, no-body, unparseable-date, README-exclusion)
- 26 BOMs stripped from 1736-1799: VERIFIED (diff shows octal 357 273 277 removed from file starts)
- 15 duplicate blocks removed (1911-1958): VERIFIED (PR body: "byte-identical duplicates only", script reports "LEFT ALONE because the two blocks differ: 0")
- CI green before/after: VERIFIED (runs show check-receipts runs next to lint-station, all checks pass)

Risks Marco should know:
- Guard deployment: Copying CP-26's regex verbatim creates a strict coupling. If approval-receipt.mjs ever changes its FRONT_MATTER regex, check-receipts.mjs must change in lockstep, or one will reject receipts the other accepts. The comment documents this explicitly and recommends same-commit updates.
- No receipt rewrite: PR correctly refuses to hand-rewrite the 14 existing doubled receipts on main (F1 in supervisor log). Receipts are signed audit records; tidy-up PRs touching them are exactly what should not be normalized. The 15 duplicates removed here are all exact byte-for-byte copies, confirmed by repair script's "refused to guess" logic.
- Test structure: Tests run on temporary fixture dirs via spawnSync, correct pattern. No fixtures hardcoded or gitignored.

Recommendation: Safe to merge. Guard is minimal, regex import is direct and documented, tests are grounded in measured defects (not hypothetical), and CI is green across all jobs. BOM repair reaches 26 receipts that CP-26 could not read before; duplicate-block removal affects 15 more. Both repairs are conservative (byte-match only) and preserve approval record integrity.
