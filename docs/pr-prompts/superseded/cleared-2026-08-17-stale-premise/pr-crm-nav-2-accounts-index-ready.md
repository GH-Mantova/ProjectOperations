---
premise: '! test -f apps/web/src/pages/crm/AccountsListPage.tsx'
premise_means: There is no Accounts (Client-360) index/landing page; only the AccountDetailPage exists.
requires_file_on_main: apps/web/src/pages/crm/CrmIndex.tsx
scope:
  - apps/web/src/pages/crm/**
  - apps/api/src/modules/crm/accounts/**
  - tests/e2e/**
done_when: pnpm --filter @project-ops/web build && test -f apps/web/src/pages/crm/AccountsListPage.tsx
size: 8
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# NAV-2 — Accounts index (Client-360 landing)

Implement **NAV-2** of `docs/plans/crm-tendering-nav-remodel-plan.md`.

## What to build
- New `apps/web/src/pages/crm/AccountsListPage.tsx` rendered at `/crm/accounts` — a list of Accounts:
  **name, type, lifecycle (PROSPECT/ACTIVE/PAST), win rate, open opportunities, last contact, "going cold"
  flag** (no contact > 14 days & not PAST). Each row links to the shipped `AccountDetailPage`
  (`/crm/accounts/:id`). Header stat tiles (total / active / prospects / going-cold) optional but preferred.
- Consume the CRM-1 accounts API. If `accounts.service.ts`/`accounts.controller.ts` has **no read-only list
  endpoint**, add a minimal one (list account summaries incl. the roll-up counts) — **read-only, no schema
  change**. If a list endpoint already exists, reuse it (do not duplicate).
- Match the shipped s7 / design-token conventions; "going cold" derives from `lastContactedAt` (CRM-2 field
  once present) or falls back gracefully if that column isn't on main yet.

## Do NOT
- Do NOT change the Account schema or write transactional facts. Do NOT touch /sot/ or Azure.

## Guardrails
- Build + lint pass. `escalates:false` — auto-merges on green.
