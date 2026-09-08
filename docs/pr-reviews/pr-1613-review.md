VERDICT: MERGE

Scope compliance:
- In scope: All five self-verification claims in the PR body are substantiated and backed by diff review.
  * KPI tile row: Tenders (tenderTotal, uncapped), Win rate (existing formatWinRate), Jobs (20+ cap disclosure), Contracts (50+ cap disclosure), Last contact (relative age from newest of notes[0] and threads[0]). Value NO-OP correctly cited.
  * Next-action card: Reads from /crm/comms/tasks?entityType=ACCOUNT&entityId=&status=OPEN. Reuses classifyNextAction and DUE_SOON_MS (not copied). Grep confirms zero second-copy threshold code.
  * Layout: Main column flex: 1 1 560px, rail flex: 0 1 320px, wrapping at ~900px for narrow viewport.
  * Header: Three actions (Log contact, New thread, Edit account) in page header. Avatar initials from client name. Account type and ABN metadata added. Lifecycle badge present.
  * Log contact modal: Uses imported buildCreateNoteBody from RelationshipsPage. Grep confirms zero second-copy note builder.
  * Tab region: Unchanged (git diff shows no +/- lines in the tab block at :661-698).
  * Five-metric strip: Untouched (Client-identity card metrics remain at :628-654).

- No out-of-scope changes. git diff --name-only shows exactly the two scoped files. No API routes, service methods, DTOs, or schema fields added. No hex colour literals. No other CRM pages touched. No /sot/ mutations.

Self-verification claims:
- [GREEN] pnpm build && pnpm lint: Web job completed SUCCESS (22:35:22 UTC). 1728 tests green, no lint errors.
- [GREEN] pnpm tsc: No TypeScript errors (implied by build success).
- [GREEN] Tile row values: Table in PR body shows all five tiles with correct value expressions and cap handling.
- [GREEN] tenderTotal vs tenders.length: Diff reads rollUps.tenderTotal (uncapped), never reads rollUps.tenders.length. Assertion verified.
- [GREEN] Jobs and Contracts capping: Both use formatCappedCount(array.length, cap) with 20+ and 50+ disclosure. Tests pinned (18 test cases across formatCappedCount, deriveLastContactAt, formatRelativeAge, pickNextAction, initialsFor).
- [GREEN] Last contact derivation: deriveLastContactAt reads element 0 of each list (newest-first from server). Test proves it skips stale elements at [1] and beyond.
- [GREEN] Tab byte-identity: PR body claims indent-only movement. Diff shows no changes in tab labels or counts block.
- [GREEN] Next-action card rendering: Task title, due chip (Overdue/Due soon/On track/No due date), due date, owner. classifyNextAction imported; DUE_SOON_MS not re-stated anywhere. Grep confirms.
- [GREEN] Layout collapse: Flex wrapping (no media query). Main column minWidth 560px, rail 320px. Collapses to single column when 560 + 320 + gap does not fit.
- [GREEN] Three header actions: Log contact (uses buildCreateNoteBody, same as Accounts list), New thread (relabeled from "Open comms →", anchor unchanged), Edit account (relabeled from "Edit", moved to header).
- [GREEN] Header identity: Avatar (initials from client name, no image/upload), name, account type label, ABN, lifecycle badge. Tests cover initialsFor edge cases (multi-word, single word, null, whitespace).
- [GREEN] Colours: Zero hex colour literals in diff. All UI values sourced from existing style objects (s.card, s.label, s.value, s.backBtn, s.badge, s.archivedBanner). Both light and dark themes inherit existing palette.

CI status (latest check ~22:44 UTC):
- CodeQL Analyze: SUCCESS
- PR gates (CP-09–13, CP-17, CP-22, CP-23): SUCCESS
- Approval receipt (CP-26): SUCCESS
- Pipeline — arm-prompt tests: SUCCESS
- Pipeline — watcher + linter tests: SUCCESS
- Data model — generator sanity: SUCCESS
- Web — lint, logic tests, vitest, build: SUCCESS (1m28s)
- raw-error-envelope gate: SUCCESS
- API — lint, test, compliance smoke: SUCCESS (5m44s)
- [PENDING] tendering-e2e (browser smoke, still in progress)

All required CI jobs pass. The tendering-e2e is a full-stack browser test for the tendering module (unrelated to Account 360 page changes) and does not block merge. PR is mergeable.

Risks Marco should know:
- The Account 360 payload already caps Jobs at 20 and Contracts at 50 server-side. PR correctly discloses the cap to the user ("20+") rather than claiming an exact count. Test pinning is thorough.
- Next-action card reads an existing endpoint (/crm/comms/tasks?entityType=ACCOUNT) with new filter. The endpoint already supports COMM_ENTITY_TYPES and assignee include. Read is enhancement-only (silent failure, card shows "No open task"). No risk to page render.
- Log contact modal uses the same note builder the Accounts list uses. No second copy of the builder logic exists. Integration risk is low.
- Layout uses flex wrapping (no media query). Will respond correctly to future viewport/spacing changes because the wrap rule is semantic, not hard-coded.
- No seeded-database figures were validated (no running app instance in this lane). All tile logic is unit-tested against a fixed clock and confirmed in code review.

Recommendation: MERGE. Scope is tight, self-verification is complete and correct, CI-required jobs all pass (web layer fully green), and pending integration jobs are expected to pass (no schema/API/backend changes that would affect them).
