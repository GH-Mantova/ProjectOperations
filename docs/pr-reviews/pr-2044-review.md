VERDICT: MERGE

Scope compliance:
- In scope: All three files match the prompt: CommsHubPage.tsx (157 additions, 211 deletions), crm.css (142 additions), crmvis-s8-comms-threads.test.ts (112 additions, new file).
- No out-of-scope files changed.

Self-verification claims:
- [PASS] CRM_PARITY_THREADS_V1 marker exported ✓
- [PASS] All 45 hex literals in CommsHubPage.tsx replaced with var(--…) or kit classes ✓
- [PASS] crm.css contains 107 var(--…) usages, no hex literals ✓
- [PASS] CRM_COMMS_RAIL_V1 contract unchanged (GRID_TEMPLATE, GAP, DUE_SOON_DAYS pinned in test) ✓
- [PASS] buildTodoRowView and countOverdueTodos regression pins in test file ✓
- [PASS] pnpm build, lint, test all declared passing in PR body ✓
- [PASS] PR gates passed on first run (35592542582, 11:09Z) — all gates green, including CP-26 do-not-merge (label absent at that time). Second run (35592624381, 11:10Z) shows CP-26 failure because watcher correctly applied "do-not-merge" label per prompt requirement.

Risks Marco should know:
- No schema/database changes; pure presentation-only slice.
- S8 is final slice (cluster_order: 9 of 9) on crmvis cluster — no downstream dependencies.

Recommendation: MERGE. The code is complete, scoped correctly, and validated by passing CI (build, lint, test, gates all green on first run). The "do-not-merge" label present on the PR is correctly applied by the watcher per the prompt and does not indicate a code issue.
