---
premise: '! grep -q "model ClientShare" apps/api/prisma/schema.prisma'
premise_means: There are no share-grant tables. Under D48 sharing must be an explicit grant, and there is nowhere to record one.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/common/tenancy/dto/share-grant.dto.ts
  - apps/api/src/common/tenancy/__tests__/share-tables.contract.spec.ts
done_when: pnpm build && pnpm lint && grep -q "model ClientShare" apps/api/prisma/schema.prisma && grep -q "model WorkerShare" apps/api/prisma/schema.prisma && grep -q "model ContactShare" apps/api/prisma/schema.prisma
size: 5
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: Purely additive - three new empty tables and their indexes, nothing existing altered and no data written. Safe to leave on main; nothing reads the tables until SLICE 3. To revert, drop client_shares / worker_shares / contact_shares and remove the three models from schema.prisma.
cluster: tenant-mt4
cluster_order: 1
---

# Multi-company SLICE 1 — the share list (schema only, additive)

Binding plan: **`docs/plans/multi-tenant-plan.md` § Slice breakdown, SLICE 1** (on `main`, #1175).
Decisions **D25, D48–D51** — read them in the plan before starting.

**Behaviour change in this slice: none.** Three empty tables appear. Nothing reads them yet.

## Grounding — verified on origin/main

- `model ClientShare` / `WorkerShare` / `ContactShare` — **all absent.**
- `Client`, `Worker` and `Contact` each carry `tenantId String?` — still **optional**. That is
  SLICE 2's problem, not this one. **Do not change those columns here.**
- `model Tenant` already exists; MT-0→MT-3 shipped.

## What to build

Three typed join tables — `ClientShare`, `WorkerShare`, `ContactShare`.

**One table per domain, NOT one polymorphic `Share` table.** The plan is explicit and the Data
Modeller lens insisted on it: real foreign keys, real cascade behaviour per domain. A polymorphic
table would have a string `entityType` and no referential integrity, and would make SLICE 3's
`EXISTS <grant>` check unverifiable by the database.

Each row records:

- the shared record's id (FK to the owning table, cascade on delete of the source record)
- `granteeTenantId` (FK to `Tenant`)
- `grantedByUserId` (FK to `User`)
- `grantedAt`
- optional `note`

**Unique index on `(recordId, granteeTenantId)`** — a record cannot be granted to the same company
twice.

Also add the DTO types for a grant in the tenancy module, and a contract test asserting the three
tables exist, are empty, and reject a duplicate `(recordId, granteeTenantId)` pair.

`SupplierShare` / `RateShare` / `PermissionRoleShare` are named in the plan as a **later expansion
path**. Do **not** create them in this slice — those domains have no `tenantId` column at all yet,
so a share table for them would reference an ownership model that does not exist.

## Required because this touches `schema.prisma`

- Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
  `docs/data-model/relationship-map.json` + `.md` + `metadata-catalog.json`. The CI drift check
  hard-fails a schema change that leaves the map stale, and you will not see that failure yourself.
- Put **`GATE-ALLOW: migrations`** as a bare line at column 0 of the PR body.
- Update any `*.spec.ts` `toHaveBeenCalledWith(...)` expectations your change touches.

## Do NOT

- Do NOT make `tenantId` required on anything. That is SLICE 2, it is a production-data migration,
  and Marco runs it.
- Do NOT change `tenant-scoping.middleware.ts` or any query. That is SLICE 3, and doing it now —
  while every client, worker and contact still has a blank owner — would make all master data
  invisible to everyone including Initial Services.
- Do NOT add share-management UI. That is SLICE 4.
- Do NOT write any share rows, seed any grants, or backfill anything.
- Do NOT touch `/sot/` or anything outside `scope`.

## Guardrails

- One attempt. If you cannot complete it, say `NO-OP: <reason>` and stop.
- Never exit silently. Never ask a question or stand by for approval.
- Read the job log before diagnosing any CI failure — never guess from the check name.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## For the PR body

State the exact migration folder name you created. **SLICE 2 and SLICE 3 both gate on artifacts
from this chain, and a human has to read that name off this PR to write SLICE 3's gates.**

## The completion test

Is there a PR number in your output? If no because the work was already on `main`, say
`NO-OP: <reason>`. If no because you are waiting for someone — there is nobody. Open the PR.
