---
premise: 'grep -q "we need only shift" apps/api/src/modules/tendering/scope-of-works.service.ts'
premise_means: >-
  The scope-card pricing path discards the night and weekend rates before they reach the pricing
  function. MEASURED 2026-09-03 at origin/main de811907 - listRates("labour") already returns one
  entry per role and shift, and the adapter at scope-of-works.service.ts lines 325-328 filters it to
  shift === "day" before building the rate maps. buildRateMaps at scope-item-pricing.ts line 97
  accepts only role and dayRate, and computeScopeItemTotals at lines 181-182 multiplies men by days
  by that single rate and never reads item.shift. The file's own caveat at lines 14-15 says shift is
  "not surfaced in the canonical UI" - that premise died when SCOPE_WBS_MANPOWER_V1 shipped the
  Shift dropdown in PR 1511 on 2026-09-02, and the pricing was not updated with it.
scope:
  - apps/api/src/modules/tendering/scope-item-pricing.ts
  - apps/api/src/modules/tendering/scope-of-works.service.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/scope/__tests__/scope-item-pricing.spec.ts
done_when: >-
  ! grep -q "we need only shift" apps/api/src/modules/tendering/scope-of-works.service.ts && ! grep -q "nightRate/weekendRate ignored" apps/api/src/modules/tendering/scope-item-pricing.ts && pnpm build && pnpm lint
size: 4
gate_allow: none
seed_only: false
escalates: true
cluster: wbs-shift
cluster_order: 1
---

# WBS-SHIFT-S2: two labour pricing paths disagree about shift, and the live one is wrong

**Grounded against `origin/main` = `de811907`, measured 2026-09-03T05:3xZ.**

`escalates: true` — this changes a number on a live tender. Open the PR and leave it unmerged.

**This is the FIRST slice of the `wbs-shift` chain.** WBS-SHIFT-S1, the web display fix, is gated on
it and must not land first: a corrected label over an uncorrected price is worse than today, because
today the label and the price at least agree with each other and the estimator has no false comfort.

## The finding, which is not the one the punch list carried

There are **two** labour pricing paths and they do not agree.

**Path A — conversion to a formal estimate** (`scope-of-works.service.ts:637-664`) reads
`scopeItem.shift ?? "Day"`, calls `resolveRate("labour", { role, shift: shift.toLowerCase() })`, and
the resolver at `rate-resolver.service.ts:932` correctly selects `nightRate` or `weekendRate`. **This
path is right.**

**Path B — the live scope-card and WBS totals** (`buildRateMaps` + `computeScopeItemTotals`, called
from `scope-of-works.service.ts:334` and `scope-redesign.service.ts:896`) never sees the other two
rates, because the adapter throws them away first:

    // Labour: one entry per (role, shift); we need only shift==="day" for dayRate.
    const labourRates = labourListed
      .filter((r) => r.keys["shift"] === "day")

**So the estimator sets Night, is quoted a day rate while estimating, and the number changes by up to
40% if and only if the tender is later converted through Path A.** The two figures for the same line
disagree, and which one a client sees depends on a code path, not on a decision.

Note what this is *not*: `listRates` already models shift as a key and already returns the night and
weekend rows. The resolver is correct. **The regression is entirely in the two consumers**, which is
why this is four files and not a data-model change.

## Do

1. **`scope-item-pricing.ts` — widen `buildRateMaps`.** Accept `nightRate` and `weekendRate` beside
   `dayRate`, and key `labourRateByDiscipline` by discipline **and** shift, or return a small
   resolver the pricing function calls. **Name that resolver exactly `labourRateForShift` and
   export it** — WBS-SHIFT-S1 gates on that symbol appearing on `main`, so renaming it strands the
   web slice. Keep the function pure and Prisma-free — that property is
   why its tests run without a DB and it must survive.
2. **`scope-item-pricing.ts` — make `computeScopeItemTotals` read `item.shift`**, defaulting to `Day`
   when it is null, absent or unrecognised. An unset shift must price exactly as it does today.
3. **Delete the stale caveat at lines 14-15** and replace it with one line recording that shift is
   read, that it defaults to Day, and the PR number that landed it. That caveat outliving its own fix
   is the reason this survived.
4. **`scope-of-works.service.ts` around line 325 — stop filtering.** Pass every `(role, shift)` entry
   through to `buildRateMaps` and rewrite the comment to say what the adapter now does.
5. **`scope-redesign.service.ts` around line 896 — same change** at its own call site. Both call
   sites must move together; fixing one leaves the two surfaces disagreeing, which is the defect in a
   new place.
6. **Update `scope/__tests__/scope-item-pricing.spec.ts`.** Cases: Night prices at the night rate; Weekend at the
   weekend rate; Day unchanged; null shift falls back to Day; an unrecognised string falls back to
   Day. Add one case asserting a Night line and its Path A `EstimateLabourLine` now agree — that
   equality is the whole point of the slice.

## Do NOT

- Do NOT change `apps/web/**`. The display half is WBS-SHIFT-S1 and is a separate PR.
- Do NOT change the resolver, `listRates`, or any rate table, seed or migration. The rates are
  already correct and already delivered; this slice changes only which of them the consumers use.
- Do NOT start pricing by the estimator's chosen labour Type. `labourTypeId` is local browser state
  and is persisted nowhere — pricing by `DEFAULT_ROLE_BY_DISCIPLINE` is the current design, not a
  defect, and changing it is a separate decision.
- Do NOT alter Path A. It is correct; the goal is for Path B to agree with it.
- Do NOT touch `sot/`.

## Verify

- `grep -n "we need only shift" apps/api/src/modules/tendering/scope-of-works.service.ts` returns nothing.
- `grep -n "ignored" apps/api/src/modules/tendering/scope-item-pricing.ts` returns no stale caveat.
- `pnpm --filter @project-ops/api test` passes with the new cases visible.
- A Night line priced by `computeScopeItemTotals` equals the same line priced through Path A. State
  both numbers in the PR body — that equality is the acceptance criterion, not the test count.
- `grep -n "labourRateForShift" apps/api/src/modules/tendering/scope-item-pricing.ts` returns the
  exported resolver. WBS-SHIFT-S1 cannot be released until this is on `main`.
- `pnpm build` and `pnpm lint` exit 0.
- `git diff --stat` lists four files and no migration.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". There is no human in this run. Finishing the work and then asking for
> permission is indistinguishable from failing.
