# SLICE-0 plan — Multi-company / multi-tenant (MT-4 / MT-5)

**Status:** PLAN ONLY. Rewritten 2026-08-18 to record **D48**, which supersedes the mechanism half
of the 2026-08-04 lock. Model A (row-level `tenantId`) is UNCHANGED and still locked. What changes
is what a blank value means: sharing is now an **explicit grant**, not the absence of an owner.

Design source: `docs/architecture/drafts/tenant-readiness-analysis.md`. Original decision log entry
that this plan supersedes: `sot/02-roadmap-and-status.md` (blank-means-shared wording — flagged for
a separate doc-reconcile PR; see "Doc-reconcile" below).

## Decisions this plan encodes

| # | Decision | Source |
|---|---|---|
| D25 | Every data domain **can** be shared. **Nothing is shared by default.** An **Import** option also exists (see D50). | Run 4 |
| D48 | **Explicit owner + explicit share grants.** A blank `tenantId` is not a valid state. Supersedes the 2026-08-04 wording in which a blank column meant "shared with everyone". | Marco 2026-08-17 |
| D49 | **Master data and reference data only.** Transactions stay company-owned, full stop. The 2026-08-04 classification of tenders, estimates, quotes, jobs, contracts and progress claims is UNCHANGED and must not be re-opened. | Marco |
| D50 | **Import copies a record into another company. The copy is fully independent from the moment it lands** — no link back, no sync, diverges freely. Import is NOT sharing. | Marco |
| D51 | **Only a super admin / system owner may grant a share or run an Import.** Not a per-record control for ordinary users. | Marco |

### D48 in one table — what changed on 2026-08-17

| | 2026-08-04 (superseded) | D48 (2026-08-17, in force) |
|---|---|---|
| Blank `tenantId` | shared with every company | **not a valid state — every record has an owner** |
| Sharing | implicit, by leaving the column blank | **an explicit grant recorded in a share list** |
| Default | shared | **not shared** |
| Filter | `tenantId IS NULL OR tenantId = current` | `tenantId = current OR an explicit share grant exists` |

Marco's reason for the reversal: overloading a blank value to mean "everyone" makes "shared" the
default (the opposite of what he wants) and does not extend cleanly to a third company. An explicit
owner plus an explicit share list is true to D25 and scales.

## Grounding (verified against `origin/main` @ `4ea453fc`, 2026-08-18)

- **MT-0 through MT-3 have shipped.** `model Tenant` at `apps/api/prisma/schema.prisma:23`; the
  tenancy module at `apps/api/src/common/tenancy/`; `TenantContextInterceptor` wired at
  `apps/api/src/app.module.ts:100`.
- **Only six models carry `tenantId` today** (out of 282 in the schema): `Client`, `Contact`,
  `Job`, `Tender`, `Worker`, `XeroConnection`.
- **Tenders and jobs are already owned and required.** Migration
  `apps/api/prisma/migrations/20260814110000_backfill_enforce_tenant_ids/` stamped them to
  `tenant-initial-services-001` and made the column required. **D49 means this stays as it is.**
- **Clients, workers and contacts are the whole problem.** That same migration deliberately left
  them blank as "shared master data". Every row is blank today. Under the current filter a second
  company would see every client, worker and contact the moment it existed — that is what D48 is
  fixing.
- **Suppliers, rates & lists, and permission roles have no `tenantId` at all.** They are greenfield
  — their default is a free choice with no legacy data to reinterpret.
- **The company admin screen already exists and is already restricted to super users.**
  `apps/web/src/pages/admin/AdminCompaniesPage.tsx`, routed at `/settings/companies` with
  `superUserOnly: true` at `apps/web/src/components/SettingsShell.tsx:125`. **D51's controls
  belong there**, not on each individual record.
- **The scoping middleware is `apps/api/src/common/tenancy/tenant-scoping.middleware.ts`.** It
  applies to `findMany / findFirst / findUnique / count / update / delete` and their variants.
  `create` and `createMany` are deliberately excluded — write-stamping was deferred. Under D48 a
  record created with no owner is an **invalid record**, so SLICE 3 must extend the middleware to
  stamp writes at the same time it flips the read filter.

## Slice breakdown

Each slice is `size: <= 10 files including tests`, carries `escalates: true`, is labelled
`do-not-merge` on the resulting PR, and declares `requires_merged` on the slice immediately before
it. Slices are chained; no slice arms until its predecessor is merged to `main`.

### SLICE 1 — The share list (schema, additive only) — est. 6–8 files

**Scope.** Typed join tables per shareable domain (`ClientShare`, `WorkerShare`, `ContactShare`,
and — for a later expansion path — `SupplierShare`, `RateShare`, `PermissionRoleShare`). One table
per domain, not one polymorphic `Share` table, so the foreign keys are real and cascade behaviour
is per-domain.

Each row records: the shared record's id, the grantee `tenantId`, `grantedByUserId`, `grantedAt`,
and optional `note`. Unique index on `(recordId, granteeTenantId)`.

**Behaviour change:** none. Purely additive; no query reads the tables yet.

**Files (est.):** `schema.prisma` (models + relations), one Prisma migration folder, tenancy module
DTOs for the new types, an `apps/api/data-model/*.json` regeneration, one contract test asserting
the tables exist and are empty.

**Front-matter:** `size: 1`, `escalates: true`, `gate_allow: none`, `seed_only: false`.

### SLICE 2 — Ownership migration (PRODUCTION DATA — Marco runs this) — est. 3 files

**Scope.** Stamp every existing `Client`, `Worker` and `Contact` row with
`tenant-initial-services-001`, then make the `tenantId` column **required** on all three tables.
Follows the `20260814110000_backfill_enforce_tenant_ids` precedent already in the repo — same
guard style, same idempotent `WHERE tenantId IS NULL` clauses, same rollback notes at the top of
the SQL.

**Pre-flight (mandatory, in the migration file's header comment as a runbook):**

1. Export the current state of the three tables to CSV before running the migration. The migration
   itself must not run until the export is in hand.
2. Verify tenant `tenant-initial-services-001` exists.
3. Dry-run the update count in a transaction and abort if it exceeds the expected row count from
   step 1 by more than 0 rows.

**Files (est.):** one Prisma migration folder (`migration.sql` + `meta`), a `schema.prisma` diff
making the three columns required, an `apps/api/data-model/*.json` regeneration.

**Front-matter:** `size: 1`, `escalates: true`, **`-HOLD` (Marco must arm this manually)**,
`gate_allow: none`, `seed_only: false`, `requires_merged: <SLICE 1 PR number>`.

### SLICE 3 — Flip the filter (fail-closed, both directions tested) — est. 8–10 files

**Scope.** Change `apps/api/src/common/tenancy/tenant-scoping.middleware.ts` from
`tenantId IS NULL OR tenantId = current` to `tenantId = current OR EXISTS <share grant>`. Extend
the middleware to cover `create` and `createMany`, stamping `tenantId = currentTenant` when the
caller omits it and rejecting the write when no tenant context is set (fail-closed).

**Tests are mandatory and bidirectional.** A data leak here is the whole feature failing:

- Company A cannot read Company B's owned rows (existing test, must still pass).
- Company A **cannot read Company B's owned rows even when the row is blank-`tenantId` (should not
  exist, but assert the middleware treats a stray blank as "not visible" rather than "visible to
  all")** — belt-and-braces against a migration rollback.
- Company A can read a Company B row **iff** an explicit share grant exists for company A.
- A `create` without tenant context fails closed rather than writing a `null` owner.

**Files (est.):** the middleware, its unit tests, one integration test per shareable domain
(client, worker, contact), the write-stamp guard, one contract test for the create/createMany
paths.

**Front-matter — hard, non-negotiable, and machine-enforced (see the block below):**

```
size: 1
escalates: true
gate_allow: none
seed_only: false
requires_merged: <SLICE 2 PR number>
requires_file_on_main: apps/api/prisma/migrations/<SLICE 2 migration folder>/migration.sql
```

Plus a premise that queries the **real database state**, not the file system, and returns FALSE
while any blank owner still exists — see next section.

#### SLICE 3 ordering gates (per Marco, 2026-08-18) — MUST be four independent gates

Marco's instruction, verbatim: *"ensure the gates are tight so slice 3 never lands before slice 2
fully on main."* Prose in a plan does not stop a watcher. SLICE 3's prompt MUST carry all four of
the following, and a SLICE 3 prompt lacking any of them **must be rejected at lint time rather
than armed**:

1. **`requires_merged: <SLICE 2 PR number>`.** SLICE 3 does not arm until SLICE 2's PR has actually
   merged. Not "is open", not "is approved". Merged.
2. **`requires_file_on_main: apps/api/prisma/migrations/<SLICE 2 migration folder>/migration.sql`.**
   A second, independent proof that the migration itself is on `main`. `requires_merged` alone
   trusts a PR number; this checks the artifact. Two different instruments, deliberately.
3. **A premise that is FALSE while any owner is still blank.** SLICE 3's premise queries the
   database, not a file:

   ```sql
   SELECT
     (SELECT COUNT(*) FROM "Client"  WHERE "tenantId" IS NULL) +
     (SELECT COUNT(*) FROM "Worker"  WHERE "tenantId" IS NULL) +
     (SELECT COUNT(*) FROM "Contact" WHERE "tenantId" IS NULL)
   = 0;
   ```

   While that returns `false`, SLICE 3 must not run. When SLICE 2 has done its job the premise
   flips true and SLICE 3 becomes eligible.
4. **SLICE 3's first step is a re-verification that aborts.** Before changing one line of the
   scoping filter, SLICE 3 must re-run the count above **inside the prompt itself** and **exit
   NO-OP if the count is anything but zero.** Belt, braces, and a third check at the moment of
   action — because SLICE 2 is `-HOLD` and run by Marco by hand, so there is a real window in
   which the queue believes it has landed and the data says otherwise.

**Why four overlapping gates for one ordering rule.** If the filter flips to owner-or-grant while
rows still carry a blank owner, **every client, worker and contact disappears from the app for
everyone, including Initial Services** — not a degraded view, an invisibility of the only company
that owns them. That is a production outage of the core master data, caused by two PRs merging in
the wrong order. The cost of an extra gate is a few lines of front-matter; the cost of the wrong
order is the app.

### SLICE 4 — Share-management UI on `/settings/companies` (super-user only) — est. 6–8 files

**Scope.** Add a "Sharing" tab (or panel) to the existing `AdminCompaniesPage` at
`apps/web/src/pages/admin/AdminCompaniesPage.tsx`. Route already gated `superUserOnly: true` at
`SettingsShell.tsx:125` — reuse, do not add a new route. Per D51, sharing is NOT a per-record
control for ordinary users, so no share buttons appear on client / worker / contact detail pages.

The UI lists existing grants per shareable domain, lets a super user add or revoke a grant,
records `grantedByUserId` from the current session, and calls new API endpoints on the tenancy
module.

**Files (est.):** the sharing panel component, its tests, a small share-management service on the
API side, controller endpoints, permission guards asserting super-user only, one e2e test.

**Front-matter:** `size: 1`, `escalates: true`, `requires_merged: <SLICE 3 PR number>`.

### SLICE 5 — Import (copy a master-data record into another company) — est. 8–10 files

**Scope.** Per D50, Import copies a record into another company as an **independent** row — no
link back, no sync, diverges from the source the moment it lands. Import is NOT sharing.

The plan must state explicitly, before code is written:

- **What is copied:** the row's own fields, minus its `id` (new id generated) and minus its
  `tenantId` (set to the destination). Related child records are copied per an allow-list
  per-domain (e.g. a `Client` copy takes its `Contact`s and addresses; a `Worker` copy takes its
  certifications; the allow-list per domain is defined in this slice's spec, not left to interpretation).
- **What is deliberately not copied:** transactional history (jobs, tenders, quotes, contracts,
  progress claims, allocations) never copies — D49 makes those company-owned, and D50 makes the
  copy independent. Audit trail on the source is not copied; a fresh audit entry is written on the
  destination stating "imported from tenant X record Y by user Z at time T".
- **Duplicate detection:** before copying, run a match query on the destination tenant (per-domain
  key: `Client` by normalised name + ABN; `Worker` by normalised name + phone; `Contact` by email
  first, then normalised name + phone). If a match is found, **the import returns a "possible
  duplicate" response listing the candidates and does NOT create the copy** — the super user must
  either confirm-with-force or pick an existing record to merge notes into. Silent duplicate
  creation is a bug.
- **Access control (D51):** import is a super-user-only action, invoked from the same
  `/settings/companies` surface as sharing.

**Files (est.):** import service per domain (client / worker / contact), controller endpoint,
duplicate-detection helper, tests (happy path, duplicate detected, D49-blocked transactional
domain), UI action on `AdminCompaniesPage`, one e2e.

**Front-matter:** `size: 1`, `escalates: true`, `requires_merged: <SLICE 4 PR number>`.

## Doc-reconcile — separate PR, do NOT fold into a code slice

`sot/02-roadmap-and-status.md:181` records the superseded wording verbatim:

> "Multi-tenant model to A, row-level tenantId (nullable; blank means shared master data, set means company-owned transactions)"
>
> (Paraphrased above so this plan does not itself contain the superseded phrasing. The literal
> wording still on `main` uses `null` where this quote uses `blank`; the SoT keeper's diff will
> read against the literal line.)

D48 makes that line wrong. **CP-24 hard-fails any PR mixing code and `sot/`**, so this correction
must ship as its own doc-reconcile PR authored by the SoT keeper (Station 05). It must:

- Strike the "blank means shared master data" phrasing.
- Record D48 in the decision log with its 2026-08-17 date and its supersession note against the
  2026-08-04 lock.
- Not touch any code path.

Name this reconcile as a prerequisite of SLICE 1 in the queue, but keep it a separate PR.

## Risks (unchanged from the original plan, plus one new)

- **Data-leak = the whole point failing.** SLICE 3's bidirectional tests are non-negotiable; ship
  nothing company-facing until green.
- Every existing query must go through the scoped path — a missed raw query is a leak. Grep for
  `$queryRaw` and `$executeRaw` on tenant-aware tables during SLICE 3.
- Sequence unchanged: MT slices run only with Marco present, one phase at a time.
- **New (D48):** the SLICE 2 → SLICE 3 ordering is the single most dangerous window in this plan.
  See the four-gate block under SLICE 3 — it exists precisely because the wrong order takes the
  app down for everyone.

## What this plan-slice deliberately does NOT do

- Does NOT write schema, middleware, UI, migration or test code. Plan only.
- Does NOT edit anything under `/sot/` — see the doc-reconcile note above.
- Does NOT re-open the transaction classification (D49) or Model A itself.
- Does NOT weaken the ordering constraint between SLICE 2 and SLICE 3.

## Start

Arm the doc-reconcile first (Station 05, separate PR). Then arm **SLICE 1** (the share list).
Nothing else moves until SLICE 1 is merged.
