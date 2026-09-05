---
premise: '! grep -q "ScopeOperationalCostLine" apps/api/prisma/schema.prisma'
premise_means: >-
  A scope card can price manpower, plant and waste and nothing else. Permits, traffic control,
  scaffolding and site fees have no home, so they get buried in a WBS item's description or left off
  the tender. The web slice that would surface them (pr-cardui-s6) is a NO-OP until this exists.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/scope-costs.controller.ts
  - apps/api/src/modules/tendering/scope-costs.service.ts
  - apps/api/src/modules/tendering/dto/scope-costs.dto.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/modules/tendering/__tests__/scope-costs.service.spec.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "ScopeOperationalCostLine" apps/api/prisma/schema.prisma
size: 8
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: scope-operational-costs
cluster_order: 1
rollback_strategy: >-
  Purely ADDITIVE. One new table with a FK to scope_cards, no column added to any existing table, no
  data transformed, no backfill. Revert the code and the table is orphaned but harmless; drop it in a
  follow-up if the feature is abandoned. No existing row is read, written or migrated by this slice,
  so no tender price can change.
---

# Operational cost lines — the API the card is missing

`pr-cardui-s6-other-operational-costs-HOLD.md` orders the UI for a cost section on the scope card and
then forbids inventing its persistence:

> *"If the API cannot already persist an operational-cost line against a card, do not invent one: say
> `NO-OP: no persistence for operational cost lines - needs an API slice first` and stop. A UI that
> silently loses what the estimator typed is worse than no UI."*

**Measured 2026-09-05 against `origin/main`: it cannot.** `ScopeCard` carries `scopeItems`,
`wasteItems` and `cuttingItems` and no cost-line relation; its PATCH DTO accepts `discipline`,
`plantColumnCount`, `cuttingNotes`, `wasteNotes` and the markup overrides and nothing else.
`QuoteCostLine` exists but hangs off `ClientQuote`, a different downstream object. So s6 is a
correct NO-OP, and s7 and s8 are gated behind it. This slice is the unblock, and it is API only —
**it ships no UI.**

## What to build

**One model, `ScopeOperationalCostLine`, against `ScopeCard`.** Mirror the shape and the conventions
of `ScopeWasteItem` — it is the closest existing card-child and the one to copy for naming,
`@map` style, cascade behaviour and index choices. Read it before writing the model.

Fields, at minimum:

| field | why |
|---|---|
| `id`, `cardId` + relation, `sortOrder`, `createdAt`, `updatedAt` | the card-child skeleton every sibling has |
| `description` | free text — "Traffic control, 3 days" |
| `qty`, `unit` | the mock-up's Item / Qty / Unit / Rate / Total row |
| `rate` | the estimator's rate |
| `rateOverride` (nullable) | the override pattern manpower and plant already use: a locked rate as placeholder, typing overrides, null means inherit |
| `plantRateId` (nullable, FK) | so a line picked from the rate library keeps its identity, the way `ScopeWasteItem.transportRateId` does |

Use `Decimal` with explicit precision for every money and quantity column — match the precision the
sibling models already use rather than inventing one. **Do not store a computed total**; the total is
`qty × effective rate` and a stored copy is a second source of truth that will drift.

**Routes**, following `scope-waste.controller.ts` for shape, guards and permissions: list for a card,
create, patch, delete. Wire the module. `scope-waste.controller.ts` is 266 lines and
`scope-waste.service.ts` is 977 — you should need materially less than either, because there is no
aggregation engine here.

## The lump-sum rule belongs on this side, not only in the UI

s6 says a unit carrying no duration (`Ea`, `Lump sum`) pins days at 1 and greys the field. **A rule
enforced only in the browser is not enforced.** Whatever the API accepts is what the database will
eventually hold, so put the same constraint on the DTO and say in the PR body which units are
duration-bearing and which are not. If you cannot establish that list from existing code, pick the
minimal defensible one, name it in the body, and say it is a guess — do not silently invent a
taxonomy and present it as settled.

## Do NOT

- **Do not build any UI.** No file under `apps/web/**` is in scope. s6 is the UI slice.
- **Do not touch the card subtotal, the discipline summary bar, or any pricing path.** This slice
  adds a table and its routes. Nothing reads the new rows yet, so no tender total can move. If you
  find yourself editing a totals function, you have left the slice — stop.
- Do not add a column to `ScopeCard` or to any existing table.
- Do not touch `/sot/`, the waste engine, the cutting sheet, or `.github/workflows/**`.

## Required by the schema rules — do these up front, CI will not let you fix-forward

1. Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
   `docs/data-model/relationship-map.json`, `relationship-map.md` and `metadata-catalog.json`. The
   drift check hard-fails a schema change that leaves the map stale.
2. Put a bare `GATE-ALLOW: migrations` line at **column 0** of the PR body. CP-11 hard-fails an
   undeclared migration.
3. Update any service spec whose Prisma `create`/`update` payload assertions your change touches.

## Verification

- [ ] `pnpm --filter @project-ops/api test` green, including a spec that creates, lists, patches and
      deletes a line against a card.
- [ ] State in the PR body: the exact model as committed, the routes added, and the precision chosen
      for every Decimal column with the sibling you matched it to.
- [ ] State that **no existing table gained a column** and that the migration contains no `UPDATE`.
      Quote the migration SQL in full — it should be short enough to read in one screen.
- [ ] Confirm a card's subtotal is byte-identical before and after the migration on a seeded tender,
      and say how you established it.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN — open the PR and leave it unmerged for Marco.
