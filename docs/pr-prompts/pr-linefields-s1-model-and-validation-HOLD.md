---
premise: '! grep -q "RATE_LINE_FIELDS_V1" apps/api/src/modules/rates/rate-tables.service.ts'
premise_means: >-
  A charge step can name a rate-table column or a numeric literal, and nothing else. RateTable
  carries columns and rows only (schema.prisma:5821-5843), and validateChargeSteps in
  rate-tables.service.ts throws a 400 for any field name that is not a column - at :402-406 for an
  arithmetic operand and at :440-444 for a condition field. The estimator-entered operands the
  approved mock-up prices against - Depth, Holes, Elevation, Metres, Men, Days - cannot be
  declared, cannot be typed and cannot be saved, so none of the mock-up's four worked examples can
  be entered at all.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/
  - docs/data-model/metadata-catalog.json
  - apps/api/src/modules/rates/rate-tables.service.ts
  - apps/api/src/modules/rates/dto/charge-steps.dto.ts
  - apps/api/src/modules/rates/rates.controller.ts
  - packages/config/src/charge-step-semantics.ts
  - apps/web/src/pages/admin/ChargeStepsEditor.tsx
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
done_when: pnpm build && pnpm lint && grep -q "RATE_LINE_FIELDS_V1" apps/api/src/modules/rates/rate-tables.service.ts
size: 8
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df
cluster: line-fields
cluster_order: 1
requires_on_main: 'apps/api/src/modules/rates/rate-step-evaluator.ts :: CHARGE_STEP_PARITY_V1'
rollback_strategy: >-
  The migration adds one nullable JSONB column to rate_tables and writes no row data. It is safe to
  leave applied on main with no consuming code: every read is `table.lineFields ?? []`, so an
  applied column with nothing reading it behaves exactly as main does today, and re-running the
  migration changes nothing. If the run dies after the migration and before the service change,
  leave the column and land the code in a follow-up - do not reverse the migration, because the
  column is additive and removing it would require a second migration to achieve nothing. The web
  and API halves are independently revertible: reverting the web files alone leaves declared line
  fields stored and unused.
---

# A charge step can only name a column, so the mock-up's four rules cannot be entered

First slice of the line-fields cluster. Approved mock-up:
`https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df`

Marco ruled on 2026-09-04, on the four decisions behind package 9, that charge steps price against
estimator-entered values as well as stored rate-table columns (Decision 1: yes), and that the
mock-up is the specification for what that means - including its `From` distinction between *the
rate table* and *the estimate line*, and its four worked examples, all of which must be expressible
once this cluster lands. This slice is the model and the validation. Nothing else in the cluster can
start until a step is allowed to name something that is not a column.

Measured 2026-09-04 against `origin/main`. The mock-up's own four tables are the acceptance set:
`Core holes` (line fields Depth mm, Elevation text, Holes), `Saw cuts - by depth band` (Metres),
`Saw cuts - by the millimetre` (Depth mm, Metres) and `Labour day rates` (Men, Days). Not one of
them is enterable today: `Depth / 10 -> round -> x Rate -> x Holes` fails at the first step, because
`Depth` is not a column on the table and `validateChargeSteps` rejects it with a 400.

Standing note, unchanged from the charge-steps cluster: `chargeSteps` is stored, validated and
previewed and is never priced against anything. `evaluateSteps`
(`apps/api/src/modules/rates/rate-step-evaluator.ts:237`) has exactly two references in the repo -
its own definition and `apps/api/src/modules/rates/__tests__/rate-step-evaluator.spec.ts` - and
`RateResolverService` never reads the field. This slice widens a path that does not yet run in
production. Whether a stored step list may price a tender line is Decision 2 and is parity-gated;
see Do NOT.

Marco's ruling is explicit that parity lands first, which is why this slice gates on
`CHARGE_STEP_PARITY_V1`: adding a second class of operand to two evaluators that already disagree
doubles the surface on which they can disagree.

## What to build

**1. One additive column on RateTable.** In `apps/api/prisma/schema.prisma`, beside
`chargeSteps Json? @map("charge_steps")` (`:5832`):

```prisma
lineFields  Json?  @map("line_fields")
```

Add the migration under `apps/api/prisma/migrations/` in a folder whose name contains
`rate_line_fields`, with the one statement it needs:
`ALTER TABLE "rate_tables" ADD COLUMN "line_fields" JSONB;`. Nullable, additive, writes no row
data.

Do not add a `RateLineField` table. `chargeSteps` is already a `Json?` column on this same model,
declared by the same person on the same screen; a line field is the same kind of thing and is
stored the same way. Nothing joins to a line field and nothing references one by id, so a second
table would buy a controller, a DTO pair and a CRUD screen before a step could name one.

**2. The record shape, and the rules that make it safe.** A line field is:

```
{ name: string; kind: "number" | "text"; unit?: string | null; options?: string[]; sample?: number | string }
```

- `name` is trimmed and non-empty, at most 120 characters - the same ceiling
  `CreateRateColumnDto` puts on a column name (`dto/rate-column.dto.ts:29`).
- **Names must be unique across line fields AND must not collide with a column name on the same
  table.** Columns already carry `@@unique([rateTableId, name])` (`schema.prisma:5861`). Both kinds
  of field land in ONE values map keyed by name, so a collision makes the operand ambiguous and
  silently picks a winner. Reject it with a 400 that names the clash.
- `kind: "text"` may carry `options`, a list of strings - the mock-up's `Elevation` line field is
  `text` with `['Floor','Wall','Inverted']`. A text line field may be named by a condition field
  and never by an arithmetic operand, which is the rule the editor already applies to TEXT and
  LIST_REF columns (`numericFieldOptions`, `ChargeStepsEditor.tsx:50-52`).
- `sample` is the value the preview uses until slice 4 builds real inputs. The mock-up carries one
  per line field for exactly this reason: Depth 18, Elevation `Inverted`, Holes 12.

**3. Widen the server's field-name validation.** `validateChargeSteps`
(`rate-tables.service.ts:370-454`) builds `columnSet` from column names at `:375` and rejects
anything else at `:402-406` (arithmetic operand) and `:440-444` (condition field). Build the name
set from columns **plus** the table's declared line fields, and keep the two failure modes
distinguishable: an unknown name and a text field used in the sum are different mistakes and must
not share a message. Validate the `lineFields` payload itself in the same function's file, with the
same 400-on-any-structural-violation contract.

**4. The route has to be able to carry it.** `PatchChargeStepsDto`
(`dto/charge-steps.dto.ts:15-19`) declares `steps` only, and the global `ValidationPipe` runs with
`whitelist: true` **and** `forbidNonWhitelisted: true` (`apps/api/src/bootstrap/create-app.ts:21-27`)
- so an undeclared `lineFields` property on the PATCH body is a 400, not a quietly dropped field.
Declare it on the DTO, and pass it through at `rates.controller.ts:388`, which today reads
`dto.steps` alone.

**5. One values payload, built once, used by both sides.** A step resolves an operand by name from a
`Record<string, number | string>` map. That map is built inline on the client today
(`scenarioValues`, `ChargeStepsEditor.tsx:353-363`) and nowhere at all on the server, because
nothing calls `evaluateSteps` yet. Put the builder in
`packages/config/src/charge-step-semantics.ts` - the module `CHARGE_STEP_PARITY_V1` introduces for
exactly this reason - as one exported function that takes the columns, the matched row's cells, the
declared line fields and the line values, and returns the merged map. Have the client call it in
place of the inline loop.

**This is the parity surface, and Marco's rule from `CHARGE_STEP_PARITY_V1` applies to it.** A line
field must resolve to the same value on both sides, and a line field with no value must produce
whatever outcome parity already defined for a column with no value - one rule, not two.

`apps/api/src/modules/rates/rate-step-evaluator.ts` is deliberately NOT in `scope`, and should need
no edit: `resolveNumeric` (`:148-159`) and `evaluateCondition` (`:166-193`) both key off `values` by
name, so a line field resolves the moment it is in the map. If you find that line-field parity
cannot be reached without changing that file, stop and say
`NO-OP: line-field parity needs a change inside rate-step-evaluator.ts, which CHARGE_STEP_PARITY_V1 owns`.

**6. Enough of the editor to enter one.** `numericFieldOptions` and `allFieldOptions`
(`ChargeStepsEditor.tsx:50-57`) take columns only; widen them to take the declared line fields as
well, so the existing add-step form's operand select offers a number-kind line field and its
condition select offers a text one. The mount point at `RatesListsAdminPage.tsx:1142-1149` passes
`columns` and `rows` and must now pass `lineFields`; widen the `RateTable` type in that file to
carry the field. That is the whole web change in this slice - **the single operand picker and
in-place editing are slice 2, the Fields table is slice 3, and the scenario inputs are slice 4.**

**7. Regenerate the data-model catalog.** Run `pnpm data-model:build` and commit the regenerated
`docs/data-model/metadata-catalog.json`. Do not commit `relationship-map.json` or
`relationship-map.md`: both are gitignored (`.gitignore:135-136`) and CI's drift check
(`build-relationship-map.mjs --check`, `.github/workflows/ci.yml:131`) only proves the generator
still parses the schema. Put `GATE-ALLOW: migrations` as a bare line at column 0 of the PR body.

Mark `apps/api/src/modules/rates/rate-tables.service.ts` with `RATE_LINE_FIELDS_V1`.

## Do NOT

- **Do not wire `evaluateSteps` into `RateResolverService`,** or into any other pricing path. That
  is Decision 2, it is parity-gated, and it has not been made. Adding a second class of operand is
  not a reason to start pricing with the first.
- **Do not build the rest of the cluster.** In-place step editing is slice 2, the Fields table with
  `From` and `Used in` is slice 3, and the cascading scenario picker with the highlighted row is
  slice 4. A PR carrying the schema change and an editor rebuild together sits unreviewed - that is
  the reason the ruling split them.
- **Do not let `floor` or `cap` take a field.** `FloorStep` and `CapStep` keep `value: number`.
  The mock-up's `Core holes` rule uses `floor 1` as a literal.
- **Do not relax any existing validation.** The first-step-must-be-`start` rule
  (`rate-tables.service.ts:390-392` and `validateSteps` at `ChargeStepsEditor.tsx:166-168`), the
  known-op set (`:355-364`) and the comparator set (`:446-451`) all stay exactly as they are. This
  slice adds a class of legal name; it removes no check.
- **Do not add an API route, a controller method, or a model.** The only route change permitted is
  the `lineFields` property on the existing `PATCH /rates/tables/:id/charge-steps` body.
- **Do not change what any existing step evaluates to.** A stored step list that names only columns
  must produce the identical number before and after this slice.
- Do not touch `/sot/`, the rows table, the rates list columns card beyond the one prop widening
  named in item 6, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/api test` and `pnpm --filter @project-ops/web test` both green.
- [ ] Name the migration folder and paste the SQL. Confirm it is one `ADD COLUMN`, nullable, and
      that it writes no row data.
- [ ] **Worked example, end to end, from the mock-up: `Core holes`.** Declare line fields
      `Depth` (number, mm, sample 18), `Elevation` (text, options Floor / Wall / Inverted, sample
      `Inverted`) and `Holes` (number, sample 12) on a table whose columns are `Diameter` (KEY,
      NUMBER, mm) and `Rate` (VALUE, CURRENCY), with the row `Diameter 32, Rate 1.70`. Enter the
      seven steps: start with `Depth`; divide by 10; round to the nearest 1; never less than 1;
      multiply by `Rate`; multiply by 2 only when `Elevation` is `Inverted`; multiply by `Holes`.
      **Save it, reload it, and state the line total.** It must be `81.60`. Quote the running total
      after each of the seven steps (18, 1.8, 2, 2, 3.40, 6.80, 81.60) and confirm the PATCH
      returned 200 rather than a 400.
- [ ] State what the same PATCH returns on `origin/main` today, and quote the exact 400 message.
- [ ] Name collision: declare a line field named the same as an existing column and quote the 400.
      State the field name and the column name.
- [ ] Text in the sum: point a `multiply` step at the `Elevation` line field and quote the message.
      Confirm it is distinguishable from the message for a name that does not exist at all, and
      quote both.
- [ ] Parity: give one step list using a line field and state the figure produced by the client
      preview and by the server evaluator against the same values map. They must match; state both
      numbers. Say which function builds the map and confirm it has exactly one implementation.
- [ ] Report the reference count for `evaluateSteps` after the change and confirm no new caller in
      any pricing path was added.
- [ ] Confirm a stored step list that names only columns produces the same number before and after.
      State it.
- [ ] `docs/data-model/metadata-catalog.json` regenerated and committed;
      `relationship-map.json` / `.md` not committed. Say so.
- [ ] `GATE-ALLOW: migrations` present as a bare line at column 0 of the PR body.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco. It is
`true` here because this slice changes the database schema and widens what the server will accept
and store.
