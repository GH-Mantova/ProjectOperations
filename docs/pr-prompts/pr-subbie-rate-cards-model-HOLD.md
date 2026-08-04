---
premise: '! grep -q "model SubcontractorRate" apps/api/prisma/schema.prisma'
premise_means: The SubcontractorRate model does not exist on main yet — subcontractors have no per-subbie rate-card concept; only the estimate-side RateTable/legacy rate tables exist.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/subcontractor-rates/**
  - apps/api/src/common/permissions/permission-registry.ts
  - apps/api/src/app.module.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model SubcontractorRate" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/subcontractor-rates/subcontractor-rates.service.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Purely additive: one new table (subcontractor_rates), one new FK to subcontractor_suppliers, no columns added to any existing table, no data migrated or backfilled. To revert before dependent code (RC-2 UI) lands: drop the subcontractor_rates table and delete the migration directory, then re-run prisma migrate. Zero blast radius on the in-flight estimate-rate migration (RateResolverService / RateTable / legacy Estimate*Rate tables) — this slice never reads or writes any of those.'
---

# RC-1: SubcontractorRate model + CRUD module + permissions

**Binding plan:** `docs/plans/subcontractor-rate-cards-slice-plan.md` on main (read it in full before
starting). Grounded state on main today: subcontractors are the `SubcontractorSupplier` model
(`apps/api/prisma/schema.prisma`, domain "Directory"; service `apps/api/src/modules/directory/directory.service.ts`
reads it via `prisma.subcontractorSupplier`), with a `SubcontractorsPage` in the directory UI. Rates
today are entirely on the **estimate** side — legacy per-domain tables (`EstimateLabourRate`,
`EstimatePlantRate`, etc.) plus the newer `RateTable`, resolved through
`RateResolverService` (`apps/api/src/modules/rates/rate-resolver.service.ts`), which is **mid-migration
and must not be touched by this work**. No per-subcontractor rate concept exists anywhere on main.

This slice adds an **additive, isolated** `SubcontractorRate` model — a subbie's own agreed $/unit
rates — as a completely separate axis from the estimate-rate spine. It does not read from, write to,
or route through `RateResolverService` in any way.

## What to build

### 1. Schema — `apps/api/prisma/schema.prisma`
Add `model SubcontractorRate` (place it near `SubcontractorSupplier` in the Directory domain section):
- `id String @id @default(cuid())`
- `subcontractorSupplierId String @map("subcontractor_supplier_id")` + relation to
  `SubcontractorSupplier` (`onDelete: Cascade`) — add the reciprocal `subcontractorRates
  SubcontractorRate[]` field on `SubcontractorSupplier`.
- A rate-kind/scope-code discriminator field aligned to the **canonical 4-scope-code system**
  (`DEM` / `CIV` / `ASB` / `Other`, source of truth `apps/api/src/modules/personas/definitions/disciplines.ts`,
  documented in `sot/01-charter-and-architecture.md` SECTION 10). Use a `String` column (not a Prisma
  enum) validated at the DTO layer against `IS_DISCIPLINE_CODES` imported from that file — mirror how
  other modules that consume discipline codes import from it rather than inlining literals.
- `unit String` — e.g. "hr", "day", "m2", "tonne" (free text, same convention as existing rate rows).
- `rate Decimal` (use the same `@db.Decimal` precision convention other money/rate columns in the
  schema use — check an existing `Decimal` rate column, e.g. on `RateRow` or an `Estimate*Rate` table,
  and match it).
- `validFrom DateTime? @db.Date`, `validTo DateTime? @db.Date` (both optional).
- `notes String?`
- `isActive Boolean @default(true)`
- `createdAt`/`updatedAt` timestamps + `createdById`/`updatedById` following the existing
  created-by/updated-by convention used elsewhere in the schema (see how `SubcontractorSupplier` or
  `JobRole` do it) — relation to `User`.
- `@@map("subcontractor_rates")`, appropriate `@@index` on `subcontractorSupplierId` (and on the
  discriminator + `isActive` if that matches existing indexing conventions for similar lookup tables).

**Append-only supersede rule (sot/01, Marco 2026-07-23):** do NOT build any "edit rate value in place"
path in the service. "Editing" a rate is: create a new `SubcontractorRate` row and set the
superseded row's `isActive = false` (and optionally close its `validTo`) in the same transaction.
Never mutate `rate`, `unit`, or the discriminator on an existing row after creation. Document this
rule at the top of the service file.

### 2. Migration
Create the migration under `apps/api/prisma/migrations/` (timestamp-prefixed directory, e.g.
`<timestamp>_feat_subcontractor_rate`, matching the naming convention of existing migrations such as
`apps/api/prisma/migrations/20260630120000_feat_schedule_allocation/`). Put a bare `GATE-ALLOW: migrations`
line at column 0 of the migration SQL file's leading comment (mirror
`20260630120000_feat_schedule_allocation/migration.sql`'s header) AND at column 0 of the PR body.

### 3. Data-model regeneration (MANDATORY — schema.prisma changed)
Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
`docs/data-model/relationship-map.json`, `docs/data-model/relationship-map.md`, and
`docs/data-model/metadata-catalog.json`. Add `docs/data-model/**` to scope (already listed above).

### 4. CRUD module — `apps/api/src/modules/subcontractor-rates/`
Mirror the shape of `apps/api/src/modules/job-roles/` (controller + service + module + `dto/`
subfolder — read those four files on main first, they are the template):
- `subcontractor-rates.module.ts` — registers controller + service, exports the service.
- `subcontractor-rates.controller.ts` — `@Controller("subcontractors/:subcontractorSupplierId/rates")`
  (or a flat `@Controller("subcontractor-rates")` with the FK in the DTO — pick whichever matches the
  house convention better once you've read a comparable nested-resource controller; be consistent).
  Guard with `JwtAuthGuard` + `PermissionsGuard`. Endpoints: list (view), get one (view), create
  (manage), supersede/deactivate (manage) — no raw update-in-place endpoint per the append-only rule
  above. Register the module in `apps/api/src/app.module.ts` alongside the other feature modules.
- `subcontractor-rates.service.ts` — Prisma-backed CRUD honouring the append-only supersede rule.
  Validate the discriminator against `IS_DISCIPLINE_CODES`.
- `dto/create-subcontractor-rate.dto.ts`, `dto/supersede-subcontractor-rate.dto.ts` (class-validator
  DTOs, same style as `job-roles/dto/`).

### 5. Permissions
Add two new permission entries to `apps/api/src/common/permissions/permission-registry.ts`:
- `{ code: "subcontractors.rates.view", module: "directory", label: "View subcontractor rate cards", description: "View a subcontractor's own agreed rates" }`
- `{ code: "subcontractors.rates.manage", module: "directory", label: "Manage subcontractor rate cards", description: "Create and supersede a subcontractor's own agreed rates" }`
Guard the controller's read endpoints with `.view` and write endpoints with `.manage`
(`@RequirePermissions(...)`, same decorator every other controller in this codebase uses). **Seed
nothing** — do not add a role→permission seed assignment; who gets these permissions is Marco's call
(same convention other recent permission-registry additions in this codebase follow).

### 6. Tests
Unit tests for the service (mirror `apps/api/src/modules/job-roles/__tests__/`): create, list, get,
supersede (asserting the old row's `isActive` flips to `false` and a new row is created — never
mutated in place), and rejection of an unknown discriminator code.

## Do NOT
- Do NOT touch `RateResolverService`, `RateTable`, `RateColumn`, `RateRow`, or any `Estimate*Rate`
  table/model — that resolver is mid-migration and out of scope for this work entirely.
- Do NOT build any UI — that is RC-2 (next slice). This is API-only.
- Do NOT build the "price a scope line from a subbie's rate" action — that is RC-3, explicitly gated
  behind the subcontractor-assignment decision and NOT part of this slice.
- Do NOT seed any `SubcontractorRate` rows or role→permission assignments.
- Do NOT invent a parallel scope-code taxonomy — import `IS_DISCIPLINE_CODES` from
  `apps/api/src/modules/personas/definitions/disciplines.ts`, never inline discipline literals.
- Do NOT touch Azure/Entra/SharePoint.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if `SubcontractorRate` already exists on main, say
  `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must pass. Regenerate the data-model map in the SAME PR — do not skip it
  because `schema.prisma` changed.
