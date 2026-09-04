---
premise: '! grep -q "SCOPE_ITEM_MARKUP_PERSIST_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: >-
  The per-item Markup % cell writes to a local Map and calls no server handler, while the Item
  total beside it renders the server's `lineTotalWithMarkup`. Typing a markup therefore paints the
  cell amber and moves no money at all - not the item total, not the card subtotal, not the tender
  total - and the override is gone on the next load.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-item-markup-persist.test.tsx
done_when: pnpm build && pnpm lint && grep -q "SCOPE_ITEM_MARKUP_PERSIST_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 5
gate_allow: none
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: scope-card-persistence
cluster_order: 3
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_PLANT_PERSIST_V1'
rollback_strategy: >-
  Web-only, one component plus one test. No API, no schema, no migration. Revert and the Markup
  cell goes back to the local-state behaviour it has today.
---

# The item markup override paints a cell and moves no money

Third slice of the persistence cluster. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

Measured 2026-09-04 against `origin/main`. In `ScopeQuantitiesTable.tsx` the Markup % input calls
`setItemMarkup` (:1230, :1233) and the revert control calls it too (:1209); `setItemMarkup` (:517)
writes to the `itemMarkupOverrides` local Map (:480) and there is no `patchItem` on the path. The
`<OverrideField>` around the input paints `var(--surface-override)` once `isOverridden` is true, so
the cell changes colour immediately. The Item total cell three columns along renders
`item.lineTotalWithMarkup` (:1266-1268), which is computed on the server. The estimator types 22,
the cell goes amber, and every figure on the screen stays exactly where it was.

Nothing downstream saves it either: the card subtotal and the discipline summary bar both sum the
server's `lineTotal` / `lineTotalWithMarkup` (`computeCardBarStats` in `DisciplineSummaryBar.tsx`,
and the footer sums at :815-825), and the tender bucket loop in
`apps/api/src/modules/tendering/scope-redesign.service.ts` does the same. **The override must
persist and it must move all three: the item total, the card subtotal and the tender total.** One
number, written once, read by every consumer - not a fourth place that computes markup on its own.

**This is not the same job as `pr-cardfix-s2`.** That slice passes `cardMarkup` down from
`ScopeCardsTab` to this table, which today renders it without the prop
(`ScopeCardsTab.tsx`:396-402) so the default `cardMarkup = 0` (:453) applies and every row claims
it is inheriting 0%. **Inheriting the right number and storing an override are two different
jobs**: `pr-cardfix-s2` fixes what the cell *says* it inherits; this slice makes what the estimator
*types* survive and count. Do not do the other one's work, and do not assume the other one has
landed - read the prop, whatever it currently is.

## What to build

**0. Establish whether the API can hold a per-item markup, before you touch the component.** Here
is the audit as measured on 2026-09-04; re-run it, because it decides whether this PR exists.

- `ScopeOfWorksItem` in `apps/api/prisma/schema.prisma` has **no markup column.** `ScopeCard` has
  `markupOverride`, `wasteMarkupOverride` and `cuttingMarkupOverride`; the item has none.
- `ScopeItemFieldsBase` in `dto/scope-of-works.dto.ts` has **no markup field**, so a
  `patchItem(item.id, { markupOverride: n })` would be dropped by validation and would write
  nothing even if a column existed.
- Both readers resolve markup the same way and neither looks at the item:
  `ScopeOfWorksService.listItems` uses `item.card?.markupOverride != null ? ... : tenderMarkup`
  before calling `computeScopeItemTotal`, and the `/scope/summary` bucket loop in
  `scope-redesign.service.ts` repeats that resolution line for line. `computeScopeItemTotal` itself
  takes `markupPercent` as a parameter - it does not read the item.
- `EstimateItem.markup` exists, but it is not this row. It belongs to the downstream estimate table,
  is created only by a draft-to-confirmed transition, and a manually added scope item is born
  `status: "confirmed"` and never gets one. `computeScopeItemTotal` never reads it.

**1a. If a per-item markup store IS on `main` when you run** - an API slice landed ahead of this
one - then this is a web slice. Send the override through `patchItem` on change and on revert, the
way `description` (:1115) and `notes` (:1124) already go, let `onItemsChanged()` reconcile, and
render the effective percent from the server's answer rather than from the local Map. Clearing the
input must write `null` (inherit), not `0` - those are different numbers and only one of them is
what the estimator meant. Mark the component with `SCOPE_ITEM_MARKUP_PERSIST_V1`.

**1b. If it is not** - which is what was true on 2026-09-04 - **stop.** Say, on one line:

`NO-OP: no per-item markup store on ScopeOfWorksItem - needs an API slice first`

and then state what that API slice has to add: a nullable `markupOverride Decimal? @db.Decimal(5, 2)`
on `scope_of_works_items` (null = inherit the card, exactly as `ScopeCard.markupOverride` means
null = inherit the tender); the matching optional field on `ScopeItemFieldsBase`; and one shared
resolver - `item.markupOverride ?? card.markupOverride ?? tenderEstimate.markup ?? 30` - used by
**both** `listItems` and the `/scope/summary` bucket loop, because a markup that moves the row but
not the tender is a worse bug than one that moves nothing.

An override that colours a cell and changes no total is a lie told in the estimator's own
handwriting. Do not ship a half of it.

## Do NOT

- **Do not add, change or remove any API route, service method, DTO field, schema field or
  migration.** No schema change is expected from this slice and `gate_allow` is `none`. If you find
  yourself editing anything under `apps/api/`, you are in 1b: stop and NO-OP.
- **Do not compute the item total in the browser.** The Item total cell reads the server's
  `lineTotalWithMarkup`, and the card subtotal and summary bar sum the server's per-row figures. A
  client-side markup multiplication would make the three disagree with the tender.
- **Do not pass `cardMarkup` down from `ScopeCardsTab`** and do not change the placeholder, the
  title text or the `Card: N%` hint under the input. That is `pr-cardfix-s2`, in the corrections
  cluster.
- **Do not touch the Manpower or Plant column groups** - `pr-cardpersist-s1` and
  `pr-cardpersist-s2` own them, including the legacy plant cluster.
- Do not touch the Measurement column or the Actions column - `pr-cardui-s5` owns both.
- Do not change presentation: no column order, no group rules, no money formatting. The corrections
  cluster owns all of it.
- Do not touch `/sot/`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] Type a markup on one item, reload the page, and **state whether the override survived and
      what the cell reads after the reload.**
- [ ] Give the Item total, the card subtotal and the discipline summary bar figure before and after
      the override, all three, and say by how much each moved. If any of the three did not move,
      say which and why.
- [ ] Clear the override and state what the item total returns to, and whether the row went back to
      inheriting or to 0%.
- [ ] Confirm the tender-level figure from `/scope/summary` agrees with the card subtotal after the
      override. Give both numbers.
- [ ] If you took the NO-OP: name the missing column, the missing DTO field and both resolver call
      sites explicitly, and confirm you changed no file.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco.
