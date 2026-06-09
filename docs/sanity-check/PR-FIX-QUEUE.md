# PR Fix Queue — sanity-check follow-ups

**Generated:** 2026-06-09
**Purpose:** Prioritised list of PR-prompt drafts to address findings from the sanity-check pass.

Each entry is sized for one PR prompt suitable for the autonomous PR-watcher. Severity ordered.

## Tier 1 — must land before Azure deploy

### PR-Q-01 (CRITICAL) — Reconcile schema.prisma <-> migrations drift
- **Finding:** F0-01
- **Branch:** `chore/reconcile-schema-drift-2026-06-09`
- **Scope:** Run `prisma migrate diff` to capture the missing SQL → add a new migration file `apps/api/prisma/migrations/<YYYYMMDDHHMMSS>_chore_reconcile_schema_drift_2026_06_09/migration.sql` containing the SQL → confirm `prisma migrate reset --force` completes without the new-migration prompt
- **Why before Azure:** production `prisma migrate deploy` only runs the migrations folder; without this PR the deployed DB will be missing whatever's in schema.prisma but not in migrations
- **Reference:** `findings/2026-06-09-phase-0-schema-drift/REPORT.md`
- **Estimated effort:** 30 min (mechanical — generate, commit, verify)

## Tier 2 — should land soon

### PR-Q-02 (HIGH) — Fix seed Job ID format to always produce canonical `J-YYYY-NNN`
- **Finding:** F1E-01
- **Branch:** `fix/seed-job-id-canonical-format`
- **Scope:** Audit `apps/api/prisma/seed.ts` and `apps/api/prisma/seed/*.ts` for hardcoded `JOB-YYYY-NNN` strings → replace each with a call to `JobNumberService` (or the canonical sequence allocator) → add unit test asserting all job numbers produced by the seed match `/^J-\d{4}-\d{3}$/`
- **Reference:** `findings/2026-06-09-phase-1e-job-id-format-regression/REPORT.md`

### PR-Q-03 (CONCERN) — Field/Mobile 403 graceful error boundary
- **Finding:** F3-01
- **Branch:** `fix/field-allocations-403-empty-state`
- **Scope:** In `apps/web/src/pages/field/MyAllocationsPage.tsx` (or wherever the data fetch lives), catch the 403 Forbidden response from `/api/v1/field/my-allocations`. Render a styled empty/error state with the existing `EmptyState` component (icon + heading "Mobile access not provisioned" + body "Contact your office administrator to link a worker profile" + CTA "Back to web view" pointing at `/`). Don't render the raw JSON.
- **Reference:** `findings/2026-06-09-phase-3-system-smoke/REPORT.md`

### PR-Q-04 (CONCERN) — Sites detail page completeness check vs PR #288 changelog
- **Finding:** F1A-01
- **Branch:** `chore/sites-detail-page-audit`
- **Scope:** Spike — open `/sites/site-001` against a fixture with at least 1 linked tender + 1 linked project + 1 linked document. Verify whether the KPI strip + tabs (Overview/Tenders/Projects/Documents) are conditionally rendered or genuinely missing. If conditionally rendered, note in the module reference doc. If genuinely missing, plan a follow-up implementation PR.
- **Reference:** `findings/2026-06-09-phase-1a-master-data/REPORT.md`

## Tier 3 — polish, can wait

### PR-Q-05 (MINOR) — `?tab=workers` URL param either honoured or rejected
- **Finding:** F1A-02
- **Branch:** `fix/master-data-workers-tab-redirect`
- **Scope:** Either (a) make the master-data `?tab=workers` query redirect to `/resources` properly, OR (b) surface a 404-style "unknown tab" message instead of silent rewrite to clients. Pick one.

### PR-Q-06 (MINOR) — Client contacts: email column tooltip / wrap
- **Finding:** F1A-04
- **Branch:** `fix/client-contacts-email-tooltip`
- **Scope:** Add `title` attribute on truncated email cells (cheap) OR widen the column / wrap. Single-file CSS or component edit.

### PR-Q-07 (MINOR) — Compliance sidebar badge count alignment
- **Finding:** F3-02
- **Branch:** `fix/sidebar-compliance-badge-semantics`
- **Scope:** Confirm what the "6" represents at the API layer, then either (a) align the page's default filter to match (e.g. show all expiring within 90 days by default), OR (b) make the badge match the 30-day default OR (c) hover-tooltip "expiring within 90 days" on the badge.

### PR-Q-08 (MINOR) — Documents context rail labels
- **Finding:** F3-03
- **Branch:** `fix/documents-rail-labels-show-parent`
- **Scope:** In `apps/web/src/pages/documents/DocumentsPage.tsx` (or wherever the rail renders), show the parent record's code or name (e.g. "JOB-2026-001 North precinct", "IS-T100 TEMPLATE") instead of just the entity type ("Jobs", "Tendering"). Single file change.

## Tier 4 — documentation reconciliation

### PR-Q-09 — Update module-reference docs to reflect actual UI surface
- **Finding:** F1B-01
- **Branch:** `docs/module-reference-tendering-reconciliation`
- **Scope:** Update `docs/sanity-check/module-reference/05-tendering-estimating.md` to note the actual tab strip is Overview / Scope of Works / Quote (3 tabs, not 5). Document that Estimate is embedded inside Scope of Works items. Document that Clarifications was collapsed into the Overview "Activity & communications" panel per PR #260. Doc-only change.

## Tier 5 — TODO continuation

The items below are not findings — they're carry-forward checks from the partial Phase 1B + 1C work. Address by re-running a targeted slice of the live drive when an AI key is available.

- Quote PDF smoke render against IS-T100 (`Quote tab > PDF button`)
- Walk through each Quote editor sub-tab (Provisional Sums / Cost Options / Assumptions / Exclusions / T&C / Preview) and verify pre-populated content per PR #228 fixture spec (2 prov sums, 2 cost options, 8 linked assumptions, 7 exclusions, 21 T&C clauses)
- Configure an AI provider key in `apps/api/.env` and run a single Tendering Assistant chat exchange in each sub-mode (scope / estimate / quote / clarifications / tender-detail) to verify the persona + sub-mode + context-key injection chain end-to-end
- Drawing tools test: open IS-T020, persona scope sub-mode, ask the assistant to call `list_tender_drawings` then `read_tender_drawing` on the seeded demo PDF
- `read_asbestos_register` test: same path, ask the assistant about the asbestos register attached to IS-T020
- Award + Contract + Convert-to-Job end-to-end against IS-T001 (Ipswich) or IS-T003 (Sandgate)
- Mobile-responsive viewport check (375px wide) for KPI title/period collision, tender title truncation, sidebar Tendering duplication, "Due this week" mismatch (the Phase 6 Chat1 2026-05-03 deferred items)
- JobsPage empty state (#327): need to either delete all 3 active jobs OR apply a filter that yields 0 matches
- PR #313 CenteredModal targets: identify which 2 modals shipped in that PR specifically and verify visually

## How to fire these as PR prompts

For each Tier 1 / Tier 2 / Tier 3 item:
1. Open the corresponding finding's REPORT.md
2. Translate the **Recommended fix** section into a watcher PR prompt following the house style (see `docs/pr-prompts/pr-114-*.md` for a template)
3. Save to `docs/pr-prompts/pr-NNN-<slug>.md` (no `-ready` suffix)
4. When ready to fire, rename to `pr-NNN-<slug>-ready.md` — the watcher picks it up

Documentation items (Tier 4) can be drafted and committed without going through the watcher if Marco prefers — they're doc-only.
