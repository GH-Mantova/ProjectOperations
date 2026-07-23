VERDICT: MERGE

Scope compliance:
- In scope: Single new file `docs/architecture/drafts/swms-build-slice-plan.md` (232 lines) added to the drafts directory, as required by the prompt. File contains:
  - Decision header with two-track split (A: static SWMS wizard, B: control-mapping tool) and flagged module-home question for Marco
  - Source inventory verified against prototype (C:\ProjectOperations-Reference\Interactive SWMS\): 7 sections, 102 controls, 410 control rows, 31 SOP-SWMS, trigger vocab, ALWAYS-default rows
  - Track A: 11 ordered slices, each <=10 files, each <=5 in gate_allow
  - Track B: 5 ordered slices, each <=10 files, depends on A3
  - Sequencing diagram, risk flags, and summary table with size/gate_allow/seed_only/escalates metadata
- Out of scope: None. No schema.prisma edits, no migrations, no seed changes, no sot/ touches, no application code.

Self-verification claims:
- [✓] pnpm build green (CI job "Web — lint, logic tests, build" passed)
- [✓] pnpm lint green (CI jobs "API — lint, test, compliance smoke" and Web jobs passed)
- [✓] test -f docs/architecture/drafts/swms-build-slice-plan.md (file verified at commit 65b2aed0, 232 lines)
- [✓] No schema.prisma diff (verified: git diff main 65b2aed0 -- apps/api/prisma/schema.prisma returns empty)
- [✓] No migration added (no files in migrations/ directory touched)
- [✓] No seed changes (no apps/api/prisma/seed* files touched)
- [✓] No sot/ changes (git diff main 65b2aed0 -- sot/ returns empty)
- [✓] Single substantive commit (65b2aed0) plus two merge commits to track main

CI status:
- All 8 check runs passed: CodeQL, tendering-e2e, Data model generator sanity, PR gates, API lint/test/smoke, Web lint/tests/build, CodeQL analyses
- PR is mergeable (mergeable_state: clean)

Risks Marco should know:
- None. Pure documentation/planning work, no schema or runtime changes. The plan correctly flags five open questions for future slices (module-home, Section 7 reconciliation, B2 idempotency, PDF export choice, SWMS-PR-prompts.md deprecation).
- Plan explicitly states "Do NOT auto-merge" — PR left unmerged per prompt requirement; Marco to review module-home + Section 7 flags before arming Track-A Slice 1.

Recommendation: Safe to merge. Plan is complete, well-structured, and maintains all guardrails (no schema/code/seed, CP-24 compliance, size budgets, gate_allow metadata). Marco can review the module-home and soil-section flags at leisure before Track A begins.
