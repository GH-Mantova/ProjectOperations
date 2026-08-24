---
premise: '! test -f apps/web/src/pages/JobSorRegisterPage.tsx'
premise_means: There is no per-job SoR register screen, so the VC+AR register and the raise-claim action built by S9a have no user-facing surface and can only be reached through the API.
scope:
  - apps/web/src/pages/JobSorRegisterPage.tsx
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/JobSorRegisterPage.tsx && grep -q "sor-register" apps/web/src/App.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
cluster: sor-s9
cluster_order: 2
requires_on_main: apps/api/src/modules/agreed-records/agreed-record-register.controller.ts :: eligible-for-claim
---

# SoR S9b - per-job SoR register screen + raise-claim picker

**Slice 2 of 2.** Marco split the former S9 at the API/web seam on 2026-08-20. **S9a** built the
schema, the migration, the register service and its controller. This slice is the UI only.

**Gate:** S9a must be on main - the literal route segment `eligible-for-claim` present in
`apps/api/src/modules/agreed-records/agreed-record-register.controller.ts`. That is a **real symbol
S9a introduces**, not a marker file: if the endpoint this page calls does not exist, the page cannot
work, so the gate tests exactly the thing that matters.

## Grounded (read first - all of this is on main once S9a lands)

Three endpoints exist and are guarded by the existing project-manager / claims-manage permission.
**Read the controller before writing the page** - take the response shapes from the code, not from
this description:

- `GET  register/for-job/:jobId` - combined VC + AR rows, sorted `createdAt` desc. VC rows carry
  `variationNumber`, description, status, `sorVersion`, `pricedAmount`. AR rows carry `recordNumber`,
  description, status, `sorVersion`, `totalPricedAmount`, and worker + client-rep signature presence.
- `GET  register/for-job/:jobId/eligible-for-claim` - the APPROVED-only subset used to build the
  raise-claim payload.
- `POST register/for-job/:jobId/raise-claim` - body `{ claimMonth, variationIds[], agreedRecordIds[] }`.

## What to build

1. **`apps/web/src/pages/JobSorRegisterPage.tsx`**
   - A per-job register table with VC and AR rows in one list, status pills, and the SoR version
     stamp per row. Follow the existing per-job page design tokens - **find a sibling per-job page
     and match it**; do not invent new visual language.
   - A **"Raise claim"** action that opens a picker populated from `eligible-for-claim` (approved
     and, for ARs, both-signatures-present items only), takes a claim month, and posts to
     `raise-claim`.
   - The picker must show **why** an item is not eligible when the register lists it but the
     eligible feed does not - unapproved, or missing a signature. A disabled row with a reason beats
     a row that silently vanishes between the two lists.
   - Handle the empty case (a job with no VCs and no ARs) with a plain empty state, not a spinner
     that never resolves.
   - Read error bodies with **`readApiErrorMessage`** - the raw-error-envelope migration finished on
     2026-08-20 and 50 files now use it. Do NOT reintroduce a raw `res.text()` read.

2. **`apps/web/src/App.tsx`** - route at `/jobs/:jobId/sor-register` behind the same claims-manage
   guard the API uses. The literal `sor-register` must appear here; `done_when` asserts it.

## Do NOT

- **Do NOT touch the API, the schema, or any migration.** If an endpoint is wrong or missing a field,
  say so in the PR body and work with what exists - **do not widen into S9a's scope to fix it.**
- Do NOT introduce a parallel claim model or re-run any pricing.
- Do NOT build the configurable approval-chain / roles editor UI (DEFERRED in the plan's LATER).
- Do NOT touch tender pricing, Azure/Entra/SharePoint, or `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the two files in `scope`. That is a scope limit,
**not** a reason to stop before pushing.

## Guardrails

- One attempt. If `JobSorRegisterPage.tsx` already exists on main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
