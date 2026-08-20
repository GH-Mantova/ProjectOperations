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

**Marco's call — CONFIRMED DIRECTLY 2026-08-20, and recorded in
`docs/pr-prompts/BACKLOG-DECISIONS.md` §D ("Transport-capacity grid grouping"): transport type is
the outer level.** A truck is the
thing you pick; the material is what you look up against it. It also turns 6 groups of 4 into 4
groups of 6.

> **Provenance note.** An earlier draft of this prompt asserted that sentence with **no register
> entry behind it** — a self-attributed decision, which is the LL-39 failure mode, and on a
> migration that rewrites `sort_order` on a table every estimator sees. It was put to Marco on
> 2026-08-20 and he confirmed it. The decision is now written down where the next agent can find
> it. Note the seeding migration's own comment at
> `20260715120000_r3_t0_asset_fuel_capacity_ops_settings/migration.sql:59-60` still reads
> *"Transport types are the four rigs the Initial Services fleet actually runs (Marco to confirm)"* —
> that is a **different** open question (the rig list, not the column order) and this PR does not
> answer it. Leave it alone.

## What to build

One migration, `<timestamp>_transport_capacity_column_order`, rewriting `sort_order` on the four
columns of table `rt-tc`:

| column id | name | from | to |
|---|---|---|---|
| `rt-tc-c-transport` | Transport type | 2 | **1** |
| `rt-tc-c-material` | Material class | 1 | **2** |
| `rt-tc-c-m3` | Capacity (m³) | 4 | **3** |
| `rt-tc-c-tonnes` | Capacity (tonnes) | 3 | **4** |

Make it idempotent — guard on the current value so a re-run is a no-op.

**Match on `(rate_table_id, name)`, not on the literal ids.** These four rows were inserted by the
seeding migration with literal ids, so id-matching would probably work here — but "probably" is
the wrong standard for a migration on a table every estimator sees, and slice 1 of this same
cluster has the identical trap for a worse reason (its rows can be created by the admin UI with a
cuid). Use one rule across the cluster. **Assert the updated row count is 4 and fail the migration
otherwise** — a silent zero-row update that still exits 0 is the failure mode to design out.

Because two of these are a swap (transport 2→1 while material 1→2), do it in a single statement
with a `CASE`, or stage through a temporary sentinel value. Two sequential `UPDATE`s will collide
on the table's uniqueness expectations partway through.

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
and m³ therefore changes which figure a priced lookup returns.

⚠️ **Corrected 2026-08-20 — the original safety argument here was true by accident, not by
design.** It claimed `rt-tc` is "read through `resolveReferenceValue(columnName)`, which names its
column explicitly." Re-measured on `origin/main` `6bf3614d`:

- `resolveReferenceValue` exists (`apps/api/src/modules/rates/rate-resolver.service.ts:426-454`)
  and **does** resolve by column name, not position (`:438`).
- But it has **zero production callers.** The only references outside its own definition are in
  `rate-resolver.service.spec.ts`, which exercises it with slug `"plant"`.
- The slug `transport-capacity` appears **exactly once in the entire repo** — line 71 of the
  seeding migration. `rt-tc` appears only in that same file.
- `scope-waste.service.ts` gets capacity from the per-line `capacityPerLoad` / `capacityUnit`
  fields, not from `rt-tc` at all.

So the reorder is safe because **nothing reads this table programmatically yet** — vacuously, not
because a name-based accessor is protecting it. The conclusion stands; the reason does not, and the
difference matters: the protection people think is there is not there. **The first consumer added
to `rt-tc` inherits the `valueCols[0]` hazard immediately**, and there is no test standing between
them and it. State this in the PR body, in these terms — not as "safe, verified".

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
