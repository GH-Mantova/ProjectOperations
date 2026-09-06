---
premise: 'grep -q "export type ListedRate" apps/api/src/modules/rates/rate-resolver.service.ts && ! grep -A15 "export type ListedRate" apps/api/src/modules/rates/rate-resolver.service.ts | grep -q "isActive: boolean"'
premise_means: >-
  ListedRate has no isActive field, so a consumer that filters inactive rate
  rows today (scope-waste.service.ts:845) cannot preserve that filter after
  being routed through listRates(). This is the measured prerequisite for the
  11b2 consumer migration.
scope:
  - apps/api/src/modules/rates/rate-resolver.service.ts
  - apps/api/src/modules/rates/__tests__/**
done_when: >-
  pnpm build && pnpm lint && grep -A15 "export type ListedRate"
  apps/api/src/modules/rates/rate-resolver.service.ts | grep -q "isActive: boolean"
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: rates-consumers
cluster_order: 4
requires_merged: 1348
---

# SLICE 11b2 (prerequisite) — surface `isActive` on `ListedRate`

## ⛓ CHAIN-WIRED BEHIND SLICE 3a — do not hand-release this gate

`requires_merged: 1348` records this prompt's dependency. It was originally
`requires_on_main: ... :: wasteGroup`, gating on that symbol appearing in
`rate-resolver.service.ts` once **`pr-rates-consumers-s3a-export-only`** merged. That has since
happened: #1348 landed `wasteGroup` and `loadRate` in the `waste` adapter's `info` bag, so the
needle is present on main and the gate is satisfied. The key was CONVERTED rather than left in
place because a `requires_on_main` needle that is already present rejects `CLUSTER_DEAD_GATE` the
moment the prompt is armed - the gate would block the slice it was written to order (2026-08-28).

Both slices edit `tryListLegacy`'s `case "waste"`. Running them concurrently would conflict
in the same hunk, so this one stays `GATE_NOT_RELEASED` until s3a is on main, then flips to
PROMOTE on its own. **Do not edit the gate to make this prompt armable.** If you are reading
this because the gate looks stuck, check whether s3a has merged — that is the answer.


This slice adds ONE field. It changes no query, no row set, and no existing consumer.
Read the whole prompt before you start; the constraint section is the point of the slice.

## The measured problem

`listRates(slug)` has two backing paths and they disagree about inactive rows.

Measured on `origin/main` `47f9c73d`, `apps/api/src/modules/rates/rate-resolver.service.ts`:

| path | line | inactive rows |
|---|---|---|
| `tryListRateTable` | 282 — `where: { rateTableId: table.id, isActive: true }` | **excluded** |
| `tryListLegacy` `case "labour"` | 316 | included |
| `tryListLegacy` `case "plant"` | 330 | included |
| `tryListLegacy` `case "waste"` | 346 | included |
| `tryListLegacy` `case "cutting"` | 359 | included |
| `tryListLegacy` `case "core-hole"` | 382 | included |
| `tryListLegacy` `case "fuel"` | 395 | included |
| `tryListLegacy` `case "enclosure"` | 408 — `where: { isActive: true }` (line 410) | **excluded** |
| `tryListLegacy` `case "other-rates"` | 422 — `where: { isActive: true }` (line 424) | **excluded** |

All nine legacy models carry `isActive Boolean @default(true)` — verified in
`apps/api/prisma/schema.prisma`. So the data is there in every case; six adapters
simply do not read it.

Consequence: `listRates("waste")` returns a **different row set** depending on
`RATES_CANONICAL_SOURCE`. Any consumer that needs "active rates only" — and
`scope-waste.service.ts:845` does exactly that today, with its own
`where: { isActive: true }` — cannot be migrated onto the resolver without a way
to express that filter identically on both paths.

## Do

1. Add `isActive: boolean;` to the `ListedRate` type (line 30-37). Put it after
   `unit` and before `source`, and give it a one-line comment saying what it means
   on each path (see item 4).

2. In `tryListRateTable` (line 269), populate it from `row.isActive`. Rows there are
   already pre-filtered to `isActive: true`, so this is always `true` today — populate
   it from the column anyway rather than hard-coding `true`, so the field stays honest
   if that `where` is ever relaxed.

3. In `tryListLegacy` (line 314), populate it from `row.isActive` in **all eight**
   cases. In `case "labour"` the loop pushes three `ListedRate` entries per row — all
   three take the same `row.isActive`.

4. Comment the asymmetry at the `ListedRate` declaration, in the codebase's existing
   comment style (see the `plant` adapter's `info` comment for the register to use).
   State plainly that the RateTable path pre-filters inactive rows while six of the
   eight legacy adapters do not, so `isActive` is currently the only way a consumer
   can get the same row set from both — and that a consumer wanting active-only rows
   must filter on it explicitly.

## Do NOT

- **Do not add, remove, or change a single `where` clause.** Not in `tryListRateTable`,
  not in any `tryListLegacy` case, not in `enclosure` or `other-rates` where the filter
  already exists. Making the six unfiltered adapters filter would change what
  `rates-export.service.ts` exports (it consumes `listRates("plant")` as of #1337) and
  what every future consumer sees. That is a product decision and it is filed for Marco
  in `needs-marco/rates-11b2-consumer-migration-blockers-2026-08-27.md`.
  **It is not yours to make. If you find yourself editing a `where`, stop.**
- Do not change `keys`, `info`, `value`, `unit`, `source`, or any `orderBy`.
- Do not touch `resolveRate`, `tryRateTable`, `tryLegacy`, `enumerateRateSet`,
  `assertRateParity`, or the material-density methods.
- Do not touch any consumer. No file outside `scope` may change.
- Do not touch `estimateMaterialDensity`. There is an unresolved conflict between
  `pr-524` and `pr-rates-s11c` about that model, filed for Marco. Leave it alone.

## Tests

Extend `apps/api/src/modules/rates/__tests__/rate-resolver.service.spec.ts`. Adversarial
fixtures — a fixture where every row is active proves nothing here.

1. **Legacy path, mixed activity.** Fixture for `listRates("waste")` with at least one
   `isActive: false` row and one `isActive: true` row. Assert the returned array still
   contains **both** (the row set is unchanged — this is the regression guard on
   "additive"), and that each entry's `isActive` matches its source row.

2. **Same for `plant`**, since `rates-export.service.ts` consumes it.

3. **RateTable path.** Fixture where `rateRow.findMany` is called; assert the `where`
   still carries `isActive: true` and that returned entries report `isActive: true`.

4. **`labour` fan-out.** One labour row with `isActive: false` produces three entries
   (day/night/weekend) and **all three** report `isActive: false`.

5. **Filtering is now expressible.** Assert that
   `(await listRates("waste")).filter((r) => r.isActive)` yields exactly the active rows —
   this is the call `scope-waste.service.ts` will make in the follow-up slice, so pin it here.

## STOP AND REPORT

Open the PR, describe what you found, and stop — do not work around it — if any of these
is true:

- Any of the line numbers or `where` clauses in the table above does not match what you
  measure on your branch point. Re-measure before you assume the table is right; report
  the difference. Do not silently adapt.
- A legacy model in `tryListLegacy` turns out not to have `isActive` after all.
- `pnpm build` or `pnpm lint` fails for a reason you cannot attribute to your own edit.
- Adding the field breaks an existing test. That would mean something consumes
  `ListedRate` structurally (exhaustive destructuring, a strict object assertion), which
  contradicts "additive" and needs to be reported, not patched around.

Report measurements, not conclusions. If you assert a row count or a line number in the
PR body, show the command that produced it.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.

The STOP AND REPORT conditions are not an exception to this. "Stop and report" means
**open the PR, put the measurement and the problem in the body, and leave it unmerged** —
push what you have. It never means exit without opening a PR.
