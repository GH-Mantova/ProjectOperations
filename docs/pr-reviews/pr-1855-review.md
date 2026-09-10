VERDICT: MERGE

## Summary

PR #1855 restores nine U+FFFD replacement characters in sot/03-progress-log.md that have been corrupted since 2026-07-08 (the SoT consolidation). The repair is evidence-backed, using PR #228's undamaged body as the authoritative source. Scope is clean, CI passes, self-verification claims are sound, and no code/schema/migrations are touched.

## Scope compliance

**In scope:**
- sot/03-progress-log.md: 6 lines changed, restoring U+FFFD → proper Unicode (—, §, ×)
- docs/pr-prompts/00-05-sot-keeper-2026-09-10-1411-nine-lost-characters-have-been-on-main-since-the-sot-consolidation.md: breadcrumb file (331 lines, new)
- Markdown only; no scripts, no apps, no migrations, no schema changes — CP-24 clean by construction

**Out of scope:** None. Diff exactly matches stated scope.

## Self-verification claims

- [GREEN] Byte delta predicted before write, read back after: 648,359 → 648,354 = −5 (predicted −5, exact match)
- [GREEN] U+FFFD count: 9 → 0 on read-back
- [GREEN] git diff --numstat = 6 lines in one file only (sot/03-progress-log.md); nothing else touched
- [GREEN] check-sot-refs.mjs → exit 0, total=275 dangling=0 exempt=20 baselined=0
- [GREEN] docs/qa/sot-refs-baseline.json untouched (git diff --numstat origin/main returns empty)
- [GREEN] check-breadcrumb.mjs → exit 0, CLEAN
- [GREEN] build-relationship-map.mjs --check → exit 0 (S6 gate)
- [GREEN] All CI checks: SUCCESS (CodeQL, pr-gates, approval-receipt, pipeline tests) or SKIPPED (doc-only changes expected to skip API/web/data-model jobs)
- [GREEN] Merge state: CLEAN, mergeable: MERGEABLE

## Evidence-backed repair quality

Each of the nine restored characters matches PR #228's undamaged body and file convention:
- 4× `—` U+2014: em-dash convention (409 of 410 dated headings use it; PR body confirms each instance)
- 1× `§` U+00A7: section marker (191 instances in file; pattern `(§5 Tendering)` occurs 3 times)
- 4× `×` U+00D7: multiplication sign (PR body lists counts 4, 3, 4, 5; "2× provisional sums" appears there)

Edit was performed in node via concatenation (never String.replace), with surrounding context matching to ensure exactly-once replacement. Matches DOCTRINE §9.3 (character-level encoding repair on the safe path).

## Risks Marco should know

**None identified.** This is a pure doc-reconcile PR:
- Station 05 did not arm (no `*-ready.md`); this was not fired by the watcher; it is a human-scoped PR
- Station 05 cannot merge its own PRs per house rules — Marco's review gate is intact
- No production data touched; no migrations or schema drift possible
- The breadcrumb documents four companion findings (F2–F5), all properly scoped: F2 escalated to Marco, F3 deferred (Linux sandbox unavailable), F4/F5 dispatched to Station 00

The one subtlety: this station's auto-fix allowlist does not explicitly permit character-level encoding restoration to curated prose. The PR body explicitly declares this as a judgment call ("Scope note, declared rather than buried") and correctly notes that Marco can close the PR if the judgment is wrong; the finding survives either way. This is honest scope-guarding, not a defect.

## Recommendation

Merge. Scope is clean, CI is green, self-verification is complete, and the repair is authoritative. Station 05 correctly opened a reconcile PR and stepped out — Marco's review is the human gate that completes it.
