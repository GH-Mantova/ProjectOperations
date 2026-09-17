---
premise: '! grep -q "createColumnsFromHeader" apps/api/src/modules/rates/rate-xlsm-import.service.ts'
premise_means: Importing a sheet into a brand-new rate table still fails - every heading is reported as matching no column and dropped - because import can only match existing columns, never create them, even when the table has none.
scope:
  - apps/api/src/modules/rates/rate-xlsm-import.service.ts
  - apps/api/src/modules/rates/__tests__/rate-xlsm-import.service.spec.ts
done_when: pnpm build && pnpm lint && grep -q "createColumnsFromHeader" apps/api/src/modules/rates/rate-xlsm-import.service.ts && pnpm --filter @project-ops/api test -- rate-xlsm-import
size: 3
gate_allow: none
seed_only: false
escalates: true
module: rates
cluster: ratescol
cluster_order: 5
requires_on_main: 'apps/web/src/components/rates/FilterableRateGrid.tsx :: structureAdding'
design_ref: https://claude.ai/code/artifact/b589c915-c92a-491e-80a5-3fe9c55a3bb6
---

# Rates columns S4 - "the first row is the heading", where it is actually true: import

**Slice 5 of 5** of `ratescol`, and the only server slice with behaviour. On a **live** rate table
"promote row 1 to headings" has nowhere to land - columns are records and every cell is keyed on a
column id (`schema.prisma` ~6021-6031), so promoting a row would orphan every key. But row 1 is
already the header in the import path, in code. This slice makes import **create** the columns from
row 1 when the target table has none, instead of reporting that none of them match. The mock-up in
`design_ref` state 10 is the standard.

**Gate:** S3 must be on main (`structureAdding` in the grid) - S3 is the empty-table build flow this
slice completes from the import side.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the two files in `scope`.

## Guardrails

- One attempt. If `createColumnsFromHeader` is already present on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure. `pnpm build`, `pnpm lint` and the import spec
  must pass.
- `escalates: true` - this adds a column-creating path to import, which changes what a sheet does
  to a table. Open, leave unmerged.

## Grounded on main (read first; cite line numbers in the PR body)

- `rate-xlsm-import.service.ts`: `sheet.getRow(1)` is the header (~120); an empty header row is an
  error *"Header row (row 1) is empty — no columns found."* (~128); `:165` skips row 1 when reading
  data rows; an unmatched heading is a **warning** and dropped, *"Sheet column \"X\" does not match
  any column in table \"Y\"; it will be ignored."* (~139); a required column missing from the sheet
  is an error (~148). Today import **only matches** existing columns; it never creates any.
- Column creation already exists: `RateTablesService.createColumn` (and `assertStructure`,
  `rate-validation.service.ts` ~29-48) is the one place a column may be born, so it enforces the
  structural contract. Reuse it - do not write a second column-insert path.
- Inferring type from a column of values is the same job the importer already does to validate
  cells; keep it minimal and conservative.

## What to build

`createColumnsFromHeader` - when, and **only when**, the target table has **zero columns**:

1. Read row 1 as the column names (as `getRow(1)` already does). An empty header row stays the
   existing error.
2. For each heading, infer a starting shape from its column of values: all-numeric with a currency
   hint / all-numeric / else text -> `CURRENCY` / `NUMBER` / `TEXT`; role defaults to `KEY`
   (look-up) for text columns and `VALUE` (price) for the rightmost currency column, `INFO`
   otherwise - a **starting point the user can change**, not a guess presented as final. Do not
   invent units; a created VALUE column with no unit is exactly the state S1's header and S2's
   settings panel are built to flag (*needs a $ per what? before this table can price*).
3. Create the columns through `createColumn` in table order, then import the data rows against them
   exactly as the matched path does. If `createColumn` / `assertStructure` throws, surface that
   message - do not swallow it.
4. **On a table that already has columns, behaviour is unchanged** - match and warn as today. This
   new path is reached only at zero columns. The three shipped strings (~128, ~139, ~148) stay for
   the existing path.

The web preview that shows "Five columns will be created" and "check what each one is for" is S3's
grid / import review; this slice is the server that makes it real. Do not add web files here.

## Do NOT

- Do NOT create columns when the table already has any - only at zero columns.
- Do NOT bypass `createColumn` / `assertStructure` - column birth goes through the one guarded path.
- Do NOT change the matched-import path, its three strings, or the row-skip at `:165`.
- Do NOT invent units or present an inferred role/type as final.
- Do NOT touch the web app, the schema, the seed, or `/sot/`.

## VERIFY

```
pnpm build && pnpm lint
grep -q "createColumnsFromHeader" apps/api/src/modules/rates/rate-xlsm-import.service.ts
pnpm --filter @project-ops/api test -- rate-xlsm-import
```

Spec cases: zero-column table + a header row creates N columns and imports the rows; a table with
columns still matches-and-warns unchanged; an empty header row is still the shipped error; a
`createColumn` throw (e.g. duplicate heading) surfaces, not swallowed.

Open the PR titled `feat(rates): S4 - import creates columns from row 1 when the table has none`
and leave it UNMERGED.
