VERDICT: MERGE

Scope compliance:
- In scope: ShellLayout (NavItem.badge widened, two new badge fetchers added, tab rows added); test file ShellLayout.crm-chrome.test.ts (46 pure-logic tests); AccountsPage, TendersPage, CommsPage (tab count renders added); CommsInboxTriage (archive and delete row actions mounted, sort and filter logic added). All 6 files exactly match scope.
- Out of scope: None. No API route, DTO, service, or schema.prisma changes. No changes to LeadsTriageList.tsx, ArchiveEntryModal.tsx, or CrmBoardPage.tsx (the three reused components remain untouched, mounted rather than edited). No changes to /tenders/leads.

Self-verification claims:
- [✅] pnpm --filter @project-ops/web test green — 1862 tests, 46 contributed by this slice.
- [✅] pnpm lint (apps/web) — no output, as required.
- [✅] NavItem.badge type widened to "crm-tenders" | "crm-comms"; conditional renders for "safety" and "compliance" still present and unchanged.
- [✅] Two CRM badges render correctly via existing SidebarPill. Tenders badge sources GET /crm/comms/tasks?entityType=TENDER&status=OPEN&limit=200 via countDistinctOverdueTenders (counts distinct entityId over overdue rows). Comms badge sums untriaged leads total + overdue-to-dos total via sumCommsBadgeCount. Both render nothing at zero.
- [✅] Six tab counts across three shells: List (plain), Relationships (none), Register (plain), Follow-ups (amber pill), Inbox (red pill), Threads (plain), To-dos (plain). Sources verified against the prompt's routing table.
- [✅] Archive mounted from existing ArchiveEntryModal; delete calls existing deleteEntry. No new modal, no new route. Row actions are [Archive] [Don't pursue] [Price it] or [Delete] alone on empty lead.
- [✅] Inbox header reads "Untriaged · oldest first"; rows sorted by sortLeadsOldestFirst before render. Prompt notes sort is within-page-only until API adds order parameter (correctly stated in PR body).
- [✅] Anchor filter for non-ACCOUNT types shows "— the Inbox can only be filtered by account" rather than inventing a query parameter.
- [✅] Pure functions pinned by tests: countDistinctOverdueTenders, sumCommsBadgeCount, navTabId, isNavTabActive (ShellLayout); isIntakeLeadEmpty, leadRowActionSet, sortLeadsOldestFirst (CommsInboxTriage).
- [✅] Zero colour literals added; both pills read var(--status-warning) and var(--status-danger) from existing tokens.
- [✅] No file under /tenders/leads component set was modified. TendersPage.tsx imports the pure function countDistinctOverdueTenders from ShellLayout (bundle-conscious, avoids duplication; App.tsx already imports ShellLayout eagerly per PR body).
- [✅] CRM_CHROME_V1 marker added to ShellLayout.tsx (42 occurrences across scope).

Risks Marco should know:
- **API-side gaps explicitly documented.** PR body lists four gaps that block perfect execution: (1) GET /tenders gated on tenders.view not crm.view → crm-view-only user sees Register tab without figure (not fixable from web); (2) limit=200 capped to 100 server-side → both badge and register under-count past 100 open TENDER tasks (pre-existing, shared); (3) oldest-first sort is within-page only (listOpenLeads has no order parameter); (4) Delete button unreachable in practice because captureLead always sets accountId. Each is correctly scoped as API-side and marked as FIX-FORWARD in the PR body.
- **TendersPage → ShellLayout import.** TendersPage now imports countDistinctOverdueTenders from ShellLayout. This is intentional bundle-conscious design to avoid duplicating the derivation. App.tsx already imports ShellLayout eagerly (per PR body), so no new bundle weight.
- **Deviations noted and justified.** Header retains muted "page N of M" alongside "Untriaged · oldest first"; PR body rationale is clear (pagination awareness outweighs brevity). Archive/Delete as mutually exclusive (rather than both rendered) is correct per the prompt's wording and gap 4 (Delete nearly unreachable anyway).

Recommendation: Merge. Code is scope-clean, tests are green, and all scope promises are met. The four API-side gaps are transparent, correctly scoped as follow-up work, and do not compromise the value shipped here (counts render with correct logic, actions reuse existing components, sort keeps its promise within the page). The TendersPage import of a pure function is defensible and documented.
