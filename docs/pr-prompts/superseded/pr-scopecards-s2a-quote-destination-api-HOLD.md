---
premise: '! grep -q "QuoteDestination" apps/api/prisma/schema.prisma'
premise_means: An estimating line cannot say where it goes on the client quote. The server has a per-line provisional flag on scope items only, an Other-discipline OR-rule that overrides it, a Rule A that silently zeroes any item linked to a SUB line, and no way for a waste, cutting or operational-cost line to be provisional, a cost option or internal - so the estimating screen and the quote screen use different words for the same money and the tender price is decided by three unrelated switches.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/tendering/dto/scope-of-works.dto.ts
  - apps/api/src/modules/tendering/dto/scope-costs.dto.ts
  - apps/api/src/modules/tendering/scope-of-works.service.ts
  - apps/api/src/modules/tendering/scope-of-works.controller.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/scope-redesign.controller.ts
  - apps/api/src/modules/tendering/scope-waste.controller.ts
  - apps/api/src/modules/tendering/scope-waste.service.ts
  - apps/api/src/modules/tendering/scope-costs.service.ts
  - apps/api/src/modules/tendering/scope/scope-cards.controller.ts
  - apps/api/src/modules/tendering/__tests__/quote-destination.spec.ts
  - apps/api/src/modules/tendering/__tests__/quote-destination-backfill.spec.ts
  - apps/api/src/modules/tendering/__tests__/priced-or-provisional.spec.ts
  - apps/api/src/modules/tendering/__tests__/sub-linked-item.spec.ts
  - apps/api/src/modules/tendering/__tests__/scope-item-labour-store.spec.ts
  - apps/api/src/modules/tendering/__tests__/scope-costs.service.spec.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.spec.ts
  - apps/api/src/modules/estimate-export/excel/estimate-excel.builder.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/api test -- quote-destination priced-or-provisional sub-linked-item scope-item-labour-store scope-costs summary-section-markup operational-costs-priced estimate-export && grep -q "SCOPE_QUOTE_DESTINATION_V1" apps/api/src/modules/tendering/scope-redesign.service.ts && grep -q "enum QuoteDestination" apps/api/prisma/schema.prisma && grep -q "optionsTotal" apps/api/src/modules/tendering/scope-redesign.service.ts && test "$(grep -c 'Rule A' apps/api/src/modules/tendering/scope-redesign.service.ts)" = "0" && test "$(grep -c 'isProvisional' apps/api/src/modules/tendering/scope-redesign.service.ts)" = "0" && test -f docs/data-model/relationship-map.json && node scripts/data-model/build-relationship-map.mjs --check
size: 6
gate_allow: migrations
seed_only: false
escalates: true
backfill: true
rollback_strategy: Two migrations. The first is additive (one enum, one NOT NULL column with DEFAULT 'PRICE' on four tables) and safe to leave on main. The second is UPDATE-only, idempotent, and derives every value from columns that are kept (is_provisional, priced_by_sub_item_id, scope_cards.discipline) - re-running it changes nothing, and it never touches a row already moved off PRICE. To revert, drop the four quote_destination columns and the enum; the legacy columns still hold what they held. No column is dropped in this slice.
module: tendering
cluster: scopecards
cluster_order: 2
requires_on_main: 'apps/api/src/modules/tendering/scope-redesign.service.ts :: SCOPE_OPERATIONAL_COSTS_PRICED_V1'
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
---

# Scope Cards S2a - where a line goes: one destination, four values (API + migration)

**Second of nine**, one merging chain (`docs/plans/scope-cards-reconciliation-plan.md`, section 3),
split at the API/web seam the way S6 and S9 were: **S2a** is the column, the migration, the four
DTOs, the summary and the programme figures; **S2b** is the screen (the destination select on every
row, the coloured rail, the note under the total, the three-way header, Opt A/B/C, the link offer)
and arms only when this slice's marker is on `main`. The Discipline Cards mock-up (`design_ref`,
v26) is the standard; its `dest()` / `inTotal()` / `inProgramme()` helpers and the `WHERE A LINE
GOES` comment block are the logic this slice implements on the server.

> Marco, 2026-09-10: *Every estimating line carries **one destination**, using the quote screen's
> own four words: In the price (a cost line), Provisional (an allowance under the total), Cost option
> (an alternative beside it), Internal only (never crosses to the quote). Nothing is auto-zeroed when
> work is subcontracted.*
> Marco, 2026-09-11: *Internal only leaves the money AND the programme - its crew, plant and duration
> drop out of card and discipline figures. One meaning per control.*

## Grounded on origin/main 6a37f12a, 2026-09-15 - re-verify line numbers before you edit

- **Three switches decide the money today, and none of them is a destination.**
  `scope-redesign.service.ts:864-1085 summary()`: **Rule A** (`:953-966`) - an item with
  `pricedBySubItemId` set contributes `lineTotal: 0` to its bucket; **Rule B** (`:967-972`) - a SUB
  line prices at its selected quote or zero; the **provisional predicate** (`:982-992`) -
  `item.isProvisional === true || itemDiscipline === "Other"` sends a line to
  `provisionalSubtotal / provisionalWithMarkup` instead of `subtotal / withMarkup`.
  `tenderPrice` (`:1066`, after S1: four independently-marked-up streams) sums the priced side;
  `provisionalTotal` (`:1060`) sums the provisional side across disciplines. Cutting (`:1000-1020`)
  and waste (`:1022-1054`) are aggregated per card with no notion of provisional at all - a waste
  allowance cannot be an allowance.
- **The flag exists on one table only.** `ScopeOfWorksItem.isProvisional` (`schema.prisma:3719-3727`,
  comment: *"line is provisional if isProvisional === true OR discipline === 'Other'"*), written by
  `ScopeItemFieldsBase.isProvisional` (`dto/scope-of-works.dto.ts:128-131`) and read by the
  predicate above, by `estimate-excel.builder.ts:130-142` (through `summary.provisionalTotal`) and
  by the web (`DisciplineSummaryBar.tsx:84`, `ScopeCardsTab.tsx:338` - S2b's problem). Nothing on
  the web writes it. `EstimateItem.isProvisional` (`schema.prisma:2742`) is a **different table**
  (the estimates module, proposals, the AI tool, the project snapshot) and is **not** in this slice.
  `ScopeWasteItem` (`:3810`), `CuttingSheetItem` (`:4144`) and `ScopeOperationalCostLine` (`:3933`)
  carry no such column.
- **Linking is a zeroing switch.** `POST /tenders/:tenderId/scope/items/:itemId/sub-link`
  (`scope/scope-cards.controller.ts:51-67`, `LinkToSubLineDto` at `dto/scope-of-works.dto.ts:410`)
  sets `pricedBySubItemId` (`scope-redesign.service.ts:1279`); Rule A then zeroes the item. The
  controller doc (`:56`) and `sub-linked-item.spec.ts:195-240` pin that behaviour. The mock-up's
  STATE 2 comment says the opposite: *"the quote no longer zeroes this line. Both stand."*
- **The programme ignores nothing but `excluded`.** `getCardSummary`
  (`scope-of-works.service.ts:1204-1255`) reads `scopeItems where status != "excluded"` and derives
  `peakCrew` / `labourDays` / `plantSummary` / `duration` over all of them; the web folds cards into
  disciplines in `utils/discipline-rollup.ts` (pure arithmetic over what this endpoint returns), so
  a card-level exclusion propagates to the discipline without web changes.
- **`status: "excluded"` is the AI-proposal rejection state**, not a destination: `STATUSES`
  (`dto/scope-of-works.dto.ts:51`), `excludeItem` (`scope-of-works.service.ts:587-596`), the route
  (`scope-of-works.controller.ts:197-208`, *"Exclude an AI-proposed scope item"*), the drawer
  (`ScopeQuantitiesTable.tsx:2837-2838, 3624-3632`). This slice does **not** touch it - see Do NOT.
- **Migration precedents.** A backfill that runs as its own UPDATE-only migration and is
  re-executed by a spec against the real test database: `projects/__tests__/bp0a2-backfill.spec.ts`
  (`loadStatements()` + `$transaction($executeRawUnsafe)`, serial suite) over
  `20260703071228_bp0a2_backfill_job_attributes`. Enum style: `enum TenderPricingBasis`
  (`schema.prisma:1454`). Latest folder `20260914063000_ea2a_estimating_analytics_preset` (or
  whatever S1 added after it).

## The model (the mock-up's, on the server)

```
PRICE       -> QuoteCostLine          in the tender price
PROVISIONAL -> QuoteProvisionalLine   priced, printed under the total
OPTION      -> QuoteCostOption        priced, printed beside the total
INTERNAL    -> nothing crosses        priced on the card only; leaves the programme too
```

Every line prices whatever its destination. The destination only decides where the money lands.
One column, four line types, default `PRICE`.

## Build this

### 1. Schema - `schema.prisma`

```prisma
enum QuoteDestination {
  PRICE
  PROVISIONAL
  OPTION
  INTERNAL
}
```

`quoteDestination QuoteDestination @default(PRICE) @map("quote_destination")` on **all four**:
`ScopeOfWorksItem`, `ScopeWasteItem`, `CuttingSheetItem`, `ScopeOperationalCostLine`. Add
`@@index([tenderId, quoteDestination])` on `ScopeOfWorksItem` only (the summary query filters it).
Mark `ScopeOfWorksItem.isProvisional` `@deprecated` in a comment the way `unit` / `value` are at
`:3593-3596` - *"read by nothing after SCOPE_QUOTE_DESTINATION_V1; a cleanup PR drops it"*. **Do not
drop it here.** Regenerate `docs/data-model/` (`node scripts/data-model/build-relationship-map.mjs`).

### 2. Two migrations, in this order

**`<ts>_scopecards_s2a_quote_destination`** - DDL only: `CREATE TYPE "QuoteDestination"`, four
`ALTER TABLE ... ADD COLUMN "quote_destination" "QuoteDestination" NOT NULL DEFAULT 'PRICE'`, the
index. Additive; nothing else.

**`<ts>_scopecards_s2a_quote_destination_backfill`** - UPDATE only, idempotent, `scope_of_works_items`
only, every statement guarded by `AND quote_destination = 'PRICE'` so a re-run moves nothing twice:

```sql
-- 1. the flag becomes the destination
UPDATE scope_of_works_items SET quote_destination = 'PROVISIONAL'
 WHERE is_provisional = true AND quote_destination = 'PRICE';
-- 2. the Other OR-rule becomes data, once, so the code can stop carrying it
UPDATE scope_of_works_items i SET quote_destination = 'PROVISIONAL'
  FROM scope_cards c
 WHERE c.id = i.card_id AND c.discipline = 'Other' AND i.quote_destination = 'PRICE';
-- 3. Rule A becomes data: a covered item was zero yesterday, so it is INTERNAL today
UPDATE scope_of_works_items SET quote_destination = 'INTERNAL'
 WHERE priced_by_sub_item_id IS NOT NULL AND quote_destination = 'PRICE';
```

Statement 3 is why an existing tender reads **identically to the cent** after this slice: the
money Rule A zeroed is now money INTERNAL leaves out. Without it every linked tender's price would
rise on merge. Waste, cutting and operational-cost rows need no backfill - they were all priced
into the total yesterday and `PRICE` is the default.

### 3. DTOs - four line types accept `quoteDestination`

`quoteDestination?: QuoteDestination` (`@IsOptional() @IsEnum(QuoteDestination)`), on:
`ScopeItemFieldsBase` (`dto/scope-of-works.dto.ts`, next to `isProvisional`), the waste create /
update DTOs in `scope-waste.controller.ts`, the cutting create / update DTOs in
`scope-redesign.controller.ts`, and `UpsertOperationalCostLineDto` (`dto/scope-costs.dto.ts`).
`isProvisional` stays on the scope-item DTO as a **deprecated alias**: when a request carries
`isProvisional: true` and no `quoteDestination`, the service writes `PROVISIONAL`; when it carries
`quoteDestination`, `isProvisional` is ignored. Every list / create / update response returns
`quoteDestination`. Create defaults: scope item `dto.quoteDestination ?? (discipline === "Other" ?
PROVISIONAL : PRICE)` in both `createItem` (`scope-of-works.service.ts:416-431`) and
`createItemInCard` (`:1522-1545`) - that is the OR-rule, applied once at birth, and the only place
the word `Other` still decides anything; the other three types default to `PRICE`.

### 4. `summary()` - `scope-redesign.service.ts`

`export const SCOPE_QUOTE_DESTINATION_V1 = "scopecards-s2a"`. Then:

- **Delete Rule A** (`:953-966` and its comment). A covered item prices its labour and plant like
  any other; `pricedBySubItemId` survives as a link the screen renders. Rule B stays as is.
- **Delete the provisional predicate** (`:982-992`). The word `isProvisional` and the string
  `"Other"` no longer occur in `summary()`. The line's `quoteDestination` picks its bucket.
- Each discipline bucket becomes `{ itemCount, subtotal, withMarkup, provisionalSubtotal,
  provisionalWithMarkup, optionSubtotal, optionWithMarkup, internalSubtotal, internalWithMarkup }`.
  `itemCount` counts every non-excluded line as today. `internal*` is **reported and summed into
  nothing** - it exists so the card can show the struck-through figure the mock-up draws.
- **Cutting, waste and operational costs split the same four ways.** Keep the per-card marked-up
  buckets exactly as they are (`card.<section>MarkupOverride ?? tenderMarkup`), but keep one bucket
  per `(cardId, quoteDestination)`. Each stream returns `{ itemCount, subtotal, withMarkup,
  provisional: { subtotal, withMarkup }, option: { subtotal, withMarkup }, internal: { subtotal,
  withMarkup } }` where the top-level pair is the PRICE side (so every existing reader of
  `cutting.withMarkup` / `waste.withMarkup` / `operationalCosts.withMarkup` keeps meaning "in the
  price"). `waste.byDiscipline` stays PRICE-only.
- Totals, all 2 dp:
  `tenderPrice` = the four streams' PRICE `withMarkup` (the S1 line, unchanged in shape);
  `provisionalTotal` = the four streams' PROVISIONAL `withMarkup` (today it is scope-only; the
  other three contribute 0 until someone sets a line);
  **new** `optionsTotal` = the four streams' OPTION `withMarkup`;
  **new** `internalTotal` = the four streams' INTERNAL `withMarkup`.
  Never fold a bare subtotal into any of them.

### 5. The programme - `getCardSummary` (`scope-of-works.service.ts:1204`)

Add `quoteDestination: { not: "INTERNAL" }` to the `scopeItems` where clause, so `peakCrew`,
`labourDays`, `plantSummary` and `duration` are computed over lines whose work is ours. Return
`computed.internalLinesLeftOut: number` (a second count query, or select the column and count in
the loop) - the mock-up's header chip *"−N internal only"*. The discipline roll-up on the web is
pure arithmetic over this envelope, so the discipline figure follows without a web change; S2b
sums the counts for its own chip.

### 6. The link offers, it does not decide - `scope/scope-cards.controller.ts`

`LinkToSubLineDto` gains `setInternal?: boolean` (default `false`). When `true`, the same write that
sets `pricedBySubItemId` also sets `quoteDestination = INTERNAL` on the covered item. Unlink never
changes the destination - the estimator decides. Rewrite the controller docs at `:56` and `:74`:
linking no longer zeroes anything.

### 7. The export carries it - `estimate-export.*`

`scopeItems[]` in the payload gain `quoteDestination`; the `summary` the payload embeds is the new
shape. `estimate-excel.builder.ts`: after the *Provisional / Other* row (`:154-160`, driven by
`summary.provisionalTotal`, unchanged), a *Cost options* row - *"Alternatives priced beside the
tender price (not in tender price)"* - when `optionsTotal > 0`; INTERNAL scope rows print with
*internal only* in the Notes column and are not summed anywhere. Nothing changes for a tender with
every line in the price.

### 8. Tests

- **`quote-destination-backfill.spec.ts`** - the harness of `bp0a2-backfill.spec.ts`, over the
  second migration: seed a card of discipline `DEM` and a card of discipline `Other`; rows (a) plain,
  (b) `is_provisional = true`, (c) on the Other card, (d) `priced_by_sub_item_id` set, (e) already
  `OPTION`; run; assert (a) `PRICE`, (b) `PROVISIONAL`, (c) `PROVISIONAL`, (d) `INTERNAL`, (e) still
  `OPTION`; run again; assert nothing moved (idempotent).
- **`quote-destination.spec.ts`** (the style of `priced-or-provisional.spec.ts`, mocked prisma):
  the spec's acceptance - a card with a $48,000 SUB line (selected quote) and $41,000 of in-house
  lines shows `tenderPrice` **89,000** with everything `PRICE` and **48,000** with the in-house
  lines `INTERNAL`, and `internalTotal` is 41,000 in the second case; a covered item
  (`pricedBySubItemId` set) with destination `PRICE` prices normally - Rule A is gone; flipping one
  line `PRICE -> OPTION` moves `tenderPrice` by exactly that line and `optionsTotal` by the same;
  a `PROVISIONAL` waste line lands in `provisionalTotal` and not in `waste.withMarkup`; an
  `OPTION` cutting line and an `INTERNAL` operational-cost line each land in their own figure only;
  the four streams' PRICE sides are byte-identical to S1's figures when every line is `PRICE`.
- **Rewrite `priced-or-provisional.spec.ts`**: the three cases become destination cases (case 2's
  *"Other with the flag false is still provisional"* becomes *"an Other-card item created without a
  destination is born PROVISIONAL"*, tested on `createItemInCard`).
- **Rewrite `sub-linked-item.spec.ts`**: the Rule A cases invert (`:195-240`); add
  `setInternal: true` on link writes `INTERNAL`, unlink leaves it.
- **`scope-item-labour-store.spec.ts`**: `getCardSummary` with one `INTERNAL` item - its crew and
  person-days are absent, `internalLinesLeftOut` is 1; with none, the figures are unchanged.
- **`scope-costs.service.spec.ts`**: `quoteDestination` round-trips on create / update / list.
- **`estimate-export.service.spec.ts`**: the *Cost options* row is present exactly when
  `optionsTotal > 0`.

## Do NOT

- Do NOT drop `is_provisional`, and do NOT touch `EstimateItem.isProvisional` or anything under
  `modules/estimates`, `ai-providers` or `projects` - different table, different slice.
- Do NOT touch `status: "excluded"`, `excludeItem`, the exclude route or the drawer. Excluded rows
  are rejected AI proposals, not our working; S2b decides what the drawer becomes.
- Do NOT put a destination on the web. No `.tsx` in scope. The screen still reads
  `provisionalSubtotal` / `provisionalWithMarkup` and `isProvisional` today and keeps working
  because those fields keep their meaning; S2b moves it to the column.
- Do NOT zero anything on link, and do NOT set `INTERNAL` unless `setInternal` was sent.
- Do NOT fold `optionsTotal` or `internalTotal` into `tenderPrice` or `provisionalTotal`.
- Do NOT touch quote code (`client-quotes`, `QuoteCostLine*`) - S4 reads this column; nothing
  writes to the quote here.
- Do NOT touch `TenderEstimate.markup`, `resolveEffectiveMarkup`, the SUB tab, or `/sot/`.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/api test -- quote-destination priced-or-provisional sub-linked-item scope-item-labour-store scope-costs summary-section-markup operational-costs-priced estimate-export
pnpm build && pnpm lint
node scripts/data-model/build-relationship-map.mjs --check
ls apps/api/prisma/migrations | grep -c "scopecards_s2a_quote_destination"          # exactly 2
grep -c "UPDATE" apps/api/prisma/migrations/*scopecards_s2a_quote_destination/migration.sql            # 0
grep -c "UPDATE" apps/api/prisma/migrations/*scopecards_s2a_quote_destination_backfill/migration.sql   # 3
grep -n "Rule A\|isProvisional\|\"Other\"" apps/api/src/modules/tendering/scope-redesign.service.ts    # must be empty
grep -n "SCOPE_QUOTE_DESTINATION_V1\|optionsTotal\|internalTotal" apps/api/src/modules/tendering/scope-redesign.service.ts
```

PR body: `GATE-ALLOW: migrations` bare at column 0; quote both migration SQL files, the
`tenderPrice` / `provisionalTotal` / `optionsTotal` / `internalTotal` lines, the 89,000 / 48,000
test, and the backfill spec's five-row table with before / after destinations.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Never ask a question or "stand by" for approval. A dismissed or unanswered question is the
  absence of a human, not a stop signal. Proceed on best judgement and record the assumption in
  the PR body.
- `escalates: true` - a schema change on four tables with a data backfill that decides where every
  existing line's money lands. Marco merges, not automation.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR; this section is never a reason to wait. Second
of the `scopecards` chain; dispatches once `SCOPE_OPERATIONAL_COSTS_PRICED_V1` (S1) is on `main`.
S2b is authored once `SCOPE_QUOTE_DESTINATION_V1` is on `main`.
