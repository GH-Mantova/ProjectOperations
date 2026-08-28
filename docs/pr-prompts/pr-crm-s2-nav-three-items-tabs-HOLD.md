---
premise: '! grep -q "CRM_NAV_TABS" apps/web/src/components/ShellLayout.tsx'
premise_means: >-
  The CRM nav group is a flat list of item-per-page. Marco's 2026-08-27 decision is three items whose
  sub-pages are tabs inside the page, never collapsible sidebar parents.
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/App.tsx
  - apps/web/src/pages/crm/**
  - apps/web/src/components/__tests__/**
done_when: >-
  pnpm build && pnpm lint && grep -q "CRM_NAV_TABS" apps/web/src/components/ShellLayout.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
requires_merged: 1356
cluster: crm-build
cluster_order: 2
---

# CRM S2 — three nav items, sub-pages as tabs

Routing and tab shells only. **The tabs render pages that already exist.** No new screen content.

## Do

1. Collapse the CRM group in `ShellLayout.tsx` to **three** items, marked with a `CRM_NAV_TABS` comment
   in the same style as the existing `PIPELINE_FOLDED` marker:
   - **Accounts** `/crm/accounts` — tabs: List, Relationships
   - **Tenders** `/crm/register` — tabs: Register, Follow-ups
   - **Comms hub** `/crm/comms` — tabs: Inbox, Threads, To-dos
2. Add tab shells to the three landing pages. Tab state in the URL (`?tab=`) so a tab is linkable.
3. Point the Relationships tab at the existing `RelationshipsPage`, unchanged. Remove **only** its
   separate nav entry — the route `/crm/relationships` stays and redirects into `/crm/accounts?tab=relationships`.
4. Follow-ups, Inbox and To-dos tabs render an empty state naming the slice that fills them (S8, S10).
   An honest empty state, not a fake one.

## Do NOT

- **Do NOT use a collapsible sidebar parent.** Marco explicitly rejected the Operations
  Assets-&-Equipment pattern. Nesting is tabs, in the page.
- **Do NOT delete any route.** `/crm/relationships`, `/crm/register`, `/crm/comms` all keep working.
- Do NOT move Leads & opportunities or Pipeline out of Tendering.
- Do NOT change any page's content, filters or data fetching. This slice is nav and shells.
- Do NOT touch `apps/api/`.

## Tests

Extend `ShellLayout.nav.test.ts`. Adversarial, not decorative:
1. The CRM group has exactly three items, in the order Accounts, Tenders, Comms hub.
2. **No CRM item has `children`** — the negative control for the collapsible pattern Marco rejected.
3. Each of the three carries its `crm.view` gate, unchanged from today.
4. `pickMobileTabItem` still returns an absolute route for the CRM group.

## STOP AND REPORT

- A tab's target page does not exist, or exists under a different name than the plan states.
- Adding tab shells requires touching a page's data fetching. It should not; report it if it does.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
