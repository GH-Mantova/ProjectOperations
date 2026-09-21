VERDICT: MERGE

Scope compliance:
- In scope: Station 00 board collection PR — breadcrumb logs from 0308/0408/0508/0608 runs (00) and 0610 run (04), plus this run's own. Queue state updates (.arming-log.txt, sweep-rotation.json). Two spent prompt retirements (brandtheme-s4 and geocodify-v2-host, work already merged to main). Five 2026-09-11 breadcrumbs archived.
- Out of scope: None. All changes are docs/ and queue bookkeeping. No code, no migrations, no /sot/, no Azure.

Self-verification claims:
- Breadcrumbs: check-breadcrumb.mjs exit 2, structure validated (9 checked, 0 malformed). PASS.
- Spent prompt retirement: both lint-prompt.mjs verdicts verified (brandtheme exit 3 STALE; geocodify verified against origin/main with git grep probe — premise FALSE on main, still TRUE in 3-behind working tree). PASS.
- No .arming-log.txt overwrite: git diff --numstat shows "2 0" (strict superset, insertions with zero deletions). PASS.
- Queue state advance: sweep-rotation.json advanced by Station 04 authority (index 1 → 2, timestamp updated). PASS.
- Escalations discharged: three [STALE] rows (pr-1898, pr-1911, pr-1913) moved to needs-marco/discharged/ with discharge note; status-sweep.ps1 §5 recount 55 → 52 confirms the move. PASS.

Risks Marco should know:
- F1 (Require cycle latent on main): The breadcrumb documents a real cycle in reporting.service.ts ↔ tender-winloss-report.definitions.ts, latent on main, surfaced by #1920's new spec. Station 00 pushed a fix to #1920's branch (extract helpers to reporting.helpers.ts), but the breadcrumb was written while CI was still in progress on that fix. The fix itself is NOT in this PR — it's on #1920's branch. This PR correctly documents the finding and the action taken. Status of #1920's fix is Marco's to monitor (it was in ADDENDUM when breadcrumb was written, showing a second push after the first was incomplete).
- F2 (Dev tree lag): The breadcrumb correctly identified that the 3-commit lag made lint-prompt.mjs report spent prompts as armable. Both are now retired in this PR. This is a known trap (documented) and was handled correctly via origin/main git grep probe.
- F3 (EA-2a will re-appear on next FF): The breadcrumb notes pr-ea-s2a-dashboard-preset-seed will re-appear on the dev tree's next fast-forward since #1920's diff doesn't retire it. This is deferred to the next sighted run with an explicit instruction. Documented as forward guidance, not a defect.
- CI Status: All checks on #1921 GREEN/SKIPPED (appropriate for docs-only). CodeQL passed. Pipeline watcher + linter tests passed.

Recommendation: Merge. This is a clean board collection PR with all CI passing. It correctly documents findings and actions taken, retires spent prompts, and updates queue state. The only real action item (F1's require cycle fix on #1920) is correctly documented as happening to a separate PR and is Marco's to verify.
