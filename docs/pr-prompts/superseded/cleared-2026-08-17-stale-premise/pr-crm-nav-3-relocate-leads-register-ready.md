---
premise: '! test -f apps/web/src/pages/crm/TendersRegisterPage.tsx'
premise_means: The Tenders register lives only as a tab on the Tenders page; there is no standalone register page and Leads & Opportunities has not moved to Tendering.
requires_file_on_main: apps/web/src/pages/crm/CrmIndex.tsx
scope:
  - apps/web/src/pages/**
  - apps/web/src/App.tsx
  - apps/web/src/components/ShellLayout.tsx
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && test -f apps/web/src/pages/crm/TendersRegisterPage.tsx && grep -q "crm/register" apps/web/src/App.tsx
size: 9
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# NAV-3 — Relocate Leads & Opportunities + Tenders register

Implement **NAV-3** of `docs/plans/crm-tendering-nav-remodel-plan.md`.

## What to build
- **Tenders register** → new `apps/web/src/pages/crm/TendersRegisterPage.tsx` at `/crm/register`:
  read-only, ALL tenders / ALL statuses, one row per tender, **CLIENT** (primary/awarded client) + **STATUS**
  (tender status) columns + filters. Reuse the existing full-dataset (loop-pagination) fetch from the shipped
  Tendering S1 work; do NOT re-cap at 100.
- **Leads & Opportunities** → move the leads-collapse "Leads & opportunities" surface off the Tenders-page
  tab into its own route under **Tendering** (e.g. `/tenders/leads` or `/leads-opportunities`); wire the
  NAV-1 "Leads & opportunities" nav item to it. The Tenders page keeps draft entry + pricing + Pipeline.
- **Redirects** (`Navigate replace`): old Tenders-tab URLs for leads/register → their new homes; dead `/crm`
  → `/crm/accounts` (if not already from NAV-1). Update `batch2-tendering` / `batch8` e2e assertions.

## Do NOT
- Do NOT change tender business logic or the per-client model — this relocates views only.
- Do NOT touch /sot/ or Azure. The withdrawn-review lifecycle is a separate slice (not here).

## Guardrails
- Build + lint pass; no dead imports; redirects must not 404. `escalates:false` — auto-merges on green.
