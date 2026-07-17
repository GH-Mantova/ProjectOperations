---
premise: grep -q "tenders/dashboard" apps/web/src/App.tsx
premise_means: The dead /tenders/dashboard route still exists in the router.
scope:
  - apps/web/src/**
done_when: pnpm build && pnpm lint && ! grep -q "tenders/dashboard" apps/web/src/App.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# Remove the dead /tenders/dashboard route and confirm Home (/) is the default dashboard

Per Marco 2026-07-17: the landing page `/` is the single "Home" dashboard. Remove the redundant
`/tenders/dashboard` route + its page import + any sidebar/link references. Confirm `/` renders the
Home dashboard as the default landing.

## Do NOT
- Do NOT delete the two seeded dashboard ROWS ("Operations", "Tendering",
  ids fcbe0865-... and 039aa61f-...) here — deleting production dashboard data is a separate
  `escalates: true` task for Marco. This PR is code-only (routes/links).
- Do NOT touch the FIELD (mobile) nav.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails
One attempt. Never exit silently (`NO-OP: <reason>`). Never ask or stand by. `pnpm build` +
`pnpm lint` must pass. Read the CI job log before diagnosing any failure.
