---
premise: '! ls apps/api/prisma/migrations | grep -q "transport_capacity_column_order"'
premise_means: The Transport capacity table still groups by Material class and shows tonnes before m³ — the column-order migration has not been written.
scope:
  - apps/api/prisma/migrations/**
  - apps/api/test/canonical/CP-08-seed-idempotency.spec.ts
done_when: pnpm build && ls apps/api/prisma/migrations | grep -q "transport_capacity_column_order"
size: 2
gate_allow: migrations
seed_only: false
escalates: true
cluster: rates-column-hygiene
cluster_order: 3
requires_on_main: apps/web/src/pages/admin/RatesListsAdminPage.tsx :: handleUpdateColumn
rollback_strategy: 'Migration only rewrites sort_order on four rate_columns rows of table rt-tc. To revert: set them back to material=1, transport=2, tonnes=3, m3=4. No cell data is touched and no row identity depends on column order, so a mid-flight death leaves the table fully usable in either order.'
---

# Transport capacity: group by transport type, and show m³ before tonnes

## Why the current order exists

Nobody chose it. `FilterableRateGrid` picks its group column like this:

```ts
const defaultGroupKey = groupByKey === undefined
  ? columns.find((c) => c.groupable)?.key ?? null
  : groupByKey;
```

`groupable` is `role === "KEY" && kind === "text"`, so **both** of `rt-tc`'s KEY columns qualify
and `.find()` simply takes whichever has the lower `sortOrder`. The seeding migration
(`20260715120000_r3_t0_asset_fuel_capacity_ops_settings`) wrote Material class at 1 and Transport
type at 2, so grouping falls on material. The grid's toolbar offers only a Group on/off toggle —
there is no column picker — so this cannot be changed from the screen.

Marco's call: transport type is the outer level. A truck is the thing you pick; the material is
what you look up against it. It also turns 6 groups of 4 into 4 groups of 6.

## What to build

One migration, `<timestamp>_transport_capacity_column_order`, rewriting `sort_order` on the four
columns of table `rt-tc`:

| column id | name | from | to |
|---|---|---|---|
| `rt-tc-c-transport` | Transport type | 2 | **1** |
| `rt-tc-c-material` | Material class | 1 | **2** |
| `rt-tc-c-m3` | Capacity (m³) | 4 | **3** |
| `rt-tc-c-tonnes` | Capacity (tonnes) | 3 | **4** |

Make it idempotent — guard on the current value or use `ON CONFLICT`-style defensive predicates so
a re-run is a no-op. Match on id; fall back to `(rate_table_id, name)` only if an id does not
resolve.

Also add an assertion to `CP-08-seed-idempotency.spec.ts` that `rt-tc`'s KEY columns are ordered
transport-then-material, so a future re-seed cannot silently revert it.

## Why this is safe — I checked the three places order could matter

- **`enumerateRateSet`** keys entries `{tableId}:{rowId}:{colId}` — order-independent. It also
  skips `isReference` tables entirely, and `rt-tc` is one.
- **`tryRateTable` and `resolveReferenceValue`** match with `keyCols.every(...)` — set-based,
  order-independent.
- **`validateRow`** joins KEY cells in column order to test uniqueness, but builds both sides of
  the comparison inside one call, so a consistent reorder cannot change the outcome.

The one genuine hazard is that `resolveRate`/`listRates` return `valueCols[0]`. Swapping tonnes
and m³ therefore changes which figure a priced lookup returns — **harmless here** because `rt-tc`
is `isReference: true` and is read through `resolveReferenceValue(columnName)`, which names its
column explicitly. **If this table is ever made priced, revisit this.** Say so in the PR body.

## Why this slice is gated

Two reasons, both real.

**Reversibility.** This migration changes stored column order on a system table. Until the
column-edit UI exists (slice 2 of this cluster), nobody can put it back from the screen — it would
take another migration. Gating on `handleUpdateColumn` being on `origin/main` means the undo path
exists before the change does.

**Conflict avoidance.** Slice 1 and this slice both edit
`apps/api/test/canonical/CP-08-seed-idempotency.spec.ts`. Run concurrently they collide in the same
file; run in sequence they do not.

## Do NOT

- Do not touch any `rate_rows` cell data. Cells key on column id, not position.
- Do not rename any column, or change any role, dataType or unit.
- Do not touch `seed-initial-services.ts` — `transport-capacity` is seeded by migration only and
  does not appear in `seedRateTableProjections`. Adding it there is a separate decision.
- Do not add a group-by picker to the grid — that belongs with the column-edit UI slice.
- Do not touch `/sot/`.

## PR body must contain

`GATE-ALLOW: migrations` as a **bare line at column 0**.

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
