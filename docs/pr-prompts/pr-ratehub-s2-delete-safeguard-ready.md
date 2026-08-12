---
premise: ! test -f apps/api/src/modules/rates/rate-archive.service.ts
premise_means: The rate-archive service does not exist yet — S2 delete safeguard work is still needed.
requires_file_on_main: apps/web/src/pages/settings/reference-data/VendorRatesTab.tsx
scope:
  - apps/api/src/modules/rates/rate-archive.service.ts
  - apps/api/src/modules/subcontractors/**
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/common/auth/super-user.guard.ts
  - apps/web/src/pages/directory/SubcontractorsPage.tsx
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - docs/data-model/**
done_when:
  - pnpm build
  - pnpm lint
  - test -f apps/api/src/modules/rates/rate-archive.service.ts
  - grep -q "archivedAt" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
rollback_strategy: "no rollback — archivedAt and archivedById are nullable columns; drop them in a follow-on migration if needed"
backfill: false
---

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the premise is already satisfied on main, say `NO-OP: premise already satisfied`
  and exit.
- Never ask a question. Decide from the evidence, or write to `needs-marco/` and stop.
- Before diagnosing any CI failure, read the job log via `gh run view <run-id> --log`.
- Say `NO-OP: <reason>` loudly if you cannot finish. A silent exit is treated as success by the
  watcher — that is the worst outcome.

## Context

Plan: `docs/plans/rate-hub-sor-integration-plan.md` (read it, especially §Locked Decisions #4).

This slice adds the delete safeguard across hub vendors (`SubcontractorSupplier`) and their rate
lines (`SubcontractorRate`). The pattern to copy exactly is the `ContractArchiveService` introduced
in PR #1042.

## Ground first — read these files (cite line numbers)

1. `apps/api/src/modules/contracts/contract-archive.service.ts` — the full service (122 lines).
   Copy its `archive / unarchive / hardDelete / requireEntity` pattern verbatim; adapt for
   `SubcontractorSupplier` and `SubcontractorRate`.
2. `apps/api/src/modules/contracts/contracts.controller.ts` — lines 16, 297, 422, 430:
   `SuperUserGuard` import and usage. Replicate for the subcontractors controller.
3. `apps/api/src/common/auth/super-user.guard.ts` — the guard implementation.
4. `apps/api/prisma/schema.prisma` lines 4285–4400 (`SubcontractorSupplier`) — confirm `archivedAt`
   is NOT present yet before adding it.
5. `apps/api/prisma/schema.prisma` lines 3897–3917 (`Contract.archivedAt` pattern to mirror).
6. `apps/web/src/pages/admin/ratesListsHelpers.ts` line 76 (`whereUsedBlockerMessage`) — reuse this
   UI pattern for the in-use guard on vendor delete.

## What to build

### 1. Schema change
Add to `SubcontractorSupplier` in `schema.prisma`:
```
archivedAt   DateTime? @map("archived_at")
archivedById String?   @map("archived_by_id")
archivedBy   User?     @relation("SubcontractorArchivedBy", fields: [archivedById], references: [id], onDelete: SetNull)
```
Add `@@index([archivedAt])`.
Add the back-relation on `User`:
```
subcontractorsArchived SubcontractorSupplier[] @relation("SubcontractorArchivedBy")
```

Run `npx prisma migrate dev --name feat_subcontractor_archived_at`.

Regenerate the data-model map:
```
node scripts/data-model/build-relationship-map.mjs
```
Commit `docs/data-model/metadata-catalog.json`, `relationship-map.json`, `relationship-map.md`.

GATE-ALLOW: migrations

### 2. New service
Create `apps/api/src/modules/rates/rate-archive.service.ts`:
- `archive(id: string, actorId: string)` — sets `archivedAt = now`, `archivedById = actorId`,
  writes audit log (`action: "subcontractors.archive"`).
- `unarchive(id: string, actorId: string)` — clears both fields, writes audit log.
- `hardDelete(id: string, actorId: string, isSuperUser: boolean)` — throws `ForbiddenException`
  if not super-user. Checks for live references (active tender allocations, SorClientRateEntry rows
  that still reference this vendor or their rates) and throws `ConflictException` with a clear
  message if any exist. Then deletes; writes audit log.
- `requireVendor(id)` private — throws `NotFoundException` when vendor absent.
- Inject `PrismaService` and `AuditService` (same as `ContractArchiveService`).

**In-use guard (hard-delete blocked while referenced):**
Query `Commitment` (or `TenderRateEntry`/`SorClientRateEntry`) for any reference to this vendor's
rates that is NOT from a locked/archived tender. If count > 0 throw `ConflictException`:
`"Vendor has ${count} active references and cannot be permanently deleted. Archive it instead."`

### 3. Controller endpoints
In the subcontractors controller, add:
- `PATCH /subcontractors/:id/archive` — calls `archive`; guard: `JwtAuthGuard` + `rates.manage`.
- `PATCH /subcontractors/:id/unarchive` — calls `unarchive`; guard: same.
- `DELETE /subcontractors/:id` — calls `hardDelete`; guard: `SuperUserGuard`.

### 4. Web UI
In `apps/web/src/pages/directory/SubcontractorsPage.tsx`:
- Add "Archive" button on the vendor card (visible when not already archived).
- Add "Restore" button on archived vendors.
- For super-users, add "Permanently delete" button behind a confirm dialog.
- Show `whereUsedBlockerMessage`-style tooltip/warning when hard-delete is blocked.

## Do NOT
- Do NOT add `archivedAt` to `SubcontractorRate` in this slice (rate archiving via the `isActive`
  flag already exists on that model).
- Do NOT change the RateTable delete behaviour — that is a separate concern.
- Do NOT edit `/sot/`.

## VERIFY
```
pnpm build && pnpm lint
test -f apps/api/src/modules/rates/rate-archive.service.ts
grep -q "archivedAt" apps/api/prisma/schema.prisma
grep -q "SubcontractorArchivedBy" apps/api/prisma/schema.prisma
```
All must pass before you open the PR.

Open the PR with a title like:
`feat(rate-hub): S2 — delete safeguard for hub vendors (archive-first + super-user hard-delete)`

Leave it UNMERGED.
