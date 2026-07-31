---
premise: grep -q "CRM (Leads & Opportunities)" apps/web/src/components/ShellLayout.tsx
premise_means: The sidebar still carries the standalone CRM entry (and Tender Settings), so the Tenders-page consolidation is unfinished.
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.ts
  - apps/web/src/App.tsx
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/TenderingSettingsPage.tsx
  - apps/web/src/tendering-labels.ts
  - apps/web/src/components/CommandPalette.tsx
  - tests/e2e/pr-acceptance/**
done_when: pnpm build && pnpm lint && ! grep -q "CRM (Leads & Opportunities)" apps/web/src/components/ShellLayout.tsx
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# Finish the Tenders consolidation — CRM lives ONLY as a tab; DELETE the dead Tender Settings feature

**v2 (2026-07-31, supersedes the earlier revision committed in #825).** Marco's 2026-07-31 audit
ruling changed one thing: Tender Settings is NOT folded in as a tab — it is DELETED. The Settings
audit proved it is a write-only dead surface: `apps/web/src/tendering-labels.ts` is imported by
NOTHING except `TenderingSettingsPage.tsx`; every tendering label is hardcoded
(`TenderingPage.tsx:119`, `:514`; `TenderDetailPage.tsx:592`; `ScopeColumnManager.tsx:188`).
Saving labels does nothing. If label customisation is ever wanted it will be re-specced properly.

## Context (verified on origin/main 2026-07-31)

- `ShellLayout.tsx` NAV_GROUPS (estimating) still carries the standalone
  "CRM (Leads & Opportunities)" entry (`/crm`, `requiresPermission: "crm.view"`) AND the
  "Tender Settings" entry (`/tenders/settings`).
- **The nav unit test already expects the CRM entry to be GONE** (`ShellLayout.nav.test.ts`
  asserts estimating without CRM) yet trunk is green — the test is evidently NOT picked up by the
  CI web-test run. Run it yourself (see VERIFY); do NOT change vitest/CI config in this PR.
- Marco's rulings: `/crm` AND `/tenders/settings` both die outright (404, no redirects).
  `/crm/opportunities/:id` STAYS.

## What to build

**1. apps/web/src/pages/tendering/TenderingPage.tsx — CRM tab hygiene (no new tabs):**

- `TopTab` stays `"tenders" | "crm"`. Do NOT add a settings tab.
- **Permission parity:** the old sidebar CRM entry was gated on `crm.view`. Ensure the CRM tab is
  equivalently gated: hide the CRM tab for users without `can(user, "crm.view")`, and treat
  `?tab=crm` without the permission as the tenders tab. If a gate already exists, keep it.

**2. DELETE the dead Tender Settings feature (frontend only):**

- Delete `apps/web/src/pages/TenderingSettingsPage.tsx` and `apps/web/src/tendering-labels.ts`.
- Remove the `/tenders/settings` route and the `TenderingSettingsPage` import from App.tsx.
- Do NOT touch the backend `tendering_labels` API/table — dead but harmless; its removal is a
  separate backlog item (needs a migration).

**3. apps/web/src/App.tsx — kill the dead /crm route:**

- Remove `<Route path="/crm" element={<Navigate to="/tenders?tab=crm" replace />} />` (falls
  through to the `*` NotFoundPage). KEEP `/crm/opportunities/:id` (OpportunityDetailPage).

**4. apps/web/src/components/ShellLayout.tsx — nav + breadcrumbs:**

- Remove the "CRM (Leads & Opportunities)" item and the "Tender Settings" item from the
  estimating group.
- Simplify the Tenders `match`: drop the now-dead `/tenders/settings` exclusion; keep excluding
  `/tenders/reports` and `/tenders/contacts`.
- Remove the `"/crm"` and `"/tenders/settings"` BREADCRUMBS entries. Keep `/crm/opportunities/:id`
  resolving to something sensible: add `"/crm/opportunities": "CRM"` if removing the `"/crm"`
  prefix entry breaks the detail page's breadcrumb (verify against the resolver logic).

**5. apps/web/src/components/__tests__/ShellLayout.nav.test.ts:**

- Estimating expectation becomes [Tenders, Contracts, Directory, Rates & Lists, Reports].
- Update the Tenders active-match assertions to the simplified rule (drop/invert the
  `/tenders/settings` case).

**6. Sweep stray references:**

- `grep -rn '"/crm"' apps/web/src` and `grep -rn "/tenders/settings\|tendering-labels\|TenderingSettingsPage" apps/web/src`
  — update or remove every remaining reference (CommandPalette, GlobalSearch, QuickCreate, page
  links). Links to `/crm/opportunities/...` stay.
- `grep -rn "/crm\|tenders/settings" tests/e2e` — retarget or remove specs that visit the old URLs
  or assert the old nav entries. Wait for POSITIVE end states.

## Do NOT

- Do NOT add redirects for `/crm` or `/tenders/settings` — Marco wants them dead (404).
- Do NOT add a Settings tab to the Tenders page — the feature is deleted, not relocated.
- Do NOT remove `/crm/opportunities/:id` or `OpportunityDetailPage`.
- Do NOT touch the backend tendering-labels API/table, schema, migrations, or seeds.
- Do NOT change what the CRM board does — navigation/removal only.
- Do NOT add new permission gates beyond mirroring the existing `crm.view` nav gate on the CRM tab.
- Do NOT touch vitest/CI config or the FIELD mobile nav.
- Do NOT touch the "Operations Overview"/"Home" dashboard headings (separate PR in flight).

## VERIFY

- `pnpm build && pnpm lint`
- `! grep -q "CRM (Leads & Opportunities)" apps/web/src/components/ShellLayout.tsx`
- `! test -f apps/web/src/pages/TenderingSettingsPage.tsx`
- `! test -f apps/web/src/tendering-labels.ts`
- `npx vitest run apps/web/src/components/__tests__/ShellLayout.nav.test.ts` (or workspace
  equivalent) MUST pass — CI does not reliably run this file, so run it here.

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
