VERDICT: MERGE

Scope compliance:
- In scope: Station 00 supervisor pipeline collection PR. Archives five dispositioned breadcrumbs to docs/pr-prompts/archive/ (shown as renames) and adds this run's own breadcrumb (new file). All changes are within docs/pr-prompts/, consistent with STATION-CAPABILITIES §5 (Lane: 00 board PR, `docs/pr-prompts/` only).
- Out of scope: None. No code changes, no sot/ edits, no product mutations.

Self-verification claims:
- [PASS] node scripts/pipeline/check-breadcrumb.mjs → CLEAN, exit 0 (structure 1 checked / 0 malformed) — stated in PR body and confirmed via file content
- [PASS] node scripts/pipeline/lint-station.mjs → ADMIT, all 8 docs clean, exit 0 — stated in PR body and confirmed via file content
- [PASS] Five breadcrumbs archived: all five files shown as RENAMED to docs/pr-prompts/archive/ in the PR file list, with correct source filenames matching the body's list (1409, 1508, 1607, 1410, 1411)
- [PASS] New breadcrumb added: 00-00-supervisor-2026-09-17-1707-* file added with 283 lines of content matching the PR body
- [PASS] No armed prompts: body states "Armed 0 at open and at close" — no new -ready.md files in the diff
- [PASS] No sot/ edits: breadcrumb explicitly states "No `/sot/` edit" and no sot/ files appear in the PR file list
- [PASS] No product mutations: body confirms "Nothing was armed, labelled, closed, rebased or merged on the product board" — only docs/pr-prompts/ changed

Risks Marco should know:
- F-1 escalation: The breadcrumb records a third measured instance of an open escalation (dispatched-findings-have-no-file-backed-home-2026-09-10). This is purely a measurement and appended to an existing escalation; no new problem introduced by this PR.
- F-3 dispatch: The breadcrumb notes that pr-queue-layout-sot-entry-HOLD.md is live work awaiting Station 05, not this station. This is a hand-off concern, not a blocker for this PR.
- Board state: Three product PRs (#2005, #2002, #1998) remain parked by design with do-not-merge labels. Their CP-26 gate is working as intended. This PR does not affect them.

Recommendation: Merge. Pure documentation/observation PR with clean CI, scope-compliant, and substantive self-verification fully satisfied.
