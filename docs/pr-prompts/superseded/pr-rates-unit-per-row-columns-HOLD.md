---
premise: '! grep -q "UNIT_PER_ROW_V1" apps/api/src/modules/rates/rate-validation.service.ts'
premise_means: assertStructure demands a per-column unit on every VALUE column, so a rate table whose rows each bill on a different basis cannot pass structure validation - which blocks every column add and every column edit on the Other rates table in production today.
scope:
  - apps/api/src/modules/rates/rate-validation.service.ts
  - apps/api/src/modules/rates/__tests__/rate-validation.service.spec.ts
  - apps/web/src/pages/admin/ratesListsHelpers.ts
  - apps/web/src/pages/admin/__tests__/ratesListsHelpers.test.ts
done_when: pnpm build && pnpm lint && grep -q "UNIT_PER_ROW_V1" apps/api/src/modules/rates/rate-validation.service.ts && grep -q "UNIT_PER_ROW_V1" apps/web/src/pages/admin/ratesListsHelpers.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df
cluster: rates-column-hygiene
cluster_order: 2
requires_on_main: 'apps/api/prisma/migrations :: rates_value_columns_require_unit'
---

# A VALUE column needs no unit when the rows carry their own (UNIT_PER_ROW_V1)

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## The defect, and why it is the RULE that is wrong rather than the data

`RateValidationService.assertStructure` (`rate-validation.service.ts:34-38`) rejects any VALUE column
with a null or blank unit. Both `createColumn` and `updateColumn` run it over the **merged** column
set, so one such column blocks **every column add and every column edit on that table**.

`#1699` fixed three tables where the omission was a genuine copy-paste slip &mdash; `plant`, `fuel` and
`enclosure` are all per-day rates and now say so. **It deliberately left a fourth, and that one is
not a slip.**

`other-rates` (`rt-or`) has three columns, created by
`20260813120000_slice-11a-enclosure-otherrates-densities`:

| id | name | dataType | role | unit |
|---|---|---|---|---|
| `rt-or-c-desc` | Description | TEXT | KEY | &mdash; |
| `rt-or-c-unit` | **Unit** | TEXT | **INFO** | &mdash; |
| `rt-or-c-rate` | Rate | CURRENCY | **VALUE** | **NULL** |

**The per-row unit is not missing. It is already captured, correctly, in the INFO column built for
it** &mdash; the seeded rows carry `"per visit"`, `"p/day"`, `"p/hr"`, `"p/hr/man"`, and others down
to `"per 6mm bar diameter"`. What is null is the **per-column** unit, and for this table a per-column
unit is meaningless, because every row bills on a different basis.

So the honest fix is not to invent a unit for that column. It is that **`assertStructure` demands a
per-column unit unconditionally, and a table whose rows each carry their own unit is a legitimate
shape it refuses.** Marco ruled this on 2026-09-07, asked directly: *relax the rule where rows carry
their own unit.*

## What to build

**The rule becomes: a VALUE column MAY omit its unit when the same table has an INFO column that
supplies a unit per row. Otherwise the existing error stands, unchanged.**

Mark it `UNIT_PER_ROW_V1` in both files so the premise inverts and the marker is greppable.

🔴 **It must be PERMISSIVE, not prescriptive.** `plant` has **both** an INFO `Unit` column *and* a
per-column unit of `day`, because every plant row really is per-day &mdash; and `#1699` has just set
that value on production. A rule that started *requiring* the column unit to be absent when an INFO
`Unit` column exists would reject `plant`, `fuel` and `enclosure` and undo that PR. Widen what is
allowed; reject nothing that is accepted today.

**How the rule identifies the unit-supplying column is the one real design call**, and it is yours to
make and defend in the PR body. The obvious reading is an INFO column named `Unit` &mdash; that is what
both `plant` and `other-rates` actually have, and it needs no schema change. It is also name-coupled
and therefore brittle, and a `dataType`/role-based or flag-based alternative may be better. **Pick
one, say why in the PR body, and say what you rejected.** If you conclude the name check is too weak
to ship, stop and report rather than adding a schema field this slice's `gate_allow: none` does not
cover.

## On the `design_ref`

This is a **validation-parity fix in a web file with no design of its own**. The cited artifact is the
Charging Methods Admin mock-up &mdash; the mock-up for `RatesListsAdminPage`, which is the screen
`ratesListsHelpers.ts` validates for, and the same citation `linefields-s1` carries for the same page.
It is named because the gate has no exemption for a correctness fix, not because a design decision is
being taken here. **Nothing in this slice changes what that screen looks like.**

## The client mirror must move with it

`validateColumnStructure` in `apps/web/src/pages/admin/ratesListsHelpers.ts:161-162` carries the same
rule with its own wording (*"needs a unit"*). `#1699`'s prompt said to leave it alone, and that was
right then &mdash; it mirrored the server correctly. **It no longer will.** If only the server relaxes,
the admin screen shows a red "Structure issues" banner for a table the server accepts, which is worse
than today's state because the user is told the save will fail when it will not. Change both, keep the
wordings distinct as they are now, and pin the agreement with a test.

## Tests

- a VALUE column with no unit on a table **with** an INFO `Unit` column &mdash; **accepted**;
- the same column on a table **without** one &mdash; still **rejected**, with the existing message;
- ⚠️ **`plant`'s real shape &mdash; INFO `Unit` column AND `unit: "day"` on the VALUE column &mdash;
  still accepted.** This is the regression guard for `#1699` and it is the test most likely to be
  left out;
- a table with two VALUE columns where only one has a unit, both directions;
- the client and the server agree on every case above. The web workspace has **no jsdom and no
  testing-library** &mdash; `validateColumnStructure` is a pure exported function, so test it directly.

**Revert your production hunk in a scratch copy and confirm the new tests go red.** Report the result.
This repo has repeatedly found suites that passed whether or not the fix was present.

## Stop and report

- **If relaxing the rule would let any table currently on `origin/main` become invalid, or would make
  any currently-valid table invalid**, stop and say which. The change is meant to be strictly
  widening.

## What this is NOT

- Not a unit for `other-rates`. There is no correct single value; that is the finding, not the gap.
- Not a change to `validateRow`, which never inspected units and is why row edits work today.
- Not a change to the "Structure issues" banner copy.
