VERDICT: MERGE

Scope compliance:
- In scope: Corrects DOCTRINE §9.5 (arming-log tracked-status claim), re-records canonical hashes, commits the 13 unpublished arms to `.arming-log.txt`, deletes the spent `-HOLD` twin, archives two completed breadcrumbs. All changes inside `docs/`.
- Out of scope: None. This is a hand-landed Station 00 board PR per DOCTRINE §10.3 (binding law, canonical block, correction to DOCTRINE itself).

Self-verification claims:
- [PASS] Canonical hashes recomputed: `instruments v2 7ab89207dac0765c` in `_canonical-blocks.json`
- [PASS] Lint re-run confirms "ADMIT: all 8 docs clean" (was REJECT before re-record)
- [PASS] 13 new arm lines committed to `.arming-log.txt` (37→50 lines, dated 2026-09-03 06:05:18Z through 2026-09-04 11:29:24Z)
- [PASS] `-HOLD` twin `pr-lint-gate-path-space-HOLD.md` deleted from tracked files
- [PASS] Two breadcrumbs archived safely (basename-matched by check-breadcrumb.mjs, verified CLEAN exit 0)
- [PASS] CI green: PR gates, approval receipt, pipeline tests, arm-prompt tests all SUCCESS; skips expected for docs-only

Risks Marco should know:
- None. Hand-landed per DOCTRINE §10.3 authority scope. No watcher verdict expected or required (absence is explicit per §10.1). Corrects a false claim in binding documentation (DOCTRINE §9.5). CI is fully green. All self-verification claims verified.

Recommendation: Safe to merge. Corrects DOCTRINE's false claim about arming-log tracked status, commits the stale arms, and cleans up the spent `-HOLD` twin as pattern-established in #1584.
