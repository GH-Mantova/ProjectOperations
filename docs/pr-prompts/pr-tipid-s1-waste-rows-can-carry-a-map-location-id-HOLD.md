---
premise: '! grep -q mapLocationId apps/api/prisma/seed-initial-services.ts'
premise_means: >-
  The waste RateTable projections have no place to put a MapLocation id. MEASURED 2026-09-03 at
  origin/main 50662fdc - seed-initial-services.ts:3764-3799 builds rt-wst-t and rt-wst-m3 with
  columns facility/type/group/ton/load and m3, and every row's cells carry the facility as a display
  STRING. The TIP rename guard at map-locations.service.ts:138-157 exists precisely because that
  string is the only link. Marco decided 2026-09-03 (D3, option d) that the rate row should carry
  the MapLocation id and resolve the name, so a rename cannot orphan rates. This slice makes the id
  expressible and resolvable. It writes no ids and changes no behaviour.
scope:
  - apps/api/prisma/seed-initial-services.ts
  - apps/api/src/modules/rates/waste-facility.ts
  - apps/api/src/modules/rates/__tests__/waste-facility.spec.ts
done_when: >-
  grep -q mapLocationId apps/api/prisma/seed-initial-services.ts && git ls-files --error-unmatch apps/api/src/modules/rates/waste-facility.ts && pnpm build && pnpm lint
size: 3
gate_allow: none
seed_only: false
escalates: false
cluster: tip-facility-id
cluster_order: 1
---

# TIP-ID-S1: give the waste rows somewhere to put the id, and a resolver that prefers it

**Grounded against `origin/main` = `50662fdc`, measured 2026-09-03.** Implements Marco's D3 ruling,
option (d), decided 2026-09-03.

**No migration.** `RateRow.cells` is `Json` (`schema.prisma:5869`), so a new key is a data change,
not a schema change. **No behaviour change either** — every row ships with the id `null` and the
resolver falls back to the name, so this slice is inert until TIP-ID-S2 writes ids.

## Why it cannot do more than this

`MapLocation` is **seeded nowhere** — a repo-wide grep over `apps/api/prisma/*.ts` returns nothing,
and the only creator is `map-locations.service.ts:116`, a person in Settings. So at seed time there
are **zero** MapLocations and **no ids to write**. Any slice that tries to populate the link during
seeding is writing nulls with extra steps. Populating it is S2's job and needs a real database.

## Do

1. **Add an `mapLocationId` column definition to both waste tables** in
   `seed-initial-services.ts` — `rt-wst-t` and `rt-wst-m3`. Give it
   `dataType: "TEXT"`, `role: "INFO"`, and a `sortOrder` that places it last so the existing screen
   layout does not move. **`role: "INFO"`, not `KEY`** — a KEY column participates in row matching,
   and a null id on every row would collide.
2. **Write `mapLocationId: null` into every row's `cells`** in both projections. Explicit `null`,
   not omitted: a reader can tell "not linked yet" from "this build predates the column".
3. **Create `apps/api/src/modules/rates/waste-facility.ts`** exporting one pure function —
   `resolveWasteFacility(cells, lookup)` — that returns the display name for a waste row:
   the `MapLocation` name when `cells.mapLocationId` is set **and** resolves through the supplied
   lookup, and `cells.facility` otherwise. Pure, no Prisma, so it is unit-testable without a DB, in
   the same style as `scope-item-pricing.ts`.
4. **Make the fallback loud, not silent.** When `mapLocationId` is set but does **not** resolve,
   return the stored `facility` string **and** signal it — a second return field, or a caller-supplied
   `onDangling` callback. A dead id must never be indistinguishable from "not linked yet". That
   distinction is the whole safety argument for option (d) and it has to exist from the first slice.
5. **Tests** in `__tests__/waste-facility.spec.ts`: id null → name; id set and resolving → the
   MapLocation name; id set and dangling → the stored name **plus the dangling signal**; both absent
   → empty string, no throw.

## Do NOT

- Do NOT add a Prisma migration, and do NOT add a column to `EstimateWasteRate` or `MapLocation`.
  The id lives in the JSON cell.
- Do NOT write any real id anywhere. This slice ships every row `null`.
- Do NOT touch `map-locations.service.ts`, and **do NOT remove or weaken the rename guard at
  `:138-157`**. It protects the legacy table that still prices every job today; it is retired in
  TIP-ID-S3, not here.
- Do NOT change the `facility` cell, rename it, or drop it. Both keys coexist — the name stays as the
  human-readable value and the fallback.
- Do NOT wire the resolver into any screen or endpoint yet. Adding it and calling it in the same
  slice makes a behaviour change out of what should be an inert one.
- Do NOT touch `sot/`.

## Verify

- `grep -c mapLocationId apps/api/prisma/seed-initial-services.ts` returns at least 4 (two column
  definitions, two cell writes).
- Re-seed a scratch database and read one waste row back: `cells.mapLocationId` is `null` and
  `cells.facility` is unchanged.
- `pnpm --filter @project-ops/api test` passes with the four new cases visible.
- **Control that this slice is inert**: the Rates & Lists screen renders the waste tables exactly as
  before. Say so in the PR body — a visible change here means the resolver was wired in early.
- `pnpm build` and `pnpm lint` exit 0.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop before
pushing.
