---
premise: 'git fetch -q origin feat/rates-parity-harness-s1 && git show origin/feat/rates-parity-harness-s1:apps/api/src/modules/rates/charge-step-parity.service.ts | grep -qF "(rawSteps as ChargeStep[])"'
premise_means: >-
  PR #1878's branch still casts the two Prisma JSON columns it reads (`chargeSteps`,
  `lineFields`) straight from `JsonArray` to `ChargeStep[]` / `RateLineField[]`. TypeScript
  refuses both with TS2352, the API package does not compile, so 39 suites fail before a single
  assertion runs and tendering-e2e never gets an API to talk to (run 34560773839, head db0420c2).
  The harness itself is not wrong - it cannot be built.
fixes_pr: 1878
scope:
  - apps/api/src/modules/rates/charge-step-parity.service.ts
  - apps/api/src/modules/rates/rate-tables.service.ts
done_when: >-
  pnpm --filter api build && pnpm --filter api lint && ! grep -qF "(rawSteps as ChargeStep[])"
  apps/api/src/modules/rates/charge-step-parity.service.ts && ! grep -qF "(rawLineFields as
  RateLineField[])" apps/api/src/modules/rates/charge-step-parity.service.ts && grep -q
  "RATE_PARITY_HARNESS_V1" apps/api/src/modules/rates/charge-step-parity.service.ts
size: 2
gate_allow: none
seed_only: false
escalates: true
backfill: false
module: rates
---

# Repair PR 1878 - the parity harness reads two JSON columns with a cast TypeScript refuses

**Do this ON PR #1878's existing branch `feat/rates-parity-harness-s1`. Do NOT open a new PR.**
The defect is inside that PR's own diff. main is green.

## FIRST: re-verify against the CURRENT head

Errors drift, and the watcher rebases this branch after every merge to main. The review that
sent you here (`pr-1878-review.md`) cites lines 646 and 652; by the next run the same two errors
sat at 283 and 289. Read the API job log of the **latest** CI run on the branch, confirm the
failure is still the two TS2352s below, and chase the line numbers the log gives you. If the
failure has changed, fix what the log shows and say so plainly.

At the time of writing (run 34560773839, head db0420c2, API job 103142884864):

    src/modules/rates/charge-step-parity.service.ts:283:12 - error TS2352: Conversion of type
      'JsonArray' to type 'ChargeStep[]' may be a mistake because neither type sufficiently
      overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
    src/modules/rates/charge-step-parity.service.ts:289:12 - error TS2352: Conversion of type
      'JsonArray' to type 'RateLineField[]' may be a mistake ...

**Two errors, one cause, every API suite red.** The other reds are not yours: `PR gates - diff
checks` falls with `Approval receipt (CP-26)` (one cause, two reds), and CP-26 is SUPPOSED to
fail - #1878 came from an `escalates: true` prompt. Do NOT touch the `do-not-merge` label and do
NOT try to make CP-26 pass. Only Marco removes it.

## The actual code (on the branch, `loadTable` or whatever the current head calls it)

    const rawSteps = table.chargeSteps;
    const steps: ChargeStep[] | null =
      rawSteps && Array.isArray(rawSteps) && rawSteps.length > 0
        ? (rawSteps as ChargeStep[])
        : null;

    const rawLineFields = table.lineFields;
    const lineFields: RateLineField[] =
      rawLineFields && Array.isArray(rawLineFields)
        ? (rawLineFields as RateLineField[])
        : [];

`Prisma.JsonArray` is `JsonValue[]`; `ChargeStep` and `RateLineField` are object types with
required string fields. Neither overlaps, so a direct assertion is a compile error under the
strictness this package builds with.

## What to build - read the columns the way main already reads them

main already owns a tolerant reader for one of the two columns, written for exactly this case:
`readStoredLineFields(raw: unknown): RateLineField[]` in `rate-tables.service.ts` (RATE_LINE_FIELDS_V1,
"tolerant by design and never throws ... anything unrecognisable is dropped, which lands on []").
It is module-private today.

1. **`lineFields`** - export `readStoredLineFields` from `rate-tables.service.ts` (add `export`,
   change nothing else in that file) and call it from the harness:
   `const lineFields = readStoredLineFields(table.lineFields);`. Do not copy the function.

2. **`chargeSteps`** - there is no tolerant reader for steps on main; the value was validated by
   `validateChargeSteps` on the way in, and the harness already wraps the whole evaluation in two
   `try/catch` layers and logs a throw as its own disagreement kind. So read it through `unknown`,
   once, with a comment that says why it is safe here and nowhere else:

       // Stored steps were validated by validateChargeSteps on write (rate-tables.service.ts);
       // the harness is read-only and every evaluation runs under try/catch, so a malformed
       // row is logged as a disagreement, never thrown into a price.
       const steps: ChargeStep[] | null =
         Array.isArray(rawSteps) && rawSteps.length > 0
           ? (rawSteps as unknown as ChargeStep[])
           : null;

   This is the one place `as unknown as` is acceptable: the value cannot reach a price (the
   method returns `Promise<void>` and every call site discards it), which is the property the
   whole PR exists to guarantee. Do NOT add a runtime schema parser for steps here - that is
   evaluator territory and out of scope.

3. Nothing else changes: not `rate-step-evaluator.ts`, not the call sites in
   `rate-resolver.service.ts`, not the spec, not the module wiring.

## Verify, then push

1. `pnpm --filter api build && pnpm --filter api lint` - both green, zero TS2352.
2. `pnpm --filter api test -- charge-step-parity rate-resolver` - the harness spec and the
   resolver spec compile and pass.
3. Commit on the branch with a message that describes the change and does NOT put the words
   fix/fixes/close/closes/resolve/resolves immediately before `#1878` (a squash message is built
   from every commit message and GitHub would auto-close on merge).
4. Push. Do not open a PR - #1878 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1878 is the PR** - push to its branch
`feat/rates-parity-harness-s1` and do not open another.
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

`escalates: true` is inherited from #1878 - it gates the MERGE, not the RUN. Marco merges #1878.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already repaired` and exit.
- Touch only the two files in `scope`; in `rate-tables.service.ts` the diff is the word `export`.
- Never remove the `do-not-merge` label; never merge.
