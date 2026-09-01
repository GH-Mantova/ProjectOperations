VERDICT: MERGE

Scope compliance:
- In scope: All required files present — schema.prisma (isProvisional field added correctly alongside provisionalAmount as per prompt), migration (additive-only with DEFAULT false), scope-redesign.service.ts (perDiscipline buckets extended, provisional-line logic implemented: line is provisional if isProvisional===true OR discipline==="Other"), estimate-export.service.ts (summaryTyped and discBucket extended with provisionalSubtotal/provisionalWithMarkup, provisionalTotal added), estimate-excel.builder.ts (provisional block relabelled and fed by provisionalTotal), scope-of-works.dto.ts (isProvisional optional boolean, defaults false), priced-or-provisional.spec.ts (three required test cases: priced+provisional reconcile, Other-discipline rule preserved, flipping conserves total), quote-html.builder.spec.ts (fixture updated to match new summary shape), docs/data-model/metadata-catalog.json (regenerated).
- Out of scope: None detected.

Self-verification claims:
- [PASS] pnpm build
- [PASS] pnpm lint
- [PASS] grep -q "isProvisional" apps/api/src/modules/tendering/scope-redesign.service.ts
- [PASS] node scripts/data-model/build-relationship-map.mjs --check → OK
- [PASS] Three new spec cases stated to fail on current head and pass after (verified in test file)
- [PASS] Do NOT rules all respected (widened Other rule, did not touch provisionalAmount semantics, no markup changes, no cutting/waste items touched, no /sot/ touches)
- [UNVERIFIED] Export reconciliation test — PR notes DB unavailable in agent worktree; defers to Marco post-deploy. Math checks out via test case 1 (priced $1,000 + provisional $1,000 = $2,000 pre-flag total) and case 3 (flip conserves sum).

Risks Marco should know:
- Migration ordering: 20260901010000 correctly sorts AFTER 20260901000000 (pre-existing same-day migration). No conflict.
- The flag is additive to perDiscipline but does not break existing Other-discipline rows — they remain provisional by discipline rule regardless of isProvisional===false. This is the intended "regression guard" and test case 2 validates it.
- CP-26 gate (do-not-merge label) is expected due to escalates:true — PR is correctly marked do-not-merge pending Marco's review. This is not a blocker.
- All other CI checks passing (CodeQL, data-model sanity, web build, tests, pipeline checks). PR gates failure is intentional (the do-not-merge label).

Recommendation: Ready for merge. The implementation is sound, all scope requirements met, self-verification thorough, and the only CI failure is the expected do-not-merge gate. Marco should remove the label once satisfied, then merge.
