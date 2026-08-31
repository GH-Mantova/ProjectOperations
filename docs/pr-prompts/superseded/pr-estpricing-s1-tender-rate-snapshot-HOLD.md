---
premise: '! grep -q "TENDER_RATE_SNAPSHOT_APPLIED" apps/api/src/modules/rates/rate-resolver.service.ts'
premise_means: The resolver still ignores a tender's locked rate set; every lookup reads live rates.
scope:
  - apps/api/src/modules/rates/rate-resolver.service.ts
  - apps/api/src/modules/rates/tender-rate-set.service.ts
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/rates/__tests__/rate-resolver-snapshot.spec.ts
done_when: pnpm build && pnpm lint && grep -q "TENDER_RATE_SNAPSHOT_APPLIED" apps/api/src/modules/rates/rate-resolver.service.ts
size: 5
gate_allow: none
seed_only: false
escalates: true
cluster: estimating-pricing
cluster_order: 1
---

# Make a tender's locked rate set actually price the tender

## The problem, precisely

`TenderRateSet` / `TenderRateEntry` exist and are populated when a user locks rates from the
tender's Rates tab, but **nothing reads them when pricing.** A repo-wide search finds hits only
inside the rate-set service, its controller, module wiring, tests, and one delete-guard — and
none in `scope-of-works.service.ts`, `scope-waste.service.ts`, `scope-redesign.service.ts` or
`estimates.service.ts`. The snapshot is display-only.

The consequence is on the client-facing path: the PDF endpoint's own contract says totals are
*"recomputed from raw EstimateItem lines on every call; stored totals are never trusted"*
(`estimate-export.controller.ts`). So any correction to a pricing formula silently changes what a
re-print of an already-sent quote produces.

**This slice must land before any pricing correction.** It is the thing that bounds the change.

## What to build

1. **`RateResolverService`** — when the tender being priced has a `TenderRateSet`, resolve every
   rate from its entries instead of the live tables. Key on the existing
   `{rateTableId}:{rowId}:{columnId}` entry format. Emit the literal token
   `TENDER_RATE_SNAPSHOT_APPLIED` in the structured log line when a lookup is served from a
   snapshot — this string is the proof-of-landing marker the next slice in this cluster gates on,
   so it must appear in `rate-resolver.service.ts` itself.
2. **The snapshot sits ABOVE the canonical-source switch, not inside one of its branches.**
   `resolveRate` (`rate-resolver.service.ts:79-103`) forks on `getCanonicalSource()`: with
   `ratetable` it tries `tryRateTable` then `tryLegacy`; with `legacy` — the default — it tries
   `tryLegacy` **first** and only reaches `tryRateTable` for slugs legacy does not know.
   `enumerateRateSet` (`:159-163`) builds the snapshot from
   `prisma.rateTable.findMany({ where: { isReference: false } })` — **RateTable only, whatever the
   switch says.** So a snapshot keyed `{rateTableId}:{rowId}:{columnId}` describes rows the legacy
   branch never consults. Wire the snapshot check inside one branch and a locked tender on the
   default `legacy` setting prices from live legacy rates with the snapshot doing nothing — the
   exact display-only defect this slice exists to remove, still present and now harder to see.
   The order must be: snapshot (if the tender has one) → then the existing switch, untouched.
   Add a spec case that pins this with the switch on `legacy`.
3. **A miss is a warn, not a silent fall-through.** If a tender has a snapshot but a required key
   is absent from it, log `snapshot-miss-fell-back-to-live` with the key, and use the live rate.
   Never fail the request. This mirrors the existing `ratetable-miss-fell-back-to-legacy` shape so
   the two can be read together.
4. **Commit point is at write.** A tender with no snapshot prices live, exactly as today. Marco
   decided (31 Aug) that existing tenders are **not** retro-fitted with a snapshot — they keep
   pricing live and will move to the corrected maths when the next slice lands. Do not add any
   retro-fitting step; it is deliberately out of scope.
5. **Spec** at `apps/api/src/modules/rates/__tests__/rate-resolver-snapshot.spec.ts` covering:
   a tender with a snapshot resolves from it; a tender without one resolves live; a snapshot with a
   missing key warns and falls back; the warn names the missing key; and the precedence case in
   point 2, run with `RATES_CANONICAL_SOURCE` unset so the default `legacy` branch is exercised.

## Do NOT

- Do not touch `schema.prisma` — `TenderRateSet` and `TenderRateEntry` already exist.
- Do not change how or when a snapshot is created; only how it is READ.
- Do not retro-fit snapshots onto existing tenders.
- Do not touch `RATES_CANONICAL_SOURCE` or the legacy/hub switch — a separate decision.
- Do not touch `/sot/`.

## VERIFY

- `pnpm --filter @project-ops/api test:serial` green.
- `pnpm build` and `pnpm lint` green.
- `grep -q "TENDER_RATE_SNAPSHOT_APPLIED" apps/api/src/modules/rates/rate-resolver.service.ts`

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
