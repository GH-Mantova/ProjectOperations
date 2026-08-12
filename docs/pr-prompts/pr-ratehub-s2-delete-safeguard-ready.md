---
premise: '! test -f apps/api/src/modules/rates/rate-archive.service.ts'
premise_means: There is no RateArchiveService yet — hub rates / vendors / type items can still be hard-deleted without an in-use guard.
scope:
  - apps/api/src/modules/rates/rate-archive.service.ts
  - apps/api/src/modules/rates/rate-archive.controller.ts
  - apps/api/src/modules/rates/__tests__/rate-archive.service.spec.ts
  - apps/api/src/modules/rates/rates.module.ts
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - apps/web/src/components/rates/ArchiveDeleteButtons.tsx
requires_file_on_main: apps/api/src/modules/rates/rate-hub-vendors.service.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/rates/rate-archive.service.ts && grep -q "assertNotInUse" apps/api/src/modules/rates/rate-archive.service.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# RATE-HUB S2 — archive-first + in-use guard + super-user hard-delete

Reuse the clients / contracts archive pattern so a hub rate, a vendor, or a type
item can be soft-archived by any hub admin but only **hard-deleted by a super-user
when nothing live references it.** Full plan:
`docs/plans/rate-hub-sor-integration-plan.md`.

## Ground first (cite before editing)
- `apps/api/src/common/auth/super-user.guard.ts:4` — reuse for hard delete.
- `apps/api/src/modules/tender-clients/tender-packages.service.ts:22`, `:186` — `isArchived` gate pattern.
- `apps/api/prisma/schema.prisma:5421`, `:5464` — `RateTable`, `RateRow` (already has `isActive`).
- `apps/api/prisma/schema.prisma:4278`, `:4353` — `SubcontractorSupplier` (`isActive`), `SubcontractorRate` (`isActive`).
- `apps/api/prisma/schema.prisma:3585` — `GlobalListItem.isArchived`.
- `apps/api/prisma/schema.prisma:5486`, `:7042`, `:7059` — `TenderRateSet` / `SorClientRateCard` / `SorClientRateEntry` (things to check for "in-use").

## What to build
1. `RateArchiveService` at `apps/api/src/modules/rates/rate-archive.service.ts`:
   - `archive(kind, id)` → flips `isActive`/`isArchived` false on `RateTable`,
     `RateRow`, `SubcontractorSupplier`, `SubcontractorRate`, or `GlobalListItem`
     (`kind` discriminates). Reversible via `unarchive(kind, id)`.
   - `assertNotInUse(kind, id)` → throws `ConflictException` with the list of
     blocking references when the entity is referenced by an ACTIVE `TenderRateSet`,
     `SorClientRateEntry`, or a live tender / variation row.
   - `hardDelete(kind, id, actor)` → calls `assertNotInUse`, then removes the row
     inside a transaction, writing a change-log line (reuse whatever change-log
     table `sor_change_log_entries` sits alongside, OR emit a structured audit
     log entry — do NOT add a new table in this slice).
2. Controller at `apps/api/src/modules/rates/rate-archive.controller.ts`:
   - `POST /rates-hub/:kind/:id/archive` (permission `rates.manage`).
   - `POST /rates-hub/:kind/:id/unarchive` (permission `rates.manage`).
   - `DELETE /rates-hub/:kind/:id` (guarded by `SuperUserGuard`).
3. Wire into `apps/api/src/modules/rates/rates.module.ts`.
4. Unit spec at
   `apps/api/src/modules/rates/__tests__/rate-archive.service.spec.ts` covering:
   archive round-trip, `assertNotInUse` blocks on each of the three reference
   kinds, `hardDelete` succeeds when clean, super-user gate on the DELETE route.
5. Web: shared `ArchiveDeleteButtons` component + confirm dialog (reuse
   `useConfirm`) on the hub tabs; hard-delete button is DISABLED with hover
   reason ("in use by N tender(s) / SoR line(s)") when `assertNotInUse` would
   block, and only visible to super-users.

## Do NOT
- Add a new change-log table in this slice — reuse the existing audit path.
- Broaden the `SuperUserGuard` to other routes.
- Route subbie/supplier rates through `RateResolverService`.
- Rebuild archive behaviour that already exists on `RateRow.isActive` /
  `SubcontractorRate.isActive` — the service just orchestrates it.
- Edit `/sot/`. Do not use `requires_merged`.

## VERIFY
- `pnpm build && pnpm lint`
- `test -f apps/api/src/modules/rates/rate-archive.service.ts`
- `grep -q "assertNotInUse" apps/api/src/modules/rates/rate-archive.service.ts`
- Spec passes; hard-delete route rejects non-super-user requests.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the plan already exists on main. Never ask a
question or "stand by" for approval. Read the CI job log before diagnosing any failure.
