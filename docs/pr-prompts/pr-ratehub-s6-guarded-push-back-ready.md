---
premise: '! test -f apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts'
premise_means: There is no push-back service yet — a local edit made on a SoR line cannot flow back to the master hub rate under a permission gate with an impact preview.
scope:
  - apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts
  - apps/api/src/modules/schedule-of-rates/sor-push-back.controller.ts
  - apps/api/src/modules/schedule-of-rates/__tests__/sor-push-back.service.spec.ts
  - apps/api/src/modules/schedule-of-rates/schedule-of-rates.module.ts
  - apps/web/src/pages/schedule-of-rates/PushToMasterDialog.tsx
requires_file_on_main: apps/api/src/modules/rates/rate-xlsm-import.service.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts && grep -q "impactPreview" apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts
size: 5
gate_allow: none
seed_only: false
escalates: true
---

# RATE-HUB S6 — guarded push-back (SoR local edit → master hub rate)

Let a permitted user push a local SoR-line edit back to the master hub
rate — permission-gated, change-logged, with an **impact preview** listing
UNLOCKED tenders that would move before the caller confirms. **Locked
snapshots stay frozen.** **Escalates** — Marco holds the merge.
Full plan: `docs/plans/rate-hub-sor-integration-plan.md`.

## Ground first (cite before editing)
- `apps/api/src/modules/schedule-of-rates/sor-rate-source.types.ts` (S3) — the source discriminators tell push-back which master to update.
- `apps/api/src/modules/rates/rate-resolver.service.ts:54` — INTERNAL push targets `RateTable`/`RateRow` (write via the same shape `resolveRate` reads).
- `apps/api/prisma/schema.prisma:5464` — `RateRow.cells` (INTERNAL target).
- `apps/api/prisma/schema.prisma:4353` — `SubcontractorRate` (SUBBIE/SUPPLIER target; **append-only supersede** — never mutate the existing row; create a new active row and flip the old to `isActive: false` in one transaction).
- `apps/api/prisma/schema.prisma:5486` — `TenderRateSet` (locked snapshots — the frozen set).

## What to build
1. `SorPushBackService` at
   `apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts` with:
   - `impactPreview({ sorRateId, newValue }): { affectedUnlockedTenders: Array<{ tenderId, tenderRef, currentValue, newValue }>; blockedLockedCount: number }`
     — walks references from the master target (INTERNAL: `RateTable`/row; SUBBIE/SUPPLIER: `SubcontractorRate`) to any `TenderRateSet` / active tender that still points at it, splitting into UNLOCKED (will move) vs LOCKED (frozen; will not).
   - `push({ sorRateId, newValue, confirmToken, actorId }): { updatedMasterId }`:
     - Requires permission `rates.push` (new permission code — register it).
     - Rejects when `sourceKind = MANUAL` (nothing to push back to).
     - INTERNAL: updates the specific `RateRow.cells` value inside a transaction.
     - SUBBIE / SUPPLIER: append-only supersede — inserts a new `SubcontractorRate` and flips the old row's `isActive: false`.
     - Writes a change-log entry (reuse the S2 change-log path).
     - Does NOT touch any `TenderRateSet` (locked snapshots stay frozen).
   - `confirmToken` = a hash of the previewed impact; `push` refuses if the current impact hash differs (prevents blind push after the preview was rendered).
2. Controller at `apps/api/src/modules/schedule-of-rates/sor-push-back.controller.ts`:
   - `POST /schedule-of-rates/push-back/preview` (permission `rates.push`).
   - `POST /schedule-of-rates/push-back/commit`  (permission `rates.push`).
3. Wire into `apps/api/src/modules/schedule-of-rates/schedule-of-rates.module.ts`.
4. Unit spec at
   `apps/api/src/modules/schedule-of-rates/__tests__/sor-push-back.service.spec.ts`:
   - MANUAL push rejected.
   - INTERNAL push writes the `RateRow.cells` value; asserts no `TenderRateSet` row was touched.
   - SUBBIE/SUPPLIER push appends a new `SubcontractorRate`, flips old `isActive: false`, in one transaction.
   - `push` refuses when `confirmToken` mismatches the current preview.
5. Web: `PushToMasterDialog.tsx` — visible only to callers with `rates.push`; renders the preview, calls `commit` with the token, shows a summary of the affected UNLOCKED tenders.

## Do NOT
- Modify any `TenderRateSet` / `TenderRateEntry` row — locked snapshots are frozen by contract.
- Mutate an existing `SubcontractorRate` in place — the model is append-only supersede (RC-1 comment at schema.prisma:4349).
- Broaden `SuperUserGuard` — this is a `rates.push` permission, not super-user.
- Route SUBBIE/SUPPLIER through `RateResolverService`.
- Edit `/sot/`. Do not use `requires_merged`.

## VERIFY
- `pnpm build && pnpm lint`
- `test -f apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts`
- `grep -q "impactPreview" apps/api/src/modules/schedule-of-rates/sor-push-back.service.ts`
- Spec asserts no `TenderRateSet` write and append-only vendor supersede.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the plan already exists on main. Never ask a
question or "stand by" for approval. Read the CI job log before diagnosing any failure.
