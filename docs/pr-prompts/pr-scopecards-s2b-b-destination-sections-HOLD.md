---
premise: '! grep -q "SCOPE_QD_UI_SECTIONS_V1" apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx'
premise_means: S2b-a put the destination control on the WBS item rows. The other three sections of a card - cutting, waste and other operational costs - still have no destination column, cannot PATCH a destination, and still report a single lump of money instead of sorting it by where each line goes.
scope:
  - apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx
  - apps/web/src/pages/tendering/ScopeWasteTab.tsx
  - apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/cutting-section.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/other-operational-costs.test.tsx
  - apps/web/src/pages/tendering/__tests__/waste-section.test.tsx
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test -- cutting-section other-operational-costs waste-section && grep -q "SCOPE_QD_UI_SECTIONS_V1" apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx && grep -q "quoteDestination" apps/web/src/pages/tendering/ScopeWasteTab.tsx && grep -q "quoteDestination" apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
module: tendering
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_QD_UI_ITEMS_V1'
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
---

# Scope Cards S2b-b - the other three sections

**Second of three.** The original S2b was one slice over 20 files; two `01-code-writer` runs
truncated before commit (see `docs/pr-prompts/needs-marco/scopecards-s2b-runtime-truncation-2026-09-16.md`)
and Marco chose on 2026-09-16 to split it. S2b-a built `QuoteDestinationSelect` and put it on the
WBS item rows. This slice puts the same control on the remaining three sections and makes each one
report its money four ways. **Nothing consumes that four-way shape yet** - S2b-c folds it into the
card and the discipline bar.

**This slice does NOT set `SCOPE_QUOTE_DESTINATION_UI_V1`.** S3 gates on that marker; S2b-c sets it
when the screen is finished. Set `SCOPE_QD_UI_SECTIONS_V1` here and nothing else.

The Discipline Cards mock-up (`design_ref`, v26) is the standard, literally: the `WHERE A LINE GOES`
CSS block, `destCell()`, `destNote()`.

> Marco, 2026-09-10: *Hiding a line - never in a drawer. Whatever its destination the row stays in
> place on the card, greyed and railed, because a comparison you cannot see is not a comparison.*

## Grounded on origin/main c1094ced - re-verify line numbers before you edit

- `CuttingSection.tsx:399-409` - columns WBS · Description · Rig · Method · Elevation · Depth ·
  Length · Rate · Total; PATCH at `:488`.
- `ScopeWasteTab.tsx:685-704` - the waste rows.
- `OtherOperationalCosts.tsx:670-673` - S1's columns.

Each row already carries the server's own line total; **none carries a destination**, and
`quoteDestination` is already arriving on every row from S2a - no API surface is added here.

`QuoteDestinationSelect` exists on main after S2b-a at
`apps/web/src/pages/tendering/scope-cards/QuoteDestinationSelect.tsx`. **Import it. Do not rebuild
it, restyle it, or fork a second copy** - one control, four sections.

## Build this

`export const SCOPE_QD_UI_SECTIONS_V1 = "scopecards-s2b-b"` in `CuttingSection.tsx`.

### 1. A Goes to column on each of the three sections

A **Goes to** column (`th.inc` / `td.inc`, 1% width, no wrap) holding `QuoteDestinationSelect`,
placed where the mock-up puts it:

- **Other operational costs** - the **first** column, giving the mock-up's
  `Goes to · From · Item description …` order.
- **Cutting** and **Waste** - immediately **after the description**.

Changing it PATCHes `{ quoteDestination }` on that row's own route and refreshes the row; a failed
write reverts the control and shows the section's normal error line.

**Do not pass `optionLetter`.** The Opt A/B/C letters are assigned once per card across all four
sections in card order, which is S2b-c's job. Omit the prop entirely - do not pass a literal
`undefined` to make it look wired. (That is precisely what the first truncated run left behind.)

### 2. The row stays where it is

Row classes `d-prov | d-option | d-internal` reproduce the mock-up's rail: a 3px inset left rail in
the destination's colour (accent-dark, primary, muted). An INTERNAL row additionally sits on
`--surface-subtle` with its non-control cells at `.55` opacity and its **total struck through**
(1.5px), the *base + N%* sub-line not struck. A note under the total (`destNote()`): *provisional
sum* / *cost option* / *internal only* as a small uppercase `.exclnote` in the destination's colour;
nothing for PRICE.

This is the same treatment S2b-a built for the item rows. Match it exactly.

### 3. Each section reports its money four ways

Each section reports `{ price, provisional, option, internal }`, each `{ subtotal, withMarkup }` -
**the same server row figures it reports today**, sorted by the row's own destination. Nothing is
computed in the browser beyond the sorting and the sum.

Nothing consumes this yet. `ScopeCardsTab`'s fold is **out of `scope`** and stays on main as it is:
it keeps reading whatever it reads today, so no card or discipline figure moves in this slice. S2b-c
changes the fold and the bar in one go.

### 4. Tests

- **`cutting-section.test.tsx`**, **`other-operational-costs.test.tsx`**, **`waste-section.test.tsx`**:
  the Goes-to column is present and in the position named above; changing it PATCHes
  `{ quoteDestination }` on that section's own route; a PROVISIONAL row carries `d-prov` and
  *provisional sum*; an INTERNAL row carries `d-internal`, a struck total and *internal only*; and
  the section reports the four-way money shape with each server figure landing in the pile its row's
  destination names.
- Pin that a failed PATCH reverts the control and surfaces the section's normal error line.
- Do **not** assert anything about Opt letters, card totals or the discipline bar. None of those
  move in this slice.

## Do NOT

- Do NOT price anything in the browser. Every figure is a server row figure sorted into a pile.
- Do NOT change what *Card total* / *DEM total* mean (PRICE + PROVISIONAL) and do NOT add options
  or internal money to either. **This slice changes no card or discipline figure at all.**
- Do NOT hide a row for any destination, and do NOT put a destination on rejected proposals.
- Do NOT delete the `excluded` status, the `x` on AI proposals, or the exclude route call.
- Do NOT set INTERNAL automatically - the dialog asks, the estimator answers. (The dialog itself
  landed in S2b-a and is not touched here.)
- Do NOT touch the API, `schema.prisma`, `tokens.css` (Marco's kit), the SUB tab's quote table, or
  `/sot/`. Row rails and pills are page-local styles on brand tokens.

**And three that belong to this split:**

- Do NOT set `SCOPE_QUOTE_DESTINATION_UI_V1`. S3 gates on it; S2b-c sets it.
- Do NOT touch `DisciplineSummaryBar`, `ScopeCardsTab`, `ScopeCardTab`, `useScopeCards` or
  `discipline-rollup` - not in `scope`, and they are S2b-c's. `isProvisional` and the
  `discipline === "Other"` rule stay exactly as they are on main until S2b-c retires them.
- Do NOT re-open `ScopeQuantitiesTable.tsx`, `QuoteDestinationSelect.tsx` or `SubLinkPicker.tsx`.
  S2b-a finished those. If one of them looks wrong, say `NO-OP: <reason>` and report it rather than
  widening this slice.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/web test -- cutting-section other-operational-costs waste-section
pnpm build && pnpm lint
grep -n "optionLetter" apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx apps/web/src/pages/tendering/ScopeWasteTab.tsx apps/web/src/pages/tendering/scope-cards/OtherOperationalCosts.tsx   # must be empty
grep -n "SCOPE_QUOTE_DESTINATION_UI_V1" apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx   # must be empty
grep -n "SCOPE_QD_UI_SECTIONS_V1" apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx
git diff --name-only origin/main   # must list exactly the six files in scope
```

PR body: a screenshot of one card showing all three sections with the Goes-to column in the
mock-up's position, and the sentence *"card and discipline figures are unchanged by this slice -
S2b-c moves them."*

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Never ask a question or "stand by" for approval. A dismissed or unanswered question is the absence
  of a human, not a stop signal. Proceed on best judgement and record the assumption in the PR body.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am waiting
  for someone" - there is nobody. Open the PR.
- **Budget.** This slice is six files precisely because the twenty-file version could not finish in
  one turn. If you find yourself widening scope, stop and say `NO-OP: <reason>` instead.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR; this section is never a reason to wait.
Second of the three slices the original S2b was split into. S2b-c arms once
`SCOPE_QD_UI_SECTIONS_V1` is on `main`.
