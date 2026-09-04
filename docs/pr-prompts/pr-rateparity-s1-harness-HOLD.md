---
premise: '! grep -rq "RATE_PARITY_HARNESS_V1" apps/api/src/modules/rates'
premise_means: >-
  Nothing anywhere compares the price a tender line is charged today against the price the stored
  charge-step list would produce for the same line. `chargeSteps` is stored, validated and
  previewed, and is priced against nothing, so there is no evidence either way about whether
  switching charge steps on would move a number. The decision to switch cannot be taken until that
  evidence exists.
scope:
  - apps/api/src/modules/rates/charge-step-parity.service.ts
  - apps/api/src/modules/rates/rate-resolver.service.ts
  - apps/api/src/modules/rates/rates.module.ts
  - apps/api/src/modules/rates/__tests__/charge-step-parity.service.spec.ts
done_when: pnpm build && pnpm lint && grep -rq "RATE_PARITY_HARNESS_V1" apps/api/src/modules/rates
size: 7
gate_allow: none
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df
cluster: rates-parity-gate
cluster_order: 1
requires_on_main: 'apps/api/src/modules/rates/rate-tables.service.ts :: RATE_LINE_FIELDS_V1'
rollback_strategy: >-
  API-only. One new service, one call site inside `RateResolverService`, the module wiring and a
  spec. No API route, no DTO, no schema, no migration, no new dependency, no environment variable.
  The service is required to be incapable of returning a price, so a revert cannot move a tender
  total - it removes a log line and nothing else.
---

# Run both prices on every line, log every disagreement, and throw the new one away

First slice of the parity-gate cluster. Approved mock-up:
`https://claude.ai/code/artifact/a6a66f6e-3592-435a-8608-9480411712df`

**The ruling.** Marco, 2026-09-04, Decision 2 of the four decisions behind package 9 (recorded in
`docs/decisions/estimating-four-decisions-2026-09-04.md`): charge
steps become the price **parity-gated - option (a)**. Not build-and-flip, and not per-table opt-in.
Both paths run against real tenders, every disagreement is logged, and the switch happens only once
that log is clean.

**Why (a) rather than per-table opt-in.** Finding 9.4.3 is measured, not suspected. The client
preview and the server evaluator compare condition values by different rules:

- client, `checkCondition` in `apps/web/src/pages/admin/ChargeStepsEditor.tsx:279`:
  `case "is": return lhs === rhs || String(lhs) === String(rhs);`
- server, `evaluateCondition` in `apps/api/src/modules/rates/rate-step-evaluator.ts:174-176`:
  `case "is": ... return lhs === rhs;` - strict, no coercion.

So a numeric cell `150` against a condition typed `"150"` matches in the preview and **never** on
the server. Per-table opt-in would let a table whose rules look right in the editor be switched on
and price differently in production, one table at a time, with nothing watching. That is harmless
only because `evaluateSteps` has never run: it has exactly two references in the repo - its own
definition at `apps/api/src/modules/rates/rate-step-evaluator.ts:237` and
`apps/api/src/modules/rates/__tests__/rate-step-evaluator.spec.ts` - and `RateResolverService`
never reads `chargeSteps` (grep the field: the only hits are `ChargeStepsEditor.tsx`,
`RatesListsAdminPage.tsx`, `rate-tables.service.ts`, `rates.controller.ts` and `schema.prisma`).

**This slice builds step 3 of the ruling's five-step sequence: the harness itself, which is the
gate. It switches nothing on.** It ships a number that is computed, compared, logged and then
discarded.

**Why the gate.** `requires_on_main` is `apps/api/src/modules/rates/rate-tables.service.ts ::
RATE_LINE_FIELDS_V1`, which is not on `origin/main` as at 2026-09-04. A charge-step operand today
can only be a rate-table column name or a numeric literal - the grammar at
`rate-step-evaluator.ts:8-19`, and `validateSteps` at `ChargeStepsEditor.tsx:157-179` rejects any
field that is not a column on the table. Until that artifact lands there is no per-line operand for
a step list to be evaluated against, and the harness would have nothing to compare. The prompt
parks until it does. Do not remove the gate to make the lint go green.

## What to build

**1. One service that computes both numbers for one priced line.** New file
`apps/api/src/modules/rates/charge-step-parity.service.ts`, provided and exported from
`rates.module.ts` alongside `RateResolverService`. For a line it is handed, it:

- takes the figure the current path produced - the value `RateResolverService` resolved, which is
  what `computeScopeItemTotal` (`apps/api/src/modules/tendering/scope-item-pricing.ts:208`) prices
  the line from;
- loads the `chargeSteps` for that rate table and evaluates them with `evaluateSteps` against the
  same inputs;
- compares the two and logs when they differ.

**2. Log every disagreement, with both numbers and enough to find the line again.** One structured
`logger.warn` per disagreement, with a stable event name so the log can be counted rather than
read. `RateResolverService` already logs in exactly this shape - see
`this.logger.warn({ event: "ratetable-miss-fell-back-to-legacy", slug, keys })` at
`rate-resolver.service.ts:100`. Match it. Each record must carry, at minimum:

- the tender id;
- the rate table (slug and id);
- the resolution keys;
- **the step index at which the two answers part company** - `evaluateSteps` returns
  `{ total, trail }` and every trail entry carries `{ index, op, runningTotal, skipped }`
  (`rate-step-evaluator.ts:237`+), so the index is available without inventing anything;
- **both numbers**, named, in the same record. A log that says "mismatch" without the pair is
  useless for the soak.

Also count and log the lines that AGREE, or the disagreement count means nothing. A denominator is
required by the verification below.

**3. Read-only by construction, not by discipline.** The harness must be structurally incapable of
changing a price. Build it that way and say how in the PR body:

- **The public method returns nothing.** `Promise<void>`. A method that returns a number can be
  wired into a price by a one-line edit six months from now; a method that returns nothing cannot.
  The charge-step figure must exist only as a local and as a field in a log record.
- **The call site discards.** The call from `RateResolverService` is a statement, never part of a
  return expression, and never assigned to anything the resolver reads.
- **It cannot throw into the pricing path.** `evaluateSteps` throws on an empty step list, on a
  first step that is not `start`, on divide-by-zero, and on `StepArithmeticTypeError` when a string
  lands in an arithmetic operand. Every one of those is reachable from a stored rule. Wrap the
  whole charge-step evaluation in a catch that logs the throw as a disagreement of its own kind and
  returns. A harness that can take down a live price is not read-only.
- **It cannot slow a price into a timeout.** Load a table's `chargeSteps` once per table per
  request, not once per line.

**4. Cover the read-only property with tests, not just the arithmetic.** The spec must include a
case where the charge-step path throws and the caller still gets its normal price, and a case where
the charge-step path returns a wildly different number and the resolved price is unchanged.

Mark `apps/api/src/modules/rates/charge-step-parity.service.ts` with `RATE_PARITY_HARNESS_V1`.

**Tracking.** This is the same lever as board items 1.2.2 and 1.2.15 and should be tracked with
them. `RATES_CANONICAL_SOURCE` is set in no deployed environment: the only occurrence outside code
and tests is `.env.example:209`, which sets the documented default `legacy`, and
`parseRatesCanonicalSource` (`apps/api/src/config/app.config.ts:14-17`) returns `legacy` for
anything that is not exactly `"ratetable"`. Production therefore takes the legacy-first branch by
absence, and will keep taking it after this slice.

## Do NOT

- **Do not make `RateResolverService` return the charge-step result.** Not from `resolveRate`, not
  from `listRates`, not from `tryRateTable`, not from `tryLegacy`, not through a new option flag,
  and not "just when a table has steps". The resolved value this slice returns must be
  byte-identical to the value `main` returns for the same input.
- **Do not set `RATES_CANONICAL_SOURCE` in any environment.** Not in `.env.example`, not in a
  deploy config, not in a workflow, not as a process-level default in a service constructor. The
  harness must read the same rates the application already reads and must not touch the canonical
  source at all.
- **Do not change `evaluateSteps`' semantics.** The condition comparison rules, the error taxonomy,
  the rounding and the arithmetic in
  `apps/api/src/modules/rates/rate-step-evaluator.ts` all stay exactly as they are on `main`. That
  file belongs to `pr-chargesteps-s1-evaluator-parity`, which lands first. If the two evaluators
  still disagree when you run, that disagreement is the harness's finding to report, not its bug to
  fix.
- **Do not add "line fields" or any other new operand.** A step operand is a rate-table column name
  or a numeric literal. If the gate artifact has changed that, use what it provides; do not invent
  a second mechanism.
- **Do not declare the soak finished, and do not propose a flip date.** Soak length is Marco's call
  and he takes it when the harness lands, not when it is written.
- Do not add, change or remove an API route, controller, DTO, schema field or migration.
- Do not touch `/sot/`, or any file outside `scope:`.

## Verification

- [ ] `pnpm --filter @project-ops/api test` green.
- [ ] State the exact return type of the harness's public method, and confirm it is `Promise<void>`.
      Quote the call site line from `rate-resolver.service.ts` and say in one sentence how the
      charge-step figure is prevented from reaching a caller.
- [ ] Run the harness over real priced lines and report **two figures**: the number of priced lines
      examined and the number that disagreed. Neither number may be omitted, and a disagreement
      count without a denominator is not a report.
- [ ] For at least one disagreement, quote the whole log record: tender, rate table, step index,
      and both numbers. If the count is zero, say so and give the denominator anyway.
- [ ] Prove the harness cannot break a price: state what the resolved value is for a line whose
      charge-step evaluation throws, and confirm it equals the value `main` returns for the same
      line.
- [ ] Confirm `RATES_CANONICAL_SOURCE` is unchanged - grep the diff and report zero occurrences
      outside the harness's own tests.
- [ ] Confirm `apps/api/src/modules/rates/rate-step-evaluator.ts` is untouched by this diff.
- [ ] **Do not claim the soak is complete.** State the observation window the figures above cover
      and stop there.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push and open the PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN - open the PR and leave it unmerged for Marco. It is
`true` here because this slice adds a second evaluation to every priced line in production.
