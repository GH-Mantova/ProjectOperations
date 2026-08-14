---
premise: '! test -f apps/web/src/pages/crm/CrmRedirects.tsx'
premise_means: The directory/clients entry points and dead /crm routes have not been redirected into the new CRM surface.
requires_file_on_main: apps/web/src/pages/crm/CrmIndex.tsx
scope:
  - apps/web/src/App.tsx
  - apps/web/src/pages/crm/**
  - apps/web/src/components/ShellLayout.tsx
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && test -f apps/web/src/pages/crm/CrmRedirects.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# NAV-4 — Directory/dead-route redirects into the CRM surface

Implement **NAV-4** of `docs/plans/crm-tendering-nav-remodel-plan.md`.

## What to build
- New `apps/web/src/pages/crm/CrmRedirects.tsx` centralising the CRM redirects, wired in `App.tsx`:
  - the client/Directory entry point → `/crm/accounts` (a **light** redirect only — the deep Directory
    decommission + Subcontractor/Supplier → Procurement move is owned by `docs/plans/site-dissolution-plan.md`;
    do NOT duplicate it here),
  - any remaining dead `/crm` → `/crm/accounts`.
- Confirm the **Comms hub** nav item (added in NAV-1) resolves to `/crm/comms`.
- Update e2e where a directory/clients nav path is asserted.

## Do NOT
- Do NOT delete or re-home Subcontractor/Supplier (site-dissolution owns that). Do NOT touch /sot/ or Azure.
- Do NOT remove the Directory data or module — this is a nav redirect only.

## Guardrails
- Build + lint pass; redirects must not 404. `escalates:false` — auto-merges on green.
