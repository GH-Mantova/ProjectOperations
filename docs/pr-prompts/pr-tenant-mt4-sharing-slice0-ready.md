---
premise: grep -q "null = shared" docs/plans/multi-tenant-plan.md
premise_means: The multi-tenant plan still records the 2026-08-04 mechanism in which a blank tenantId means "shared with every company". Marco superseded that on 2026-08-17 (D48) - ownership is now explicit and sharing is an explicit grant - and the plan has not been rewritten to say so.
scope:
  - docs/plans/multi-tenant-plan.md
done_when: ! grep -q "null = shared" docs/plans/multi-tenant-plan.md && grep -q "D48" docs/plans/multi-tenant-plan.md && grep -q "SLICE 5" docs/plans/multi-tenant-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: true
---

# Multi-company sharing (MT-4/MT-5) - SLICE 0: rewrite the plan for explicit sharing

Brief **§2.1**. This slice rewrites `docs/plans/multi-tenant-plan.md` and NOTHING else. No schema,
no middleware, no UI, no migration. The plan is the first PR; the slices chain behind it.

## The decision this slice records

**D48 (Marco, 2026-08-17) SUPERSEDES the mechanism half of the 2026-08-04 decision.**

Model A (row-level `tenantId`) is UNCHANGED and still locked. What changes is what a blank value
means:

| | 2026-08-04 (superseded) | D48 (2026-08-17) |
|---|---|---|
| Blank `tenantId` | shared with every company | **not a valid state - every record has an owner** |
| Sharing | implicit, by leaving the column blank | **an explicit grant recorded in a share list** |
| Default | shared | **not shared** |
| Filter | `tenantId IS NULL OR tenantId = current` | `tenantId = current OR an explicit share grant exists` |

Marco's reason: overloading a blank value to mean "everyone" makes "shared" the default, which is
the opposite of what he wants, and it does not extend to a third company. An explicit owner plus an
explicit share list is true to D25 and scales.

## Decisions from the run 4 interview the plan must encode

| # | Decision |
|---|---|
| D25 | Every data domain **can** be shared, **nothing by default**, plus an **Import** option. |
| D48 | Explicit owner + explicit share grants. A blank owner is not a valid state. |
| D49 | **Master data and reference data only.** Transactions stay company-owned, full stop - the 2026-08-04 classification of tenders, estimates, quotes, jobs, contracts and progress claims is UNCHANGED and must not be re-opened. |
| D50 | **Import copies a record into another company. The copy is fully independent from the moment it lands** - no link back, no sync, diverges freely. Import is NOT sharing. |
| D51 | **Only a super admin / system owner may grant a share or run an Import.** Not a per-record control for ordinary users. |

## Grounding the plan must build on (verified against origin/main @ 2d293b81)

- **MT-0 through MT-3 have shipped.** `model Tenant` (`schema.prisma:23`), the tenancy module
  (`apps/api/src/common/tenancy/`), and `TenantContextInterceptor` wired at `app.module.ts:100`.
- **Only six models carry `tenantId` today** out of 282: `Client`, `Contact`, `Job`, `Tender`,
  `Worker`, `XeroConnection`.
- **Tenders and jobs are already owned and required.** Migration
  `20260814110000_backfill_enforce_tenant_ids` stamped them to `tenant-initial-services-001` and
  made the column required. **D49 means this stays exactly as it is.**
- **Clients, workers and contacts are the whole problem.** That same migration deliberately left
  them blank as "shared master data". Every row is blank today, so under the current filter a second
  company would see every client, worker and contact the moment it existed.
- **Suppliers, rates & lists and permission roles have no company column at all.** They are
  greenfield - their default is a free choice with no legacy data to reinterpret.
- **The company admin screen already exists and is already restricted.**
  `apps/web/src/pages/admin/AdminCompaniesPage.tsx`, routed at `/settings/companies` with
  `superUserOnly: true` (`SettingsShell.tsx:121`). D51's controls belong THERE, not on each record.
- **The scoping middleware is `apps/api/src/common/tenancy/tenant-scoping.middleware.ts`**, applying
  to `findMany / findFirst / findUnique / count / update / delete` and their variants. `create` and
  `createMany` are deliberately excluded - write-stamping was deferred. The plan must say whether
  D48 changes that, because a record created with no owner is now an invalid record.

## The slice breakdown the plan must specify

**SLICE 1 - the share list (schema, additive only).** Typed join tables per shareable domain rather
than one polymorphic table, so the foreign keys are real. Record who granted the share and when.
Additive; nothing existing changes behaviour.

**SLICE 2 - ownership migration. PRODUCTION DATA. Marco runs this.** Stamp every existing client,
worker and contact with the Initial Services tenant, then make the column required. Follow the
`20260814110000_backfill_enforce_tenant_ids` precedent already in the repo - same guard style, same
idempotent `WHERE` clauses, same rollback notes in the header. **This slice must be `-HOLD` until
Marco arms it, and it must export the affected rows before it changes anything.**

**SLICE 3 - flip the filter.** Change the scoping rule to owner-or-explicit-grant, fail-closed.
Cross-tenant tests in BOTH directions are mandatory - a data leak here is the whole feature failing.
**SLICE 3 must not land before SLICE 2**: if the filter stops treating blank as shared while rows
are still blank, every client, worker and contact disappears from the app for everyone, including
Initial Services. State that ordering constraint in the plan as a hard dependency.

**SLICE 4 - share management UI** on the existing `/settings/companies` screen, super-user only.

**SLICE 5 - Import.** Copy a master-data record into another company as an independent row per D50.
Must state explicitly what is copied, what is deliberately not copied, and how a duplicate is
detected and reported rather than silently created twice.

Each slice must be <= 10 files including tests, must carry `escalates: true`, and must declare
`requires_merged` on the slice before it.

## The separate doc-reconcile this plan must name

`sot/02-roadmap-and-status.md:181` records the superseded wording verbatim: *"Multi-tenant model to
A, row-level tenantId (nullable; null = shared master data, set = company-owned transactions)"*.
D48 makes that line wrong. **CP-24 hard-fails any PR mixing code and `sot/`**, so the plan must name
this as its own doc-reconcile PR and must NOT fold it into any code slice.

## What this slice must NOT do

- Do NOT write schema, middleware, UI, migration or test code. Plan only.
- Do NOT edit anything under `/sot/` - see the reconcile note above.
- Do NOT re-open the transaction classification (D49) or model A itself.
- Do NOT weaken the ordering constraint between SLICE 2 and SLICE 3.

## Verification

`docs/plans/multi-tenant-plan.md` no longer contains the superseded blank-means-shared wording,
records D48 with its supersession note, and names SLICE 1 through SLICE 5 with per-slice scope and
file-count estimates.

## Escalation

`escalates: true`. This plan sets the direction for a production-data migration over live client,
worker and contact records, and reverses a previously locked decision. Label the resulting PR
`do-not-merge` for Marco.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
