---
premise: ! test -f apps/api/src/modules/rates/rate-xlsm-import.service.ts
premise_means: The rate-xlsm-import service does not exist yet — S5 .xlsm import/export work is still needed.
requires_file_on_main: apps/web/src/pages/schedule-of-rates/CreateSorPage.tsx
scope:
  - apps/api/src/modules/rates/rate-xlsm-import.service.ts
  - apps/api/src/modules/rates/rate-xlsm-export.service.ts
  - apps/api/src/modules/rates/rates.controller.ts
  - apps/api/src/modules/rates/rates.module.ts
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
done_when:
  - pnpm build
  - pnpm lint
  - test -f apps/api/src/modules/rates/rate-xlsm-import.service.ts
  - test -f apps/api/src/modules/rates/rate-xlsm-export.service.ts
  - grep -q "xlsm" apps/api/src/modules/rates/rates.controller.ts
size: 9
gate_allow: none
seed_only: false
escalates: false
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

Plan: `docs/plans/rate-hub-sor-integration-plan.md` (read it, especially §Locked Decisions #7).

This slice adds .xlsm import/export to the hub (`/settings/reference-data`). The pipeline is:
**staged → validated → all-or-nothing commit**. There is a dry-run mode that returns an impact
preview without committing. The same hub data (RateTable rows) feeds both SoR creation (S4) and
estimating — no duplication.

## Ground first — read these files (cite line numbers)

1. `apps/api/prisma/schema.prisma` lines 5428–5500 (`RateTable`, `RateColumn`, `RateRow`).
2. `apps/api/src/modules/rates/rates.controller.ts` — what endpoints already exist; add import/export
   endpoints alongside them.
3. `apps/api/src/modules/rates/rates.module.ts` — register new services here.
4. `apps/web/src/pages/admin/RatesListsAdminPage.tsx` — add import/export UI to the existing page.
5. Check `package.json` in `apps/api` for an existing Excel library (e.g. `xlsx`, `exceljs`).
   If none exists, use `exceljs` (a widely-used, well-maintained library for .xlsx/.xlsm). Verify
   it is not already a dependency before adding it.

## What to build

### 1. Import service
Create `apps/api/src/modules/rates/rate-xlsm-import.service.ts`:

**Staged import pipeline:**

`stageImport(buffer: Buffer, tableSlug: string): Promise<ImportStageResult>`
- Parses the .xlsm buffer with ExcelJS.
- Validates column headers match the `RateColumn` definitions for the given `RateTable`.
- Maps rows to candidate `RateRow.cells` objects.
- Returns `{ valid: boolean; errors: string[]; preview: CandidateRow[] }` without writing anything.

`commitImport(stageResult: ImportStageResult, tableSlug: string, actorId: string): Promise<void>`
- Only called after `stageImport` returns `valid: true`.
- In a single Prisma transaction: soft-deactivates all existing rows (`isActive = false`), inserts
  the new rows, writes an audit log entry.
- All-or-nothing: if the transaction fails, no rows change.

Impact preview included in `stageImport` result:
- Count of existing active rows that would be replaced.
- Count of new rows that would be inserted.
- List of rows whose key values differ from any existing active row (changed items).

### 2. Export service
Create `apps/api/src/modules/rates/rate-xlsm-export.service.ts`:

`exportTable(tableSlug: string): Promise<Buffer>`
- Fetches the `RateTable` with its `columns` and active `rows` (`isActive = true`).
- Builds an ExcelJS workbook: one sheet, header row from `RateColumn.name`, data rows from
  `RateRow.cells`.
- Returns the buffer as .xlsx (ExcelJS does not write macros; deliver as .xlsx for round-trip
  safety; filename suggestion: `<slug>-rates.xlsx`).

### 3. Controller endpoints
Add to `apps/api/src/modules/rates/rates.controller.ts`:
- `POST /rates/import/:tableSlug` — multipart file upload; calls `stageImport`.
  Query param `?commit=true` triggers `commitImport` if stage result is valid.
  Guard: `rates.manage`.
- `GET /rates/export/:tableSlug` — calls `exportTable`, streams the buffer.
  Guard: `rates.view` or `rates.manage`.

### 4. Web UI
In `apps/web/src/pages/admin/RatesListsAdminPage.tsx`:
- Add an "Import .xlsx" button on the active RateTable's toolbar.
  - Opens a file picker (accept `.xlsx,.xlsm`).
  - On file select, calls the stage endpoint; shows the impact preview (rows added/replaced/changed).
  - User confirms → calls the commit endpoint; success toast + grid refresh.
  - On validation errors, shows the error list; no commit.
- Add an "Export .xlsx" button that triggers the export endpoint and downloads the file.

## Do NOT
- Do NOT import into the SoR tables directly — the hub is the import target; SoR reads from the hub.
- Do NOT write to legacy `Estimate*Rate` tables.
- Do NOT allow partial commit — the transaction is all-or-nothing.
- Do NOT change the schema — this slice has no migrations.
- Do NOT edit `/sot/`.

## VERIFY
```
pnpm build && pnpm lint
test -f apps/api/src/modules/rates/rate-xlsm-import.service.ts
test -f apps/api/src/modules/rates/rate-xlsm-export.service.ts
grep -q "xlsm\|import.*tableSlug\|export.*tableSlug" apps/api/src/modules/rates/rates.controller.ts
```
All must pass before you open the PR.

Open the PR with a title like:
`feat(rate-hub): S5 — .xlsm import/export on hub with staged validation + impact preview`

Leave it UNMERGED.
