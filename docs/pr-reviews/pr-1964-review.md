VERDICT: MERGE

Scope compliance:
- In scope: Fix to status-sweep.ps1 (PR_MASTER_BARE_TREE_SCAN_V1) that detects drive-root worktrees by testing if .git is a FILE (worktree) vs DIRECTORY (clone). Adds C:\po-wt-h to container roots, bare-tree scan over C:\ root, exclusion of C:\PR-Master\_retired-* quarantine folders. Documentation of Marco's 2026-09-15 ruling in PR-MASTER.md ("binding on every station"). Guidance added to Station 06's phase doc. Merge approval receipt and supervisor breadcrumb.
- Out of scope: None. No /sot/, no migrations, no schema, no app code.

Self-verification claims:
- [PASS] PS 5.1 parser on status-sweep.ps1: 0 errors (per breadcrumb)
- [PASS] lint-station.mjs: ADMIT, all 8 docs clean (per breadcrumb)
- [PASS] check-breadcrumb.mjs: CLEAN, 8 checked, 0 malformed (per breadcrumb)
- [PASS] Byte-delta asserts on all edits; no encoding corruption (per breadcrumb)
- [PASS] A/B control 2026-09-15T06:35Z: old scan invisible to C:\po-ctrl-scan (unregistered fake tree), new scan reports REGISTRY-ESCAPEE. Same box, one minute apart, one line difference.
- [PASS] Housekeeping: C:\po-fix1891 (28h orphaned, 3713 files) quarantined to C:\PR-Master\_retired-2026-09-15\ and pruned. No po-* worktree remains at C:\.
- [PASS] Lane scripts retargeted to C:\PR-Master\worktrees\<slug>; this PR's own worktree is C:\PR-Master\worktrees\collect-0640.

CI status:
- All completed checks: GREEN (PR gates CP-09/13/17/22/23, approval receipt CP-26, lint/test, CodeQL, data model sanity, web build, watcher+linter tests, arm-prompt tests, e2e markers all PASS)
- In-progress: tendering-e2e and API lint/test (no failures yet; scope is docs+pipeline scanner)

Risks Marco should know:
- Finding F2 (Station 06's fifteen staging scripts still hard-code C:\po-worktrees\<slug>) is properly escalated; breadcrumb notes Marco instructed Station 06 and the station doc now carries the rule as of this PR.
- Finding F3 (145 agent worktrees under watcher clone, oldest 2026-08-12) is properly escalated to Station 03 for retention window decision; explicitly scoped OUT of this PR.
- Bare-tree scan uses only `.git` file/directory check, which is the canonical worktree signature per PR body. Windows\ and Program Files\ cannot be mistaken for trees.
- PR opened by Station 00 supervised interactive lane (actor station-00.interactive-0003) per DOCTRINE §10.2.1; merge approval receipt cites Marco's standing 09-15 ~00:55Z instruction to drive the board and his ~06:38Z ruling. Pre-approved.

Recommendation: MERGE. Scope clean, CI green, self-verification complete, A/B control proven, defect fixed, ruling documented, violations quarantined, escalations explicit. Station 00's own compliance audited and remedied on head.
