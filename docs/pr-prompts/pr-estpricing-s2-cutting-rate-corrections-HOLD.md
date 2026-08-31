---
premise: '! grep -q "CUTTING_RATE_CORRECTIONS_V1" apps/api/src/modules/tendering/scope-redesign.service.ts'
premise_means: The four measured concrete-cutting pricing defects are still live.
scope:
  - apps/api/src/modules/tendering/scope-redesign.service.ts
  - apps/api/src/modules/tendering/__tests__/cutting-rate-corrections.spec.ts
done_when: pnpm build && pnpm lint && grep -q "CUTTING_RATE_CORRECTIONS_V1" apps/api/src/modules/tendering/scope-redesign.service.ts
size: 4
gate_allow: none
seed_only: false
escalates: true
cluster: estimating-pricing
cluster_order: 3
requires_on_main: 'apps/api/src/modules/rates/rate-resolver.service.ts :: SNAPSHOT_LIST_APPLIED'
---

# Four measured concrete-cutting pricing defects

Each was verified against the Cutrite rate rows in `seed-initial-services.ts` on 2026-08-30.
Three overcharge; one undercharges badly. **Write the failing test first in every case** — all four
produce plausible-looking numbers, which is why they survived this long.

## 1. Core-hole depth has no rounding and no minimum

`pricedCuttingData` computes `const depthUnits = depthMm / 10` and multiplies. A 14 mm hole bills
1.4 units. Marco's rule: **the listed rate buys one whole 10 mm unit; part-units round at the five
(x0–x4 down, x5–x9 up); every hole bills at least one unit.**

A 32 mm hole at $1.70: 0–14 mm is $1.70, 15–24 mm is $3.40, 25–34 mm is $5.10.

## 2. Tracksaw and Flush-cut ignore depth entirely

`resolveCuttingRate` buckets those rigs to `ceil(depth/25)*25`, finds no row above 25 mm, then
falls back to the smallest available row — so every cut of any depth prices at $18.00/m. Marco's
rule: **$18.00 buys 25 mm of depth per lineal metre and scales at $0.72/mm, with $18.00 as the
floor.** A 100 mm cut is $72.00/m, not $18.00/m. Derive both constants from the seeded 25 mm row
rather than hardcoding them, so a Cutrite reprice moves the floor and the per-mm rate together.

## 3. Core holes accept any method multiplier

`resolveCoreHoleRate` applies `METHOD_MULTIPLIER[input.method]` with no per-equipment allowlist,
so Low-emission silently adds 25% to a core hole. **Core holes take no method multiplier.**

## 4. Demosaw wall cuts are loaded on top of a wall rate

`ELEVATION_MULTIPLIER["Wall"] = 1.1` is applied to every saw cut. But the Cutrite sheet already
prices Demosaw walls in their own rows — 150 mm wall concrete is $48.60 against $28.40 on the
floor, which is 1.71x, a priced row and not a 10% uplift. The result is $53.46/m against a sheet
price of $48.60/m.

**The rule is that a loading belongs only where the sheet does not already price that dimension.**
Scope the elevation loading per equipment: no uplift where the rig has its own Wall rows (Demosaw),
uplift where its rows are stored as `Any` (Ringsaw, Flush-cut, Tracksaw). Roadsaw is Floor-only and
is unaffected.

## What to build

Apply all four in `scope-redesign.service.ts`, and place the literal token
`CUTTING_RATE_CORRECTIONS_V1` in a comment beside the corrected block — it is this slice's
proof-of-landing marker and the next slice gates on it.

Spec at `apps/api/src/modules/tendering/__tests__/cutting-rate-corrections.spec.ts` with one
failing-first case per defect, using the numbers quoted above as the expected values.

## Do NOT

- Do not change the rate rows themselves; the seeded Cutrite values are correct.
- Do not touch `schema.prisma` or add a migration.
- Do not alter the waste or scope-item pricing paths.
- Do not touch `/sot/`.

## VERIFY

- The four new specs fail on the current head and pass after the change — state both in the PR body.
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
