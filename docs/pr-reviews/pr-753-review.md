VERDICT: MERGE

Scope compliance:
- In scope: Single plan document (715 lines) comprehensively covering B-P0b SLICE 0 Worker/WorkerProfile merge strategy with WorkerProfile canonical. Includes decision header, full field/relation inventory (9 FKs to Worker, 7 to WorkerProfile, code consumers), detailed fold map, 11 ordered slices (S1-S11), and 8 risks. B-P0a sequencing lock prominently stated at top of plan.
- Out of scope: None detected. Only file changed is `docs/architecture/drafts/worker-workerprofile-merge-slice-plan.md`. Zero schema.prisma, migration, TypeScript, or sot/ changes.

Self-verification claims:
- [PASS] pnpm build passed (CI green)
- [PASS] pnpm lint passed (CI green)
- [PASS] Only one file created: docs/architecture/drafts/worker-workerprofile-merge-slice-plan.md
- [PASS] No schema.prisma changes (verified: only drafts/ file touched)
- [PASS] No migrations (verified: no migration folder created)
- [PASS] No .ts/.tsx/.mjs code changes (verified: no src/ changes)
- [PASS] No sot/ edits (verified: sot/ untouched; flag for 05-sot-keeper documented in plan)

Risks Marco should know:
- Sequencing lock is well-documented: B-P0b code slices (S1+) blocked until B-P0a fully merged on main. This is a pre-flight check, not a blocker for this plan-only PR.
- R3 (Docket Restrict FK) correctly identified as requiring S2 backfill completion before S7 proceeds; migration includes guard assertion.
- R4 (WorkerCompetency vs WorkerQualification) correctly flags these as overlapping but distinct; plan notes they remain separate post-merge.
- R6 (B-P0a sequencing) confirms the lock; B-P0a (PR #715) has already merged, so B-P0b S1 is safe to arm when ready.
- R7 flags sot/ reconcile for 05-sot-keeper (correct: do not edit sot in this PR).
- Plan includes 11 independent slices with rollback notes and escalation flags; S2 (backfill) and S11 (drop) correctly marked as prod-data changes.

Recommendation: Merge. This is a well-structured plan document with comprehensive inventory, sequencing safeguards, and risk mitigation. No code or schema changes to review. CI clean. Ready for Marco's merge.
