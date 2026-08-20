---
premise: 'gh pr view 1257 --json state -q .state | grep -q OPEN'
premise_means: PR #1257 is still open, so the plant-category regression on its branch is unfixed and unmerged. If it has merged or closed, this prompt is stale and the work needs re-scoping against main.
scope:
  - apps/api/src/modules/rates/rate-resolver.service.ts
  - apps/api/src/modules/rates/__tests__/rate-resolver.service.spec.ts
  - apps/api/src/modules/tendering/scope-of-works.service.ts
  - apps/api/src/modules/tendering/scope/__tests__/scope-cards.service.spec.ts
done_when: pnpm build && pnpm lint && pnpm --filter api test -- scope-cards.service.spec.ts rate-resolver.service.spec.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# Restore plant category grouping — fix forward on `feat/rates-consumers-s2-tendering`

**Work on the existing PR branch. Do NOT open a new PR.**
`git fetch origin && git checkout feat/rates-consumers-s2-tendering && git pull`, commit, push to the
same branch. #1257 is `rates-consumers` **SLICE 2 of 4** — slices 3 and 4 build on whatever shape
lands here.

## The regression

`getCardSummary` groups the plant card summary through a `rateCategories` map. On `origin/main` that
map was populated from a direct `{ id, category }` read off `prisma.estimatePlantRate`. Routing
through `rateResolver.listRates("plant")` returns `ListedRate`, which carries no category — so the
map is now **never populated** and every plant entry falls to `"Other"`.

The PR's current code says so out loud:

```ts
const rateCategories = new Map<string, string>();
if (rateIds.length > 0) {
  const allPlantRates = await this.rateResolver.listRates("plant");
  // Category is not in ListedRate — map remains empty; entries group as "Other".
  void allPlantRates;
}
```

Six tests in `scope-cards.service.spec.ts` fail against this. **The tests are right.** They were in a
directory the PR's author had not found; the behaviour change was declared under *Known limitations*
and shipped past them.

**Marco's decision, 2026-08-20: restore the behaviour.** "Display only, not pricing" understates it —
estimators read that summary to sanity-check a card, and one undifferentiated "Other" bucket is a real
loss. Blessing it at slice 2 of 4 is the expensive moment to get it wrong.

## The shape to build — an `info` map, not a one-off `category` field

**Marco chose this shape deliberately over a narrow `category?: string` field.** `tryListRateTable`
already builds `keys` from KEY columns and **silently discards every INFO column**. The plant table
declares two of them:

```ts
// seed-initial-services.ts, table rt-plt
{ key: "item",     name: "Item",     role: "KEY",   sortOrder: 1 },
{ key: "category", name: "Category", role: "INFO",  sortOrder: 2 },   // <- dropped today
{ key: "unit",     name: "Unit",     role: "INFO",  sortOrder: 3 },   // <- dropped today
{ key: "rate",     name: "Rate",     role: "VALUE", sortOrder: 4 },
```

So this is not "add the field category needs" — it is "stop throwing away a whole column role".
Same cost, fixes the class.

1. **`ListedRate`** — add `info: Record<string, unknown>`. Not optional: always present, `{}` when
   there is nothing. An optional field invites `?.` chains at every call site and lets a future
   adapter forget it silently.

2. **`tryListRateTable`** — build `info` from `role === "INFO"` columns exactly as `keys` is built
   from `role === "KEY"`, same `cells[col.id] ?? cells[col.name]` fallback, same `col.name` keying.

3. **`tryListLegacy`** — populate `info` in every case, not just `plant`. The rows are already
   fetched in full; the fields are being dropped one line later, so this costs nothing:
   - `plant`: `info: { Category: row.category, Unit: row.unit }`
   - other slugs: whatever descriptive non-key fields that row already has, `{}` if genuinely none.

   **Key `info` by the RateTable column `name`** (`"Category"`, capital C) on **both** paths, so a
   consumer reads the same key whichever source answered. This is the whole point of the abstraction
   and it is the thing most likely to be got wrong.

4. **`getCardSummary`** — populate the map and delete the `void allPlantRates` stub and its comment:

   ```ts
   for (const r of await this.rateResolver.listRates("plant")) {
     const c = r.info.Category;
     if (typeof c === "string" && c !== "") rateCategories.set(r.rowId, c);
   }
   ```

   Empty string must **not** become a category — the seed writes `category: r.category ?? ""` for
   plant rows, so a blank would otherwise create a `""` group instead of falling to `"Other"`.

## ⚠️ The latent bug you must NOT paper over

Making the six tests pass is not sufficient, and here is the trap.

`getCardSummary` joins on `rateCategories.get(p.plantRateId)`. What `rowId` actually holds depends on
which adapter answered:

| path | `rowId` is | matches `p.plantRateId`? |
|---|---|---|
| `tryListLegacy("plant")` | `EstimatePlantRate.id` | ✅ yes |
| `tryListRateTable("plant")` | `RateRow.id` (`rr-plt-*`) | ❌ **no — different id space** |

`plantRateId` is not a foreign key. It lives inside a JSON blob (`schema.prisma:3598`,
`plantItems: [{ plantRateId?, description, qty, days, unit }]`) and historically held an
`EstimatePlantRate.id`.

Today the resolver is legacy-first, so the join works and the tests will go green. **The moment the
canonical source flips to `ratetable`, every lookup misses and every plant entry silently returns to
`"Other"` — with all six tests still passing**, because they exercise the legacy path. That is
precisely the "next refactor silently re-breaks it with the tests green" failure the reviewer asked
to be designed out.

**Do at least this:** add a test that drives `getCardSummary` with the resolver in **ratetable** mode
and asserts a real category comes back. If it cannot pass without an id-mapping change, **stop and
say so in the PR body under a heading `KNOWN GAP — ratetable cutover`**, naming this table. Do not
widen scope into slices 3/4 to fix it, and do **not** delete or weaken the test to get green.

Flagging a real gap loudly is the correct outcome here. Declaring it quietly under *Known
limitations* is what produced this PR's regression in the first place.

## Tests

**`rate-resolver.service.spec.ts`** — assert `info` on **both** adapters:
- `tryListRateTable`: a plant row's `info.Category` and `info.Unit` come through, keyed by column
  **name**, and `keys` is unchanged (still KEY columns only).
- `tryListLegacy`: `info.Category` comes through from `EstimatePlantRate.category`.
- A row with no INFO columns yields `info: {}`, never `undefined`.

**`scope-cards.service.spec.ts`** — the six failing tests must pass **without** `.skip`, `.todo`, or
a loosened assertion. Their harness currently mocks the prisma shape
(`estimatePlantRates?: Array<{ id: string; category: string | null }>`, line 24). Rewire that harness
to feed `listRates("plant")` instead. **Change the plumbing, not the expectations** — the assertions
on lines ~712, ~758, ~786, ~812-813 are the specification.

⚠️ **Line ~816, `"buckets plant entries with null category under Other"`, is currently PASSING and
must stay passing.** It is the negative control: `category: null` legitimately means `"Other"`. If a
change makes all seven green by making everything a category, that test is what catches it.

## Do NOT

- Do NOT rewrite the six tests to expect `"Other"`. That was the rejected option.
- Do NOT open a new PR. Fix forward on `feat/rates-consumers-s2-tendering`.
- Do NOT touch `resolveRate`, `tryRateTable`, `enumerateRateSet` or any pricing path. `info` is
  descriptive metadata; nothing may price off it.
- Do NOT change `keys` on any adapter — existing consumers round-trip selections through it.
- Do NOT touch `schema.prisma`, add a migration, or edit the seed.
- Do NOT expand into slices 3 or 4. `git diff origin/main --name-only` must stay within `scope`.

## Guardrails

- One attempt. If `info` is already on `ListedRate`, say `NO-OP: <reason>`.
- `pnpm build`, `pnpm lint`, and both spec files must pass.
- Update the PR body: delete the *Known limitations* paragraph about `rateCategories` staying empty —
  it is no longer true — and add the `KNOWN GAP — ratetable cutover` section if step ⚠️ applies.
