VERDICT: MERGE

Scope compliance:
- In scope: new script `scripts/pipeline/new-worktree.ps1` (PO_WORKTREE_HELPER_V1), updated guidance in `docs/pipeline/PR-MASTER.md` (new "How you create one" section with refusal table), updated station 06 step 1 in `docs/pipeline/stations/06-pr-master.md` (reference to the helper).
- Out of scope: none. No code paths, no migrations, no seed, no `/sot/` changes, no git worktree state mutations (self-test fixture was explicitly moved to quarantine per design, not left on disk).

Self-verification claims:
- Parser syntax check (PS 5.1): PASS (0 errors reported)
- Refusal logic (slug validation, root validation, occupied path): PASS (13/13 green)
- Create/remove/list operations: PASS (worktree created, verified .git is file, removed, pruned correctly)
- No drive-root orphans: PASS (drive-root scan: 0)
- Fixture quarantine (not deletion): PASS (file verified present after move to `C:\PR-Master\_retired-2026-09-15\po-helper-occupied`)
- Lint (lint-station.mjs): PASS (all 8 docs clean, exit 0)
- CI: PASS (all 14 checks green: CodeQL, gates, smoke, linter, data-model, web, API)

Risks Marco should know:
- Station 06's fifteen `s06-stage*.ps1` scripts still use legacy `C:\po-worktrees\<slug>` paths; they are identified as the first callers the next sweep should retarget to use the helper. Not in scope of this PR.
- Reference smoke trees at `C:\ProjectOperations-Reference\worktrees\po-{n}-smoke` (mentioned in `docs/pipeline/stations/02-board-driver.md:391`) were not retargeted. PR body asks Marco whether that root should move under `C:\PR-Master\worktrees\` or remain his own reference material. Not a blocker for merging this PR.

Recommendation: Safe to merge. The helper is a well-designed refusal-based entry point that closes the path-at-drive-root defect, self-tested and documented. Future follow-ups to retarget Station 06 and 02 can use the helper as the canonical path-creation instrument.
