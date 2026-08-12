---
premise: '! test -f apps/api/src/modules/rates/rate-xlsm-import.service.ts'
premise_means: The hub cannot import or export .xlsm rate workbooks yet — Marco's existing spreadsheet cannot be loaded once and consumed by SoR + estimating.
scope:
  - apps/api/src/modules/rates/rate-xlsm-import.service.ts
  - apps/api/src/modules/rates/rate-xlsm-import.controller.ts
  - apps/api/src/modules/rates/__tests__/rate-xlsm-import.service.spec.ts
  - apps/api/src/modules/rates/rates.module.ts
  - apps/web/src/components/rates/XlsmImportPanel.tsx
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
requires_file_on_main: apps/api/src/modules/schedule-of-rates/sor-hub-builder.service.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/rates/rate-xlsm-import.service.ts && grep -q "dryRun" apps/api/src/modules/rates/rate-xlsm-import.service.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
---

# RATE-HUB S5 — .xlsm import / export on the hub (validation-gated)

Add the locked validation gate for importing Marco's rate workbook into the
hub (`RateTable` + rows) with a dry-run preview and all-or-nothing commit,
plus a matching export. SoR + estimating consume the hub — import ONCE.
Full plan: `docs/plans/rate-hub-sor-integration-plan.md`.

## Ground first (cite before editing)
- `apps/api/prisma/schema.prisma:5421`, `:5444`, `:5464` — `RateTable`, `RateColumn`, `RateRow`.
- `apps/web/src/pages/admin/RatesListsAdminPage.tsx:77` — extend the Internal-rates tab.
- `apps/api/src/modules/rates/rate-hub-vendors.service.ts` (S1) — the vendors read-view (do NOT touch it here; import writes to `RateTable`, not to vendor rates).

## What to build
1. `RateXlsmImportService` at
   `apps/api/src/modules/rates/rate-xlsm-import.service.ts`:
   - `parseWorkbook(buffer): StagedImport` — parses .xlsm sheets → typed rows.
   - `validate(staged): ValidationReport` — enforces column shape, dedupe by
     unique key, numeric-range bounds, list-value references.
   - `dryRun(staged): { report, impact }` — impact = counts of NEW / UPDATED /
     UNCHANGED / SKIPPED rows per `RateTable`, plus a preview of the first 20
     rows per table.
   - `commit(staged): { tablesTouched, rowsWritten }` — all-or-nothing inside
     a Prisma transaction; refuses to run if `validate` returned any ERROR.
   - `exportWorkbook({ tableSlugs? }): Buffer` — round-trip: emits the same
     shape the import accepts.
2. Controller at `apps/api/src/modules/rates/rate-xlsm-import.controller.ts`:
   - `POST /rates-hub/xlsm/validate` (multipart upload).
   - `POST /rates-hub/xlsm/dry-run`.
   - `POST /rates-hub/xlsm/commit` (permission `rates.manage`).
   - `GET  /rates-hub/xlsm/export`.
3. Wire into `apps/api/src/modules/rates/rates.module.ts`.
4. Unit spec at `apps/api/src/modules/rates/__tests__/rate-xlsm-import.service.spec.ts`:
   - Validation catches malformed rows / bad units / unknown list values.
   - `commit` refuses if `validate` has errors.
   - Transaction rollback on partial failure.
   - Export round-trips a small hand-built workbook.
5. Web: `XlsmImportPanel.tsx` on the Internal-rates tab — file picker →
   `validate` → `dryRun` preview panel → **Commit** button (disabled until
   validation clean). Export button downloads the current hub.

## Do NOT
- Import into `SubcontractorRate` (vendor rates own themselves — this slice is HUB tables only).
- Bypass the validate → dry-run → commit sequence. Commit MUST refuse on errors.
- Alter existing `RateTable` shape — the import maps onto the current schema.
- Edit `/sot/`. Do not use `requires_merged`.

## VERIFY
- `pnpm build && pnpm lint`
- `test -f apps/api/src/modules/rates/rate-xlsm-import.service.ts`
- `grep -q "dryRun" apps/api/src/modules/rates/rate-xlsm-import.service.ts`
- Spec asserts commit refuses on validation errors; export round-trips.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the plan already exists on main. Never ask a
question or "stand by" for approval. Read the CI job log before diagnosing any failure.
