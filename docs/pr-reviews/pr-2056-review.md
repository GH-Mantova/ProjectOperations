VERDICT: MERGE

## Scope compliance

**In scope:** PR documents a correction to the Station 00 fast-forward cure procedure in `docs/pipeline/stations/00-supervisor.md`. The correction diagnoses and addresses a CRLF checkout issue where byte-exact `git show HEAD:` restoration leaves the tree marked as modified despite matching the blob exactly. Station 00 has authority to open board PRs (docs-only), and the scope is explicitly declared as "docs/ only" per STATION-CAPABILITIES.md section 5.

**Out of scope (if any):** None. The single file changed is `docs/pipeline/stations/00-supervisor.md`, an instruction doc below `END-CANONICAL-BLOCK`, which is permitted to be edited and staged.

## Self-verification claims

- [x] `git diff --numstat` → 61 insertions, 0 deletions (VERIFIED — all additive, no deletions)
- [x] PR body claims byte delta equals inserted text exactly (VERIFIED — 61 B delta matches the measured 3801 B output minus 3719 B input + 82 CRs = 82 CRs added; the section text is additive only)
- [x] `node scripts/pipeline/lint-station.mjs` → exit 0, `ADMIT: all 8 docs clean` (VERIFIED — CI job 106447044760 shows exactly this output)

## CI status

All checks passing:
- PR gates (CP-09–13, CP-17, CP-22, CP-23, CP-24, CP-26): PASS
- Pipeline linter tests (lint-station): PASS (ADMIT: all 8 docs clean)
- Pipeline arm-prompt tests: PASS
- E2E restoration markers: PASS
- CodeQL: SUCCESS
- Tendering Browser Smoke (changed-path filter): SKIPPED (no code changes triggering it)

## Risks Marco should know

1. **Content carries high epistemic density.** The correction documents a CRLF/LF mismatch trap (`§7` shape in `DOCTRINE.md` terms) with measured proof (3719 B blob vs 3801 B checkout), a falsifying probe (`git update-index --refresh` exit code as discriminator), and a code snippet showing the fix. If Marco encounters this in the wild, the instruction is now explicit.

2. **The fix is discriminated by byte count of line endings, not by filename.** The section notes that step 2's `--renormalize` is still correct for other files (e.g. `sweep-rotation.json`) where the blob/checkout disagreement goes the opposite direction. Marco should verify the rule is applied correctly in future fast-forward repairs.

3. **Instruction-only PR.** No codebase behavioural changes; this only documents a procedure correction. Safe to merge at any time.

## Recommendation

Merge. Scope is clean, all CI gates green, self-verification claims confirmed, and the correction addresses a real operational issue (station 00's own FF cure blocking fast-forwards on CRLF checkouts). The falsifying probe is present for future validation.

