---
premise: ! sed -n '/^model Client {/,/^}/p' apps/api/prisma/schema.prisma | grep -q tenantId
premise_means: Client (and the other pilot tenant-aware models) have no tenantId column yet; no Tenant model exists on main.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/prisma/seed.ts
  - apps/api/src/common/tenancy/tenant.constants.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model Tenant {" apps/api/prisma/schema.prisma && sed -n '/^model Client {/,/^}/p' apps/api/prisma/schema.prisma | grep -q tenantId && test -f apps/api/src/common/tenancy/tenant.constants.ts
size: 7
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Purely additive: one new Tenant table + nullable tenantId columns (default NULL) on five pilot models; no existing row is touched, no column is dropped, no constraint tightened. Safe to leave applied. To revert before dependent code lands: drop the tenantId columns and the tenant table, delete the migration directory, re-run prisma migrate.'
---

# MT-0: Tenant model + additive nullable tenantId columns (pilot tranche)

**Do NOT auto-merge — escalates. This is a schema slice for the multi-tenant program; leave the PR open, unmerged, for Marco.**

Per the locked design in `docs/plans/multi-tenant-plan.md` (model A, row-level nullable `tenantId`,
`tenantId = NULL` means group-wide/shared), main today has zero tenant concept: `apps/api/prisma/schema.prisma`
has no `model Tenant` and no tenant-aware model (verified: `Client`, `Worker`, `Contact`, `Tender`, `Job`)
carries a `tenantId` column. `PrismaService` (`apps/api/src/prisma/prisma.service.ts`) is a bare
`PrismaClient` subclass with no scoping. This slice adds ONLY the additive schema plumbing — nothing is
enforced, no query is filtered, no existing row is touched. It is the first of several slices; do not try
to build the middleware, identity carry, backfill, or UI here.

## What to build

### 1. Add a `Tenant` model to `apps/api/prisma/schema.prisma`
Minimal registry of companies in the group:

    model Tenant {
      id        String   @id @default(cuid())
      name      String
      code      String?  @unique
      isActive  Boolean  @default(true) @map("is_active")
      createdAt DateTime @default(now()) @map("created_at")
      updatedAt DateTime @updatedAt @map("updated_at")
      @@map("tenants")
    }

### 2. Add a nullable `tenantId` column to a PILOT set of five tenant-aware models only
This is tranche 1, deliberately kept small (5 tables, well under the ~8-table guidance). Add to
EXACTLY: `Client` (~line 657), `Worker` (~line 906), `Contact` (~line 736) — the "mixed" classification
in the plan doc — and `Tender` (~line 1080), `Job` (~line 1351) — "company-owned". On each:

    tenantId String? @map("tenant_id")
    tenant   Tenant? @relation(fields: [tenantId], references: [id], onDelete: SetNull)

Add `@@index([tenantId])` to each of the five models' index block. Do NOT touch any other model in this
slice — the remaining tenant-aware tables (estimates/quotes, contracts/claims, procurement, compliance,
scheduling, assets, forms, dockets, etc. — see the classification list in `docs/plans/multi-tenant-plan.md`)
need follow-on table-group slices (MT-0b, MT-0c, ...) after this one lands; state that explicitly in the
PR body so the pipeline knows more tranches are coming.

### 3. Migration
Create `apps/api/prisma/migrations/<timestamp>_feat_tenant_model_columns/migration.sql`. It must ONLY:
`CREATE TABLE tenants (...)`, then `ALTER TABLE clients/workers/contacts/tenders/jobs ADD COLUMN
tenant_id TEXT NULL REFERENCES tenants(id) ON DELETE SET NULL`, plus the five indexes. No backfill, no
`NOT NULL`, no drops. Existing rows keep `tenant_id = NULL` after this migration — backfill is a
separate, later, Marco-run slice (MT-3), not this one.

### 4. Seed the first tenant (registry row only — do NOT backfill existing rows)
In `apps/api/prisma/seed.ts`, idempotently upsert one `Tenant` row representing the existing company
(e.g. `id: "tenant-initial-services"`, `name` sourced from the seeded `CompanyProfile.tradingName` if
available, else a literal fallback string, `code: "IS"`). This is so later slices have a real tenant id
to reference. Do NOT set `tenantId` on any `Client`/`Worker`/`Contact`/`Tender`/`Job` row in the seed or
anywhere else — every existing and newly-seeded row stays `tenantId = NULL` after this PR.

### 5. `apps/api/src/common/tenancy/tenant.constants.ts` (new file)
Export the constants later slices will import instead of re-deriving this list:

    export const SEEDED_DEFAULT_TENANT_ID = "tenant-initial-services";
    export const PILOT_TENANT_AWARE_MODELS = ["Client", "Worker", "Contact", "Tender", "Job"] as const;
    export const PILOT_MIXED_TENANT_MODELS = ["Client", "Worker", "Contact"] as const;
    export const PILOT_COMPANY_OWNED_TENANT_MODELS = ["Tender", "Job"] as const;

### 6. Regenerate the data-model map
Run `node scripts/data-model/build-relationship-map.mjs`. Commit the regenerated
`docs/data-model/relationship-map.json`, `docs/data-model/relationship-map.md`, and
`docs/data-model/metadata-catalog.json`.

### 7. PR body
- Bare line at column 0: `GATE-ALLOW: migrations`
- State plainly: "Tranche 1 of N — pilot 5 tables only. Remaining tenant-aware tables need follow-on
  table-group slices before MT-4 classification can be complete."
- Note this is part of the locked multi-tenant plan (`docs/plans/multi-tenant-plan.md`), phase MT-0.

## Do NOT
- Do NOT write any scoping/filtering logic, middleware, or Prisma extension — that is MT-1.
- Do NOT touch JWT, sessions, or login — that is MT-2.
- Do NOT set `tenantId` on any existing row — that is MT-3, and it is Marco-run production data work.
- Do NOT add tenantId to any model outside the five named above.
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
- Regenerate the data-model map (step 6) or the drift check fails; put `GATE-ALLOW: migrations` bare
  at column 0 of the PR body (step 7) or CP-11 fails.
- `pnpm build` and `pnpm lint` must pass. Migration must be additive-only and idempotent to re-apply on
  a fresh DB.
