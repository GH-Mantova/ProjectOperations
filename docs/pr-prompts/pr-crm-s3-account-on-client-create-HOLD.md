---
premise: '! grep -q "ensureAccountForClient" apps/api/src/modules/master-data/master-data.service.ts'
premise_means: >-
  Nothing creates an Account when a Client is created, and the two additive account FK columns shipped
  with no backfill. Nine Account rows exist against hundreds of tenders, and the going-cold nudge
  traverses a column nothing writes.
scope:
  - apps/api/src/modules/master-data/**
  - apps/api/src/modules/crm/accounts/**
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/**/__tests__/**
done_when: >-
  pnpm build && pnpm lint && grep -q "ensureAccountForClient"
  apps/api/src/modules/master-data/master-data.service.ts
size: 5
gate_allow: migrations
seed_only: false
escalates: true
backfill: true
rollback_strategy: >-
  Additive only — creates Account rows and populates two nullable FK columns. Reversible by archiving
  the created accounts; no column is dropped and no existing row is modified outside the two FKs.
cluster: crm-build
cluster_order: 3
requires_on_main: apps/web/src/components/ShellLayout.tsx :: CRM_NAV_TABS
---

# CRM S3 — stop the account drift, and backfill what never ran

## The measured defect

`master-data.service.ts:178` does `prisma.client.create(...)` and writes no Account. Grepping `Account`
across `apps/api/src/modules/master-data/` returns nothing. The CRM-1 migration backfilled once, on
2026-08-14; every Client created since has no Account.

Two more columns shipped additively with **no backfill and no write path**:
`contacts.account_id` (CRM-2 migration adds and indexes it, nothing writes it) and
`opportunities.account_id` (CRM-3, same). `getGoingColdAccounts`
(`relationships.service.ts:156-167`) filters `contacts: { some: ... }` through the first of those, so
the going-cold nudge **cannot fire for any account**. The schema comment claiming `account_id` is
"populated for all contacts whose organisationType = CLIENT" is false.

## Do

1. `ensureAccountForClient(clientId, tx?)` in the accounts service: idempotent, creates one Account
   wrapping the Client (`Account.clientId` is `@unique`, so the relation is 1:1 by construction) with
   `lifecycleStatus: PROSPECT` and no inference. Call it from the client-create path, inside the same
   transaction.
2. A data migration backfilling `contacts.account_id` and `opportunities.account_id` from their client
   relation where an Account exists. Idempotent, re-runnable, `WHERE account_id IS NULL` guarded.
3. A data migration creating a PROSPECT Account for every Client that has none. **Lifecycle is
   `PROSPECT` for all — do not infer.** Inference is S4's job, with Marco reviewing it per row.
4. Correct the false schema comment on `Contact.accountId`.

## Do NOT

- **Do NOT infer lifecycle here.** Marco's decision 7: the link is unambiguous, the lifecycle is a guess,
  and a guess applied to 205 rows without review is exactly what he rejected. `PROSPECT` for all.
- **Do NOT modify any Client, Tender, Job or Contract row.** This slice creates Accounts and fills two
  nullable FKs. Nothing else.
- Do NOT drop, rename or re-type any column. Do NOT touch `Account.archivedAt` semantics.
- Do NOT delete or supersede `scripts/crm/backfill-accounts.mjs`; leave it as it is.
- Do NOT touch `/sot/` or any web file.

## Tests

1. `ensureAccountForClient` called twice for one client creates **one** Account (idempotence).
2. Creating a Client through the master-data service yields an Account with `clientId` set.
3. A Client that already has an Account is left untouched — no second row, no field overwritten.
4. **Going-cold regression**: with `contacts.account_id` populated, `getGoingColdAccounts` returns a
   stale account. This is the assertion that proves the backfill did its job — today it returns nothing
   for every input, so a test that only checks "no error" is worthless here.
5. Migration idempotence: applying the backfill twice changes no row the second time.

## STOP AND REPORT

- The client-create path is not at `master-data.service.ts:178`, or creates through a different service.
- `Account.clientId` is not `@unique` on your branch point — the whole 1:1 argument rests on it.
- The backfill would need to write outside `accounts`, `contacts.account_id` and `opportunities.account_id`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
