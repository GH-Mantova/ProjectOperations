---
premise: ! test -f scripts/data-model/tenant-id-null-audit.mjs
premise_means: Nobody has measured how many Tender/Job rows currently have a NULL tenantId, and tenantId is still nullable (not enforced) on those company-owned tables.
scope:
  - scripts/data-model/**
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && test -f scripts/data-model/tenant-id-null-audit.mjs && grep -qE "^\s+tenantId\s+String\s" apps/api/prisma/schema.prisma
size: 6
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Backfill sets tenantId = the single seeded Tenant row (SEEDED_DEFAULT_TENANT_ID from apps/api/src/common/tenancy/tenant.constants.ts) on every Tender/Job row currently NULL, then ALTERs both columns to NOT NULL. The backfilled value is provably correct pre-migration (every existing row belongs to the one company that has existed until now), so there is no data-loss risk. To revert: run `ALTER TABLE tenders ALTER COLUMN tenant_id DROP NOT NULL; ALTER TABLE jobs ALTER COLUMN tenant_id DROP NOT NULL;` — the backfilled values are harmless to leave in place even after reverting the constraint.'
---

# MT-3: Backfill + enforce tenantId on company-owned pilot tables (production data — Marco-run)

**Do NOT auto-merge — escalates, touches production data. Leave the PR open, unmerged. Marco runs the
backfill migration by hand after review, mirroring how the siteId backfill
(`docs/pr-prompts/pr-siteid-notnull-backfill-HOLD.md`) was handled. Do NOT touch Azure/Entra/SharePoint.**

Per `docs/plans/multi-tenant-plan.md`, MT-3 runs only "After MT-1/MT-2 are proven" — this slice assumes
the scoping extension (MT-1) and identity carry (MT-2) are already on main. From MT-0, `Tender.tenantId`
and `Job.tenantId` are nullable and currently NULL on every existing row (no backfill has happened). The
classification is already locked and requires no new decision here (unlike the siteId case): company-owned
tables get `tenantId` backfilled to the one existing company and then made `NOT NULL`; shared master data
(`Client`, `Worker`, `Contact`) stays nullable and untouched — this slice does NOT touch those three.

## What to build

### 1. `scripts/data-model/tenant-id-null-audit.mjs` (new — primary artifact of this slice)
A **READ-ONLY** audit script mirroring the house convention in
`scripts/data-model/siteid-null-audit.mjs`: connects via Prisma, counts `Tender` and `Job` rows where
`tenantId IS NULL` vs total, and writes a timestamped report to
`docs/data-model/tenant-id-null-audit-<ISO-stamp>.md` (same header/structure as
`docs/data-model/siteid-null-audit-2026-07-20T13-43-07.md`). No schema changes, no migrations, no row
mutations. Run it and commit the generated report alongside this PR so the NULL count is on record before
the backfill migration below runs.

### 2. Migration: backfill then enforce
`apps/api/prisma/migrations/<timestamp>_backfill_enforce_tenant_ids/migration.sql`, in this exact order:
1. `UPDATE tenders SET tenant_id = '<SEEDED_DEFAULT_TENANT_ID>' WHERE tenant_id IS NULL;`
2. `UPDATE jobs SET tenant_id = '<SEEDED_DEFAULT_TENANT_ID>' WHERE tenant_id IS NULL;`
3. `ALTER TABLE tenders ALTER COLUMN tenant_id SET NOT NULL;`
4. `ALTER TABLE jobs ALTER COLUMN tenant_id SET NOT NULL;`
Use the literal id exported as `SEEDED_DEFAULT_TENANT_ID` from
`apps/api/src/common/tenancy/tenant.constants.ts` (MT-0). Do NOT touch `clients`, `workers`, or
`contacts` — those stay nullable (shared master data), per the locked classification.

### 3. Update `apps/api/prisma/schema.prisma`
Flip `Tender.tenantId` and `Job.tenantId` from `String?` to `String` (required), keeping the `Tenant`
relation non-optional to match. `Client.tenantId`, `Worker.tenantId`, `Contact.tenantId` stay `String?`
— do not change them.

### 4. Regenerate the data-model map
Run `node scripts/data-model/build-relationship-map.mjs`. Commit the regenerated
`docs/data-model/relationship-map.json`, `docs/data-model/relationship-map.md`, and
`docs/data-model/metadata-catalog.json`.

### 5. PR body
- Bare line at column 0: `GATE-ALLOW: migrations`.
- State the exact NULL counts from step 1's audit report before backfill.
- State plainly this is a production-data migration and Marco must review/run it, mirroring the siteId
  backfill precedent.

## Do NOT
- Do NOT touch `Client`, `Worker`, or `Contact` — those are shared/mixed master data and stay nullable.
- Do NOT enforce NOT NULL on any table beyond `Tender` and `Job` in this slice.
- Do NOT run the migration against production yourself — open the PR and stop; Marco runs it.
- Do NOT touch Azure/Entra/SharePoint.
- Do NOT edit anything under `/sot/`.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if this is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- Regenerate the data-model map (step 4) or the drift check fails; put `GATE-ALLOW: migrations` bare at
  column 0 of the PR body (step 5) or CP-11 fails.
- `pnpm build` and `pnpm lint` must pass. The audit script (step 1) must be genuinely read-only — verify
  it issues no `UPDATE`/`ALTER` and runs it BEFORE writing the backfill migration.
