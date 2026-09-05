---
premise: '! grep -q "SCOPE_PLANT_PICKER_V2" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx'
premise_means: >-
  The plant Type dropdown is one flat list in whatever order the API returned, with the category
  glued onto the front of every label, where the mock-up shows one group per category in a fixed
  order. The list also never offers the manual-entry option the code already handles, so the entire
  custom-plant feature - the free-text name, the revert control and the custom rate cell - is
  unreachable dead code and anything the catalogue does not carry cannot be entered at all.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/components/TooltipSelect.tsx
  - apps/web/src/pages/tendering/__tests__/wbs-plant-picker-groups.test.tsx
done_when: pnpm build && pnpm lint && grep -q "SCOPE_PLANT_PICKER_V2" apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: scope-card-corrections
cluster_order: 3
requires_on_main: 'apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx :: SCOPE_WBS_INPUTS_V2'
rollback_strategy: >-
  Web-only: the table, the shared select, one test. No API, no schema, no migration, no new
  dependency. The grouped option form is added alongside the flat one, so the other fifteen call
  sites are untouched. Revert and the picker renders the flat list it renders today.
---

# The plant picker is one flat list, and its manual-entry escape hatch was never wired up

Third slice of the corrections cluster, gated behind slice 2's `SCOPE_WBS_INPUTS_V2` because both
edit the same component. Approved mock-up:
`https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

Measured 2026-09-04 against `origin/main`. Two defects and one open question. The second defect is
the important one: a whole feature is present in the code and reachable by nobody.

## What to build

**1. Group the list.** `plantTypeOptions` at lines 648-665 already groups the rates by category
into a `Map` at lines 651-657 - and then throws the grouping away, flattening back into one array
and prefixing the category into each label as `${cat}: ${p.item}` at line 661. Iteration is `Map`
insertion order, which is the order the API returned the rows, so the categories appear in whatever
order they arrived.

The mock-up emits one `<optgroup>` per category in a fixed order: Excavator, Bobcat, Crane, Truck,
Other. The string `optgroup` appears nowhere in `apps/web/src` - grep it and confirm zero - because
`TooltipSelect` renders a flat `options.map` at lines 65-75. It has to learn groups.

- Add the grouped form as an **optional** shape alongside the flat `options` prop rather than
  replacing it. `TooltipSelect` has sixteen call sites, all inside `ScopeQuantitiesTable.tsx`, and
  only the plant Type select at line 1646 needs groups.
- Keep the tooltip contract the component exists for: the closed select still carries the selected
  option's label as its `title` (line 40), and every `<option>` still carries its own `title`
  (line 70).
- `EstimatePlantRate.category` is `String?` in `apps/api/prisma/schema.prisma` - nullable, free
  text, no enum - and the code already substitutes `"Other"` for a null at line 653. The mock-up's
  five categories are therefore a preference, not a guarantee. Order those five first, in the
  mock-up's order, and append any category the API returns that is not among them. Nothing may be
  dropped because its category was unexpected. Say in the PR body what an unlisted category did.
- Once the group heading carries the category, drop the `${cat}: ` prefix from the label at line
  661. The mock-up does not repeat it.

**2. Emit the manual-entry option - the custom-plant feature is currently unreachable.** The string
`__custom__` appears exactly once in the whole file, at line 1652, inside the plant Type `onChange`
handler. Grep it and confirm the count is 1. Nothing ever puts it in the option list, so the
handler's branch never fires, `isCustom` is never true, and everything behind it is dead code:

- the free-text name input and its revert control at lines 1626-1644,
- the custom rate input with no locked rate at lines 1701-1716,
- `onCustomDescription` (lines 1170-1172) and `onRevertToList` (lines 1173-1179), neither of which
  any UI path calls.

The mock-up's list always ends with `✎ Type it manually…`, under an `<optgroup>` labelled
`Not in the list`, and its legend reads: *"Plant can be free-typed. The list ends with
'✎ Type it manually…' - pick it and the cell becomes a text box with its own rate."*

Append that entry as the final option, value `__custom__`, in its own trailing group. The handler
at line 1652 already does the right thing with it, so this is wiring rather than new behaviour:
exercise the existing branch first and fix it if it is wrong, but do not write a second one beside
it. This is the only route an estimator has to an item the catalogue does not carry - the mock-up
names a decontamination unit, a HEPA vacuum and an EWP as the asbestos cases it exists for.

**3. OPEN QUESTION - the transport filter. Leave it in place.** `isTransportPlant` at lines 150-152
returns true when `p.category === "Truck"` or `p.unit === "each way"`, and it is applied at line 649
in the Type picker and again at line 623 in `plantOptions`. Hook trucks, semi tippers and plant
floats therefore cannot be put on a WBS row at all. The mock-up includes them and uses them in its
own worked examples. That is a genuine conflict, and it is **not** a defect for this slice to fix.

The filter looks deliberate and the reason is on record. The comment directly above it, lines
147-149, says transport items are *"moving to a separate 'Transport Fees' surface"* and names both
tests. It arrived in commit `6a5ed44e`, *"filter transport items from plant picker dropdown"*
(#594). `apps/api/prisma/schema.prisma` corroborates the destination: `ScopeWasteItem.transportRateId`
points at an `EstimatePlantRate` row and is documented as the Transport Fees reference (comment near
line 3782, relation at line 3800).

So: **do not remove it, do not narrow it, and do not add a flag that bypasses it.** Instead, state
in the PR body (a) the commit and the comment that introduced the filter, (b) whether the Transport
Fees surface it points at actually carries these items today - `ScopeWasteTab.tsx` is where to look
- and (c) whether the mock-up putting hook trucks on a WBS row means that decision has lapsed.
Write it as an open question for Marco to rule on, not as a recommendation you have acted on.

Mark the component with `SCOPE_PLANT_PICKER_V2`.

## Do NOT

- **Do not change `isTransportPlant` or either of its call sites** (lines 623 and 649). See item 3 -
  the PR body reports on it, the diff does not touch it.
- **Do not change the rendering of the other fifteen `TooltipSelect` call sites.** The grouped
  option form is opt-in; a call site that passes a flat list must produce the same markup it
  produces today.
- **Do not add, remove or re-point a `patchItem` call.** Plant row state is local and the picker
  writes nothing to the server today - it must not start here. Persistence is a separate cluster.
- Do not touch the manpower columns, the money formatting, the markup prop or the Cutting gate -
  slice 2 owns all four and lands first.
- Do not touch the Measurement column or the trailing Actions column - `pr-cardui-s5` owns those.
- Do not touch `/sot/`, the API, `apps/api/prisma`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/web test` green.
- [ ] Open the plant Type dropdown and read back the group headings in the order they render. Name
      every category the API returned and say where each one landed, including any that is not one
      of the mock-up's five.
- [ ] An option's label no longer repeats its category. Give one label before and after.
- [ ] `grep -rc optgroup apps/web/src` was 0 before this PR; give the after figure and the file it
      is in.
- [ ] The final entry in the list is the manual-entry option under its own group heading. Give the
      group label and the option label exactly as rendered.
- [ ] Pick it: the Type cell becomes a text box and the Day rate cell becomes a plain rate input
      with no locked rate. Type a name and a rate, then use the revert control, and say what the
      cell returns to.
- [ ] Trucks and plant floats are still absent from the list. Say so explicitly, name the commit
      that filtered them, and state whether the Transport Fees surface carries them today.
- [ ] Both themes checked. Every colour comes from a token; grep the diff for hex literals and
      report zero.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
