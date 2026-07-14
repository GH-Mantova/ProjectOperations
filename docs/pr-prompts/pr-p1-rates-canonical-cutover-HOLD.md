---
premise: '! grep -rq "RATES_CANONICAL_SOURCE" apps/api/src'
premise_means: The canonical-source switch does not exist yet, so the cutover has not been built.
scope:
  - apps/api/src/modules/rates/rate-resolver.service.ts
  - apps/api/src/modules/rates/__tests__/rate-resolver.service.spec.ts
  - apps/api/src/config
  - .env.example
done_when: pnpm build && pnpm lint && grep -rq "RATES_CANONICAL_SOURCE" apps/api/src
size: 6
gate_allow: env-vars
seed_only: false
escalates: false
---

# P1 — RateTable canonical cutover (`RATES_CANONICAL_SOURCE`)

**This prompt is the missing link.** `pr-524-rates-b2-slice2-canonical-HOLD.md` names
`pr-rates-b2-ratetable-canonical-cutover` as its explicit precondition — **and that prompt was never
written.** The entire Rates B-slice-2 endgame (dropping the 8 legacy `Estimate*Rate` tables) has been
blocked for days on a step that did not exist. This is that step.

## STANDING AUTHORITY - read this first

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
There is no human in this run. Finishing the work and then asking for permission is
**indistinguishable from failing.**
**Your run is complete only when your output contains a PR NUMBER** - or an honest `NO-OP: <reason>`.

## Where we already are (all merged — do not rebuild any of it)

- **The flexible `RateTable` / `RateColumn` / `RateRow` model** — shipped.
- **The rate-resolver seam** (`rate-resolver.service.ts`, `enumerateRateSet`) — shipped. Every rate
  lookup already goes through this ONE place. That was the whole point of the seam.
- **`isReference` + `resolveReferenceValue()`** (excavator production rates) — shipped, #540.
- **`FilterableRateGrid`** (the in-ERP editing surface) — shipped, #535.
- **The baseline rows seeded into PROD** via an idempotent migration — shipped, #552.
  Prod now has 9 rate tables / 35 columns / **132 rows**, byte-identical to the seed.

**Everything is in place except the switch.** The resolver still reads the 8 legacy `Estimate*Rate`
tables; the RateTable data sits there, correct and unused.

## What to build

**A single switch, defaulting OFF, that makes `RateTable` the canonical source for rate lookups.**

1. **`RATES_CANONICAL_SOURCE`** env var. Values: `legacy` (default) | `ratetable`.
   Add to `.env.example` with a comment. **Default MUST be `legacy`** — this PR must change no
   behaviour until the flag is flipped deliberately.

2. In **`rate-resolver.service.ts`** — and **nowhere else** — branch on the flag. Every consumer
   already calls through this seam, which is exactly why the seam was built. **If you find yourself
   editing a second file to change where rates come from, stop: you are going around the seam.**

3. **Both paths must return the identical shape.** The callers must not be able to tell which source
   answered.

4. **A parity check.** Add `assertRateParity()` (or similar) that resolves the SAME key from BOTH
   sources and reports any divergence. This is what makes the cutover *provable* rather than hoped:
   we can run both in parallel and see they agree before flipping anything.

## Tests

- Resolver returns identical values from `legacy` and `ratetable` for **every** seeded rate key.
  *(The prod seed guarantees the two are byte-identical — an md5 over all 132 rows matched the seed's
  own projection. So this test SHOULD pass; if it does not, you have found a real bug and you must
  say so loudly rather than "fixing" the test.)*
- With the flag unset, behaviour is **exactly** as before (default `legacy`).
- With `RATES_CANONICAL_SOURCE=ratetable`, lookups come from `RateTable`.
- `isReference` tables (excavator production) stay **excluded** from priced rate-set snapshots.

## Do NOT

- **Do NOT drop, alter, or deprecate any `Estimate*Rate` table.** That is `pr-524`, it is
  irreversible, and it is explicitly gated on Marco's confirmation AFTER a clean pricing cycle on
  the new source. **Dropping them here would destroy data.**
- Do not change the default. It ships OFF.
- Do not touch the seed.
- Do not touch `sot/`. CP-24 hard-fails any PR mixing code and `sot/`.

## Gates

`gate_allow: env-vars` — you are adding `RATES_CANONICAL_SOURCE`. Put the marker **bare at column 0**
in the PR body:

```
GATE-ALLOW: env-vars
```

Not `## GATE-ALLOW: env-vars`. Not with a trailing period. **10 PRs have died on exactly this.**

## After this merges

`pr-524` (drop the legacy tables) becomes runnable — but ONLY after:
1. `RATES_CANONICAL_SOURCE=ratetable` has been live in prod, and
2. a **clean pricing cycle** has completed on it, and
3. **Marco confirms.**

**Say this explicitly in your PR body**, so the next agent does not chain straight into the
irreversible step.

## Guardrails

- **ONE ATTEMPT.** If it does not work, `NO-OP: <reason>` and stop.
- **NEVER ask a question. NEVER "stand by".**
- Open the PR. **Do not merge** — this changes where every price in the system comes from.
