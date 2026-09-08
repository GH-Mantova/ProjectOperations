VERDICT: MERGE

Scope compliance:
- In scope: All changes restricted to the three files named in the prompt. No API routes, service methods, DTOs, schema fields, or migrations added/changed/removed. No architecture changes to the one-list-one-fetch-one-row-pipeline model.
- Out of scope: None. The PR moves the five status Sets from the page to helpers (substantive architecture improvement for testability and avoiding duplication), extracts `parseMoney` from `formatMoneyAUD` (identical behaviour, now reusable), and adds `columnsForTab` / `visibleColumnsForTab` functions. All are pure helpers with no API surface.

Self-verification claims:
- [x] `pnpm --filter @project-ops/web test` green: 121 files, 1967 tests, all green (58 in new test file).
- [x] Four KPI cards with worked example (SIX_ROWS fixture): Overdue 2, Due this week 2, Never logged 3, Value at risk $4,200,000 over all six; cards and list move together across three filter scenarios.
- [x] Two windows pinned independently: DUE_SOON_MS = 3 days (unchanged, byte-identical), DUE_THIS_WEEK_MS = 7 days (new constant). Assertion: row due in 5 days is "this week" but not "due soon".
- [x] Reference counts verified by grep: WON_LOST_STATUSES (before 1 → after 5), SUBMITTED_STATUSES (before 1 → after 5), OPPORTUNITY_STATUSES (before 1 → after 5), LEAD_STATUSES (before 1 in web → after 5 in web), WITHDRAWN_STATUSES (before 1 → after 7).
- [x] Entity-type toggle labels in order (Submitted tenders · Opportunities · Leads · Won & lost) and composition test: "Submitted tenders" + "Overdue" = 1 row (intersection), neither group can resurrect a row the other excluded.
- [x] WITHDRAWN_STATUSES: belongs to NO group (no toggle in mock-up); row renders em-rule for chip; filtered out if any entity toggle is on.
- [x] Header row verification: Register unchanged (8 columns); Follow-ups has Type chip at position 2 (after Tender, before Client), total 9 columns. Type is hideable, unsortable.
- [x] Next-action toggles (Overdue · Due soon · No next action · On track) unchanged in order and defaults (first three on, On track off). Page renders no inner tab bar.
- [x] Hex literals: zero added. Page's hex count unchanged at 50 (all pre-existing, using design tokens: --surface-card, --border-default, --radius-lg, --text-primary, --text-secondary, --surface-subtle, brand tokens).
- [x] `git diff --name-only` lists only the three files in scope.
- [x] `pnpm lint` exit 0, `tsc --noEmit` exit 0, `pnpm build` succeeded.

Risks Marco should know:
- E2E smoke test (tendering-e2e) was still running at review time. All unit tests, linting, build, and compliance checks passed. Type chip rendering is verified in unit tests (pure logic) but not in running app (jsdom coverage is intentionally skipped per the test pattern). Marco can do a manual pixel check on Follow-ups if needed.
- Column visibility mutation: hiding Type column is now a stored setting. Any saved view that referenced the old 8-column blob will still parse (unknown id check in `normalizeColumnVisibility` will drop it), but if Marco later wants entity-type toggles to persist in saved views, that's a separate follow-up (PR body flags this as intentional).
- WITHDRAWN_STATUSES stays declared but unused in toggles: follow-up work if a fifth toggle is approved; this slice is correct as written.

Recommendation: Merge after e2e check completes; ready now.
