VERDICT: MERGE
REVIEWED-SHA: e30af9bca3054def80ea24b81b7a3321f7afef17

Scope compliance:
- In scope: Deletion of the 0315 breadcrumb's duplicate root copy (left in archive as the single home after PR #2305). Documentation of F13 (the mistake and correction) added to 0614 breadcrumb. Both actions were explicit in the originating prompt's WHAT CHANGED section and F13 findings.
- Out of scope: None. Docs-only, no migrations, no schema changes, no code touches. The 0416 breadcrumb archiving was completed in a prior run; this PR addresses the aftermath.

Self-verification claims:
- [GREEN] Root copy of 0315 deleted (300 deletions shown in diff)
- [GREEN] Archive copy of 0315 preserved (verified in tree listing: `docs/pr-prompts/archive/00-00-supervisor-2026-10-10-0315-merged-the-0214-board-pr-and-measured-the-instrument-lane-cannot-cover-a-watcher-built-fix.md` exists)
- [GREEN] F13 findings documented in 0614 breadcrumb (45 additions shown in diff, F13 section present covering the mistake, the CRLF workaround, and the gas-leak condition for the next run)
- [GREEN] Dev tree worktree cleanup tracked (F13 notes dev tree held sweep-rotation.json dirty; this was left for Station 04 as noted)
- [GREEN] Escalation filed (prompt says one new escalation to needs-marco; verified in F3 of the 0614 breadcrumb as `spent-hold-gate-fails-closed-against-the-broken-instrument-bins-nothing-contract-2026-10-10.md`)

CI status:
- All checks PASSED: Changed-path filter (CI, CodeQL, Tendering Browser Smoke), Analyze (actions, javascript-typescript), E2E restoration markers, PR gates (CP-09-13, CP-17, CP-22, CP-23), Approval receipt (CP-26), Pipeline tests (watcher+linter, arm-prompt, Windows), CodeQL final. No failures, no timeouts.

Risks Marco should know:
- The 0614 breadcrumb notes an uncommitted state left in the dev tree by Station 04 (`docs/pipeline/sweep-rotation.json`, marked dirty). This is intentional per the prompt (Station 04's state, not 00's to commit), and will block the next fast-forward only if PR lands that path. No action required this merge.
- F13 documents a subtle contract: `check-breadcrumb.mjs`'s `NOTE … is UNTRACKED` absence means "already tracked, use git mv not copy". This is now in writing; the next archiving action can reference it.
- F1 (blind run COLLECT ordering), F3 (spent-hold gate + broken-instrument contract collision), and F6 (INSTRUMENT_LANE_V1 unreachable for watcher-built fixes) are escalated to needs-marco with options. These are live decisions in front of Marco, not blocking this merge.

Recommendation: Merge. Scope clean, CI fully green, substantive work verified (duplicate retired, findings documented, escalations filed). No schema drift, no migrations, no auth surface changes. The breadcrumb's own read-backs confirm the work was done before commit.
