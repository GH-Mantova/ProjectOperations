---
premise: 'sed -n "/^model Client {/,/^}/p" apps/api/prisma/schema.prisma | grep -qE "tenantId\s+String\?"'
premise_means: Client, Worker and Contact still have an OPTIONAL tenantId, so master-data rows can exist with no owner. Under D48 a blank owner is not a valid state.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/common/tenancy/__tests__/ownership-backfill.spec.ts
done_when: pnpm build && pnpm lint && ! sed -n "/^model Client {/,/^}/p" apps/api/prisma/schema.prisma | grep -qE "tenantId\s+String\?"
size: 4
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: PRODUCTION DATA. The UPDATE is idempotent (WHERE tenant_id IS NULL) and re-runnable. The NOT NULL constraint is the irreversible half - to revert, drop the three NOT NULL constraints, which restores the previous shape but NOT the knowledge of which rows were originally blank. That knowledge lives only in the CSV export taken in pre-flight step 1, which is why the export is mandatory BEFORE the migration runs. If the run aborts mid-flight the constraint is simply not applied and the migration can be re-run after investigating.
cluster: tenant-mt4
cluster_order: 2
requires_on_main: apps/api/prisma/schema.prisma :: model ClientShare
---

# Multi-company SLICE 2 — ownership migration ⚠️ PRODUCTION DATA ⚠️

Binding plan: **`docs/plans/multi-tenant-plan.md` § Slice breakdown, SLICE 2.** Decision **D48**.

## 🛑 HELD — Marco arms this by hand. Do not arm it from any station, sweep, or automation.

This slice writes to **live client, worker and contact rows** and then makes the column
irreversible-in-practice. It is `-HOLD` deliberately. Its gate opening does **not** mean "arm it" —
it means the schema prerequisite is on `main`.

Marco arms it, Marco takes the backup, Marco merges the resulting PR.

## Grounding — verified on origin/main

- `Client`, `Worker`, `Contact` each carry `tenantId String?` — optional today.
- Precedent to follow exactly: `apps/api/prisma/migrations/20260814110000_backfill_enforce_tenant_ids`
  — the migration that did this same job for tenders and jobs. Same guard style, same idempotent
  `WHERE ... IS NULL` clauses, same rollback notes at the top of the SQL.
- That earlier migration **deliberately left these three blank**, treating them as "shared master
  data". D48 reverses that decision. This slice is what makes the reversal true in the data.

## What to build

1. **Stamp** every existing `Client`, `Worker` and `Contact` row whose `tenant_id` is null with
   `tenant-initial-services-001`.
2. **Then** make `tenantId` required on all three models.
3. Regenerate the data-model map and commit it.
4. A **backfill-correctness test** (`ownership-backfill.spec.ts`) that seeds a legacy row with a
   null owner, runs the transform, and asserts the produced value is the expected tenant and that
   the row is readable afterwards. This is required by the intake linter's Gate A and it is the
   layer that catches a bad transform before it reaches data.

## Pre-flight runbook — put this in the migration file's header comment, verbatim

1. **Export the current state of all three tables to CSV before running.** The migration must not
   run until the export is in hand. The export is the only record of which rows were originally
   blank, and the `NOT NULL` constraint destroys that distinction permanently.
2. **Verify tenant `tenant-initial-services-001` exists.** Stamping rows with a tenant id that does
   not exist fails the FK and leaves the migration half-applied.
3. **Dry-run the update count inside a transaction** and abort if it exceeds the expected row count
   from step 1 by even one row. A larger count means the data changed under you between export and
   run.

## Do NOT

- Do NOT touch `tenant-scoping.middleware.ts` or any query filter. That is SLICE 3, and it must not
  land before this one — see the plan's four-gate section.
- Do NOT stamp any model other than `Client`, `Worker`, `Contact`. Tenders and jobs were already
  done by `20260814110000`; transactional domains stay as they are per D49.
- Do NOT use a default value on the column as a shortcut for the backfill. A default silently
  invents ownership for future rows and hides a missing write-stamp; SLICE 3 adds the write-stamp
  properly.
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

Opening the PR is safe. **Merging it is the act that touches production data, and that is Marco's.**

## For the PR body

- **`GATE-ALLOW: migrations`** as a bare line at column 0.
- State the **exact migration folder name** you created. SLICE 3's mandated gates reference it by
  path and cannot be written until this name exists.
- Restate the three pre-flight steps so whoever merges sees them without opening the SQL.

## The completion test

Is there a PR number in your output? If no because the work was already on `main`, say
`NO-OP: <reason>`. If no because you are waiting for someone — there is nobody. Open the PR.
