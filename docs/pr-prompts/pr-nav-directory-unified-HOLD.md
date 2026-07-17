---
premise: '! grep -rq "DirectoryPage" apps/web/src'
premise_means: The unified Directory surface (Clients / Subcontractors & Suppliers / Contacts tabs) does not exist yet.
scope:
  - apps/web/src/**
done_when: pnpm build && pnpm lint && grep -rq "DirectoryPage" apps/web/src
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# Unified Directory: one tabbed surface for Clients / Subcontractors & Suppliers / Contacts

Per Marco 2026-07-17: collapse the five people/company surfaces into ONE Directory page with tabs.
Today these are scattered across `/master-data` (clients tab), `/tenders/clients`,
`/tenders/contacts`, `/directory/subcontractors`, `/directory/contacts`.

Build `DirectoryPage` at `/directory` with tabs: **Clients | Subcontractors & Suppliers | Contacts**,
reusing the existing data sources/components. Point the sidebar "Directory" item at `/directory`.
Redirect the old routes to `/directory?tab=...`. Make the tender-scoped contacts view
(`/tenders/contacts`, `/tenders/clients`) a tab inside the tender workspace, or redirect to the
Directory filtered by tender. Do not change the API/backend models.

## Do NOT
- Do NOT delete backend endpoints or Prisma models. Redirect old routes; do not hard-remove them
  until a later cleanup PR confirms nothing links to them.
- Do NOT touch the FIELD (mobile) nav.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails
One attempt. Never exit silently (`NO-OP: <reason>`). Never ask or stand by. `pnpm build` +
`pnpm lint` must pass. Read the CI job log before diagnosing any failure.
