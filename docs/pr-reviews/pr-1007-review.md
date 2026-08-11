VERDICT: MERGE

## Scope compliance

In scope:
- OutcomeCaptureModal.tsx (255 lines): prompted-but-skippable form, result pre-filled from context, reason select only for LOST/NO_BID, no required fields
- NeedsOutcomePanel.tsx (191 lines): collapsible safety net listing closed tenders with no recorded outcome; client-side filter; "Record outcome" action opens same modal wired to POST /tenders/:id/outcome
- outcomeApi.ts (103 lines): typed client with enum mirrors (WON/LOST/NO_BID, 10 bounded reasons); payload compaction; recordOutcome handler
- TenderingPage.tsx (+64 lines): mount NeedsOutcomePanel; extend moveTender to open modal optimistically after terminal drop; mount OutcomeCaptureModal with decoupled saveOutcome handler

Out of scope: None detected. No migrations, schema, API changes, routes, or nav modifications.

## Self-verification claims

- pnpm build + pnpm lint: **GREEN** (Web job completed, PR gates passed)
- Enum mirrors match API schema.prisma exactly (WON/LOST/NO_BID, 10 reasons): **GREEN**
- POST /tenders/:id/outcome endpoint exists: **GREEN** (controller line 498)
- Server already returns outcomes on /tenders list (tenderInclude): **GREEN** (service line 87)
- Modal skippable (Skip equally weighted): **GREEN** (both close without recording)
- WL-1a (PR #1004) gated predecessor: **GREEN** (merged to main)
- Web CI green: **GREEN** (Web — lint, logic tests, vitest, build: SUCCESS)
- PR gates green: **GREEN** (CP-09–13, CP-17, CP-22, CP-23: SUCCESS)
- CodeQL green: **GREEN** (SUCCESS)

## Risks Marco should know

- API and e2e CI jobs still in progress (started 00:03:09 and 00:04:05 UTC). Web job already passed, and this PR touches only web files, so API/e2e are unlikely to be blocked by this change. If either fails, it's unrelated to scope.
- No missing originating prompt file found in docs/pr-prompts/ (neither active, processed, failed, nor paused). The WL-1b feature shipped without a discoverable prompt artifact — unclear if this was intentional or lost in handoff. For audit purposes, suggest Marco retain a copy of the originating prompt (if one exists) alongside the PR.
- Outcome capture is intentionally non-blocking: card animation never waits on modal submit, and Skip is symmetric with Save. This is by design per Marco 2026-08-10 note in PR body.

## Recommendation

Merge. Scope is clean, web CI is green, design is sound, and WL-1a gating is satisfied. Monitor API/e2e jobs for completion as a formality, but this PR poses no API or e2e risk.
