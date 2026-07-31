---
premise: grep -q "CRM (Leads & Opportunities)" apps/web/src/components/ShellLayout.tsx
premise_means: The sidebar still carries the standalone CRM entry (and Tender Settings), so the Tenders-page consolidation (CRM + Settings as tabs) is unfinished.
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.ts
  - apps/web/src/App.tsx
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/TenderingSettingsPage.tsx
  - apps/web/src/components/CommandPalette.tsx
  - tests/e2e/pr-acceptance/**
done_when: pnpm build && pnpm lint && ! grep -q "CRM (Leads & Opportunities)" apps/web/src/components/ShellLayout.tsx
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# Finish the Tenders consolidation — CRM + Settings live ONLY as tabs; kill the leftover nav entries and routes

## Context (verified on origin/main 2026-07-31)

The CRM board was folded into the Tenders page as a tab (`/tenders?tab=crm`, `TopTab` strip in
`TenderingPage.tsx`), but the consolidation was never finished:

- `ShellLayout.tsx` NAV_GROUPS (estimating) still carries the standalone
  "CRM (Leads & Opportunities)" entry (`/crm`, `requiresPermission: "crm.view"`) AND the
  "Tender Settings" entry (`/tenders/settings`).
- **The nav unit test already expects the CRM entry to be GONE**:
  `ShellLayout.nav.test.ts` asserts estimating = [Tenders, Contracts, Tender Settings, Directory,
  Rates & Lists, Reports]. It contradicts the component on main, yet trunk is green — so this test
  is evidently NOT picked up by the CI web-test run. Run it yourself (see VERIFY); do NOT change
  the vitest config in this PR (that CI blind spot is a separate work item).
- `/tenders/settings` still renders a standalone `TenderingSettingsPage`; Marco wants it as a
  third tab on the Tenders page.

Marco's ruling (2026-07-31): kill the old URLs outright — `/crm` AND `/tenders/settings` both 404.
No redirects. `/crm/opportunities/:id` (opportunity detail) STAYS.

## What to build

**1. apps/web/src/pages/tendering/TenderingPage.tsx — third tab:**

- Extend `type TopTab = "tenders" | "crm"` with `"settings"`; extend `TopTabStrip` tabs with
  `{ key: "settings", label: "Settings" }`; `setActiveTab` sets `tab=settings`
  (mirror the existing `tab=crm` handling; bare `/tenders` stays the tenders tab).
- When `activeTab === "settings"`, render the existing tender-settings content (import
  `TenderingSettingsPage` from `../TenderingSettingsPage`, or export/reuse its content component
  if the page wraps its own chrome — follow the `CrmBoardContent` precedent).
- The tenders-tab-only header actions (`+ New tender`, view toggle, Resume drafts) stay hidden on
  the settings tab, same as they are on the CRM tab today.
- **Permission parity:** the old sidebar CRM entry was gated on `crm.view`. Ensure the CRM tab is
  equivalently gated: hide the CRM tab for users without `can(user, "crm.view")`, and treat
  `?tab=crm` without the permission as the tenders tab. If a gate already exists, keep it. The
  Settings tab gets NO new gate — exact parity with today's open `/tenders/settings` route.

**2. apps/web/src/App.tsx — kill the dead routes:**

- Remove `<Route path="/crm" element={<Navigate to="/tenders?tab=crm" replace />} />` (falls
  through to the `*` NotFoundPage).
- Remove `<Route path="/tenders/settings" element={<TenderingSettingsPage />} />`.
- KEEP `/crm/opportunities/:id` (OpportunityDetailPage) — the CRM tab links to it.
- Drop the now-unused `TenderingSettingsPage` import from App.tsx if nothing else there uses it.

**3. apps/web/src/components/ShellLayout.tsx — nav + breadcrumbs:**

- Remove the "CRM (Leads & Opportunities)" item and the "Tender Settings" item from the
  estimating group.
- Simplify the Tenders `match`: with `/tenders/settings` gone it no longer needs that exclusion;
  keep excluding `/tenders/reports` and `/tenders/contacts`.
- Remove the `"/crm"` and `"/tenders/settings"` BREADCRUMBS entries. Keep the `/crm/opportunities`
  detail page resolving to something sensible: add `"/crm/opportunities": "CRM"` if removing the
  `"/crm"` prefix entry would break the detail page's breadcrumb (verify with the resolver logic).

**4. apps/web/src/components/__tests__/ShellLayout.nav.test.ts:**

- Update the estimating expectation to [Tenders, Contracts, Directory, Rates & Lists, Reports]
  (CRM was already expected absent; now also remove the Tender Settings row).
- Update the Tenders active-match assertions: drop/invert the `/tenders/settings` case to match
  the simplified rule.

**5. Sweep stray references:**

- `grep -rn '"/crm"' apps/web/src` and `grep -rn "/tenders/settings" apps/web/src` — update every
  remaining navigation reference (CommandPalette, GlobalSearch, QuickCreate, any page links) to
  the tab URLs (`/tenders?tab=crm`, `/tenders?tab=settings`) or remove the entry. Links to
  `/crm/opportunities/...` stay.
- `grep -rn "/crm\|tenders/settings" tests/e2e` — retarget any spec that visits the old URLs or
  asserts the old nav entries. Wait for POSITIVE end states.

## Do NOT

- Do NOT add redirects for `/crm` or `/tenders/settings` — Marco explicitly wants them dead (404).
- Do NOT remove `/crm/opportunities/:id` or `OpportunityDetailPage`.
- Do NOT change what the CRM board or Tender Settings screens do — this is navigation/layout only.
- Do NOT add new permission gates beyond mirroring the existing `crm.view` nav gate on the CRM tab.
- Do NOT touch the vitest/CI config, the FIELD mobile nav, schema, API, or seeds.
- Do NOT touch the "Operations Overview" dashboard title or heading assertions (separate PR in flight).

## VERIFY

- `pnpm build && pnpm lint`
- `! grep -q "CRM (Leads & Opportunities)" apps/web/src/components/ShellLayout.tsx`
- `! grep -q '"/tenders/settings"' apps/web/src/components/ShellLayout.tsx`
- `npx vitest run apps/web/src/components/__tests__/ShellLayout.nav.test.ts` (or the workspace
  equivalent) MUST pass — this file is not reliably run by CI, so run it here.
- `grep -q '"settings"' apps/web/src/pages/tendering/TenderingPage.tsx`

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
