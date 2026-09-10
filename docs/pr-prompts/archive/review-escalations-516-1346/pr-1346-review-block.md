# PR #1346 Review Block

PR #1346 was auto-closed without merge because its substantive changes (the four DOCTRINE §9 corrections for v1→v2 bump) are already on main via PR #1345, which merged 11 minutes earlier. However, the v2 branch also contains the same corrections plus minor wordsmithing refinements (better prose in §9.2/§9.4/§9.5) and an unrelated test file deletion (allocation.service.spec.ts, 304 lines). 

**Action**: Do not merge PR #1346 as-is. If the wording improvements are valuable, extract ONLY those hunks (no test deletion) and fire a new micro-PR against main's current instruments v2. This keeps the hash stable and scope clean.

Current state: mergeStateStatus = BEHIND, mergeable = true, CI = all green, but substantively redundant.
