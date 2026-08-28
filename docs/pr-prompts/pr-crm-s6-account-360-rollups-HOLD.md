---
premise: '! grep -q "rollUpContracts" apps/api/src/modules/crm/accounts/accounts.service.ts'
premise_means: >-
  getAccount360 rolls up contacts, tenders and jobs only. Its own header comment claims contracts, the
  Account has relationshipNotes and opportunities relations that are never read, and there is no way to
  log a contact from the account list.
scope:
  - apps/api/src/modules/crm/accounts/**
  - apps/web/src/pages/crm/AccountDetailPage.tsx
  - apps/web/src/pages/crm/AccountsListPage.tsx
  - apps/web/src/pages/crm/__tests__/**
  - apps/api/src/modules/crm/**/__tests__/**
done_when: >-
  pnpm build && pnpm lint && grep -q "rollUpContracts"
  apps/api/src/modules/crm/accounts/accounts.service.ts
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: crm-build
cluster_order: 6
requires_on_main: apps/web/src/pages/crm/crm-api.ts :: patchAccount
---

# CRM S6 — the four roll-ups Account 360 is missing, and Log contact from a row

## The measured gap

`getAccount360` (`accounts.service.ts:218-320`) queries contacts, `tenderClient` and `job`.
Grepping `contract` across `modules/crm/accounts/` returns only comment lines — including `:77`, which
claims contracts are rolled up. `AccountDetailPage.tsx:376` has exactly three tabs.
`Account.relationshipNotes` and `Account.opportunities` exist in the schema and are never read.

## Do

1. Add read-only roll-ups to `getAccount360`: **contracts**, **opportunities**, **relationship notes**
   and **comms threads** (by the polymorphic anchor `entityType: "ACCOUNT"`).
2. Tabs on `AccountDetailPage`: **Activity** (default), Contacts, Tenders, Jobs, **Contracts**,
   **Opportunities**. Activity merges notes and threads into one time-ordered timeline.
3. Email entries in the Activity timeline render behind a clearly-labelled empty state — the capture
   worker is blocked on Marco's M365 provisioning and is **out of scope for this programme**.
4. **Log contact** on every row of the Accounts list, opening the S1 note form pre-filled with that
   account. Same component, not a second form.

## Do NOT

- **Do NOT change the three existing roll-ups.** Add beside them; a shape change breaks the list page.
- Do NOT write anything into an Email or capture path. Do NOT touch Azure / Entra / M365 config.
- Do NOT make the CRM write to a Tender, Job or Contract. Roll-ups are read-only — this is the ownership
  matrix in `crm-module-plan.md` and it is not up for revision.
- Do NOT build a second note form.

## Tests

1. `getAccount360` returns the four new roll-up keys and **still returns the original three unchanged** —
   assert the old keys explicitly; that is the regression that matters.
2. An account with no contracts returns an empty array, not undefined.
3. Activity ordering: a note and a thread interleave by timestamp, newest first.
4. `Log contact` builds a note body carrying the row's `accountId` — never null (S1's guard).

## STOP AND REPORT

- `CommThread` cannot be queried by account without importing a module comms deliberately does not
  import. If so, read it from the accounts side and report how.
- Adding a roll-up changes the response shape the list page depends on.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
