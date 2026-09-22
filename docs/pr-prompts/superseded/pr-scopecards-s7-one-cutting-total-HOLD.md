<!-- RETIRED 2026-09-22 by station-00.interactive-0004: SPENT, the work SHIPPED.
     S7 landed as #2093 (CUTTING_ONE_TOTAL_V1), merged 21:24:16Z with Marco's receipt at
     docs/decisions/merge-approvals/2093.md. On main now: cutting-line-pricing.ts,
     EstimateCuttingLine.lineTotal (migrations 20260923000002/3/4), and all six readers
     summing the stored lineTotal.
     WHY LINT STILL ADMITTED IT: the premise greps 'cuttingLines.reduce' in
     scope-of-works.service.ts, and that string survives the slice - the reduce now sums
     l.lineTotal instead of qty x rate. The premise cannot tell the two apart, so a spent
     prompt kept reading as armable. Arming it would have rebuilt a shipped slice. -->
---
premise: 'grep -q "cuttingLines.reduce" apps/api/src/modules/tendering/scope-of-works.service.ts'
premise_means: A cutting line's money is worked out in two ways that do not agree. A scope-card cutting row (CuttingSheetItem) is priced once by the server and its lineTotal is stored. An estimate cutting line (EstimateCuttingLine) has nowhere to store a total, so six readers each re-multiply qty x rate for themselves, and the scope-of-works generator picks its rate with a private copy of the row-picker that takes the depth BELOW the requested one and never applies a loading. This slice gives both models one pricing function and gives the estimate line a stored total.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/cutting-line-pricing.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/scope-of-works.service.ts
  - apps/api/src/modules/tendering/scope/estimate-proposals.service.ts
  - apps/api/src/modules/estimates/estimates.service.ts
  - apps/api/src/modules/contracts/contracts.service.ts
  - apps/api/src/modules/projects/projects.service.ts
  - apps/api/src/modules/tendering/__tests__/cutting-one-total.spec.ts
  - apps/api/src/modules/tendering/__tests__/scope-of-works-rate-resolver.spec.ts
  - apps/api/src/modules/**/__tests__/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/api test -- cutting-one-total cutting-step-equivalence cutting-rate-corrections scope-redesign-rate-resolver scope-of-works-rate-resolver && grep -q "CUTTING_ONE_TOTAL_V1" apps/api/src/modules/tendering/cutting-line-pricing.ts && ! grep -rEq --include=*.ts --exclude=*.spec.ts --exclude-dir=__tests__ "(Number|toNumber)\((l|line)\.qty\) \* (Number|toNumber)\((l|line)\.rate\)" apps/api/src/modules && test "$(ls apps/api/prisma/migrations | grep -c scopecards_s7_cutting_line_total)" = "3" && node scripts/data-model/build-relationship-map.mjs --check
size: 7
gate_allow: migrations
backfill: true
rollback_strategy: Three migration files. The first adds a nullable line_total Decimal(12,2) to estimate_cutting_lines and changes nothing else. The second is one UPDATE that sets line_total = ROUND(qty * rate, 2) where it is null - it moves no figure, because it multiplies the rate each row already stores. The third sets NOT NULL. To revert, drop the column and restore the six qty x rate folds.
seed_only: false
escalates: true
module: tendering
cluster: scopecards
cluster_order: 9
requires_on_main: 'apps/web/src/pages/tendering/ScopeCuttingSheet.tsx :: CUTTING_ONE_SURFACE_V1'
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
---

# Scope Cards S7 - one cutting total, on the server

**Seventh of nine.** S6 (#2071, `CUTTING_ONE_SURFACE_V1`) put one concrete-cutting surface on the
card; the sheet now folds only the server's stored `lineTotal`s and reports them upward through
`onSectionTotalChange`. **This slice is API only and changes no figure on the card.** It makes the
server price a cutting line in one place for both cutting models and store the result.

> Marco, 2026-09-21, the calls this slice carries: one shared pricing function called at write time;
> both models keep their shape (no convergence migration); existing rows are backfilled and the
> fallback is dropped, because *"there is no existing calculated quote within the ERP now."*
>
> Marco, 2026-09-22 (carried by S6, prompt section 6): **a depth with no priced row prices at the next
> depth up**, and rows added to the table later are picked up. That is `resolveCuttingRate`'s row
> pick (`scope-redesign.service.ts` ~`:310-325`: deepest at-or-above the requested depth, else the
> biggest available), reading the table live through `listRates`. Nothing in this slice may cache,
> copy or hard-code a depth list.

## Grounded on origin/main eb3086fa, 2026-09-22 - re-verify every line number before you edit

| | `EstimateCuttingLine` (`schema.prisma:2844`) | `CuttingSheetItem` (`:4203`) |
|---|---|---|
| money | `qty Decimal(10,2)`, `rate Decimal(10,4)` | quantityLm / quantityEach, ratePerM / ratePerHole, shiftLoading, markupOverride, quoteDestination |
| stored total | **none** | `lineTotal Decimal(12,2)?` - null means *unpriced*, and that is meaningful |
| written by | `estimates.service.ts:1184` create, `:1231` update; `scope-of-works.service.ts:818` saw cut, `:852` core hole; `estimate-proposals.service.ts:274` AI proposal accept | `scope-redesign.service.ts` `pricedCuttingData` (`:1700`), called from create `:707` and update `:818` |

**The six re-multiplications** - every one `qty x rate`, none reading a stored figure:

```
contracts.service.ts:308        for (const l of item.cuttingLines) lineTotal += Number(l.qty) * Number(l.rate);
contracts.service.ts:1611       item.cuttingLines.reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0)
estimates.service.ts:1405       round2(item.cuttingLines.reduce(... toNumber(l.qty) * toNumber(l.rate) ...))
projects.service.ts:~702-710    for (const line of item.cuttingLines) estimateTotal += Number(line.qty) * Number(line.rate)
scope-of-works.service.ts:1635  item.cuttingLines.reduce((sum, l) => sum + Number(l.qty) * Number(l.rate), 0)
scope-redesign.service.ts:1846  item.cuttingLines.reduce((sum, l) => sum + Number(l.qty) * Number(l.rate), 0)
```

**Where the estimate line's rate comes from.**
- `resolveCuttingRate` (`scope-redesign.service.ts:220`) and `resolveCoreHoleRate` (`:436`) pick the
  row and, since S5, price it through the table's charge steps. Their only non-test caller is
  `pricedCuttingData`, the scope-card side.
- `scope-of-works.service.ts:~800-830` **re-implements the row-picker** as *deepest at-or-below* the
  requested depth (its own comment says so) and stores the raw `cuttingMatch.value` - no step, no
  loading. **That contradicts Marco's next-depth-up ruling.**
- `scope-of-works.service.ts:~845-859` stores `resolveRate("core-hole").value` - the raw per-hole rate.
- `estimates.service.ts:1196` stores `dto.rate` verbatim. No web caller exists; the rate comes from
  an API caller or an accepted AI proposal (`estimate-proposals.service.ts:274`). **A rate someone
  supplied is a decision - store it as given, never re-resolve it.**

**How the scope-card side rounds** - `pricedCuttingData` ends each branch with
`lineTotal: new Prisma.Decimal(total.toFixed(2))` (`:1737` other-rate, `:1759` saw cut, `:1805` core
hole). `toFixed` rounds a binary float; Postgres `ROUND` rounds a decimal. They disagree at exact
half-cents. One total means one rounding.

**S6 carry-overs, verified:**
- `sanitiseSawElevation` and `METHODS_BY_EQUIPMENT` stay - `resolveCuttingRate` still calls both. Do
  not remove or rename them. **Import** `resolveCuttingRate` / `resolveCoreHoleRate` into the new file;
  do not move them.
- The web is done: `ScopeCuttingSheet.tsx` folds `lineTotal` (`:~232-243`) and ScopeCardsTab adds it
  at its one fold point. Do not add a second fold anywhere.
- If an e2e check is ever touched, the section heading's accessible name is
  `Concrete cutting(N items)` - no space before the bracket.

## Build this

`export const CUTTING_ONE_TOTAL_V1 = "scopecards-s7";` in
`apps/api/src/modules/tendering/cutting-line-pricing.ts` (NEW).

### 1. One pricing function - `cutting-line-pricing.ts` (NEW)

```ts
/** THE cutting line total. Decimal arithmetic, half-up to the cent - the same rule as Postgres ROUND. */
export function cuttingLineTotal(input: {
  qty: Prisma.Decimal | number | string;
  rate: Prisma.Decimal | number | string;
  addOn?: Prisma.Decimal | number | string | null;   // legacy shiftLoading (deprecated by S6, data kept)
}): Prisma.Decimal

/** Rate + total for one line. Uses the caller's rate when one is supplied; resolves it otherwise. */
export async function priceCuttingLine(deps, input: {
  kind: "saw-cut" | "core-hole";
  equipment?: string | null; elevation?: string | null; material?: string | null;
  depthMm?: number | null; diameterMm?: number | null; method?: string | null;
  qty: number;
  rate?: number | null;                               // supplied -> used as given, never re-resolved
  addOn?: number | null;
  tenderId?: string | null;
}): Promise<{ rate: Prisma.Decimal; lineTotal: Prisma.Decimal } | null>
```

- `cuttingLineTotal` = `new Prisma.Decimal(qty).mul(rate).add(addOn ?? 0).toDecimalPlaces(2,
  Prisma.Decimal.ROUND_HALF_UP)`. **No `Number`, no `toFixed`.**
- `priceCuttingLine` resolves through `resolveCuttingRate` (saw cut) or `resolveCoreHoleRate` (core
  hole), passing `tenderId` so locked snapshots apply. Returns `null` exactly where they do.

### 2. Both models call it

- **`CuttingSheetItem`** - `pricedCuttingData` keeps choosing the rate exactly as S5 left it and hands
  the final arithmetic to `cuttingLineTotal` (`addOn` = the row's `shiftLoading`). The three
  `lineTotal: new Prisma.Decimal(total.toFixed(2))` lines go. `lineTotal` stays **nullable** here.
- **`scope-of-works.service.ts:~800-830`** - delete the private row-picker (`cuttingMatch`) and call
  `priceCuttingLine({ kind: "saw-cut", ... })`. Store the returned `rate` and `lineTotal`. On `null`,
  store `rate 0` / `lineTotal 0` - today's miss path.
- **`scope-of-works.service.ts:~845-859`** - `priceCuttingLine({ kind: "core-hole", diameterMm, qty })`.
  A generated core hole carries no depth and no elevation; through the `core-hole` steps that is
  today's figure exactly. Assert it.
- **`estimates.service.ts:1184` / `:1231`** - store `lineTotal: cuttingLineTotal({ qty, rate })` with
  the **supplied** rate. On update, recompute whenever `qty` or `rate` is in the patch, from the merged
  values.
- **`estimate-proposals.service.ts:274`** - the same, with the accepted proposal's rate as given.

**What moves - say it in the PR body.** Only **newly generated** scope-of-works rows:
1. a depth that falls between two seeded depths now prices at the **next depth up** (Marco's ruling),
   where the private picker took the one below;
2. a Wall elevation now gets the priced Wall row the scope-card side has always used.
A supplied rate never moves. An existing row never moves.

### 3. The estimate line gets a stored total - three migrations

`lineTotal Decimal @map("line_total") @db.Decimal(12, 2)` on `EstimateCuttingLine`. DDL and data never
share a file (S2a precedent). Timestamps after `20260922000001`.

1. `<ts>_scopecards_s7_cutting_line_total` - `ADD COLUMN "line_total" DECIMAL(12,2)`, nullable.
2. `<ts>_scopecards_s7_cutting_line_total_backfill` -
   `UPDATE "estimate_cutting_lines" SET "line_total" = ROUND("qty" * "rate", 2) WHERE "line_total" IS NULL;`
   It multiplies the rate each row already stores - it never re-resolves one. No figure moves.
3. `<ts>_scopecards_s7_cutting_line_total_not_null` - `ALTER COLUMN "line_total" SET NOT NULL`.

`GATE-ALLOW: migrations` bare at column 0 of the PR body (CP-11). Regenerate `docs/data-model/`
(`node scripts/data-model/build-relationship-map.mjs`).

### 4. The six readers read it

Each of the six sites becomes a sum of `l.lineTotal`, keeping its shape (`reduce` stays `reduce`, the
loop stays a loop, `round2` at `estimates.service.ts:1405` stays on the sum). Add `lineTotal` wherever
those queries `select` cutting-line fields. **No fallback** - no `lineTotal ?? qty * rate` anywhere.

### 5. Tests

- **`cutting-one-total.spec.ts` (NEW)**
  - Half-up on exact half-cents: `qty 1, rate 1.005` -> `1.01`; `qty 3, rate 0.335` -> `1.01`; `addOn`
    is added before rounding.
  - **Scope-card equivalence**: for every seeded `cutting`, `cutting-mm` and `core-hole` row that
    `cutting-step-equivalence.spec.ts` enumerates, at `qty` 1, 2.5 and 17.35, with and without a
    `shiftLoading`, `pricedCuttingData`'s `lineTotal` equals its pre-slice value **to the cent**. List
    every half-cent case where `toFixed` and half-up differ in the PR body (or write *none found*).
  - **Next depth up**: a generated saw cut at a depth between two seeded depths stores the deeper row's
    priced rate; a row added to the mocked table afterwards is picked up on the next generation.
  - A supplied rate is stored as given (`rate "42.1234"` -> `lineTotal = ROUND(qty * 42.1234, 2)`) and
    no lookup runs.
  - `updateCuttingLine` recomputes when only `qty` changes, and when only `rate` changes.
  - A generated Wall saw cut stores the scope-card side's rate for the same key.
  - A generated core hole with no depth and no elevation stores exactly today's `rate * qty`.
  - Each of the six readers, fed rows whose `lineTotal` deliberately differs from `qty * rate`, returns
    the sum of `lineTotal`.
- **`scope-of-works-rate-resolver.spec.ts` (EDIT)** - its `estimateCuttingLine.create` assertions
  expect `lineTotal` and a rate from `priceCuttingLine`, not `cuttingMatch.value`.
- **The backfill** - seed rows with known `qty`/`rate`, run migration 2, assert every `line_total`
  equals `ROUND(qty * rate, 2)` and no `rate` changed.

## Do NOT

- Do NOT converge the two models, move rows between them, or delete either table.
- Do NOT re-resolve a supplied rate - not on create, not on update, not in the backfill.
- Do NOT leave a `lineTotal ?? qty * rate` fallback, and do NOT leave the new column nullable.
- Do NOT make `CuttingSheetItem.lineTotal` non-nullable.
- Do NOT remove `sanitiseSawElevation`, `METHODS_BY_EQUIPMENT`, `shift` or `shiftLoading`.
- Do NOT touch `apps/web`, the card fold, markup or quote destinations - no figure on the card moves.
- Do NOT touch `tokens.css` or `/sot/` (CP-24).

## VERIFY before opening the PR

```
pnpm --filter @project-ops/api test -- cutting-one-total cutting-step-equivalence cutting-rate-corrections scope-redesign-rate-resolver scope-of-works-rate-resolver
pnpm build && pnpm lint
grep -rEn --include=*.ts --exclude=*.spec.ts --exclude-dir=__tests__ "(Number|toNumber)\((l|line)\.qty\) \* (Number|toNumber)\((l|line)\.rate\)" apps/api/src/modules   # empty
grep -n "lineTotal: new Prisma.Decimal(total.toFixed(2))" apps/api/src/modules/tendering/scope-redesign.service.ts   # empty
grep -n "cuttingMatch" apps/api/src/modules/tendering/scope-of-works.service.ts   # empty
grep -n "sanitiseSawElevation\|METHODS_BY_EQUIPMENT" apps/api/src/modules/tendering/scope-redesign.service.ts   # still present
ls apps/api/prisma/migrations | grep scopecards_s7_cutting_line_total   # exactly 3
node scripts/data-model/build-relationship-map.mjs --check
```

PR body: `GATE-ALLOW: migrations` at column 0; the three migration SQL files verbatim; the half-cent
list; the two "what moves" cases with one worked example each.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>`.
- Never ask a question or stand by. Proceed on best judgement and record the assumption in the PR body.
- `escalates: true` - three migrations (one a backfill, one a NOT NULL) across five modules' money
  paths. Marco merges, not automation.
- Read the job log before diagnosing any CI failure.
- Hard stop: Azure / Entra / SharePoint, production auth or secrets, any irreversible action.

## STATUS

Staged HOLD by Station 06 at Station 00i's hand-off (2026-09-22). Dispatches once
`CUTTING_ONE_SURFACE_V1` (S6) is on `main` - it is, as of `eb3086fa`. Arming is Marco's.
