---
premise: '! grep -q "markupOverride" apps/api/src/modules/tendering/scope-waste.service.ts'
premise_means: A waste line and a cutting line cannot carry their own markup - only scope items (item ?? card ?? tender) and, since S1, operational-cost lines can. Waste and cutting are marked up once per card in summary() from the card's section override, their list responses carry no marked-up figure, the cutting section shows no markup at all, and the card name gives no hint that it can be renamed.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/tendering/scope-item-pricing.ts
  - apps/api/src/modules/tendering/scope-waste.controller.ts
  - apps/api/src/modules/tendering/scope-waste.service.ts
  - apps/api/src/modules/tendering/scope-redesign.controller.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/__tests__/line-markup-all-types.spec.ts
  - apps/api/src/modules/tendering/__tests__/summary-section-markup.spec.ts
  - apps/api/src/modules/tendering/scope/__tests__/scope-waste.service.spec.ts
  - apps/web/src/pages/tendering/ScopeWasteTab.tsx
  - apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx
  - apps/web/src/pages/tendering/scope-cards/LineMarkupCell.tsx
  - apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/line-markup-cell.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/cutting-section.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/other-operational-costs.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/card-name-affordance.test.tsx
  - apps/web/src/pages/tendering/__tests__/waste-section.test.tsx
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/api test -- line-markup-all-types summary-section-markup scope-waste operational-costs-priced quote-destination && pnpm --filter @project-ops/web test -- line-markup-cell cutting-section waste-section other-operational-costs card-name-affordance quote-destination discipline-summary-bar && grep -q "SCOPE_LINE_MARKUP_ALL_TYPES_V1" apps/api/src/modules/tendering/scope-redesign.service.ts && grep -q "markupOverride" apps/api/src/modules/tendering/scope-waste.service.ts && test -f apps/web/src/pages/tendering/scope-cards/LineMarkupCell.tsx && test "$(grep -c 'markup_override' apps/api/prisma/migrations/*scopecards_s3_line_markup*/migration.sql)" = "2" && test -f docs/data-model/relationship-map.json && node scripts/data-model/build-relationship-map.mjs --check
size: 6
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: Additive only - one nullable markup_override Decimal(5,2) column on scope_waste_items and on cutting_sheet_items, no UPDATE ... SET, no default. Safe to leave on main if the run is capped before the code lands; re-running drops nothing. To revert, remove the two fields and drop the migration. The per-line application in summary() is arithmetically identical to today's per-card application whenever no line carries an override, so reverting the code alone restores today's figures exactly.
module: tendering
cluster: scopecards
cluster_order: 4
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_QUOTE_DESTINATION_UI_V1'
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
---

# Scope Cards S3 - per-line markup on every line type, and the card-name affordance

**Third of nine**, one merging chain (`docs/plans/scope-cards-reconciliation-plan.md`, section 3;
plan rows S3 + the old S8 folded in). The Discipline Cards mock-up (`design_ref`, v26) is the
standard: its MARKUP column on every subtable (`mkwrap` / `mk-in` / `rev`) and its card-name input.
S4 arms only when this slice's marker is on `main`.

> Marco, 2026-09-10: *Wants per-line markup on all four line types (scope items, waste, cutting,
> operational costs), not only the card-level stream markup.*

## Grounded on origin/main c1094ced, 2026-09-15 - re-verify line numbers before you edit

- **One resolver, three links, one caller so far.** `resolveEffectiveMarkup(item, card, tender)`
  (`scope-item-pricing.ts:355-369`) is `a ?? b ?? c` - *"the ONE markup-resolution expression …
  every resolver call site calls this rather than inlining the chain"*; a stored `0` is a real 0%
  (`??`, not `||`), pinned in `scope-item-labour-store.spec.ts:382-392`. Scope items call it in
  `listItems` (`scope-of-works.service.ts:380`) and `summary()` (`scope-redesign.service.ts:941`);
  S1 gave operational-cost lines the same chain (`line ?? card.markupOverride ?? tender`).
- **Waste and cutting are marked up per card, not per line.** `summary()` fetches cutting rows
  with `card.cuttingMarkupOverride` (`:1000-1020`) and waste rows with `card.wasteMarkupOverride`
  (`:1022-1054`), sums `lineTotal` per card and applies `override ?? tenderMarkup` to the card's
  subtotal once. `summary-section-markup.spec.ts` pins that with asymmetric rates (waste 10, cutting
  20). Neither row type has a `markupOverride` column (`schema.prisma:3810`, `:4144`); `ScopeCard`
  carries the two section overrides (`:3515-3516`), set through `setCardSectionMarkupOverride`
  (`scope-of-works.service.ts:1141`, controller `:306-310`) and reset in bulk (`:1371-1376`).
- **Line totals are stored at cost.** Waste: the cost engine writes `lineTotal` on create / update /
  sum-from-above (`scope-waste.service.ts:196-216, 364-372, 799-812, 935-955`). Cutting: the Cutrite
  resolvers write `lineTotal` (`scope-redesign.service.ts:557, 657, 1116-1137`). Neither list response
  carries an `effectiveMarkup` or a `lineTotalWithMarkup`; S1 added exactly those to operational-cost
  lines (`scope-costs.service.ts`), which is the shape to copy.
- **The web.** Scope items have the affordance already: `itemMarkupFromItem` (`ScopeQuantitiesTable.tsx:792`),
  `isStoredMarkupOverride` (`:838`), a PATCH that *"sends exactly ONE key, markupOverride, and ALWAYS
  sends it"* (`:845-864`), dashed-when-inherited / amber-when-overridden with a *Reset to card
  default (N%)* pip (`:3025-3027`). Operational costs got theirs in S1. `ScopeWasteTab.tsx` has a
  **section-level** control (`SectionMarkupOverride`, `wasteMarkupPhrase` `:183-189`, `computeWithMarkup`
  `:278`) and no per-line one. `CuttingSection.tsx` (`:399-409`) shows no markup anywhere - so the
  card header (`ScopeCardsTab.tsx:347-348`, cutting folded at cost) understates every card that has
  cutting by exactly the cutting markup the server applies.
- **The card name.** `CardNameHeading` (`ScopeCardsTab.tsx:1166-1230`): double-click edits, the
  input is the live control, `title="Double-click to rename"` is already on it (`:1228`). Nothing
  visible says it is there until you hover long enough for the tooltip. The mock-up draws the name
  as an always-editable input with the placeholder *Name this card…*.
- Migration precedent for a nullable Decimal(5,2): `ScopeCard.markupOverride` (`schema.prisma:3510`);
  latest folder `20260914063000_ea2a_estimating_analytics_preset` (or whatever S1 / S2a added).

## The rule

```
scope item    item.markupOverride ?? card.markupOverride        ?? tender.markup   (today)
op-cost line  line.markupOverride ?? card.markupOverride        ?? tender.markup   (S1)
waste line    line.markupOverride ?? card.wasteMarkupOverride   ?? tender.markup   (this slice)
cutting line  line.markupOverride ?? card.cuttingMarkupOverride ?? tender.markup   (this slice)
```

One function resolves all four. A stored `0` is a real "no markup". Nothing here changes a figure
until an estimator types a line override.

## Build this

`export const SCOPE_LINE_MARKUP_ALL_TYPES_V1 = "scopecards-s3"` in `scope-redesign.service.ts`.

### 1. Schema + migration

`markupOverride Decimal? @map("markup_override") @db.Decimal(5, 2)` on `ScopeWasteItem` and
`CuttingSheetItem`, with the `ScopeCard.markupOverride` comment style. One additive migration
`<ts>_scopecards_s3_line_markup` - two `ADD COLUMN`, nothing else. Regenerate `docs/data-model/`.

### 2. DTOs and responses

`markupOverride?: number | null` (`@IsOptional() @Type(() => Number) @IsNumber() @Min(0)`, the
`dto/scope-of-works.dto.ts:211` wording: *0 is a real override*) on the waste create / update DTOs
(`scope-waste.controller.ts`) and the cutting create / update DTOs (`scope-redesign.controller.ts`).
The services write it exactly as they receive it - `null` clears, `0` stores 0, absent leaves it -
and **every list / create / update response for waste and cutting returns `effectiveMarkup` and
`lineTotalWithMarkup`** beside `lineTotal`, computed through the rule above (the S1 shape). The web
never multiplies.

### 3. `summary()` applies the markup per line

Cutting (`:1000-1020`) and waste (`:1022-1054`): select the line's `markupOverride` with the card's
section override; for each line `withMarkup += lineTotal × (1 + resolveEffectiveMarkup(line, card
section override, tenderMarkup) / 100)`; drop the per-card subtotal-then-multiply. Keep the S2a
`(cardId, quoteDestination)` buckets and the four-way split exactly as they are - only the multiplier
moves from the bucket to the line. With no line override the result is identical to the cent; the
spec below pins that equivalence. `summary-section-markup.spec.ts`'s asymmetric-rate cases stay
green unchanged.

### 4. The MARKUP column on every subtable - `LineMarkupCell.tsx`

Lift the scope-item affordance into one component and use it on all three sections: `CuttingSection`
(a **Markup** column after *Rate*, before *Total*), the waste rows in `ScopeWasteTab` (after the rate
column), and `OtherOperationalCosts` (replace S1's inline copy). The mock-up's `mkwrap`: dashed
border when inherited with the inherited percentage as placeholder (*"the card's cutting markup"*,
etc.), amber fill (`--surface-override`) when overridden, `%` suffix, a `↺` pip titled *Reset to
section default (N%)* that PATCHes `{ markupOverride: null }`. The PATCH sends exactly one key.
Each row's **Total** cell becomes the server's `lineTotalWithMarkup` in bold with the `base + N%`
sub-line when a markup applies (the S1 drawing); the section header keeps *subtotal* and
*+ N% markup* but the *with markup* figure becomes the sum of the rows' `lineTotalWithMarkup`, not
`computeWithMarkup(subtotal, sectionOverride, tenderMarkup)` - that helper goes.
`SectionMarkupOverride` stays: it edits the middle link.

### 5. The card fold reads real cutting money - `ScopeCardsTab.tsx`

`CuttingSection` reports the S2b four-way shape with `withMarkup` = Σ `lineTotalWithMarkup` (no
longer cost). Rewrite the `:326-333` comment: the cutting stream's markup is now the server's row
figure, and the card header agrees with `GET /scope/summary` for a card with cutting. Waste stays
out of the card fold (S2b's ruling).

### 6. The card-name affordance - `CardNameHeading`

A pencil glyph (`✎`, `aria-hidden`, brand-muted) after the name, visible on hover and on
keyboard focus of the heading, that also opens the editor on click - so the affordance is
discoverable by mouse, keyboard and screen reader (`aria-label="Rename card"` on the pencil). The
existing `title` stays. No schema change; the name is the description.

### 7. Tests

- **`line-markup-all-types.spec.ts`**: a waste line at 1,000 with card waste override 10 and no
  line override → `lineTotalWithMarkup` 1,100 and `waste.withMarkup` 1,100; the same with line
  override 25 → 1,250; a stored `0` → 1,000 (not the card's 10); a cutting line resolves through
  `cuttingMarkupOverride`, never `wasteMarkupOverride` or `card.markupOverride`; `summary()` on a
  tender with no line overrides returns byte-identical `cutting.*`, `waste.*` and `tenderPrice` to
  the per-card computation (compute both in the test); the S2a destination buckets still split
  when a marked-up line is `OPTION`.
- **`scope-waste.service.spec.ts`**: `markupOverride` round-trips (`null`, `0`, `12.5`), responses
  carry `effectiveMarkup` / `lineTotalWithMarkup`; the cost engine's `lineTotal` is unchanged.
- **`line-markup-cell.test.tsx`**: dashed with placeholder when inherited, amber when overridden,
  reset PATCHes `{ markupOverride: null }`, typing PATCHes one key, `0` renders as an override.
- **`cutting-section`, `waste-section`, `other-operational-costs`**: the column is present, the row
  total is the API's `lineTotalWithMarkup`, the section reports Σ rows (source assertion: no
  `computeWithMarkup` and no `* (1 +` in the three files).
- **`card-name-affordance.test.tsx`**: the pencil is in the DOM, opens the editor on click and on
  Enter, and the rename PATCH is unchanged.

## Do NOT

- Do NOT write a second resolver or inline `??` chains - every call is `resolveEffectiveMarkup`.
- Do NOT touch `ScopeOfWorksItem.markupOverride`, `ScopeCard.markupOverride`, the section overrides
  or `TenderEstimate.markup` - the middle and outer links are untouched.
- Do NOT price anything in the browser and do NOT keep `computeWithMarkup` alive.
- Do NOT fold waste into the card total, and do NOT change what *Card total* means (S2b).
- Do NOT touch the cutting rate resolvers, the waste cost engine, `/sot/`, or any quote code.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/api test -- line-markup-all-types summary-section-markup scope-waste operational-costs-priced quote-destination
pnpm --filter @project-ops/web test -- line-markup-cell cutting-section waste-section other-operational-costs card-name-affordance quote-destination discipline-summary-bar
pnpm build && pnpm lint
node scripts/data-model/build-relationship-map.mjs --check
grep -c "ADD COLUMN" apps/api/prisma/migrations/*scopecards_s3_line_markup*/migration.sql       # exactly 2
grep -n "computeWithMarkup\|\* (1 +" apps/web/src/pages/tendering/ScopeWasteTab.tsx apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx   # must be empty
grep -n "SCOPE_LINE_MARKUP_ALL_TYPES_V1\|resolveEffectiveMarkup" apps/api/src/modules/tendering/scope-redesign.service.ts
```

PR body: `GATE-ALLOW: migrations` bare at column 0; quote the migration SQL, the 1,100 / 1,250 /
1,000 test, the equivalence test's two figures, and a screenshot of one card with a cutting line
whose header total and `GET /tenders/:id/scope/summary` agree to the cent - they do not today.

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
- `escalates: true` - a schema change on two line tables, and the card header's cutting figure
  changes on merge (it starts agreeing with the server). Marco merges, not automation.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR; this section is never a reason to wait. Third
of the `scopecards` chain; dispatches once `SCOPE_QUOTE_DESTINATION_UI_V1` (S2b) is on `main`.
S4 is authored once `SCOPE_LINE_MARKUP_ALL_TYPES_V1` is on `main`.
