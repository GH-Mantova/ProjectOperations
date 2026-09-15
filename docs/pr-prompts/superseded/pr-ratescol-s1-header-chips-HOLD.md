---
premise: '! grep -q "chargedFrom" apps/web/src/components/rates/rateGridModel.ts'
premise_means: The rate grid header still prints a column's role as a raw KEY / VALUE / INFO badge smuggled through labelSuffix, says nothing about its unit or list, and gives no sign of which column the system actually charges from.
scope:
  - apps/web/src/components/rates/rateGridModel.ts
  - apps/web/src/components/rates/__tests__/rateGridModel.test.ts
  - apps/web/src/components/rates/FilterableRateGrid.tsx
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "chargedFrom" apps/web/src/components/rates/rateGridModel.ts && ! grep -q "function RoleBadge" apps/web/src/pages/admin/RatesListsAdminPage.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
module: admin
cluster: ratescol
cluster_order: 2
requires_on_main: 'apps/api/src/modules/rates/rate-tables.service.ts :: Pick another name'
design_ref: https://claude.ai/code/artifact/b589c915-c92a-491e-80a5-3fe9c55a3bb6
---

# Rates columns S1 - the header says what a column is for, and which one is the rate

**Slice 2 of 5** of `ratescol`. No behaviour. The grid header gains a plain-language role chip and a
unit / list sub-line, driven by **data** on the column model instead of a React node smuggled
through `labelSuffix`, and the column the pricing engine charges from gets a visible mark. This
is the slice the mock-up says is "worth shipping on its own whatever happens to the rest". The
mock-up in `design_ref` is the standard - state 3 is what the header looks like when this lands.

**Gate:** S0 must be on main (needle `Pick another name` in `rate-tables.service.ts`). S1 does not
call S0's code; the chain is the cluster order Marco chose, so a builder never sees two of these
slices at once.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the four files in `scope`.

## Guardrails

- One attempt. If `chargedFrom` is already in `rateGridModel.ts` on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure. `pnpm build`, `pnpm lint` and the web tests
  must pass - including `pages/admin/__tests__/ChargeStepsEditor.test.tsx`, which mounts the grid
  directly (~2804) and asserts on `RatesTab.tsx`'s source (~2783-2785). It is not in scope; it
  must stay green untouched.

## Grounded on main (read first; cite line numbers in the PR body)

- `RateGridColumn` (`rateGridModel.ts` ~12) carries `key`, `label`, `kind`
  (`"text" | "number" | "currency"`), `labelSuffix?: ReactNode`, `groupable`, ... - **no role**.
  The admin page builds it in `toGridColumn` (`RatesListsAdminPage.tsx` ~1862-1875) and sets
  `labelSuffix: <RoleBadge role={c.role} />` (~1868); `RoleBadge` (~1598) prints the raw enum
  `KEY` / `VALUE` / `INFO`. `groupable: c.role === "KEY" && kind === "text"` (~1871).
- `FilterableRateGrid.tsx` renders the header cell with `{column.labelSuffix}` at ~541 and the
  filter chevron / `HeaderDropdown` at ~542-576. The grid has **two consumers**:
  `RatesListsAdminPage.tsx` ~1707 and the tender Rates tab `RatesTab.tsx` ~345. Every prop you add
  is optional with a no-op default so `RatesTab.tsx` is unchanged - **do not touch that file**.
- **Which column is "the rate".** `RateResolverService` prices from `valueCols[0]` - the first
  VALUE column in the order the resolver builds `valueCols` (`rate-resolver.service.ts` ~347,
  ~367, ~371; and ~681-684, "Use valueCols[0] only"). Read that ordering and reproduce it exactly
  in the pure helper below; do not assume `sortOrder` without checking.
- Cell text is `renderCellDisplay`'s own (~1887-1901): money renders `$14.30 / m`, numbers
  `150 mm`. The unit already reaches the cell; this slice puts it in the header too.
- `GET /lists` returns `ListSummary` with `name` and `slug` (~78-87); the page already holds it.
  A list column's sub-line shows the list's **name**. The word `slug` appears nowhere a user reads.

## What to build

### 1. `rateGridModel.ts` - role as data

- `export type RateGridColumnRole = "lookup" | "price" | "info";` - the grid's vocabulary, not the
  DTO enum. Add to `RateGridColumn`: `role?: RateGridColumnRole`, `chargedFrom?: boolean`,
  `subline?: string`. All optional; `labelSuffix` stays supported for any caller still using it.
- `export function markChargedFrom(columns: RateGridColumn[]): RateGridColumn[]` - pure: returns
  the columns with `chargedFrom: true` on exactly the column the resolver would take as
  `valueCols[0]`, `false` on every other price column, absent elsewhere. No price column -> no
  mark. Spec it in `__tests__/rateGridModel.test.ts` with three cases: one price column, three
  price columns (leftmost wins), no price column.

### 2. `FilterableRateGrid.tsx` - render it

In the header cell, after the label: the role chip, then the sub-line on its own line:

| `role` | chip text | chip style |
|---|---|---|
| `lookup` | `look-up` | quiet |
| `price` and `chargedFrom` | `the rate` | filled - the one filled chip in the header |
| `price` | `price` | outlined |
| `info` | `info` | quiet |

The `chargedFrom` column also carries a **rule down its whole column** (`th` and every `td` in
that column get an inset left rule) so the charged-from column is visible without opening
anything - mock-up state 3, `.charged`. Sub-line: `subline` verbatim when set. Chips use the
page's existing `s7-*` tokens; no hex literal, no new font.

`labelSuffix` still renders where a caller sets it (RatesTab does not), so nothing else on either
consumer moves.

### 3. `RatesListsAdminPage.tsx` - feed it, delete `RoleBadge`

- `toGridColumn` maps `KEY -> lookup`, `VALUE -> price`, `INFO -> info`, and builds `subline`:
  - price: `$ per <unit>` (`$ per m`); a price column with no unit on a table that carries a
    per-row Unit column: `$ · unit per row`;
  - list column: `<role chip word> · <list name>` resolved from the `ListSummary` the page holds
    by `listSlug` (fall back to the slug only if the name is unknown);
  - a look-up / info column with a unit: `<role chip word> · <unit>`;
  - otherwise no sub-line.
- Run the mapped columns through `markChargedFrom` before handing them to the grid.
- **Delete `RoleBadge`** and the `labelSuffix: <RoleBadge …/>` line. `done_when` asserts the
  function is gone. Nothing else on the page changes in this slice - the Fields card, the
  Add-column form and the Rows card are S2 / S3.

## Do NOT

- Do NOT add any menu item, control or handler - this slice changes what the header **says**.
- Do NOT touch `RatesTab.tsx`, `ChargeStepsEditor.test.tsx`, the API, or `/sot/`.
- Do NOT make any new grid prop required.
- Do NOT print `KEY` / `VALUE` / `INFO` or `slug` anywhere a user reads.

## VERIFY

```
pnpm build && pnpm lint && pnpm --filter @project-ops/web test
grep -q "chargedFrom" apps/web/src/components/rates/rateGridModel.ts
! grep -q "function RoleBadge" apps/web/src/pages/admin/RatesListsAdminPage.tsx
git diff --stat origin/main -- apps/web/src/pages/tendering/RatesTab.tsx   # must be empty
```

Open the PR titled `feat(rates): S1 - grid header shows role, unit and the charged-from column as data`
and leave it UNMERGED.
