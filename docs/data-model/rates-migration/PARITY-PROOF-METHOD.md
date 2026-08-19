# Parity Proof — Method Note

> This is a **method note** only. It describes what the instrument does and
> how to use it. It does NOT contain any results — results live in timestamped
> report files under `docs/rates/parity-proof-<stamp>.md`.

## What this instrument checks

`scripts/rates/parity-proof.mjs` answers one question:

> For every legacy rate key that exists in the database, does the RateTable
> path return the **same value AND the same unit** as the legacy path?

It calls `assertRateParity(slug, keys)` on a real `RateResolverService` instance
(loaded from the compiled API dist, not reimplemented). The comparison is done
inside the service using the same logic that production code uses.

## What it does NOT check

- **Resolvability** — whether RateTable can find a row at all — is what
  `fallback-audit.mjs` checks. The parity proof only runs when both paths
  answer; a `divergence` here is a value or unit mismatch, not a miss.
- **Density parity** — `resolveMaterialDensity` uses a separate code path
  (`resolveMaterialDensityFromRateTable`) that is not exercised by
  `assertRateParity`. Density parity is covered by the fallback-audit density
  section.
- **Production data** — this instrument must never be run against production.
  Marco runs it against the seeded dev database.

## Why it is needed (and why fallback-audit is not enough)

`fallback-audit.mjs` exits 0 when every legacy key is *resolvable* from
RateTable. Resolvable is not identical. A RateTable row that answers $95/t
where legacy answers $85/t passes the fallback audit and is a $10/t pricing
error. The fallback-audit also mirrors the resolver's lookup logic in its own
`tryRateTable` function rather than calling the production function — so it can
agree with itself while disagreeing with production.

The parity proof fixes both gaps:
1. It compares **values and units**, not just presence.
2. It calls **the real `assertRateParity`** from the compiled service — not a
   local copy of the logic.

## Counting rule — why there are 8 slugs, not 6

The `tryLegacy` method in `rate-resolver.service.ts` handles **8 slugs**:

| Slug | Legacy table |
|------|-------------|
| labour | EstimateLabourRate |
| plant | EstimatePlantRate |
| waste | EstimateWasteRate |
| cutting | EstimateCuttingRate |
| core-hole | EstimateCoreHoleRate |
| fuel | EstimateFuelRate |
| enclosure | EstimateEnclosureRate |
| other-rates | CuttingOtherRate |

`fallback-audit.mjs` and `docs/plans/rates-migration-plan.md:35` both say "6
priced slugs" and "6 legacy slug handlers" — both undercount. They predate
SLICE 11a, which registered `enclosure` (→ `EstimateEnclosureRate`) and
`other-rates` (→ `CuttingOtherRate`) in the resolver at `:425` and `:437` of
`rate-resolver.service.ts`. The canonical count is the number of `case` branches
in `tryLegacy`, which is **8**.

## How to run

```bash
pnpm rates:parity-proof
# or
node scripts/rates/parity-proof.mjs
```

Run against the local seeded dev database only. The default `DATABASE_URL`
points to `localhost:5432`. Override via the `DATABASE_URL` environment variable.
Set `REPO_BASE` to the repo root if the script cannot locate `@prisma/client` or
the compiled dist automatically.

Ensure `pnpm build` has produced `apps/api/dist/src/modules/rates/rate-resolver.service.js`
before running. The script exits 2 if it cannot load the compiled service.

## How to read the exit codes

| Exit code | Meaning |
|-----------|---------|
| 0 | Every key matched: value AND unit are identical in both paths. |
| 1 | At least one divergence. Report lists every divergence with legacy value/unit and RateTable value/unit. |
| 2 | Infrastructure error: DB unreachable, compiled service not found, or RateResolverService could not be instantiated. |

## NO DATA slugs

A slug with zero active legacy rows is **neither a pass nor a fail**. The
report lists it with a `NO DATA` label. It must not be silently counted as
proven. A slug that has no legacy rows cannot be compared — verify seeding
before using this report as a 11c gate for that slug.

## What a divergence means

A divergence is a real bug in the seed or the ratetable model — see the
doc-comment on `assertRateParity` in `rate-resolver.service.ts`. It is a
finding to report to Marco, not a test failure to "fix" by adjusting the
script. The script is read-only and must remain so.

## Relationship to SLICE 11c

SLICE 11c removes `tryLegacy` (the legacy fallback) and the tables it queries.
Once `tryLegacy` is gone, any key the RateTable cannot serve identically fails
at runtime — silently, in pricing. This proof is the precondition gate:

- Exit 0 on all 8 slugs with data → 11c precondition met (for parity).
- Any divergence or NO DATA slug → 11c blocked until resolved.

The report file (not this method note) is the artefact Marco reviews. A clean
exit-0 run must be pasted into the 11c PR body before that PR is reviewed.
