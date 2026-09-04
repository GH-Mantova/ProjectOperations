---
premise: '! grep -q "SCOPE_WBS_INPUTS_V2" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: >-
  The WBS row inputs disagree with the rate card and with the card they sit on. The Shift dropdown
  offers "Day" where the rate card says Weekday; both Type dropdowns open with two blank options
  because the page and the select each contribute one; the two money columns are left-aligned and
  rounded to whole dollars; changing a role or a shift leaves a stale rate override on screen even
  though the plant column five lines below already clears its own; and every row reports that it is
  inheriting a 0% markup because the card never passes its markup down. The Cutting tick also
  renders on asbestos cards, where the sheet it feeds is not rendered at all.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-manpower-columns.test.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-plant-columns.test.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-inputs-money-inheritance.test.tsx
done_when: pnpm build && pnpm lint && grep -q "SCOPE_WBS_INPUTS_V2" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 7
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: scope-card-corrections
cluster_order: 2
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_WBS_GROUPRULES_V1'
rollback_strategy: >-
  Web-only: one component, one mount point, three test files. No API, no schema, no migration, no
  new dependency. Every change is a label, an alignment, a number format, a local-state clear, one
  prop passed down, or a render condition. Revert and the rows behave exactly as they do today.
---

# The row inputs say Day, drop their cents, and tell every row it inherits 0%

Second slice of the corrections cluster, and it edits the same file as slice 1, so it is gated
behind `SCOPE_WBS_GROUPRULES_V1`. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

Measured 2026-09-04 against `origin/main`, mock-up compared against the code cell by cell. Slice 1
drew the group boundaries and fixed the column placement. Everything below is about what the cells
themselves do. Six defects, all in `ScopeQuantitiesTable.tsx` except one, which is a prop the card
never passes.

## What to build

**1. The shift is called Weekday.** `SHIFT_OPTIONS` at line 329 is `["Day", "Night", "Weekend"]`.
The mock-up's list is `SHIFTS = ['Weekday', 'Night', 'Weekend']`, matching the rate card. The word
`Weekday` appears nowhere in this file.

`"Day"` is the stored value as well as the label. It is seeded at lines 532 and 555, read back at
line 1404 (`item.shift ?? "Day"`), defaulted at line 1485 (`onShiftChange(v ?? "Day")`), and sent
to the server through the `patchItem(item.id, { shift: v })` that already exists at line 1151. Rows
on `main` therefore hold the literal string `"Day"`, and they must not be orphaned.

Split the label from the value: keep `"Day"` as the stored value and give the option the label
`Weekday`. Nothing already saved changes meaning, and the existing `patchItem` keeps sending
exactly the string the API accepts today. If you instead rename the value itself, you **must** map
a stored `"Day"` onto the new value where `shiftValue` is computed at line 1404, because
`TooltipSelect` selects by value: a row whose stored string matches no option falls through to the
blank option at `TooltipSelect.tsx` line 62 and silently reads as unset. Whichever route you take,
say in the PR body which one it was and what a pre-existing row displays afterwards.

This is a naming change, not a pricing change. `labourRateById` (line 641) maps a labour rate id to
`dayRate` and only `dayRate` - the shift does not select `nightRate` or `weekendRate` yet. That is
`pr-wbsshift-s1-web-rate-follows-shift`, not this slice.

Correct the two doc comments that name the value, at lines 76 and 298. `wbs-manpower-columns.test.tsx`
asserts `SHIFT_OPTIONS` equals `["Day", "Night", "Weekend"]` at line 189 and `SHIFT_OPTIONS[0] === "Day"`
at line 193; update both to whatever you land on.

**2. One blank option per dropdown, not two.** `labourTypeOptions` prepends
`{ value: "", label: "- none -" }` at line 632 and `plantTypeOptions` prepends the same at line 658.
`TooltipSelect` then renders its own `<option value="">` unconditionally at lines 62-64. Both Type
dropdowns open with two empty-valued options.

Drop the page's prepended sentinel and keep the one inside `TooltipSelect`. The reason is reach:
this file renders sixteen `TooltipSelect`s and the component's blank option is the clear affordance
for every one of them, while only these two lists prepend a sentinel - removing the shared one
would strip the clear affordance from the other fourteen. Pass `placeholder="- none -"` on the two
Type selects instead (lines 1438 and 1646); the prop already exists, defaults to an em dash, and no
call site sets it today.

The handlers already cope. `TooltipSelect` maps a `""` selection to `onChange(null)` at lines 45-48,
and both Type handlers already treat null as cleared - line 1441 for labour, lines 1649-1657 for
plant.

**3. Right-align the money and give it its cents.** The mock-up right-aligns both `Day rate`
headers and the rate input, and formats to two decimals.

- Both `Day rate` headers use the bare `thStyle` (lines 945 and 951), which sets
  `textAlign: "left"` at line 235. The two `Total` headers beside them already override it with
  `textAlign: "right"` (lines 946 and 952) - copy that override onto the two rate headers.
- The manpower `Day rate` cell is `<td style={cellSt}>` at line 1493 with no alignment, and its
  input at lines 1502-1527 carries `style={{ width: 72, height: 28, padding: "0 4px" }}` and no
  `textAlign`. The plant `Day rate` cell is the same at line 1700. Right-align the cell and the
  input, and give the input `fontVariantNumeric: "tabular-nums"` the way the Total cell already
  does at line 1533.
- `fmtManpowerTotal` (lines 374-381) and `fmtPlantTotal` (lines 429-436) both pass
  `maximumFractionDigits: 0`. Set `minimumFractionDigits: 2` **and** `maximumFractionDigits: 2` -
  raising the maximum alone renders `$1,234.5`, not `$1,234.50`.
- Keep the em dash for a null total. Both formatters return U+2014 for `null` (lines 375 and 430)
  and both test files assert it exactly; a null total must never become `$0.00`.
- The existing tests assert the old rounding: `wbs-manpower-columns.test.tsx` lines 175-180
  (`not.toContain(".4")`) and `wbs-plant-columns.test.tsx` lines 198-203 (`not.toContain(".5")`).
  Those assertions invert.
- `fmtCurrency` (lines 195-201) formats the footer subtotal and also rounds to whole dollars. Leave
  it alone unless the mock-up shows cents on the subtotal too, and say in the PR body which you did
  and why.

**4. Changing the role or the shift releases a stale override.** That is the mock-up's own wording:
*"Changing the role or the shift releases a stale override, the same cascade rule the measurements
use."*

`onLabourTypeChange` at line 1140 writes only `{ labourTypeId: typeId }`. `onShiftChange` at lines
1149-1152 writes only `{ shift: v }`. Neither clears `dayRateOverride`, so a rate typed against one
role stays on screen after the role changes to another.

**The plant column already does this.** `onPlantTypeChange` at lines 1163-1169 writes
`{ plantRateId, customDescription: null, dayRateOverride: null }`. Make manpower match its own
sibling twenty lines below - same shape, same reason. Say so in the PR body: this is not a new
rule, it is the rule the row already follows on the other side of the table.

The override is local row state (`RowManpowerState.dayRateOverride`, line 293). Clearing it is a
`setRowManpower` call. Do not change what the existing `patchItem` at line 1151 sends.

**5. Pass the card's markup down.** `cardMarkup` is a prop with the default `0` at line 453, and
`ScopeCardsTab` renders `<ScopeQuantitiesTable>` at lines 396-402 passing `tenderId`, `cardId`,
`discipline`, `items` and `onItemsChanged` - not `cardMarkup`. Every row therefore reads zero:
the Markup input's placeholder is `String(cardMarkup)` (line 1218), its tooltip reads
`Inheriting card markup (0%)` (line 1225), the `Card: 0%` hint (line 1240) and the effective figure
(line 1247) are all wrong for any card that is not genuinely on 0.

The fix is one prop, and both halves of the resolution are already in scope at the call site:
`activeCard.markupOverride` (used at ScopeCardsTab line 329) and `tenderMarkup` from
`useTenderEstimate` (line 60). Resolve the card override first, then the tender markup - the same
order `CardMarkupOverride` states at ScopeCardsTab line 604, `Inherits tender markup (N%)`.

Do not touch `isMarkupOverridden` (lines 261-266) or `effectiveMarkup` (lines 269-274). They are
correct; they were only ever fed a zero. Consider dropping the `= 0` default so a missing prop
becomes a type error instead of a silent zero, and say what you decided.

**6. The Cutting tick has no business on an asbestos card.** The mock-up gates the column on the
discipline, `cutting: false` for ASB. The shipped checkbox at lines 2401-2410 renders on every card,
and the identical one on additional material rows at lines 2874-2883 does too. Meanwhile the sheet
they feed is already gated: `ScopeCardsTab` renders `<ScopeCuttingSheet>` only when
`activeCard.discipline !== "ASB"` (line 423). On an asbestos card an estimator can tick Cutting and
there is nowhere for it to be priced.

The component already receives the discipline and discards it - line 451 destructures it as
`discipline: _discipline`. Use it, gate both checkboxes on the same condition `ScopeCardsTab` uses,
and express that condition once rather than twice.

Gate the **render** only. Do not clear or rewrite a `cuttingIncluded` value already stored against
an ASB item; that is a data change and it belongs to the persistence cluster.

Mark the component with `SCOPE_WBS_INPUTS_V2`.

## Do NOT

- **Do not touch persistence.** No `patchItem` call may be added, removed or re-pointed by this
  slice. Item 1 changes the string an existing call carries and item 4 clears local state next to
  one; neither adds, deletes or re-aims a call. Persistence is a separate cluster and mixing them
  makes both unreviewable.
- **Do not touch the Measurement column or the trailing Actions column.** `pr-cardui-s5` owns both.
  The Measurement column sits between Plant Total and Markup as an interim state and the comment
  above it says so.
- **Do not touch the plant picker.** No `optgroup`, no manual-entry option, no change to
  `isTransportPlant` (lines 150-152) or to `plantTypeOptions` (lines 648-665) beyond removing the
  `- none -` sentinel at line 658 that item 2 calls for. That is slice 3.
- Do not make the day rate follow the shift. That is `pr-wbsshift-s1-web-rate-follows-shift`.
- Do not redraw the group rules, the sticky header or the remove control - slice 1 owns those and
  lands first.
- Do not touch `/sot/`, the API, `apps/api/prisma`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] Read back the three Shift options as rendered. State what an item saved before this PR (stored
      shift `"Day"`) displays now, and what string the row sends on its next shift change.
- [ ] Each Type dropdown offers exactly ONE empty option. With a rate list of N roles, give the
      labour Type option count before and after (N+2 -> N+1).
- [ ] Both `Day rate` headers and both `Day rate` inputs are right-aligned. Give the rendered string
      for a manpower total of 801.4 and a plant total of 600.5.
- [ ] Set a row to one role, type a rate override, then change the role. State the rate shown before
      and after - it must be the new role's locked rate, not the typed one. Repeat for a shift
      change and give both figures.
- [ ] On a card with a 12% override under a tender on 8%, the Markup placeholder and its tooltip
      both read 12. Give both strings, plus the tooltip text for a card with no override.
- [ ] On an ASB card no row shows a `Cutting?` tick - neither row 1 nor a material row. On a non-ASB
      card it is present. Name the discipline you loaded for each.
- [ ] Both themes checked. Every colour comes from a token; grep the diff for hex literals and
      report zero.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
