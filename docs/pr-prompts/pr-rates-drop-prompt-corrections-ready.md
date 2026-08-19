---
premise: 'grep -q "no inbound Prisma relation/FK to any of them" docs/pr-prompts/pr-524-rates-b-slice2-canonical-HOLD.md'
premise_means: >-
  pr-524 still carries the false audit claim that none of the seven legacy rate
  tables has an inbound Prisma relation. ScopeWasteItem.transportRate is exactly
  such a relation to EstimatePlantRate.
scope:
  - docs/pr-prompts/**
  - docs/plans/**
done_when: >-
  ! grep -q "no inbound Prisma relation/FK to any of them"
  docs/pr-prompts/pr-524-rates-b-slice2-canonical-HOLD.md && grep -q
  "ScopeWasteItem.transportRate"
  docs/pr-prompts/pr-524-rates-b-slice2-canonical-HOLD.md && grep -q
  "escalates: true" docs/pr-prompts/pr-524-rates-b-slice2-canonical-HOLD.md
size: 3
gate_allow: none
seed_only: false
escalates: true
backfill: false
---

# Correct three factual errors in the legacy-rate-drop prompts

Documentation only. No code, no schema, no `/sot/`. Three corrections, all
verified against `main` on 2026-08-19. **Change only what is listed here.**

## Correction 1 — pr-524's FK audit claim is false

`docs/pr-prompts/pr-524-rates-b-slice2-canonical-HOLD.md:53-55` reads:

> **DROP** the 7 core rate tables: `EstimateLabourRate`, `EstimatePlantRate`,
> ... (Audit confirmed no inbound Prisma relation/FK to any of them.)

Verified false. `apps/api/prisma/schema.prisma:3648-3649`:

```prisma
transportRateId  String?             @map("transport_rate_id")
transportRate    EstimatePlantRate?  @relation("ScopeWasteItemTransportRate",
                   fields: [transportRateId], references: [id], onDelete: SetNull)
```

plus `@@index([transportRateId])` at :3671. The R3 T-1 waste transport cost
engine added this FK **after** the audit sentence was written.

Replace the parenthetical with an accurate statement: `EstimatePlantRate` has
one inbound relation — `ScopeWasteItem.transportRate` — which must be resolved
before it can be dropped; the six others were audited clear. Add a line noting
that Prisma validation fails on a relation to a missing model, so the failure
mode is a red build rather than silent corruption.

## Correction 2 — pr-524 carries `escalates: false` on an irreversible drop

`docs/pr-prompts/pr-524-rates-b-slice2-canonical-HOLD.md:14` is
`escalates: false`, while the body (:38) says "Do NOT auto-merge — human review
required" **in prose only**. `merge-queue.ps1` takes CLEAN + unlabelled PRs;
prose is not a lock. This is the third instance of the pattern (#1142, #1216,
and now pr-524).

Change the front-matter to `escalates: true` and add a one-line comment in the
body recording why: prose is not enforcement; only `escalates: true` makes the
watcher apply `do-not-merge` and CP-26 hold the PR red.

Leave the `-HOLD` filename and the arming preconditions exactly as they are.

## Correction 3 — 11c must NOT drop `EstimateMaterialDensity`

`docs/pr-prompts/no-pr-opened/pr-rates-s11c-drop-legacy-tables-ready.md` step 1
says: "Migration dropping the eight legacy `Estimate*Rate` tables **and
`EstimateMaterialDensity`**".

pr-524 says the opposite and is right: "KEEP `EstimateMaterialDensity`
entirely — it is a density lookup, not a $ rate."

Evidence: `apps/api/test/canonical/CP-08-seed-idempotency.spec.ts:55, 238, 266`
counts it and asserts `> 0`; `apps/api/prisma/seed-initial-services.ts:3549-3555`
seeds it. Dropping it fails CP-08.

Amend 11c step 1 to drop the legacy `Estimate*Rate` tables **only**, and add an
explicit "KEEP `EstimateMaterialDensity`" line to its Do NOT section.

Apply the same correction to `docs/plans/rates-migration-plan.md:82`, which
repeats the wrong instruction.

## Do NOT

- Do NOT rename either prompt file. `pr-524-...-HOLD.md` stays HOLD;
  `pr-rates-s11c-...-ready.md` stays exactly where it is under `no-pr-opened/`.
- Do NOT change either prompt's arming preconditions, scope, done_when, or any
  other front-matter field except pr-524's `escalates`.
- Do NOT touch `/sot/` — flag any `/sot/` implication for a doc-reconcile instead.
- Do NOT touch any code, schema, migration or test file.

## Verify

- `node scripts/pipeline/lint-prompt.mjs` on both edited prompts still parses
  them and reports the same verdict as before, except pr-524's escalates flag.
- Quote the before/after of each of the three edits in the PR body.

## Note on `escalates: true`

This PR touches only markdown and drops nothing. OPS-6 flagged it on the literal
string "drop-legacy" in the 11c filename it cites. Rather than reword to dodge
the check, the flag is set true on its merits: this prompt rewrites the arming
rules and the risk statement of an **irreversible table drop**. Getting those
edits wrong is exactly the failure the escalation gate exists to catch. It will
land with `do-not-merge` and CP-26 red until a human clears it.

## STANDING AUTHORITY

Documentation corrections only. Stop and report rather than widening scope.
