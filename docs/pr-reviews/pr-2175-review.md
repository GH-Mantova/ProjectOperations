VERDICT: MERGE

Scope compliance:
- In scope: All changes are under `docs/` (DOCTRINE.md §9.4 expanded with a fourth transport of the `--jq` string-literal trap, and _canonical-blocks.json hash re-recorded; breadcrumb file added). PR body correctly names "LANE: Station 00 — Supervisor, inside its own recorded authority" (DOCTRINE §10.1 step 3), and Station 00 is authorised to merge docs-only PRs per STATION-CAPABILITIES.md section 5.
- Out of scope: None. No files outside `docs/` touched. No `/sot/` mutations. No migration files. No code or test changes.

Self-verification claims:
- [PASS] Byte delta asserted: 226,897 → 229,899 = +3,002 expected, match true
- [PASS] New marker `JQ_STRING_LITERAL_STRIPPED_UNDER_FILE_TOO_V1` present and occurring exactly once
- [PASS] Prior anchor still intact (DOCTRINE §9.4 structure preserved)
- [PASS] `instruments` canonical hash re-recorded from `6ac6d53e81f4cef7` to `35ed506f13509629` (verified in _canonical-blocks.json)
- [PASS] `lint-station.mjs` claimed rejection before re-record and admission after (stated in ADDENDUM B; linter gate passed in CI)
- [PASS] `git diff --numstat` states exactly `37 0 DOCTRINE.md` and `1 1 _canonical-blocks.json`
- [PASS] Control pair on falsifying probe: `--jq '"LITERAL"'` documented as the decisive control to confirm double quotes are stripped before jq receives them
- [PASS] Two corrections to existing record clearly stated: (1) not confined to `-Command`, also affects `-File`, (2) not just escaped quotes, bare quotes stripped too
- [PASS] Cure clearly documented: never discard stderr, never skip $LASTEXITCODE on gh --jq calls, prefer @csv or bare path over string literals

Risks Marco should know:
- None. This is a documented canonical block addition with no runtime impact. Blast radius among committed callers is zero per the finding (every `--jq` in `scripts/` uses no inner string literal). The exposure is to ad-hoc agent probes, and the purpose of the document is exactly to warn against this pattern. ADDENDUM section confirms no label readings in the supervisor's own run were affected (all used `--json` plus `ConvertFrom-Json` per the prescribed form).

CI status:
- All 14 checks passing (some correctly SKIPPED for docs-only changes): Pipeline tests, PR gates, CodeQL, Tendering smoke filter all SUCCESS.

Recommendation: Safe to merge. The PR lands a critical safety finding from Station 04 into DOCTRINE with proper verification, canonical hash re-record, and zero scope creep. Marco may merge.
