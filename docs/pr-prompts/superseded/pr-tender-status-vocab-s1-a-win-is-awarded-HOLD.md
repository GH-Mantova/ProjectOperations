---
premise: '! grep -rq "TENDER_STATUS_VOCAB_V1" apps/api/src'
premise_means: >-
  Three API services each carry their own idea of which Tender.status values mean "won", "lost" or
  "closed", and two of them use a vocabulary the product no longer writes. MEASURED 2026-10-02 at
  origin/main 7d9926ae. Tender.status is a String; the values written in the app are DRAFT,
  IN_PROGRESS, SUBMITTED, AWARDED, CONTRACT_ISSUED, CONVERTED, LOST and WITHDRAWN.
  "WON" is a TenderOutcome.resultType, not a status: OutcomeCaptureModal.tsx:19 maps
  AWARDED / CONTRACT_ISSUED / CONVERTED to WON. Defects:
  (1) bid-prioritisation.service.ts:32 CLOSED_STATUSES = [WON, LOST, CLOSED, NO_BID, WITHDRAWN], so
  AWARDED, CONTRACT_ISSUED and CONVERTED tenders are ranked as open work worth chasing.
  (2) win-likelihood.service.ts:276 fetchClosedTenders filters status IN [WON, LOST, CLOSED, NO_BID],
  so every real win (status AWARDED / CONTRACT_ISSUED / CONVERTED) is left out of the history cohort.
  Win likelihood is computed from losses only.
  (3) reporting.service.ts tender-win-rate counts AWARDED and CONTRACT_ISSUED as awarded but filters
  CONVERTED out of the query entirely, and its totals row carries no winRatePct.
  The one correct set already on main is TERMINAL_TENDER_STATUSES in
  comms-reminder-escalation.service.ts:62. POSITIVE CONTROL: grep -rn "TERMINAL_TENDER_STATUSES"
  apps/api/src returns hits, so a zero for the marker is real.
done_when: >-
  pnpm build && pnpm lint && pnpm --filter api test &&
  grep -q "TENDER_STATUS_VOCAB_V1" apps/api/src/modules/tendering/tender-status.ts &&
  ! grep -q '"WON", "LOST", "CLOSED", "NO_BID"' apps/api/src/modules/win-likelihood/win-likelihood.service.ts &&
  ! grep -q 'const CLOSED_STATUSES' apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.ts
scope:
  - apps/api/src/modules/tendering/tender-status.ts
  - apps/api/src/modules/tendering/__tests__/tender-status.spec.ts
  - apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.ts
  - apps/api/src/modules/bid-prioritisation/bid-prioritisation.service.spec.ts
  - apps/api/src/modules/win-likelihood/win-likelihood.service.ts
  - apps/api/src/modules/win-likelihood/win-likelihood.service.spec.ts
  - apps/api/src/modules/reporting/reporting.service.ts
  - apps/api/src/modules/reporting/tender-win-rate.spec.ts
size: 5
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Code only. No migration, schema, seed or env var. Reverting the commit restores the three local
  status lists exactly; no stored data changes shape.
escalates: false
module: tendering
---

# Tender status vocabulary: a win is AWARDED, not WON, and every service should agree

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Why this matters to an estimator

- The **bid ranking** page lists jobs we have already won as "worth chasing".
- **Win likelihood**, shown on that page and on the tender, is computed from a history that holds
  our losses and none of our wins. Every figure it shows today is skewed low, or reads
  "Insufficient data".
- The **estimator win-rate report** drops converted tenders, and its totals row has no win rate.

All three come from the same root cause. Each service hand-wrote its own list of status values, and
two of them used words the product stopped writing. **Fix the root: one vocabulary, used by all three.**

## What to build

### 1. `apps/api/src/modules/tendering/tender-status.ts`

Marker: `export const TENDER_STATUS_VOCAB_V1 = "tender-status-vocab-s1";`

Export **read-only sets** built from the live vocabulary, each with a one-line comment saying who
writes those values:

- `WON_TENDER_STATUSES` = `AWARDED`, `CONTRACT_ISSUED`, `CONVERTED`. These are the same three that
  `OutcomeCaptureModal` maps to a WON outcome.
- `LOST_TENDER_STATUSES` = `LOST`.
- `LEGACY_CLOSED_TENDER_STATUSES` = `WON`, `CLOSED`, `NO_BID`. The product no longer writes these
  values, but older rows may carry them. **Keep them, so no historical row changes meaning**
  (RULE 1: do not damage existing data).
- `TERMINAL_TENDER_STATUSES` = WON ∪ LOST ∪ `WITHDRAWN` ∪ LEGACY_CLOSED. Nothing in this set is open
  work.
- `HISTORY_TENDER_STATUSES` = WON ∪ LOST ∪ LEGACY_CLOSED. These tenders had a result, so they can
  inform a win-likelihood cohort. `WITHDRAWN` is excluded because a withdrawn tender has no result.
- Helper `isTerminalTenderStatus(status: string): boolean`.

Export arrays as well as sets where Prisma needs `in` / `notIn`.

### 2. `bid-prioritisation.service.ts`

Delete the local `CLOSED_STATUSES`. Open tenders are `status notIn TERMINAL_TENDER_STATUSES`. Keep the
existing "notIn, so new active statuses are included automatically" reasoning in the comment.

### 3. `win-likelihood.service.ts`

`fetchClosedTenders` filters `status in HISTORY_TENDER_STATUSES`. Wins and losses are still counted
from the current `TenderOutcome.resultType`, exactly as today. **Do not change the counting rule, the
cohort match or the confidence thresholds.** This slice only lets the wins into the cohort.

### 4. `reporting.service.ts`, report `tender-win-rate`

- The query takes `SUBMITTED` plus WON ∪ LOST, so `CONVERTED` is no longer dropped.
- A tender counts as awarded when its status is in `WON_TENDER_STATUSES`.
- `totals` gains `winRatePct`, computed the same way the rows compute it: awarded / (awarded + lost),
  rounded to one decimal place, and `0` when nothing is resolved.
- **Keep** the EA-GATE self-filter (`resolveSelfFilter`) exactly as it is. It is an exposure control.

## Tests

1. `tender-status.spec.ts`:
   - The three won statuses are terminal and in history.
   - `WITHDRAWN` is terminal and NOT in history.
   - `DRAFT`, `IN_PROGRESS` and `SUBMITTED` are in neither set.
   - Every legacy value is terminal.
2. Bid ranking: an `AWARDED` tender, a `CONTRACT_ISSUED` tender and a `CONVERTED` tender are each
   **absent** from the ranked list. A `SUBMITTED` tender is present.
3. Win likelihood: the cohort query includes an `AWARDED` tender, and a cohort of one AWARDED win and
   one LOST tender produces 1 win and 1 loss. Before this fix it produced 0 and 1.
4. Win-rate report:
   - A `CONVERTED` tender counts as awarded.
   - With 3 awarded and 1 lost, `totals.winRatePct` is `75`.
   - The self-filter still applies to a plain estimator.
5. **Assert in the test, not only in prose,** that no test passes unchanged with the production
   change reverted. Each of tests 2–4 must fail on `origin/main`.

## DO NOT

- Do not change Tender.status values, the schema, seed data or any migration.
- Do not touch `comms-reminder-escalation.service.ts`. Its set is already correct; moving it to the
  shared module is a later tidy-up, not this slice.
- Do not change win-likelihood maths, weights, `BID_PRIORITY_WEIGHT` or the page.
- Do not touch `sot/` (CP-24).

## What the PR body must say

Under a heading **"Numbers will move"**: win-likelihood figures and bid rankings change once this
merges, because real wins enter the history for the first time. That is the fix, not a regression.

## VERIFY

```
git grep -n "TENDER_STATUS_VOCAB_V1" -- apps/api/src
git grep -n '"WON", "LOST", "CLOSED", "NO_BID"' -- apps/api/src    # expect: nothing
pnpm --filter api test -- tender-status bid-prioritisation win-likelihood tender-win-rate
```
