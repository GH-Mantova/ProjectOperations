---
premise: grep -rEq "Delivery workspace|Availability heatmap" apps/web/src/pages
premise_means: Page H1 titles still diverge from their sidebar labels (e.g. "Delivery workspace" for Jobs, "Availability heatmap" for the Availability report), so the nav label and on-page title disagree.
scope:
  - apps/web/src/pages/JobsListPage.tsx
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/TenderingReportsPage.tsx
  - apps/web/src/pages/AvailabilityReportPage.tsx
  - apps/web/src/pages/master-data/MasterDataWorkspacePage.tsx
  - tests/e2e/pr-acceptance/**
done_when: pnpm build && pnpm lint
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# Align on-page titles to their sidebar labels (audit A4/A5/A6/A9 + A1)

Marco's decision: the sidebar label is canonical; make each page's visible H1 match it. Pure display
text — no route, data, or component-structure changes.

## Changes
1. **A4** `apps/web/src/pages/JobsListPage.tsx` (~line 153): page H1 **"Delivery workspace" → "Jobs"**
   (nav + breadcrumb already say "Jobs").
2. **A5** `apps/web/src/pages/tendering/TenderingPage.tsx` (~line 607): H1 **"Pipeline" → "Tendering"**.
3. **A6** `apps/web/src/pages/TenderingReportsPage.tsx` (~line 173): H1 **"Estimating reports" →
   "Tender Reports"** (match the nav label).
4. **A9** `apps/web/src/pages/AvailabilityReportPage.tsx` (~line 137): H1 **"Availability heatmap" →
   "Availability report"**.
5. **A1** `apps/web/src/pages/master-data/MasterDataWorkspacePage.tsx` (~line 74): the H1 is the static
   **"Master data"**, but users reach it via the **"Clients"** sidebar item. Make the H1 reflect the
   **active tab** — "Clients" when the Clients tab is active (arrived via `?tab=clients`), "Sites" for
   Sites, "Contacts" for Contacts — so a user who clicked "Clients" sees a Clients-scoped title, not
   "Master data". Keep the tabbed structure and all data behaviour unchanged.

## Also required — keep e2e in sync
Several PR-acceptance specs assert these exact heading strings (e.g. batch1/batch7 assert
"Operations Overview"; others may assert "Delivery workspace", "Pipeline", "Estimating reports",
"Availability heatmap", or "Master data"). Grep `tests/e2e/pr-acceptance/**` for each OLD title you
change and update the assertions to the new title in the SAME PR, or `tendering-e2e` will fail.
**Do not touch the "Operations Overview" dashboard title — that is out of scope here.**

## Do NOT
- Do NOT change routes, nav labels, breadcrumbs, component names, or any data/logic — display titles only.
- Do NOT alter the Master Data tab structure; only make its H1 reflect the active tab.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails
- One honest attempt. Never exit silently — say `NO-OP: <reason>` if you open no PR.
- Never ask a question or stand by for approval.
- Read the job log before diagnosing any CI failure; run the acceptance suite and let the exit code decide.
- Completion test: is there a PR number in your output?
