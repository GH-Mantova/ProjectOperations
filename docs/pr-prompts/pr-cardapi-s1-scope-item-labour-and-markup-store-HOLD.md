---
premise: '! grep -q "SCOPE_ITEM_LABOUR_STORE_V1" apps/api/src/modules/tendering/scope-of-works.service.ts'
premise_means: >-
  A WBS item can store three labour scalars - men, days, shift - and nothing else. There is no
  column, no array and no DTO field for the row's labour ROLE, for a manpower rate override, or for
  any labour row after the first, and no column for an item-level markup override. So the manpower
  columns shipped in slice 3 are client-side only by necessity, not by oversight, and every
  persistence slice behind them stops at a NO-OP until this exists.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations
  - apps/api/src/modules/tendering/scope-of-works.service.ts
  - apps/api/src/modules/tendering/scope-item-pricing.ts
  - apps/api/src/modules/tendering/dto/update-scope-item.dto.ts
  - apps/api/src/modules/tendering/__tests__/scope-item-labour-store.spec.ts
done_when: pnpm build && pnpm lint && grep -q "SCOPE_ITEM_LABOUR_STORE_V1" apps/api/src/modules/tendering/scope-of-works.service.ts && node scripts/data-model/build-relationship-map.mjs --check
size: 9
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: scope-card-api
cluster_order: 1
rollback_strategy: >-
  One additive migration: two NULLABLE columns on scope_of_works_items and nothing else. No column
  is dropped, renamed or retyped, and no existing row is rewritten - every existing item reads back
  with both columns NULL and prices exactly as it does today. Reverting the code leaves two unused
  nullable columns behind, which is inert. There is no data migration to undo.
---

# The manpower columns cannot be saved, because there is nowhere to put them

First slice of the API cluster. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

MEASURED 2026-09-04 against `origin/main`. Slices 3 and 4 of the scope-card redesign shipped the
manpower and plant COLUMN GROUPS without the server wiring, and the reason is not that the wiring
was skipped:

- **Plant already has a store.** `plant_items JSONB` has existed since the `scope_redesign_v2`
  migration. The DTO field is optional and unvalidated, and the service hands it to Prisma
  untouched, so plant type, description, qty and days already round-trip.
- **Labour has none.** There is no `labourItems` array to mirror it. `men`, `days` and `shift` are
  three scalars on the item - one set, for the whole item - so the row's ROLE, its rate override,
  and every row after the first have nowhere to go.
- **Item markup has none.** `ScopeCard` carries `markupOverride`; the item does not.

That is why `pr-cardpersist-s1` and `pr-cardpersist-s3` are written to stop with a `NO-OP:` rather
than invent a schema. **This slice is the thing they stop for.** It ships no UI.

## What to build

**1. Two nullable columns on `ScopeOfWorksItem`, in one additive migration.**

- `labourItems Json?` - deliberately the same shape and the same name pattern as `plantItems`, so
  the two halves of a row are stored and read the same way. One entry per rendered row, carrying at
  minimum: `rowIdx`, `labourTypeId`, `role`, `shift`, `qty`, `days`, `dayRateOverride`.
- `markupOverride Decimal?` - the item-level override, matching the precision `ScopeCard.markupOverride` already uses.

Nothing is dropped, renamed or retyped. **Do not touch `men`, `days` or `shift`** - they stay, they
keep their meaning, and step 4 says what happens when both are present.

**2. DTO pass-through.** Add both to the update DTO. The global `ValidationPipe` runs `whitelist`
**and** `forbidNonWhitelisted`, so an undeclared property is rejected as a 400 - a field that is not
on the DTO cannot reach the service at all, however correct the client is. Follow the `plantItems`
precedent for shape validation, and read the preserve-on-partial-update spec before you write the
service change: `updateItem` persists exactly what the DTO sends, so a partial `labourItems` write
would erase the rest of the array.

**3. A labour leg in `computeScopeItemTotal`.** Today it prices labour as
`men x days x labourRateForShift(DEFAULT_ROLE_BY_DISCIPLINE[discipline], shift)` - the row's own
role and rate are not inputs at all. When `labourItems` is present, price each entry from its own
role, its own shift and its own override, and sum them.

**4. The precedence rule, stated once and applied everywhere.** For each of labour and markup:

- `labourItems` present and non-empty wins over the `men`/`days`/`shift` scalars.
- `labourItems` absent or empty falls back to the scalars, exactly as today.
- Item markup resolves `item.markupOverride ?? card.markupOverride ?? tenderEstimate.markup`, and
  **both resolver call sites must share one expression** - not two copies that can drift.

Every existing item has both columns NULL, so every existing item takes the fallback and prices to
the same number it does today. **Prove that, do not assert it** - see Verification.

**5. `getCardSummary` must read the new store.** It derives `peakCrew` and `labourDays` from
`item.men` and `item.days` alone. With multiple labour rows those two fields no longer describe the
item, and the discipline roll-up is built on top of this function.

**6. Fix plant pricing while you are in the file.** `computeScopeItemTotal` skips plant entries with
no `plantRateId` and always uses the catalogue rate - so free-typed custom plant prices at **$0**
and a `dayRateOverride` is ignored. The store already holds both. This is a change to one pure
function and its spec, and both readers inherit it.

Mark the service with `SCOPE_ITEM_LABOUR_STORE_V1`.

## Do NOT

- **Do not touch `apps/web/`.** Not one file. This slice ships the store and the pricing; the UI
  that writes to it is `pr-cardpersist-s1` and `s2`, and mixing them makes both unreviewable.
- Do not drop, rename or retype any existing column. Do not write a data migration. Do not backfill
  `labourItems` from `men`/`days`/`shift` - the fallback in step 4 is what makes that unnecessary,
  and a backfill would freeze today's approximation into the data.
- Do not change `DEFAULT_ROLE_BY_DISCIPLINE` or remove the scalar path. Old items still use it.
- Do not touch the cutting, waste or subcontract pricing legs.
- Do not touch `/sot/`, and nothing outside `scope:`.

## Verification

- [ ] `pnpm --filter api test` green, and `node scripts/data-model/build-relationship-map.mjs --check` passes.
- [ ] **The no-change proof.** Price a real existing item both before and after the change and state
      the two totals. They must be identical. Name the item and give both figures.
- [ ] A two-row item where row 1 is a labourer on Day and row 2 a supervisor on Night prices to the
      sum of the two rows, not to `men x days x default-role-day-rate`. State the three numbers.
- [ ] Custom free-typed plant with a `dayRateOverride` prices at the override, not $0. State it.
- [ ] Item markup: with `markupOverride` set, the item total changes and the card subtotal moves by
      the same amount. Give both figures. With it NULL, the card's markup applies as today.
- [ ] `getCardSummary` reports `peakCrew` from the labour rows. Say what it returned for a two-row
      item and why that is the right number.
- [ ] Migration is reversible on paper: state the two columns added and confirm nothing else changed
      in the generated SQL.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
