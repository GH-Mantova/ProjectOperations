---
premise: '! grep -rq "SOR_CLAIM_ONCE_V1" apps/api/src'
premise_means: >-
  A variation or agreed record already on a PREVIOUS month's progress claim can be put on this
  month's claim again, at 100%, through the job's SoR register. MEASURED 2026-10-02 at origin/main
  7d9926ae, in agreed-record-register.service.ts:
  getEligibleForClaim (line 95) filters on isEligible only, and isEligible never looks at claims.
  raiseClaim de-duplicates only against the claim for the requested contract and month
  (collectSources(existing.lineItems)), so an item carried by September's claim is appended to
  October's with previouslyClaimed 0 and thisClaimPct 100.
  ContractsService.createClaim (contracts.service.ts:695) already applies the stricter rule,
  "approved variations not already on any prior claim line". So the two claim paths disagree, and
  the register path is the one that can double-bill.
  The approved SoR Register mock-up flagged the same-month half only (an "On IS-PC012" badge).
  POSITIVE CONTROL: grep -n "not already on any prior claim" apps/api/src/modules/contracts/contracts.service.ts
  returns a hit.
design_ref: https://claude.ai/code/artifact/66c798f3-fce1-4232-9b35-77367f36e225
done_when: >-
  pnpm build && pnpm lint && pnpm --filter api test && pnpm --filter web test &&
  grep -q "SOR_CLAIM_ONCE_V1" apps/api/src/modules/agreed-records/agreed-record-register.service.ts
scope:
  - apps/api/src/modules/agreed-records/agreed-record-register.service.ts
  - apps/api/src/modules/agreed-records/__tests__/agreed-record-register.service.spec.ts
  - apps/web/src/pages/JobSorRegisterPage.tsx
  - apps/web/src/pages/__tests__/job-sor-register-eligibility.test.ts
size: 4
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Code only. No migration, schema, seed or env var. Reverting restores today's eligibility rule.
  No claim or claim line is modified by this slice, so nothing needs unwinding.
escalates: true
module: agreed-records
---

**MONEY PATH: `escalates: true`.** This changes which items a user may bill. The PR stops for Marco
before merge.

# SoR register: an item is claimed once, in one month, and the register says so

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## The rule (match the one `ContractsService.createClaim` already applies)

A variation or agreed record that appears on **any claim line of this contract, in any month, at any
claim status**, is **already claimed**:

- It is **not eligible**.
- `raiseClaim` **skips** it and reports it.

An item counts as claimed because a line exists, not because of the claim's status. A DRAFT claim
still carries the line, and the existing same-month guard already treats it that way. If someone
removes the line from that claim, the item becomes eligible again. That falls out of the rule for free.

Partial claiming (part of a variation billed this month, the rest later) is **out of scope**. Neither
claim path supports it today.

## What to build

### API: `agreed-record-register.service.ts`

Marker: `export const SOR_CLAIM_ONCE_V1 = "sor-claim-once-s1";`

1. `getRegisterForJob` loads, in the same request, every `claimLineItem` on this contract's claims
   that has a non-null `variationId` or `agreedRecordId`, selecting the claim's `id`, `claimMonth`
   and `status`. AR lines still apply when the contract is null: query by `agreedRecordId` in the
   job's AR ids.
2. Both row shapes gain `claimedOn: { claimId: string; claimMonth: string; claimStatus: string } | null`.
   It is the earliest claim carrying the item.
3. `isEligible` is today's rule **AND** `claimedOn === null`.
4. `raiseClaim`:
   - Keep the APPROVED-only query filters.
   - **Also** drop any requested id that is on a line of **another** claim of this contract, and add
     it to `skipped`.
   - The same-month `collectSources` guard stays as it is.
   - If nothing survives, keep today's 400, and name "already on a previous claim" as one of the
     reasons.
5. Keep the ordering guarantee: lines are written before the Director notification fires.

### Web: `JobSorRegisterPage.tsx`

- Export `eligibilityReason` so it can be unit-tested. When `row.claimedOn` is set, return
  **"Already claimed — <Mon YYYY> claim"**, using the claim month in en-AU format. This check comes
  **before** the approval checks, because a claimed item is approved by definition.
- Register row Claim cell: show **"On <Mon YYYY> claim"** as an info badge when `claimedOn` is set.
  This is the mock-up's "On IS-PC012" badge, extended to any month.
- The picker lists claimed items under **Not eligible** with that reason. They are never checkable.

## Tests

1. API:
   - An APPROVED, both-signed AR on September's claim is not eligible and carries a September
     `claimedOn`.
   - The same AR with no claim line is eligible.
2. API: an approved VC on a prior-month claim is not eligible.
3. API: `raiseClaim` for October with that VC and one fresh AR adds **only** the AR and returns the
   VC id in `skipped`. Assert the October claim's line count and total.
4. API: the existing same-month de-duplication and the notification ordering tests still pass,
   unchanged.
5. Web: `eligibilityReason` returns the "Already claimed — Sep 2026 claim" text for a claimed AR
   that is otherwise eligible, and the existing reasons for the rest.
6. Each of tests 1–3 and 5 **fails on `origin/main`**. Prove it by reverting the production hunk
   once; say in the PR that you did.

## DO NOT

- No schema change and no migration. The links already exist (`ClaimLineItem.variationId`,
  `ClaimLineItem.agreedRecordId`).
- Do not modify any existing claim or claim line, and do not "repair" historical duplicates. If the
  data holds any, list the query that finds them in the PR body for Marco. **Do not run a write.**
- Do not change `ContractsService.createClaim`.
- No new permission. Reads stay `finance.view`; raising a claim stays `finance.manage`.
- Do not touch `sot/` (CP-24).

## PR body must include

The read-only query that lists any item already on two or more claim lines of the same contract,
so Marco can check whether a double bill has already gone out. **Run nothing against production.**

## Screenshots

Light mode:

1. A register row with the "On Sep 2026 claim" badge.
2. The picker showing that item under Not eligible with its reason.
