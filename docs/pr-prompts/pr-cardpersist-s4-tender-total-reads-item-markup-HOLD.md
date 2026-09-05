---
premise: '! grep -q "resolveEffectiveMarkup" apps/api/src/modules/tendering/scope-redesign.service.ts'
premise_means: >-
  The tender total and the per-discipline buckets resolve markup as
  `card.markupOverride ?? tenderMarkup` and never look at `item.markupOverride`. Once an estimator
  can set a per-item override - which CARD-PERSIST SLICE 3 gives them - the card subtotal on the
  scope screen and the tender bucket on the summary screen will show DIFFERENT numbers for the same
  work. CARD-API SLICE 1 introduced `resolveEffectiveMarkup` as "the single markup-resolution
  expression" and converted one of its two call sites; this is the other one.
scope:
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/__tests__/scope-summary-item-markup.spec.ts
done_when: grep -q "resolveEffectiveMarkup" apps/api/src/modules/tendering/scope-redesign.service.ts
size: 3
gate_allow: none
seed_only: false
escalates: true
backfill: false
cluster: scope-card-persistence
cluster_order: 4
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_ITEM_MARKUP_PERSIST_V1'
rollback_strategy: >-
  One expression in one read-only aggregation, plus a new spec file. No schema, no migration, no
  write path, no route, no DTO, no new dependency. The row already carries `markupOverride` - the
  query is `include: { card: true }` with no `select`, so nothing new is fetched. Revert and the
  tender total goes back to ignoring item overrides.
---

# The tender total ignores an item's markup override, so two screens disagree about the same money

Fourth slice of the persistence cluster. SLICE 3 (`SCOPE_ITEM_MARKUP_PERSIST_V1`) made a per-item
markup override savable; it also measured this gap and named it as a KNOWN GAP in its own PR body
rather than reaching outside its scope to fix it. This slice is that fix.

Measured 2026-09-05 against `origin/main`.

## What is wrong

`scope-redesign.service.ts:931-932`, inside the per-discipline bucket loop:

    const effectiveMarkup =
      item.card?.markupOverride != null ? Number(item.card.markupOverride) : tenderMarkup;

Two links, not three. `item.markupOverride` is never consulted.

Meanwhile `scope-of-works.service.ts:385` - the read behind the scope screen - does consult it,
through the shared resolver:

    const effectiveMarkup = resolveEffectiveMarkup(
      item.markupOverride != null ? Number(item.markupOverride) : null,
      item.card?.markupOverride != null ? Number(item.card.markupOverride) : null,
      tenderMarkup
    );

`resolveEffectiveMarkup` documents itself as the single expression, "so the two cannot drift"
(`scope-item-pricing.ts:358-369`). They have drifted, because only one call site was converted.

## What to build

**1. Call the resolver here too.** Replace the two-link expression with the same three-link call
`listItems` already makes. Import `resolveEffectiveMarkup` from `./scope-item-pricing` - the file
already imports `buildRateMaps` and `computeScopeItemTotal` from there.

**Nothing new needs fetching.** The query at `:870-877` is
`findMany({ where: { tenderId, status: { not: "excluded" } }, include: { card: true, subLineQuotes: … } })`
with no `select`, so every scalar on `ScopeOfWorksItem` is already on the row - `markupOverride`
included. **If you find a `select` there when you look, do not add a field to it silently**: say
`NO-OP: the summary query does not select markupOverride - needs a read slice first` and stop.

**2. Update the comment above it.** `:903` reads
`PR B2 - markup resolves per-card: card.markupOverride ?? tenderMarkup.` That sentence is about to
become false. Rewrite it to name the three-link chain and to say the resolver owns it, the way the
`listItems` note does.

**3. Pin it with a new spec.** `scope-summary-item-markup.spec.ts`. Drive `getScopeSummary` (or
whichever method owns this loop - read it and use the real name) against a hand-rolled Prisma mock,
the way the sibling specs in that folder already do. Assert, at minimum:

- item override `50` under a card on `30` and a tender on `8` -> the bucket uses **50**.
- item override **`0`** under a card on `30` -> the bucket uses **0**, not 30. A stored zero is a
  real override. This is the case `||` would get wrong and `??` gets right, and it is the reason
  the resolver exists.
- item override `null`, card `30` -> **30**. Unchanged behaviour, the regression guard for every
  row written before the column existed.
- item override `null`, card `null`, tender `8` -> **8**.
- **The agreement test that is the point of the slice:** for one seeded item with an override, the
  discipline bucket's `withMarkup` equals the `lineTotalWithMarkup` that `listItems` computes for
  the same item. Compute both in the test rather than asserting a literal, so the assertion is
  "these two agree", not "these two both equal a number I typed".

## Do NOT

- Do not change `resolveEffectiveMarkup` itself, or its argument order. Two call sites depend on it
  and one of them shipped in #1624.
- Do not touch the cutting or waste markup paths (`cuttingMarkupOverride` at `:989`,
  `wasteMarkupOverride` at `:1018`). They are separate cost streams with their own overrides and
  this slice does not have an opinion about them.
- Do not touch the SUB double-count guard (`pricedBySubItemId`), Rule A or Rule B, or the
  provisional buckets. Read the comment block at `:936` before you edit anything near it.
- Do not add a route, a DTO, a schema field, a migration or a dependency.
- Do not touch `apps/web/`. This is an API read-path slice.
- Do not touch `/sot/`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/api test` for `src/modules/tendering` green, with counts before
      and after.
- [ ] Paste the expression before and after, and state that it went from two links to three.
- [ ] State that the summary query needed no change, and quote the `include` that proves
      `markupOverride` was already on the row.
- [ ] Give the four resolution cases as a table: item / card / tender -> markup used, before and
      after. The `0` row is the one to look at hardest.
- [ ] State the agreement figure both ways: the bucket's `withMarkup` and the item's
      `lineTotalWithMarkup`, for the same seeded item with an override, and confirm they match.
- [ ] Grep the diff for a second copy of the markup chain and report zero.
- [ ] `git diff --name-only` lists only the two files in `scope:`.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
