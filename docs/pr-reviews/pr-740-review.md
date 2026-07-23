VERDICT: MERGE

## Scope compliance

In scope:
- SECTION 9 (SIDEBAR NAVIGATION) of sot/01-charter-and-architecture.md rewritten to approved 7-group desktop sidebar IA: DASHBOARDS, ESTIMATING, PROJECTS, OPERATIONS, HR, SAFETY & COMPLIANCE, SETTINGS
- DIRECTORY top-level group removed (drift eliminated)
- FIELD mobile bottom nav preserved verbatim
- Only file touched: sot/01-charter-and-architecture.md (43 additions, 30 deletions)
- No code changes, no schema drift, no migrations

Out of scope:
- None. Scope clean.

## Self-verification claims

- [x] `grep -qx "DIRECTORY" sot/01-charter-and-architecture.md` returns non-zero (verified: drift gone)
- [x] Only `sot/01-charter-and-architecture.md` touched (verified: single file in diff)
- [x] FIELD mobile bottom-nav sub-section unchanged (verified in diff output)

## Risks Marco should know

- Docs-only SoT change. No production impact.
- tendering-e2e smoke test is still in progress (IN_PROGRESS status) but this does not block docs-only PRs per house rules.
- PR body explicitly states "Do NOT auto-merge" — Marco must review before merging. Respected.
- Implementation of deferred deletions (/tenders/dashboard, seeded dashboards, /admin/estimate-rates) are tracked as separate follow-ups, not included in this PR — this is correct per PR scope.

## Recommendation

Merge. Scope correct, all applicable checks pass, self-verification confirmed. Marco's manual review is required per the PR's "Do NOT auto-merge" flag.
