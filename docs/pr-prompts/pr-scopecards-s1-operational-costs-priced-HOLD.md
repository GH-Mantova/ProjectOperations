---
premise: '! grep -q "operationalCosts" apps/api/src/modules/tendering/scope-redesign.service.ts'
premise_means: An "Other operational costs" line on a scope card is stored and shown but never priced - the server's tender price is scope + cutting + waste and does not read the table, the web card total adds the section at cost with no markup, the line total ignores the duration the estimator typed, and the internal estimate export does not carry the section - so a card with 2 traffic controllers for 10 days at $850 shows $1,700 on the card and $0 in the tender price.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/tendering/dto/scope-costs.dto.ts
  - apps/api/src/modules/tendering/scope-costs.service.ts
  - apps/api/src/modules/tendering/scope-costs.controller.ts
  - apps/api/src/modules/tendering/scope-item-pricing.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/__tests__/scope-costs.service.spec.ts
  - apps/api/src/modules/tendering/__tests__/operational-costs-priced.spec.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.ts
  - apps/api/src/modules/estimate-export/estimate-export.service.spec.ts
  - apps/api/src/modules/estimate-export/excel/estimate-excel.builder.ts
  - apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/other-operational-costs.test.tsx
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/api test -- operational-costs-priced scope-costs summary-section-markup estimate-export && pnpm --filter @project-ops/web test -- other-operational-costs cutting-section waste-section sub-tab rates-gate && grep -q "SCOPE_OPERATIONAL_COSTS_PRICED_V1" apps/api/src/modules/tendering/scope-redesign.service.ts && grep -q "operationalCosts" apps/api/src/modules/tendering/scope-redesign.service.ts && grep -q "wbsRef" apps/api/prisma/schema.prisma && test -f docs/data-model/relationship-map.json && node scripts/data-model/build-relationship-map.mjs --check
size: 7
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: Additive only - four nullable columns on scope_operational_cost_lines (wbs_ref, source_ref, markup_override, notes), no UPDATE ... SET, no default backfill. Safe to leave on main if the run is capped before the code lands; re-running drops nothing. To revert, remove the four fields from ScopeOperationalCostLine and drop the migration. The pricing change itself is code, not data - reverting the code restores today's totals.
module: tendering
cluster: scopecards
cluster_order: 1
requires_on_main: 'docs/plans/scope-cards-reconciliation-plan.md :: S1 -> S2 -> S3 -> S4 -> S5 -> S6 -> S7 -> S8 -> S9'
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
---

# Scope Cards S1 - operational costs become money

**First of nine**, one merging chain (`docs/plans/scope-cards-reconciliation-plan.md`, section 3).
The Discipline Cards mock-up (`design_ref`, v26) is the standard; the plan's S1 row is the contract.
S2 arms only when this slice's marker is on `main`.

> Marco, 2026-09-10: *Other operational costs (permits, traffic control, scaffolding) must count
> toward the tender price, and their `days` field must multiply into the line total.*

## Grounded on origin/main 4ea0c1b6, 2026-09-15 - re-verify line numbers before you edit

- **The section exists and persists** (`SCOPE_OTHER_COSTS_V1`, PR #1665 API + cardui-s6 web).
  `ScopeOperationalCostLine` (`schema.prisma:3933-3980`): `description`, `qty Decimal(10,3)`,
  `unit String?`, `days Decimal(8,2)` (pinned to 1 for a non-duration unit - the DTO enforces it,
  `dto/scope-costs.dto.ts:37-84`, `DURATION_BEARING_UNITS` default-deny), `rate`, `rateOverride`
  (a stored 0 is a real value), `plantRateId`, `sortOrder`. Routes at
  `tenders/:tenderId/scope/cards/:cardId/operational-costs` (`scope-costs.controller.ts:25`);
  the controller's own doc says *"No total is returned or stored. The line total is
  `qty x (rateOverride ?? rate)`."*
- **The server never prices it.** `ScopeRedesignService.summary()` (`scope-redesign.service.ts:864-1085`)
  builds three independently-marked-up streams and sums them:
  `tenderPrice = scopeWithMarkupTotal + cuttingWithMarkup + wasteWithMarkup` (`:1066`, the comment
  above it: *"Never fold a bare subtotal in - that was the bug the invariant guards"*). Waste is the
  pattern to copy: per-card buckets with `card.wasteMarkupOverride ?? tenderMarkup` (`:1027-1054`).
  Scope items resolve markup through `resolveEffectiveMarkup(item, card, tender)` in
  `scope-item-pricing.ts` (`:906-943`). The string `operationalCosts` does not occur in the file.
- **The web prices it wrong twice.** `OtherOperationalCosts.tsx:177-186` `operationalLineTotal` is
  `qty x (rateOverride ?? rate)` - *"Days is deliberately NOT a factor"* (`:172`), quoting the
  controller. `sumOperationalLines` (`:196`) reports one figure upward through
  `onSectionTotalChange` (`:765-770`); `ScopeCardsTab.tsx:334-352` folds it into **both**
  `subtotal` and `subtotalWithMarkup` at cost (`:320-324`: *"There is no markup field on
  ScopeOperationalCostLine and this slice may not add one"*). So today the card header and the
  discipline bar include the section unmarked while `tenderPrice` excludes it entirely - the
  screen and the server disagree on every card that has one of these lines.
- **The export does not carry it.** `estimate-export.service.ts:291` reads `summary()`; the payload
  has `scopeItems` and `cuttingItems` (`:155-160`, `:458-459`) and nothing operational;
  `estimate-excel.builder.ts:119-126` writes a Summary row for cutting and adds it to `grandTotal`.
- **Tests that pin today:** `summary-section-markup.spec.ts` (waste and cutting are independent
  streams, tender-markup fallback, no cross-fold - keep green; it does not assert the absence of a
  fourth stream), `scope-costs.service.spec.ts`, `estimate-export.service.spec.ts`,
  `other-operational-costs.test.tsx` (`:161-169` pin `daysForUnit`; it also mirrors the API's
  `DURATION_BEARING_UNITS` off disk - keep that mirror), and `cutting-section` / `waste-section` /
  `sub-tab` / `rates-gate` which import the section.
- **ScopeCard markup fields** (`schema.prisma:3506-3516`): `markupOverride` (card), plus per-section
  `wasteMarkupOverride` / `cuttingMarkupOverride`. Operational costs use the **card** markup - the
  mock-up's `cardMk(card)` - not a fourth per-section override.
- **The mock-up's section** (`otherSection()` in the artifact): columns *Goes to* (S2, not here) ·
  *From* · *Item description* · *Source* · *Qty* · *Duration* · *Duration period* · *Rate* ·
  *Markup* · *Total*; line total `qty x duration x rate`, marked-up total `x (1 + (line.markup ??
  card.markup)/100)`; header shows *subtotal* and *+ N% markup* figures; a per-line *Comment*
  expander (*"carries to the card summary"*); *From* is a select over the card's WBS codes
  (`wbsCodes(card)`: the card code and each item's code). Latest migration folder:
  `20260914063000_ea2a_estimating_analytics_preset`.

## What to build

### 1. Four columns - `schema.prisma` + migration + data-model map

On `ScopeOperationalCostLine`, beside `plantRateId`:

```prisma
// Scope Cards S1. The WBS code this cost hangs off ("DEM1.2") - the mock-up's From column,
// stored as the code string the card printed when it was picked.
wbsRef         String?  @map("wbs_ref")
// Where the figure came from - free text, a URL, or a document reference. Mock-up's Source column.
sourceRef      String?  @map("source_ref")
// Per-line markup, same null-means-inherit semantics as ScopeOfWorksItem.markupOverride:
//   line.markupOverride ?? card.markupOverride ?? tenderEstimate.markup
markupOverride Decimal? @map("markup_override") @db.Decimal(5, 2)
// The mock-up's per-line comment.
notes          String?
```

`npx prisma migrate dev --name scopecards_s1_operational_cost_columns --create-only`; the SQL is
one `ALTER TABLE "scope_operational_cost_lines"` adding four nullable columns - nothing else. Then
`node scripts/data-model/build-relationship-map.mjs` and commit `docs/data-model/`. `GATE-ALLOW:
migrations` bare at column 0 in the PR body.

### 2. One formula, on the server - `scope-item-pricing.ts` + `scope-costs.*`

- `computeOperationalLineTotal(line)` beside `resolveEffectiveMarkup`:
  `qty x days x (rateOverride ?? rate)` where `days` is `1` when the unit is not duration-bearing
  (reuse the DTO's `isDurationBearingUnit`; never trust the stored value alone), and the result is
  `0` when `qty` or the resolved rate is null. Export it; it is the only place the formula lives.
- `computeOperationalLineMarkup(line, card, tenderMarkup)` =
  `line.markupOverride ?? card.markupOverride ?? tenderMarkup` (the scope-item chain; a stored `0`
  is a real override).
- **The list endpoint returns the money.** `list()` / `create()` / `update()` responses gain
  `lineTotal`, `effectiveMarkup` and `lineTotalWithMarkup` (numbers, 2 dp), computed server-side
  from the line, its card and the tender's markup - the same arrangement the cutting sheet uses
  (*"the section reports the total of the server's OWN line totals; it prices nothing itself"*).
  DTO accepts the four new fields (`wbsRef`, `sourceRef`: string | null; `markupOverride`: number |
  null; `notes`: string | null). Rewrite the controller doc that says no total is returned.

### 3. The fourth stream - `scope-redesign.service.ts`

`export const SCOPE_OPERATIONAL_COSTS_PRICED_V1 = "scopecards-s1"`. In `summary()`:

- read the tender's operational-cost lines with their card (`card: { select: { markupOverride } }`),
  compute each line's total and markup through the two helpers above, and build
  `operationalCosts: { itemCount, subtotal, withMarkup, byCard: { [cardId]: { subtotal,
  withMarkup } } }` (2 dp, like `cutting` / `waste`);
- `tenderPrice = scopeWithMarkupTotal + cuttingWithMarkup + wasteWithMarkup +
  operationalWithMarkup` - a **fourth independent stream**, never a bare subtotal;
- `provisionalTotal` is untouched (these lines have no provisional flag until S2).

### 4. The card and the bar agree with the server - `OtherOperationalCosts.tsx` + `ScopeCardsTab.tsx`

- The section **stops pricing**: delete `operationalLineTotal` / `sumOperationalLines`' arithmetic
  and read `lineTotal` / `lineTotalWithMarkup` off the rows the API returns. It reports **two**
  figures upward - `onSectionTotalChange(cardId, { subtotal, withMarkup })` - and `ScopeCardsTab`'s
  fold (`:334-352`) adds `subtotal` to `subtotal` and `withMarkup` to `subtotalWithMarkup`. Rewrite
  the `:320-324` comment: the section now carries its own markup, server-computed.
- Columns become the mock-up's, in its order: **From** (a `<select>` over the codes the WBS table
  above prints for this card - the card code and each item's code - stored as text in `wbsRef`),
  **Item description**, **Source** (text input; when the value is a URL show the mock-up's `↗`
  link beside it - no document picker in this slice), **Qty**, **Duration** (the existing `days`
  input, still pinned and greyed for a non-duration unit), **Duration period** (the existing `unit`
  control), **Rate** (existing, with override), **Markup** (the scope-item MARKUP affordance: dashed
  when inherited showing the card's percentage as placeholder, amber fill when overridden, a `↺`
  revert pip), **Total** (bold marked-up figure; when a markup applies, the small `base + N%` line
  under it as drawn). Section header: *subtotal* and *+ N% markup* figures, as drawn.
- A per-line **comment** expander (the mock-up's `+ Add comment` / `✓ Comment`) writing `notes`.
- Keep `daysForUnit` and the `DURATION_BEARING_UNITS` mirror exactly as they are.

### 5. The export carries it - `estimate-export.*`

Payload gains `operationalCosts: Array<{ cardId, cardCode, wbsRef, description, sourceRef, qty,
unit, days, rate, effectiveMarkup, lineTotal, lineTotalWithMarkup }>` and `summary.operationalCosts`.
`estimate-excel.builder.ts`: a Summary row *Operational costs* (like the Cutting row at `:119-126`,
added to `grandTotal`) and a fourth sheet *Operational Costs* with one row per line.

### 6. Tests

- `operational-costs-priced.spec.ts` (the style of `summary-section-markup.spec.ts`): a line of
  `qty 2 x days 10 x rate 850` totals **17,000.00**, not 1,700; a *Lump sum* line with `days 7`
  stored totals `qty x rate` (days pinned to 1); `rateOverride 0` prices to 0 and is not "absent";
  markup resolves line → card → tender, and a stored `0` line override means no markup; a null
  `qty` or rate contributes 0; `tenderPrice` = the four streams and moves by exactly the
  operational `withMarkup` when a line is added; waste and cutting figures are byte-identical
  before and after (no cross-fold).
- `scope-costs.service.spec.ts`: responses carry `lineTotal` / `effectiveMarkup` /
  `lineTotalWithMarkup`; the four new fields round-trip.
- `estimate-export.service.spec.ts`: the payload's `summary.operationalCosts.withMarkup` equals the
  figure `summary()` returns and the Summary sheet row is present when lines exist.
- `other-operational-costs.test.tsx`: the section renders the API's `lineTotalWithMarkup` and does
  no multiplication of its own (source assertion: no `qty *` / `* rate` expression in the file);
  it reports `{ subtotal, withMarkup }`; `ScopeCardsTab` folds `withMarkup` into
  `subtotalWithMarkup` (source assertion); the `DURATION_BEARING_UNITS` mirror test stays.

## Do NOT

- Do NOT add a per-section `operationalMarkupOverride` on `ScopeCard` - the mock-up prices these
  lines on the **card** markup, per line.
- Do NOT price anything in the browser. The web reads the server's `lineTotal*`; if a figure is
  not on the row, it is not on the screen.
- Do NOT fold the operational subtotal into another stream or apply a stream's markup twice.
- Do NOT touch the waste or cutting streams, `resolveEffectiveMarkup`'s scope-item chain,
  `TenderEstimate.markup`, the SUB tab, `/sot/`, or any quote / `ClientQuote*` code.
- Do NOT build a document picker for *Source* - text and a link glyph only.
- Do NOT add a quote destination, a provisional flag or a *Goes to* column - that is S2.
- Do NOT reprice or backfill existing rows in the migration. Existing tenders gain money on merge
  through the code path - the accepted consequence (plan section 2, *Existing tenders*).

## VERIFY before opening the PR

```
pnpm --filter @project-ops/api test -- operational-costs-priced scope-costs summary-section-markup estimate-export
pnpm --filter @project-ops/web test -- other-operational-costs cutting-section waste-section sub-tab rates-gate
pnpm build && pnpm lint
node scripts/data-model/build-relationship-map.mjs --check
grep -c "ADD COLUMN" apps/api/prisma/migrations/*operational_cost_columns*/migration.sql    # exactly 4
grep -n "SCOPE_OPERATIONAL_COSTS_PRICED_V1\|operationalWithMarkup" apps/api/src/modules/tendering/scope-redesign.service.ts
grep -n "Days is deliberately NOT a factor" apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx   # must be empty
```

PR body: `GATE-ALLOW: migrations` bare at column 0; quote the migration SQL, the `tenderPrice`
line before and after, the 17,000.00 test, and a screenshot of one card whose header total, the
discipline bar and `GET /tenders/:id/scope/summary` agree to the cent.

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
- `escalates: true` - this moves the tender price of every tender that carries an operational-cost
  line. Marco merges, not automation.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR; this section is never a reason to wait. First
of the `scopecards` chain; dispatches once the plan's one-chain order is on `main` (#1947).
S2 is authored once `SCOPE_OPERATIONAL_COSTS_PRICED_V1` is on `main`.
