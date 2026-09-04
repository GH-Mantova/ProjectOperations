---
premise: '! grep -q "SCOPE_MANPOWER_PERSIST_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: >-
  The Manpower column group writes to local React state and almost nothing else. Only row 1 reaches
  the server, and only its Qty, Days and Shift; the labour Type dropdown and the Day rate override
  call `setRowManpower` and stop there, on every row, and every row after the first is local in
  full. The estimator reloads the card and the type, the rates and the extra rows are gone.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-manpower-persist.test.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-manpower-columns.test.tsx
done_when: pnpm build && pnpm lint && grep -q "SCOPE_MANPOWER_PERSIST_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 8
gate_allow: none
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: scope-card-persistence
cluster_order: 1
rollback_strategy: >-
  Web-only, one component plus its tests. No API, no schema, no migration, no new dependency. Every
  change is a `patchItem` call added to a handler that already exists. Revert and the Manpower
  columns go back to the local-state behaviour they have today.
---

# The Manpower columns keep nothing but the first row

First slice of the persistence cluster. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

Measured 2026-09-04 against `origin/main`. Slice 3 of the redesign shipped the Manpower columns
without the server wiring. In `apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx`, inside
`<ManpowerRowCells>`: `onQtyBlur` (:1141), `onDaysBlur` (:1145) and `onShiftChange` (:1149) each
call `setRowManpower` and then `patchItem` **only when `rowIdx === 0`** (:1143, :1147, :1151).
`onLabourTypeChange` (:1140) and `onDayRateOverride` (:1153) call `setRowManpower` alone, on every
row. The row COUNT is a local `Map` as well - `itemRowCounts` (:477), grown and shrunk by
`addRowToItem` / `removeRowFromItem` (:500-515). Nothing on this list survives a reload except row
1's Qty, Days and Shift.

**Every manpower field on every row must round-trip: labour type, qty, days, shift, day rate
override, and the row count itself.** That is the job. Read the next section before you write
anything, because whether the job is doable at all depends on a store that may not exist.

## What to build

**0. Establish what the API can hold, on the head you are running against, before you touch the
component.** Here is the audit as measured on 2026-09-04; re-run it, because it decides the shape
of this PR.

- **Qty** - persists. `ScopeOfWorksItem.men` (`schema.prisma`, `men Decimal?` in the "General (all
  rows)" block), DTO field `men` on `ScopeItemFieldsBase`
  (`apps/api/src/modules/tendering/dto/scope-of-works.dto.ts`), carried into the Prisma payload by
  `numericFieldsFrom` and written by `ScopeOfWorksService.updateItem`. One scalar, not an array.
- **Days** - persists, identically, as `ScopeOfWorksItem.days`. One scalar.
- **Shift** - persists as `ScopeOfWorksItem.shift`; the DTO validates it with `@IsIn(SHIFTS)`. One
  scalar.
- **Labour type** - **no store.** There is no labour-role column on `ScopeOfWorksItem` and no
  labour field on the DTO. `computeScopeItemTotal` in `scope-item-pricing.ts` resolves the labour
  rate from `DEFAULT_ROLE_BY_DISCIPLINE[discipline]` plus `item.shift`; the row's own role is not
  an input to pricing and has nowhere to be written.
- **Day rate override (manpower)** - **no store.** Nothing on the model, nothing on the DTO, and
  `computeScopeItemTotal` takes the rate from the rate card only.
- **Rows 2..N** - **no store.** `men`, `days` and `shift` are three scalars, one set per item.
  Plant has a `plantItems Json?` array to hang extra rows on; labour has no equivalent column.
- **The row count** - **no store**, and it needs none of its own: a row count falls out of the
  length of whichever per-row array persists. With no labour array there is nothing for a
  manpower row to be implied by.

**1a. If a per-row manpower store IS on `main` when you run** - an API slice landed ahead of this
one - then this is a web slice and the work is mechanical. Send every field through `patchItem`
the way `description` (:1115) and `notes` (:1124) already go: the labour type id, the day rate
override, and the qty/days/shift of every row, not only `rowIdx === 0`. Keep `setRowManpower` as
the optimistic local write and let `onItemsChanged()` reconcile from the server response, which is
the pattern `patchItem` (:730) already implements. Persist the row count by persisting the rows.
Mark the component with `SCOPE_MANPOWER_PERSIST_V1`.

**1b. If it is not** - which is what was true on 2026-09-04 - **stop.** Say, on one line:

`NO-OP: no per-row manpower store on ScopeOfWorksItem - needs an API slice first`

and then state what that API slice has to add, so the next author does not have to re-derive it:
a `labourItems Json?` column on `scope_of_works_items` mirroring `plantItems`; a matching
pass-through field on `ScopeItemFieldsBase` (`plantItems` is the precedent - `@IsArray()` only,
handed to Prisma untouched by `numericFieldsFrom`); a labour leg in `computeScopeItemTotal` that
prices each row from its own role, shift and rate override instead of one
`men x days x DEFAULT_ROLE_BY_DISCIPLINE` product; and a read of the same array in
`ScopeOfWorksService.getCardSummary`, which today derives `peakCrew` and `labourDays` from
`item.men` and `item.days` alone and would otherwise under-report the crew on a multi-row item.

A UI that silently loses what the estimator typed is worse than no UI, and half-wiring it - row 1
saves, rows 2 and 3 do not - is worse than either, because the total looks plausible.

## Do NOT

- **Do not add, change or remove any API route, service method, DTO field, schema field or
  migration.** No schema change is expected from this slice and `gate_allow` is `none`. If you
  find yourself editing anything under `apps/api/prisma/`, you are in 1b: stop and NO-OP.
- **Do not touch the Plant column group.** `onPlantTypeChange`, `onCustomDescription`,
  `onRevertToList`, `onQtyBlur`, `onDaysBlur` and `onDayRateOverride` on `<PlantRowCells>`
  (:1163-1182) belong to `pr-cardpersist-s2`, and so does the legacy plant cluster in the
  Measurement cell.
- **Do not touch the Markup cell or the Item total cell** (:1200-1270). `pr-cardpersist-s3` owns
  the item markup override.
- Do not touch the Measurement column or the Actions column - `pr-cardui-s5` owns both.
- Do not change presentation: no column order, no group rules, no sticky header, no money
  formatting. The corrections cluster owns all of it.
- Do not touch `/sot/`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] Give an item three manpower rows, fill every field on each, reload the page, and **state
      which fields survived and which did not, row by row.** "It works" is not a report.
- [ ] Count the `patchItem` call sites in the Manpower group before and after and give both
      figures, plus the number of them still guarded by `rowIdx === 0`.
- [ ] Remove the middle row of a three-row item, reload, and say how many rows came back.
- [ ] State the Item total before and after the edits, and say whether it moved - the total renders
      the server's `lineTotalWithMarkup` (:1266), so a field that does not reach the server cannot
      move it.
- [ ] If you took the NO-OP: name the missing column, the missing DTO field and the missing pricing
      leg explicitly, and confirm you changed no file.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
