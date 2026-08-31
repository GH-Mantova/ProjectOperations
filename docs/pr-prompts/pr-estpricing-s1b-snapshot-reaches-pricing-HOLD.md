---
premise: '! grep -q "SNAPSHOT_LIST_APPLIED" apps/api/src/modules/rates/rate-resolver.service.ts'
premise_means: The estimating module prices through listRates, which has no snapshot check, so a tender's locked rate set still never prices it.
scope:
  - apps/api/src/modules/rates/rate-resolver.service.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/scope-of-works.service.ts
  - apps/api/src/modules/tendering/scope-waste.service.ts
  - apps/api/src/modules/rates/__tests__/rate-resolver-snapshot-list.spec.ts
done_when: pnpm build && pnpm lint && grep -q "SNAPSHOT_LIST_APPLIED" apps/api/src/modules/rates/rate-resolver.service.ts
size: 6
gate_allow: none
seed_only: false
escalates: true
cluster: estimating-pricing
cluster_order: 2
requires_merged: 1421
---

# Make the snapshot actually reach the pricing path

## Why this slice exists

Slice 1 (PR #1421) added snapshot precedence to `resolveRate` and it is correct — the check sits
above the `RATES_CANONICAL_SOURCE` fork, keyed `{rateTableId}:{rowId}:{columnId}`, with a
`snapshot-miss-fell-back-to-live` warn and 313 lines of spec. **It is also unreachable.** The
slice-1 prompt was authored against the wrong function, and its `done_when` grep passed on a token
that proves the code exists, not that anything calls it.

Measured on the merged branch:

- `resolveRate` gained `options?: { tenderId?: string }`. **Nine production call sites; none passes
  it.** `tip-recommendations.service.ts:177,299`; `rates.controller.ts:257`;
  `scope-of-works.service.ts:642,718,798`; `scope-waste.service.ts:565,611`.
- **The estimating module does not price through `resolveRate` at all.** It prices through
  `listRates`: `scope-redesign.service.ts:852,853` (labour, plant), `:234` (cutting), `:324`
  (core-hole), `:1009` (other-rates); `scope-of-works.service.ts:317,318,681,744,1116`.
- `listRates` has **no snapshot check**. It opens with `const source = this.getCanonicalSource();`
  and forks straight into `tryListRateTable` / `tryListLegacy`.

So the defect slice 1 set out to remove — *"`TenderRateSet` exists, is populated when a user locks
rates, and nothing reads it when pricing"* — is still exactly true. This slice closes it.

## What to build

1. **`listRates` gains the same precedence `resolveRate` has**, in the same shape and for the same
   reason: `async listRates(tableSlug, options?: { tenderId?: string })`, and when a `tenderId` is
   supplied and that tender has a `TenderRateSet`, the returned rows carry the snapshot's values
   instead of live ones. Log the literal token `SNAPSHOT_LIST_APPLIED` when a list is served from a
   snapshot — it is this slice's proof-of-landing marker and the next slice gates on it.

   **Put the snapshot check ABOVE `getCanonicalSource()`, not inside a branch.** Snapshot entries
   are always RateTable-keyed (`enumerateRateSet` reads
   `rateTable.findMany({ where: { isReference: false } })`), so a check nested inside the
   `ratetable` branch would do nothing on the default `legacy` setting. This is the same trap
   slice 1 documents; do not reintroduce it.

2. **A per-row miss is a warn, not a silent swap.** A snapshot that covers some rows of a table and
   not others returns the snapshot value where it has one and the live value where it does not,
   logging `snapshot-list-miss-fell-back-to-live` with the slug and the missing key. Never fail the
   request. Mirror the existing `snapshot-miss-fell-back-to-live` shape so the two read together.

3. **Thread `tenderId` through the estimating callers**, which all already know the tender:
   - `scope-redesign.service.ts` — `:852`, `:853`, `:234`, `:324`, `:1009`
   - `scope-of-works.service.ts` — `:317`, `:318`, `:681`, `:744`, `:1116`, and the three
     `resolveRate` sites at `:642`, `:718`, `:798`
   - `scope-waste.service.ts` — `:565`, `:611`
   Where a helper does not currently receive the tender id, pass it down rather than re-querying.

4. **Leave the two non-tender callers alone.** `rates.controller.ts:257` is the generic admin
   lookup and `tip-recommendations.service.ts` is not tender-scoped. Neither has a tender to pass;
   both keep resolving live. Say so in the PR body so the omission reads as a decision.

5. **Spec** at `apps/api/src/modules/rates/__tests__/rate-resolver-snapshot-list.spec.ts`:
   - `listRates` with a `tenderId` that has a snapshot returns snapshot values, and logs the token;
   - the same call with `RATES_CANONICAL_SOURCE` unset (default `legacy`) still uses the snapshot —
     this is the case that would fail if the check were nested in a branch;
   - a partial snapshot warns per missing key and falls back per row;
   - `listRates` with no `tenderId` is byte-identical to today's behaviour;
   - **an integration-level case that prices a scope card end to end against a locked tender and
     asserts the snapshot rate is the one used.** This is the assertion slice 1 lacked, and the
     reason its green suite proved nothing about reachability.

## Do NOT

- Do not change `resolveRate`'s existing snapshot path; it is correct. Extend, do not rework.
- Do not retro-fit snapshots onto tenders that have none — Marco ruled (31 Aug) existing tenders
  reprice, and that stands.
- Do not touch `RATES_CANONICAL_SOURCE` or the legacy/hub switch.
- Do not add a migration or touch `schema.prisma`.
- Do not touch `/sot/`.

## VERIFY

- Every new spec fails on the current head and passes after — state that in the PR body.
- **State in the PR body how many production call sites now pass `tenderId`, and name any that do
  not and why.** A count is the only cheap evidence that this slice did what slice 1 did not.
- `pnpm --filter @project-ops/api test:serial` green.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if you cannot proceed, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.
- `escalates: true` gates the MERGE, not the RUN. Open the PR; Marco removes `do-not-merge`.
