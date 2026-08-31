---
premise: '! grep -q "handleUpdateColumn" apps/web/src/pages/admin/RatesListsAdminPage.tsx'
premise_means: The Rates & Lists admin page has no way to edit a column — the PATCH endpoint exists on the server but nothing calls it.
scope:
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - apps/web/src/pages/admin/ratesListsHelpers.ts
  - apps/web/src/pages/admin/__tests__/ratesListsHelpers.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "handleUpdateColumn" apps/web/src/pages/admin/RatesListsAdminPage.tsx
size: 3
gate_allow: none
seed_only: false
escalates: true
cluster: rates-column-hygiene
cluster_order: 2
requires_on_main: apps/api/test/canonical/CP-08-seed-idempotency.spec.ts :: VALUE_COLUMNS_HAVE_UNITS
---

# Columns are add-only — wire up the edit endpoint that already exists

## The problem, precisely

The **Columns** card on Reference data & Lists offers exactly two operations: **Add column** and
**Delete column**. There is no rename, no unit change, no role change, no reorder — no Edit
affordance of any kind.

The server side is **already complete**. `RateTablesService.updateColumn` handles name, dataType,
role, unit, listSlug, required, min, max **and sortOrder**, and `rates.controller.ts` exposes it
(`updateColumn(@Param("tableId"), @Param("columnId"), @Body() dto: UpdateRateColumnDto)`). The web
page simply never calls it. This slice is **web-only** — do not add or change any API route.

Two consequences worth knowing before you start:

- **Delete cannot succeed on a populated table.** `deleteColumn` refuses while the table holds any
  rows, because cell keys reference the column id. On Transport capacity (24 rows) that button can
  only ever return a 409. That is correct server behaviour — but the UI gives no hint, so surface
  the server's message rather than a generic failure.
- **Column order is load-bearing.** `RateResolverService.resolveRate` and `listRates` both take
  `valueCols[0]` — the *first* VALUE column — as the answer. Reordering VALUE columns therefore
  changes what a priced lookup returns. Warn on that specific case (see below).

## What to build

1. **An inline edit row in `ColumnsCard`.** Clicking **Edit** on a column turns that row into
   editable controls for **Name**, **Role**, **Type**, **Unit / list slug** and **Required**, with
   Save and Cancel. Mirror the existing Add-column form's controls and validation so the two look
   like one feature.

2. **Reorder.** Up/down buttons (or equivalent) on each column row, persisting via the same PATCH
   with a new `sortOrder`. Keep it simple — no drag-and-drop.

3. **`handleUpdateColumn`** in the page, calling
   `PATCH /rates/tables/${table.id}/columns/${columnId}`, mirroring the existing
   `handleDeleteColumn` at line ~706 for error handling and refetch.

4. **Client-side pre-check before Save.** Reuse `validateColumnStructure` from
   `ratesListsHelpers.ts` against the *proposed* column set — the same shape the server's
   `assertStructure` will apply — so the user sees "VALUE column X needs a unit" before the
   round-trip rather than after. Extend the existing vitest file for any helper you add.

5. **A visible warning when reordering would move a VALUE column into or out of first position**,
   naming the consequence: *"This table's priced lookups return the first VALUE column. Moving it
   changes what the system reads as the rate."* Warn — do not block.

## Do NOT

- Do not add, change or remove any API route, service method or DTO. The server is done.
- Do not touch `rate-tables.service.ts`, `rate-validation.service.ts`, or the controller.
- Do not change the seed or add a migration — column data changes are the user's to make through
  this UI once it exists.
- Do not implement drag-and-drop reordering.
- Do not touch the Rows card, the Lists tab, or `VendorRatesTab`.
- Do not touch `/sot/`.

## Why this slice is gated

`updateColumn` runs `assertStructure` over the **merged** column set, so editing any column on
`plant`, `fuel` or `enclosure` throws until those tables' VALUE columns have units. Shipping this
UI first would produce a feature that fails on the three tables a user is most likely to try it on.

The gate is `requires_on_main` against the literal `VALUE_COLUMNS_HAVE_UNITS`, which slice 1 of
this cluster introduces into `CP-08-seed-idempotency.spec.ts`. The watcher DEFERS this prompt and
re-checks on each rescan until that string is on `origin/main`; it does not bin it.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if you cannot proceed, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.
- `escalates: true` gates the MERGE, not the RUN. Open the PR; Marco removes `do-not-merge`.
  (Raised from `false` by Marco, 31 Aug: this rewrites the Columns card on a screen estimators use,
  and reordering VALUE columns changes what a priced lookup returns — see the warning this slice
  is required to render. It gets a human look before it lands.)
