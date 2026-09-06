---
premise: '! grep -q "provisionalWithMarkup" apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts'
premise_means: The discipline summary bar shows ONE money figure that silently mixes priced work with provisional allowances, so an estimator cannot see how much of a discipline is actually in the quote.
scope:
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
  - apps/web/src/pages/tendering/scope-cards/DisciplineSummaryBar.tsx
  - apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/__tests__/discipline-summary-bar.test.tsx
  - apps/web/src/pages/tendering/scope-cards/utils/__tests__/discipline-rollup.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "provisionalWithMarkup" apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: scope-subcontracted
cluster_order: 6
requires_on_main: 'apps/api/src/modules/tendering/scope-redesign.service.ts :: provisionalWithMarkup'
---

# The summary bar's provisional split (SCOPE_PROVISIONAL_SPLIT_V1)

This finishes slice 5. Item 4 of `pr-scopesub-s5-sub-tab-ui` asked for the summary bar to read

> *in the quote $59,800 · provisional $16,120 · SUB total $75,920*
>
> This is the slice-1 `DisciplineSummaryBar` with SUB's own stats, not a new component.
> The provisional split comes from slice 3's per-line flag — **read it, do not recompute it**.

and #1690 shipped the other four items without it. The agent's own hand-back said why: *"the
`DisciplineRollup` carries no provisional fields at all"*, and none of the three files that would
have to change were in that slice's scope. They are in this one. **Web-only — do not add or change
any API route, service method, DTO or Prisma model.**

Approved mock-up: `https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035`

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

---

## The data path is already settled. Follow it exactly.

Everything this slice needs is already on the wire. **You are adding no fetch, no endpoint and no
API surface.** If you find yourself writing a `fetch(` or importing an API client, you have taken
the wrong path — stop and re-read this section.

**1. The flag is already arriving.** `ScopeOfWorksItem.isProvisional` is a
`Boolean @default(false) @map("is_provisional")` column (slice 3), and `listItems` returns
`{ ...item, lineTotal, lineTotalWithMarkup }` — the whole row. So `isProvisional` has been on every
item the scope-cards screen loads since slice 3 merged; nothing in the web has ever read it.

Declare it on the `ScopeItem` type in `ScopeQuantitiesTable.tsx`. **This adds no API surface** — it
is precisely the `pricedBySubItemId` precedent five lines below in the same type, whose comment
already says so. Write a comment in the same voice saying the same thing, and say which slice put
the column there.

**2. The predicate is the schema's, verbatim.** `schema.prisma` states the rule in a comment on the
column itself, and `scope-redesign.service.ts` implements it:

```ts
const isProvisionalLine = item.isProvisional === true || itemDiscipline === "Other";
```

Both halves are reproducible web-side without touching money: the flag is on the item, and the
discipline is the one the bar is already rendering. Reproduce **both halves**. A card in discipline
`Other` has every one of its lines provisional whether or not the flag is set, and dropping that
half would make the web disagree with the server about a whole discipline.

**3. The money is PARTITIONED, never recomputed.** `computeCardBarStats` in
`DisciplineSummaryBar.tsx` is, in its own words, *"THE ONE PLACE CARD MONEY IS COMPUTED"*, and it
sums the **server-computed** `lineTotal` / `lineTotalWithMarkup` off each row. The split is the same
sum taken twice with a filter on it — the exact same numbers, sorted into two piles. That is what
*"read it, do not recompute it"* means here.

**Do not** reach for the API's per-discipline `provisionalSubtotal` / `provisionalWithMarkup`
instead. They are real and correct, but they come from `scope-redesign.service.ts`'s own pricing
path, not from `listItems`. Putting them on a bar whose total comes from `listItems` would give the
bar two money sources that can drift apart, which is the divergence the header comment on
`computeCardBarStats` exists to prevent. **The partition must be of the same numbers the total is
made of.**

---

## What to build

### 1. `computeCardBarStats` splits what it already sums

Add `provisionalSubtotal` and `provisionalWithMarkup` to `CardBarStats` — the provisional slice of
the same non-excluded rows, by the predicate above. The discipline is needed for the `"Other"` half,
so the function takes it as a second argument; make it optional so no existing caller breaks, and
say in a comment that omitting it means "flag only".

Excluded items stay excluded from both piles, exactly as now.

### 2. The rollup carries the split

`CardMoneyStats` gains the two fields; `toCardRollupInput` passes them through; `DisciplineRollup`
gains them and `rollUpDisciplineStages` sums them **per card**, alongside `subtotal` — money sums
within a stage and across stages both, so they need no stage logic of their own and must not get
any. `EMPTY_DISCIPLINE_ROLLUP` gains two zeros.

### 3. `ScopeCardsTab` keeps operational costs and cutting on the PRICED side

This is the one place the arithmetic can go wrong, so it is spelled out.

`statsByCard` adds two figures to the item money that did not come from items:

```ts
subtotal: fromItems.subtotal + otherCosts + cutting,
subtotalWithMarkup: fromItems.subtotalWithMarkup + otherCosts + cutting
```

`ScopeOperationalCostLine` and the cutting take-off have **no provisional flag** — they are priced
work, always. So they are added to the totals exactly as they are now and are **not** added to the
provisional figures. Pass `fromItems.provisionalSubtotal` and `fromItems.provisionalWithMarkup`
straight through, unmodified.

Do not add a second `computeCardBarStats(` call site: a source-level test pins that there is exactly
one, and a second one is how the card total and the bar start disagreeing. Give the fallback stats
object (`{ itemCount: 0, subtotal: 0, ... }`) its two new zeros.

### 4. The bar shows three figures

The right-hand block becomes the mock's three figures. **The existing "Discipline total" figure and
label do not change** — same number, same words, same place. In-quote is derived from it:

```
in the quote = subtotalWithMarkup − provisionalWithMarkup
provisional  = provisionalWithMarkup
total        = subtotalWithMarkup          ← unchanged
```

Deriving in-quote by subtraction rather than as a third sum is deliberate: it makes
`in the quote + provisional = total` true by construction, so the three figures on the bar can never
disagree with one another, and it means **this slice cannot move a figure an estimator has already
quoted from**. Say that in a comment.

**Show the pair only when there is provisional money.** A discipline with none would otherwise read
"in the quote $X · provisional $0 · total $X" on every bar in the screen — three figures saying one
thing. When `provisionalWithMarkup` is 0 the bar renders exactly as it does today; the split appears
the moment a line is flagged. Both figures use the existing `fmtCurrency`.

Design rules are unchanged and non-negotiable: brand tokens only, the one permitted `rgba` literal,
`--brand-primary` ground with `--text-inverse` text. The three figures must survive the bar's
`flexWrap` at a narrow width without overlapping or pushing the chips off — check the wrap.

### 5. Tests

`apps/web` has **no jsdom and no testing-library**. The house pattern in this exact folder is: a
numeric or string claim is proven against a pure exported function, and a DOM claim against
`renderToStaticMarkup`. Follow it — do not add a test dependency.

In `__tests__/discipline-summary-bar.test.tsx`:

- `computeCardBarStats` splits by the flag: a mixed card returns a provisional slice that is exactly
  the flagged rows' `lineTotal` / `lineTotalWithMarkup`, and a priced remainder;
- passing discipline `"Other"` makes every non-excluded row provisional even with the flag false;
- an excluded row is in neither pile;
- **`provisional ≤ total`, always** — pin it, on a mixed card and on an all-provisional card;
- `renderToStaticMarkup`: with provisional money the bar renders all three figures and the total is
  unchanged from the no-provisional render of the same total; with none, it renders exactly one
  money figure.

In `utils/__tests__/discipline-rollup.test.ts`:

- the two new fields sum across cards, and across stages, and a card that appears twice is counted
  **once** — the duplicate guard covers them like every other figure;
- **the equivalence this module's header demands is still exact**: an ungrouped discipline (every
  `stageGroup` null) folds field for field to the pre-stage figures. Extend the pinned comparison to
  the new fields rather than leaving them outside it.

---

## Stop and report — do not choose

Report on the PR and leave the slice short rather than deciding either of these:

- **The three figures do not reconcile.** If for any input `in the quote + provisional ≠ total`,
  something upstream is not what this prompt says it is. Say what you measured; do not "fix" it by
  making one of the three a separate sum.
- **`isProvisional` is not on the items the screen loads.** The claim above is that it arrives
  already, from `listItems` returning the whole row. Verify it rather than assume it. If it is
  genuinely absent, an API change is needed and that is outside this slice's `gate_allow: none` —
  stop and say so.

## What this slice is NOT

- Not a way to SET the flag. Nothing here makes a line provisional; it displays lines the estimator
  or an earlier slice already flagged. A toggle is its own slice with its own mock.
- Not a change to `tenderPrice`, to the API's provisional totals, or to what the quote prints.
- Not a change to any figure on the card header. The card's "Card total" reads the same
  `statsByCard` entry it reads now and must keep showing the same number.
