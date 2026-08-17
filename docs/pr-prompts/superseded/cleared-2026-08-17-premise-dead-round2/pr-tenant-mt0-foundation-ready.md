---
premise: '! test -f apps/api/src/common/tenancy/tenant.constants.ts'
premise_means: >-
  No multi-tenant foundation exists — there is no `Tenant` model, no nullable
  `tenantId` columns on the pilot models, and no `tenant.constants.ts`
  (PILOT_TENANT_AWARE_MODELS / SEEDED_DEFAULT_TENANT_ID). Nothing is enforced yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/prisma/seed.ts
  - apps/api/src/common/tenancy/**
  - docs/data-model/**
done_when: >-
  pnpm build && pnpm lint && test -f apps/api/src/common/tenancy/tenant.constants.ts && grep -q "model Tenant" apps/api/prisma/schema.prisma
size: 7
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: >-
  Purely additive. A new `tenants` table, five nullable `tenant_id` FK columns
  (ON DELETE SET NULL), one seeded Tenant row, and the constants file. No existing
  row is constrained or mutated; no behaviour changes. To revert: drop the five
  columns + the tenants table, delete the migration dir, remove the tenancy files.
---

# MT-0: Tenant model + additive nullable `tenantId` columns (multi-tenant FOUNDATION)

**Do NOT auto-merge — escalates, touches schema + a migration. Leave the PR open, unmerged, for Marco.
Do NOT touch Azure/Entra/SharePoint.**

This is the LOCKED foundation of the multi-tenant program (`docs/plans/multi-tenant-plan.md`: model A,
row-level `tenantId`, decision locked 2026-08-04). It is **purely additive — nothing is enforced, no
behaviour changes**: it just adds the `Tenant` table, the nullable columns, the shared constants, and the
one seeded default tenant. Scoping (MT-1), identity carry (MT-2), backfill/enforce (MT-3), and the UIs
(MT-4/MT-5) are separate later slices that build on this.

## What to build

### 1. `model Tenant` in `apps/api/prisma/schema.prisma`
    model Tenant {
      id        String   @id @default(cuid())
      name      String
      code      String?  @unique
      isActive  Boolean  @default(true) @map("is_active")
      createdAt DateTime @default(now()) @map("created_at")
      updatedAt DateTime @updatedAt @map("updated_at")
      // back-relations added alongside the pilot-model changes below
      @@map("tenants")
    }

### 2. Add a NULLABLE `tenantId` to EXACTLY the five pilot models
`Client`, `Worker`, `Contact`, `Tender`, `Job` — each gets:
    tenantId String? @map("tenant_id")
    tenant   Tenant? @relation(fields: [tenantId], references: [id], onDelete: SetNull)
and a matching back-relation on `Tenant`. **Do NOT touch `WorkerProfile` or any other model.** Default
NULL = shared / the existing company; nothing is backfilled or made NOT NULL here (that is MT-3).

### 3. `apps/api/src/common/tenancy/tenant.constants.ts` (new — PRIMARY ARTIFACT of this slice)
    // The pilot set of tenant-aware models. Scoping (MT-1) covers exactly these.
    export const PILOT_TENANT_AWARE_MODELS = ["Client", "Worker", "Contact", "Tender", "Job"] as const;
    export type PilotTenantAwareModel = (typeof PILOT_TENANT_AWARE_MODELS)[number];
    // The one existing company, seeded as tenant #1. Used by MT-3's backfill.
    export const SEEDED_DEFAULT_TENANT_ID = "tenant-initial-services-001";

### 4. Additive migration `apps/api/prisma/migrations/<timestamp>_feat_tenant_mt0/migration.sql`
- `CREATE TABLE tenants (...)`.
- `ALTER TABLE` each of clients/workers/contacts/tenders/jobs to add nullable `tenant_id` + FK
  `REFERENCES tenants(id) ON DELETE SET NULL`.
- `INSERT` the one seeded Tenant row with id = `SEEDED_DEFAULT_TENANT_ID`, name = the existing company
  (use the CompanyProfile name if trivially available, else "Initial Services"), isActive true.
- Do **NOT** backfill any existing row's `tenant_id` and do **NOT** add NOT NULL — additive only.

### 5. Seed idempotency
Make `apps/api/prisma/seed.ts` upsert the default Tenant row by `SEEDED_DEFAULT_TENANT_ID` (idempotent x2).

### 6. Regenerate the data-model map
Run `node scripts/data-model/build-relationship-map.mjs`; commit `docs/data-model/relationship-map.json`,
`.md`, and `metadata-catalog.json`.

### 7. PR body
Bare line at column 0: `GATE-ALLOW: migrations`.

## Do NOT
- Do NOT enforce NOT NULL, add any scoping/filtering, or change any read/write behaviour (MT-1+ do that).
- Do NOT add `tenantId` to any model beyond the five pilot models. Do NOT touch `WorkerProfile`.
- Do NOT touch Azure/Entra/SharePoint. Do NOT edit anything under `/sot/`.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if this is already on main, say `NO-OP: <reason>`.
- **Never ask a question or "stand by" for a go/no-go.** The go was given when this prompt was armed.
- Regenerate the data-model map (step 6) or the drift check fails; put `GATE-ALLOW: migrations` bare at
  column 0 of the PR body (step 7) or CP-11 fails. `pnpm build` and `pnpm lint` must pass.

## VERIFY
- `pnpm build && pnpm lint`; `model Tenant` present; five pilot models have nullable `tenantId`;
  `tenant.constants.ts` exports both symbols; seed idempotent x2; migration additive (no NOT NULL, no backfill).
