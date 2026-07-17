---
premise: grep -q "path=\"/resources\"" apps/web/src/App.tsx
premise_means: /resources and /archive are still standalone pages instead of folded into Workers and Documents.
scope:
  - apps/web/src/**
done_when: pnpm build && pnpm lint && ! grep -q "path=\"/resources\"" apps/web/src/App.tsx
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# Fold /archive into Documents, and /resources into Workers

Per Marco 2026-07-17, two consolidations:

1. **Archive -> Documents:** add an "Archived" tab to the Documents workspace (`/documents`) showing
   archived jobs/documents. Redirect `/archive` -> `/documents?tab=archived`; keep `/archive/:jobId`
   reachable (redirect or render inside the Documents archived view). Remove the standalone Archive
   nav entry.
2. **Resources -> Workers:** `/resources` (ResourcesPage) manages worker availability windows, role
   suitabilities and competencies — these are worker attributes. Fold it into the Workers surface
   (`/workers`) as tabs (Availability / Suitability / Competencies), reusing the existing
   `ResourcesPage` logic. Redirect `/resources` -> `/workers`. Remove the standalone Resources nav
   entry.

## Do NOT
- Do NOT drop the underlying `/resources/workers` API calls — reuse them from the Workers surface.
- Do NOT touch the FIELD (mobile) nav.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
Finishing the work and then asking for permission is indistinguishable from failing.

## Guardrails
One attempt. Never exit silently (`NO-OP: <reason>`). Never ask or stand by. `pnpm build` +
`pnpm lint` must pass. Read the CI job log before diagnosing any failure.
