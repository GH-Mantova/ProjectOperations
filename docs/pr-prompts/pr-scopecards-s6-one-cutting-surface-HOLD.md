---
premise: 'grep -q "CuttingSection" apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx'
premise_means: A scope card carries TWO cutting surfaces, one under the other - the read-only "Cutting take-off" section and the editable Cutrite sheet below it. The approved mock-up has ONE. CuttingSection.tsx says so in its own header and parks the choice for Marco; this slice is that choice carried out. The surviving surface is also missing most of the mock-up's columns and shows saw-cut rows only.
scope:
  - apps/web/src/pages/tendering/ScopeCuttingSheet.tsx
  - apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/SubQuotePicker.tsx
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/cutting-section.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/cutting-one-surface.test.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/sub-tab.test.tsx
  - apps/web/src/pages/tendering/__tests__/waste-section.test.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-inputs-money-inheritance.test.tsx
  - e2e/**
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test -- cutting-one-surface waste-section sub-tab wbs-inputs-money-inheritance && grep -q "CUTTING_ONE_SURFACE_V1" apps/web/src/pages/tendering/ScopeCuttingSheet.tsx && test ! -f apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx && test "$(grep -c "CuttingSection" apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx)" = "0" && grep -q "Material" apps/web/src/pages/tendering/ScopeCuttingSheet.tsx && grep -q "Cutting take-off" apps/web/src/pages/tendering/ScopeCuttingSheet.tsx
size: 7
gate_allow: none
seed_only: false
escalates: true
module: tendering
cluster: scopecards
cluster_order: 8
requires_on_main: 'apps/api/src/modules/rates/charge-step-pricing.service.ts :: CHARGE_STEPS_PRICE_CUTTING_V1'
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
---

# Scope Cards S6 - one cutting surface, with the mock-up's columns

**Sixth of nine.** The scope card gets **one** concrete-cutting section instead of two, and that
section carries the column set the mock-up draws. Web only - no API, no schema, no migration. S7
(one cutting **total**) sits behind this slice.

> The mock-up has one cutting section. `CuttingSection.tsx:27-30` on `main`:
> *"THE OPEN QUESTION THIS SURFACED, WHICH THIS FILE DOES NOT SETTLE: the approved mock-up has ONE
> cutting section, and the card now carries two surfaces - this read-only take-off and the editable
> Cutrite sheet below it. Which of them should survive is Marco's call."*

> Marco, 2026-09-16: **the editable sheet survives.** The mock-up's table is an editor - five
> dropdowns on every row - so a read-only view cannot become it. The take-off existed only because
> the card showed nothing; once the editor sits in the card with the mock-up's columns, it has
> nothing left to add.

## Grounded on origin/main bdc5d05b, 2026-09-16 - re-verify line numbers before you edit

- **Two surfaces, both mounted on the card.** `ScopeCardsTab.tsx:1151` renders
  `<ScopeCuttingSheet>` (826 lines, `apps/web/src/pages/tendering/ScopeCuttingSheet.tsx`, heading
  exactly *"Concrete cutting"* at `:284`) and, directly above it, `<CuttingSection>` (512 lines,
  `scope-cards/CuttingSection.tsx`, heading *"Cutting take-off"*, `SCOPE_CUTTING_V1`). The take-off
  is **read-only** - its own header says *"This section is the READ view of what that sheet has
  produced for the card; it edits nothing."*
- **The take-off shows saw-cut rows only** (`CuttingSection.tsx:223`,
  `rows.filter((r) => r.itemType === "saw-cut")`), with core-hole and other-rate rows left to the
  sheet below. Its nine columns: `WBS`, `Description`, `Rig`, `Method`, `Elevation`, `Depth (mm)`,
  `Length (Lm)`, `Rate ($/m)`, `Total` (`:401-409`).
- **The mock-up's column set** (`CUT_TABLES` render, one table, all three row types):
  `Goes to` · `From` · `Type` · `Description` · `Equipment` · `Elevation` · `Material` · `Depth` ·
  `Ø` · `Qty` · `Method` · `Rate` · `Markup` · `Total` · actions. A field a row type does not use is
  shown **muted as an em-dash, never dropped**, so the columns stay aligned:
  *"the ERP stores null for fields a row type doesn't use - show them muted rather than dropping the
  cell"*.
- **The model already carries every one of those fields.** `CuttingSheetItem`
  (`schema.prisma:4195-4228`): `itemType` (`saw-cut | core-hole | other-rate`), `equipment`,
  `elevation`, `material`, `depthMm`, `diameterMm`, `quantityLm`, `quantityEach`, `ratePerM`,
  `ratePerHole`, `lineTotal`, `method`, `otherRateId` - plus `shift` and `shiftLoading`.
- **Three of the mock-up's columns arrive before this slice, not in it.** `Goes to` is S2b's
  destination control, `From` is S1's source glyph, `Markup` is S3's per-line markup. All three are
  on `main` as prompts ahead of this one. **Do not build them again** - if one is missing from the
  sheet when you run, add the column and read the value the earlier slice already stores.
- **The heading collision is real and has form.** Two sections answering to *"Concrete cutting"*
  turned `tendering-e2e` red on #1682 because `getByText("Concrete cutting")` resolved to two
  elements, which is why the take-off was renamed. `cutting-section.test.tsx:405-408` guards it.
  With one surface the collision cannot recur - but the guard must be re-pointed, not deleted.
- **Other references to the take-off** that must be followed: `ScopeQuantitiesTable.tsx`,
  `scope-cards/SubQuotePicker.tsx`, `scope-cards/__tests__/sub-tab.test.tsx`,
  `__tests__/waste-section.test.tsx` (asserts the `<ScopeCuttingSheet` position in the tab source)
  and `__tests__/wbs-inputs-money-inheritance.test.tsx` (asserts the sheet renders only when
  `discipline !== "ASB"` - **that rule stays; asbestos cards never cut**).
- **Web tests here are source-read + pure logic.** The workspace has no jsdom; DOM claims grep the
  rendered source. Follow `cutting-section.test.tsx` and `waste-section.test.tsx`.

## Build this

`export const CUTTING_ONE_SURFACE_V1 = "scopecards-s6";` in
`apps/web/src/pages/tendering/ScopeCuttingSheet.tsx`.

### 1. One surface

- `ScopeCardsTab.tsx` stops rendering `<CuttingSection>` and renders `<ScopeCuttingSheet>` in the
  take-off's position, so the card order the mock-up fixes is unchanged:
  **WBS items → Other operational costs → Waste → Concrete cutting → + Add WBS item → subtotal.**
- **Delete `scope-cards/CuttingSection.tsx`.** Git history keeps it; nothing else may keep a copy.
  Follow every import - `ScopeQuantitiesTable.tsx`, `SubQuotePicker.tsx` - and re-point or remove.
- The surviving heading is **"Concrete cutting"**, the mock-up's words. Keep a `Cutting take-off`
  sub-label on the section's empty state only, so the phrase the estimator learned is not lost:
  *"No cutting yet. Copy from above builds saw-cut lines from every measurement ticked for cutting -
  length becomes the cut metres and depth becomes the blade depth."* (the mock-up's own empty state).
- The `discipline !== "ASB"` rule is untouched. Asbestos cards still show no cutting section at all.

### 2. The mock-up's columns

Header, in this order: **Goes to · From · Type · Description · Equipment · Elevation · Material ·
Depth · Ø · Qty · Method · Rate · Markup · Total · actions.**

- `Rig` is renamed **Equipment**, and `Length (Lm)` becomes **Qty** - the same column serves
  `quantityLm` on a saw cut and `quantityEach` on a core hole, which is why the mock-up has one
  `Qty` and not two.
- **`Type`** (`saw-cut` / `core-hole` / `other-rate`) and **`Ø`** (`diameterMm`) are new, and with
  them the section stops filtering: **all three row types render in one table.** A cell a row type
  does not use is muted with an em-dash, never dropped.
- **`Material`** is new on the surface and comes straight off `CuttingSheetItem.material`.
- `Goes to`, `From` and `Markup` render the values S2b, S1 and S3 already store.
- Money columns keep the server's figures. **No arithmetic in the browser** - `ratePerM` /
  `ratePerHole` and `lineTotal` are the server's, as they are today.

### 3. What every dropdown may offer

The mock-up: *"a rig is offered an elevation, a material or a depth only where the sheet prices
one"*. Build the options from the priced rows the API returns for the row's rate table - not from a
hardcoded list. This is the screen half of the rule S5 left in place on the server: S5 deliberately
kept `sanitiseSawElevation`, `METHODS_BY_EQUIPMENT` and the categorical collapse, because removing
them changes what the estimator can pick.

**Remove them here, and only here:** with the dropdowns offering exactly what is priced, a request
for an unpriced combination can no longer be made, so the server no longer needs to coerce one.
Delete `sanitiseSawElevation` and `METHODS_BY_EQUIPMENT` from
`apps/api/src/modules/tendering/scope-redesign.service.ts` **only if** the equivalence spec S5 ships
still passes afterwards; if it does not, leave them and say
`NO-OP: the collapse still has callers - <what>`. The collapse itself (elevation/material folding to
the table's categorical set) is row-picking and stays until the seeded rows cover every offered
combination.

### 4. Shift comes off the cutting line

`CuttingSheetItem.shift` and `shiftLoading` (`schema.prisma:4222-4223`) are stored, accepted by the
DTO (`scope-redesign.controller.ts:30, :59`) and carried into the estimate export
(`estimate-export.service.ts:411-412, :427-428`), and the mock-up's cutting table has no shift
column and no shift step.

> Marco, standing rule: *night-shift and weekend cutting premiums are entered under "other rates",
> not as a shift loading on the cutting line.*

This slice removes **the control and the column** - no shift input, no shift column, nothing on the
sheet that writes `shift` or `shiftLoading`. **Deprecate, do not drop:** the two model fields and
their DTO members stay exactly as they are, unread by the sheet, so the estimate export keeps
printing what old tenders stored. Retiring the columns is a later cleanup, the same
deprecate-then-cleanup Marco ruled for `isProvisional` in S2a. Say so in a comment on both fields.

### 5. Tests

- **`cutting-one-surface.test.tsx` (NEW)** - the card renders exactly one cutting section; the tab
  source contains no `CuttingSection`; the heading *"Concrete cutting"* appears **once**; the
  section still does not render on an `ASB` card; the header carries all fourteen columns in the
  mock-up's order; a `core-hole` fixture row renders `Ø` with a figure and `Depth` muted, and an
  `other-rate` row renders `Equipment` / `Elevation` / `Material` muted - proving the muted-cell rule
  rather than a dropped cell.
- **`cutting-section.test.tsx` (RETIRE)** - its component is gone. Carry its heading-collision
  assertion into `cutting-one-surface.test.tsx` before deleting it: the guard that made #1682
  impossible must survive its file.
- **`waste-section.test.tsx`, `sub-tab.test.tsx`, `wbs-inputs-money-inheritance.test.tsx` (EDIT)** -
  re-point to the single surface; keep the ASB assertion exactly as it is.
- **`e2e/`** - find the `tendering-e2e` spec that reads *"Concrete cutting"* and make its expectation
  single-element. Do not weaken it to a partial match.

### 6. Depths with no priced row - Marco, 2026-09-22 (ruled on #2061)

> Marco: *"Ringsaw Wall at 275 mm: if there is no 275 mm depth charge for that, then [use the next
> depth up]. Once a rate is entered (say a new line on the concrete cutting table) for that depth,
> the system should be able to identify it from the table."*

The server already does this on `main`. `priceSawCutFromRates` in `scope-redesign.service.ts`
picks the shallowest row **at or above** the requested depth from the live table rows. **Keep that
lookup exactly as it is.** It is row-picking, and section 3's deletions do not touch it. This slice
must not break it on the screen either:

- The Depth dropdown offers the depths the table prices, built from the API rows (section 3). A row
  added to the table later appears as an option **with no code change**.
- A depth that arrives from outside the dropdown (Copy from above, an import, an older line, e.g.
  275 mm on Ringsaw Wall) is **shown as stored, never coerced or blanked**. It prices at the next
  depth up, using the server's figure.
- Test: in `cutting-one-surface.test.tsx`, a fixture row at a depth absent from the option list
  still renders its stored depth, and the options come from the rows passed in, not a literal list.
## Do NOT

- Do NOT keep both surfaces, and do NOT hide one behind a flag. One section or say `NO-OP`.
- Do NOT build `Goes to`, `From` or `Markup` from scratch - S2b, S1 and S3 own them.
- Do NOT drop a cell for a row type that does not use it. Muted em-dash, columns aligned.
- Do NOT drop `shift` or `shiftLoading` from the model, the DTO or the estimate export.
- Do NOT compute a rate or a total in the browser.
- Do NOT change the `discipline !== "ASB"` rule.
- Do NOT touch the API beyond the two deletions in section 3, `tokens.css`, or `/sot/`.

## VERIFY before opening the PR

```
pnpm --filter @project-ops/web test -- cutting-one-surface waste-section sub-tab wbs-inputs-money-inheritance
pnpm build && pnpm lint
test ! -f apps/web/src/pages/tendering/scope-cards/CuttingSection.tsx
grep -rn "CuttingSection" apps/web/src                                                    # must be empty
grep -c "Concrete cutting" apps/web/src/pages/tendering/ScopeCuttingSheet.tsx             # exactly 1
grep -n "shift" apps/web/src/pages/tendering/ScopeCuttingSheet.tsx                        # must be empty
grep -n "shiftLoading" apps/api/src/modules/estimate-export/estimate-export.service.ts    # still there
grep -n "CUTTING_ONE_SURFACE_V1\|Material\|Ø" apps/web/src/pages/tendering/ScopeCuttingSheet.tsx
```

PR body: a screenshot of the card showing one cutting section with all fourteen columns, including a
core-hole row and an other-rate row with their muted cells; the before/after of the card order; and
the `tendering-e2e` run.

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
- `escalates: true` - this slice deletes a component the estimator uses and changes the surface they
  price cutting on. Marco merges, not automation.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- The completion test: is there a PR number in your output? If the reason for "no" is "I am
  waiting for someone" - there is nobody. Open the PR.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR; this section is never a reason to wait. Sixth of
the `scopecards` chain; dispatches once `CHARGE_STEPS_PRICE_CUTTING_V1` (S5) is on `main`. S7 (one
cutting total) is authored once `CUTTING_ONE_SURFACE_V1` is on `main`.
