---
premise: '! grep -q "AnchorPicker" apps/web/src/pages/crm/CommsHubPage.tsx'
premise_means: >-
  Every write action in the Comms hub lives in anchored mode, entered only via a query string, and the
  nav points at unanchored mode. The only code that builds an anchored URL is the hub navigating from an
  existing thread, so on a system with zero threads it is a closed loop.
scope:
  - apps/web/src/pages/crm/CommsHubPage.tsx
  - apps/web/src/pages/crm/AnchorPicker.tsx
  - apps/web/src/pages/crm/crm-api.ts
  - apps/web/src/pages/crm/__tests__/**
done_when: 'pnpm build && pnpm lint && grep -q "AnchorPicker" apps/web/src/pages/crm/CommsHubPage.tsx'
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: crm-build
cluster_order: 9
requires_on_main: apps/web/src/pages/crm/TendersRegisterPage.tsx :: CRM_REGISTER_V2
---

# CRM S9 — a thread you can actually start

## The measured defect

`CommsHubPage.tsx:453` — `createThread` returns early unless `anchored`. `:396` — `anchored` is
`Boolean(entityType && entityId)`. `:382` — `entityId` comes only from the query string and defaults to
`""`. `:512-514` — unanchored mode returns the read-only inbox, and that is where the nav points.
Grepping `/crm/comms` across `apps/web/src/pages` outside the page itself returns nothing: no Account,
Tender, Job or Contract page links in.

## Do

1. `AnchorPicker` — a **two-step** control per Marco's decision 4: pick the type, then the record.
   Types: **Lead · Tender · Job · Account · Contract · Other**. "Other" carries a free-text label and no
   entity id.
2. **New thread** on the unanchored inbox, using the picker, so the first thread on an empty system is
   reachable.
3. Deep links **into** anchored mode from Account (S6 put the button there), Tender and Job detail pages.
4. Assignee on the task creator, if S1 did not already establish it — reuse S1's source; do not add a
   second.

## Do NOT

- **Do NOT move any triage action into the comms module.** Price it / Don't pursue belong to intake
  (S10). Marco's decision 3: comms imports nothing from Tender or Job so it can branch into its own
  product later, and that boundary is the reason he asked to keep the sub-module. **If you find yourself
  importing a Tender or Job service into comms, stop and report.**
- Do NOT change the polymorphic anchor's storage shape — `entityType`/`entityId` already exist.
- Do NOT resolve @mentions to users in this slice; that is a separate gap, out of scope here.
- Do NOT touch the register or the accounts pages beyond adding a deep link.

## Tests

1. `buildCreateThreadBody` from a two-step selection produces a valid `entityType`/`entityId` pair.
2. **"Other"** produces a thread with a label and no entity id, and does not throw.
3. Negative control: the picker cannot produce a body with an `entityType` and an empty `entityId` —
   that is exactly the state that makes the hub a closed loop today.
4. All six types are offered; assert the list, so dropping one is caught.

## STOP AND REPORT

- Building the record step for a type requires an endpoint that does not exist. Ship the types you can
  serve, say which you could not, and do not add an endpoint.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
