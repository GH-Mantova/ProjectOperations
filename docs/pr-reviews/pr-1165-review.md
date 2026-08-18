MERGE

Scope compliance:
- In scope: Deleted tender-client-notes.controller.ts and tender-client-notes.service.ts; removed both imports/registrations from tendering.module.ts; removed migrateFollowUpNotes method and POST /admin/imports/tender-followup-notes/migrate route from tender-tracker-import controller/service; narrowed FollowUpNotesReport.mode to "notesOnly" only; removed Stage A spec block while preserving regression guards; updated tracker-followup-notes-recovery.md runbook to mark Stage A completed/retired.
- Out of scope: None identified. schema.prisma untouched, no migration file, no web/ changes.

Self-verification claims:
- [PASS] pnpm build — reported green
- [PASS] pnpm lint — reported green (0 errors, 1 pre-existing unrelated warning)
- [PASS] pnpm --filter api test — 42 tests pass, 0 failures
- [PASS] Controller and service files deleted (verified on branch)
- [PASS] migrateFollowUpNotes removed from service (verified on branch)
- [PASS] No `.ts` files reference prisma.tenderClientNote outside spec/mocks (verified: only regression assertions remain)
- [PASS] Web CI (lint, vitest, build) — success
- [PASS] API CI (lint, test, compliance smoke) — success
- [PASS] Data model sanity (schema.prisma parses) — success
- [EXPECTED] PR gates CP-26 do-not-merge check — correctly failed; PR carries do-not-merge label per escalates:true in prompt, gate requires human review to unlock merge

Risks Marco should know:
- PR-gates intentionally blocks merge until do-not-merge label is removed by reviewer (escalates:true compliance). This is working as designed.
- Table and rows remain in database as rollback copy (intentional per slice 1 design).
- Stage B (notesOnly import path) remains fully operational; no breaking changes to existing spreadsheet top-up workflows.
- Regression suite confirms importer writes TenderClarificationNote and never TenderClientNote — migration guard is preserved.

Recommendation: Review for data integrity and confirm activity feed rendering looks correct on a tender with migrated notes, then remove do-not-merge label to release merge.
