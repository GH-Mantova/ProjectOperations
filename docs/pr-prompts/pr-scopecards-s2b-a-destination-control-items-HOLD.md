---
premise: '! grep -q "SCOPE_QD_UI_ITEMS_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: The server (S2a) stores where every estimating line goes on the client quote, but no row can show or set it. On the WBS items table there is no destination control, a covered item still renders greyed "priced on SUB1.1" cells the server no longer honours, and the drawer of turned-down AI proposals is still mislabelled "Excluded".
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/scope-cards/QuoteDestinationSelect.tsx
  - apps/web/src/pages/tendering/scope-cards/SubLinkPicker.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/quote-destination.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/sub-tab.test.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-expandables.test.tsx
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test -- quote-destination sub-tab wbs-expandables && grep -q "SCOPE_QD_UI_ITEMS_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx && test -f apps/web/src/pages/tendering/scope-cards/QuoteDestinationSelect.tsx && test "$(grep -c 'CoveredGroupCells' apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx)" = "0" && test "$(grep -c 'COVERED_ITEM_TOTAL' apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx)" = "0" && grep -q "Rejected proposals" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
module: tendering
requires_on_main: 'apps/api/src/modules/tendering/scope-redesign.service.ts :: SCOPE_QUOTE_DESTINATION_V1'
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
---

# Scope Cards S2b-a - the destination control, and the WBS items table

**First of three.** The original S2b was one slice over 20 files. Two `01-code-writer` runs
truncated before commit (see `docs/pr-prompts/needs-marco/scopecards-s2b-runtime-truncation-2026-09-16.md`);
Marco chose on 2026-09-16 to split it. This slice builds the control and puts it on the WBS item
rows only. The other three sections are **S2b-b**; the card money, the Opt lettering and the chips
are **S2b-c**.

**This slice does NOT set `SCOPE_QUOTE_DESTINATION_UI_V1`.** That marker is what S3 gates on, and
S2b-c sets it when the screen is actually finished. Set `SCOPE_QD_UI_ITEMS_V1` here and nothing else.

The Discipline Cards mock-up (`design_ref`, v26) is the standard, literally: the `WHERE A LINE GOES`
CSS block, `destSel()`, `destCell()`, `destNote()`, `notOurs()`.

> Marco, 2026-09-10: *Hiding a line - never in a drawer. Whatever its destination the row stays in
> place on the card, greyed and railed, because a comparison you cannot see is not a comparison.*
> Marco, 2026-09-11: *Internal only leaves the money AND the programme. One meaning per control.*

## Grounded on origin/main c1094ced - re-verify line numbers before you edit

- **The row type and the wire.** `ScopeItem` (`ScopeQuantitiesTable.tsx:321-430`) declares
  `pricedBySubItemId` (`:413`) and `isProvisional` (`:424`). `listItems` returns the whole row, so
  `quoteDestination` is already arriving from S2a the same way - **no API surface is added here.**
  Item writes go through `authFetch(... method: "PATCH")` on the item route; confirm / exclude at
  `:2780-2794`; link / unlink at `:2296-2320` (`linkItemToSubLine(coveredItemId, subItemId)`, wired
  to `SubLinkPicker` at `:3558-3564`).
- **Covered items are drawn as dead.** `isCoveredBySubLine` (`:3043-3046`) switches the Manpower and
  Plant column groups to `CoveredGroupCells` (`:3779-3865`) and the total cell to
  `COVERED_ITEM_TOTAL` (`:3850-3862`). After S2a the server prices those items normally, so this
  rendering now lies about the money. `sub-tab.test.tsx` pins it.
- **The drawer is for rejected proposals.** `excluded` rows (`:2837-2838`) render in a `<details>`
  titled *Excluded (n)* (`:3624-3635`); the only way in is the `x` on an AI-proposed pending row
  (`:3124-3132`, beside *ok* = confirm). A confirmed row has *Remove WBS item* instead
  (`:3135-3140`). The drawer never held "our working" - it holds proposals the estimator turned
  down. It stays; it gets its right name.
- **Dialogs.** `components/ConfirmDialog.tsx` is the house confirm; `CenteredModal` is used in this
  very file (`:3638`). `window.confirm` appears once in `TenderingPage.tsx:622` and is **not** the
  pattern to copy.

## Build this

`export const SCOPE_QD_UI_ITEMS_V1 = "scopecards-s2b-a"` in `ScopeQuantitiesTable.tsx`.

### 1. One control - `QuoteDestinationSelect.tsx` (new)

A `<select>` with the four options in the quote's words - **In the price · Provisional · Cost
option · Internal only** - values `PRICE | PROVISIONAL | OPTION | INTERNAL`, classes
`destsel d-price | d-prov | d-option | d-internal` styled as the mock-up's `select.destsel` block
(provisional = accent border on the override surface, option = primary border on the primary-light
surface, internal = dashed border, muted text). Title text verbatim from `destSel()`: *"Where this
line goes on the client quote. It is priced either way - the destination only decides where the
money lands."*

Props: `value`, `onChange(next)`, and `optionLetter?: string | null` - when set, the `Opt A` pill
(`.optlbl`) renders beside the select with title *"Grouped as Option A on the quote"*.

**Build the `optionLetter` prop and its pill now, but pass nothing to it.** The letters are assigned
once per card across all four sections in card order, which cannot be computed until S2b-b's sections
exist - that is S2b-c's job. Do **not** pass a literal `undefined` at the call site to "wire" it:
omit the prop entirely. (The first truncated run left exactly that, `optionLetter={undefined}` on
both branches of a ternary, which reads as wired and is not.)

Brand tokens only; nothing hard-coded.

### 2. The WBS item rows - `ScopeQuantitiesTable`

- A **Goes to** column (`th.inc` / `td.inc`, 1% width, no wrap) holding the control, in the item
  row's actions-side cell group (the mock-up's `destCell`, spanning the item's rows). Changing it
  PATCHes `{ quoteDestination }` on that row's own route and refreshes the row; a failed write
  reverts the control and shows the section's normal error line.
- **The row stays where it is.** Row classes `d-prov | d-option | d-internal` reproduce the mock-up's
  rail: a 3px inset left rail in the destination's colour (accent-dark, primary, muted); an INTERNAL
  row additionally sits on `--surface-subtle` with its non-control cells at `.55` opacity and its
  **total struck through** (1.5px), the *base + N%* sub-line not struck.
- **A note under the total** (`destNote()`): *provisional sum* / *cost option* / *internal only* as a
  small uppercase `.exclnote` in the destination's colour; nothing for PRICE.
- **Covered items come back to life.** Delete `CoveredGroupCells` and `COVERED_ITEM_TOTAL`; a covered
  item renders its inputs and its real total like any other, plus the mock-up's `vsbadge` under the
  total: *⇄ quoted on SUB1.1* with title *"A subcontract quote sits against this scope on SUB1.1.
  Both are priced; the destination decides which one the total counts."* `pricedOnLabel` survives
  only to build that chip.
- **The drawer is renamed *Rejected proposals (n)*** and its rows keep the strike-through; nothing
  else about it changes. Nothing with a destination is ever hidden in it.

### 3. The link offer - `SubLinkPicker` + `ScopeQuantitiesTable`

When the estimator links an item to a SUB line and that item is not already INTERNAL, a
`ConfirmDialog`: title *Set DEM1.2 to Internal only?*, body *"AsbestosCo's quote on SUB1.1 now sits
against this scope. Keep DEM1.2 priced on the card for comparison but out of the tender price and
the programme?"*, buttons **Internal only** / **Keep in the price**. Confirm sends
`{ subItemId, setInternal: true }` (S2a's flag) in the one link write; decline sends the link alone.
Unlink never asks and never changes the destination. Bulk / already-linked / already-INTERNAL cases:
no dialog.

### 4. Tests

- **`quote-destination.test.tsx`** (new): the control renders the four labels and PATCHes
  `{ quoteDestination }` on change; a PROVISIONAL row carries `d-prov` and *provisional sum*; an
  INTERNAL row carries `d-internal`, a struck total and *internal only*; a covered item renders
  inputs, a real total and *quoted on SUB1.1* - no `data-covered` cell exists; the drawer reads
  *Rejected proposals (1)* for one excluded row and is absent for none; the link dialog appears on
  link (not on unlink, not when already INTERNAL), confirm sends `setInternal: true`, decline sends
  the link alone. **The Opt A/B/C cascade is NOT tested here** - it does not exist yet; S2b-c adds
  those cases to this same file.
- **`sub-tab.test.tsx`**: the covered-cells assertions invert; the chip and the dialog are pinned.
- **`wbs-expandables.test.tsx:752`**: the excluded skip stays (rejected proposals expand nothing).

## Do NOT

- Do NOT price anything in the browser. Every figure is a server row figure sorted into a pile.
- Do NOT change what *Card total* / *DEM total* mean (PRICE + PROVISIONAL) and do NOT add options
  or internal money to either. **This slice changes no card or discipline figure at all** - that is
  S2b-c.
- Do NOT hide a row for any destination, and do NOT put a destination on rejected proposals.
- Do NOT delete the `excluded` status, the `x` on AI proposals, or the exclude route call.
- Do NOT set INTERNAL automatically - the dialog asks, the estimator answers.
- Do NOT touch the API, `schema.prisma`, `tokens.css` (Marco's kit), the SUB tab's quote table, or
  `/sot/`. Row rails and pills are page-local styles on brand tokens.

**And two that belong to this split:**

- Do NOT set `SCOPE_QUOTE_DESTINATION_UI_V1`. S3 gates on it; S2b-c sets it.
- Do NOT touch `CuttingSection`, `ScopeWasteTab`, `OtherOperationalCosts`, `DisciplineSummaryBar`,
  `ScopeCardsTab`, `ScopeCardTab`, `useScopeCards` or `discipline-rollup` - they are not in `scope`
  and belong to S2b-b and S2b-c. `isProvisional` and the `discipline === "Other"` rule stay exactly
  as they are on main until S2b-c retires them.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/web test -- quote-destination sub-tab wbs-expandables
pnpm build && pnpm lint
grep -n "CoveredGroupCells\|COVERED_ITEM_TOTAL" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx   # must be empty
grep -n "optionLetter={undefined}" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx                # must be empty
grep -n "SCOPE_QD_UI_ITEMS_V1\|Rejected proposals\|quoted on" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
grep -n "SCOPE_QUOTE_DESTINATION_UI_V1" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx           # must be empty
```

PR body: a screenshot of one card's WBS items holding one line of each destination (rail, note,
struck INTERNAL total, the *quoted on SUB1.1* chip on a covered item), and the sentence *"card and
discipline figures are unchanged by this slice - S2b-c moves them."*

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
First of the three slices the original S2b was split into. S2b-b arms once `SCOPE_QD_UI_ITEMS_V1`
is on `main`.
