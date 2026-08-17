---
premise: '! test -f apps/web/src/pages/crm/CrmIndex.tsx'
premise_means: The CRM top-level nav group and the /crm landing do not exist; the group is still named "Estimating".
requires_file_on_main: docs/plans/crm-tendering-nav-remodel-plan.md
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.ts
  - apps/web/src/App.tsx
  - apps/web/src/pages/crm/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && test -f apps/web/src/pages/crm/CrmIndex.tsx && grep -q "Tendering" apps/web/src/components/ShellLayout.tsx
size: 9
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# NAV-1 — Tendering rename + CRM group shell

Implement **NAV-1** of `docs/plans/crm-tendering-nav-remodel-plan.md`. Read that plan §2/§4/§5 first.

## What to build
- `apps/web/src/components/ShellLayout.tsx`: rename the top-level group **`id:"estimating"` label
  "Estimating" → label "Tendering"** (keep or rename the id; update all refs). Set its children order to:
  **Leads & opportunities, Tenders, Pipeline, Schedule of Rates, Contracts, Reports** (Leads & opportunities
  is a NEW nav entry pointing at the existing leads surface route; if that route lands in NAV-3, point it at
  the current Tenders-tab URL for now). Insert a **new top-level "CRM" group BETWEEN Tendering and Projects**
  with items **Accounts** (`/crm/accounts`), **Tenders register** (`/crm/register`), **Comms hub**
  (`/crm/comms`), each with a `requiresPermission` (reuse the nearest existing CRM/clients permission code;
  do NOT invent a new code silently — if none fits, note it in the PR body for Marco).
- `apps/web/src/App.tsx`: add a **`/crm` index route → `<CrmIndex/>`** which redirects to `/crm/accounts`;
  add a `/crm/register` route placeholder (the real page lands in NAV-3 — a temporary stub is fine); keep the
  existing `/crm/accounts/:id`, `/crm/pipeline`, `/crm/comms`, `/crm/opportunities/:id` routes.
- New `apps/web/src/pages/crm/CrmIndex.tsx` (the `/crm` landing → `Navigate` to `/crm/accounts`).
- Update `ShellLayout.nav.test.ts` (assert Tendering group + CRM group) and any `batch1-auth-shell` e2e
  that asserts the old "Estimating" label.

## Do NOT
- Do NOT move the Tenders/register views yet (that is NAV-3). Do NOT touch /sot/ or Azure/Entra/SharePoint.
- Do NOT change any page's business logic — nav shell + one redirect landing only.

## Guardrails
- `pnpm --filter @project-ops/web build` + lint pass. `escalates:false` — auto-merges on green.
