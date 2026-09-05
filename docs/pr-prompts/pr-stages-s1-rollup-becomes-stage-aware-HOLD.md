---
premise: '! grep -q "SCOPE_STAGE_AWARE_V1" apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts'
premise_means: >-
  The discipline roll-up hard-codes the assumption that cards in a discipline never overlap. Peak
  crew is a flat max and duration is a flat sum, with no representation of two cards running at the
  same time, so the arithmetic cannot express concurrency even if the data one day says it happens.
scope:
  - apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts
  - apps/web/src/pages/tendering/scope-cards/utils/__tests__/discipline-rollup.test.ts
done_when: pnpm build && pnpm lint && grep -q "SCOPE_STAGE_AWARE_V1" apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: concurrent-stages
cluster_order: 1
rollback_strategy: >-
  Pure arithmetic in one dependency-free module, plus its unit tests. No schema, no API, no UI, no
  new data. With every card in its own stage - which is what this slice ships - every figure is
  IDENTICAL to today's, and the tests prove it. Revert changes nothing a user can see.
---

# The roll-up learns what a stage is — without changing a single number

`discipline-rollup.ts` opens by recording a domain fact:

> *"cards inside one discipline are STAGES OF THE SAME JOB and they run ALWAYS SEQUENTIALLY … Peak
> crew → max() across the cards. NEVER a sum."*

**Marco revised that on 2026-09-05: jobs may run concurrently at some point, and he wants the logic
built now rather than retrofitted under pressure later.** Sequential is still what happens today. It
is no longer a permanent property of the domain, and the module currently cannot express anything
else — the assumption is welded into the fold rather than being a parameter of it.

This slice makes concurrency **representable**. It does not make it happen, and it must not change
any figure on any screen.

⚠️ **Note for the vision review.** The `design_ref` is the scope-card mock-up because this module
feeds the discipline summary bar drawn there. **This slice renders nothing and changes no figure on
that bar**, so there is no visual difference to compare against the mock-up — the citation is
provenance, not a claim that the screen changed.

## The model

A discipline is an ordered list of **stages**. A stage holds one or more cards. Cards in the same
stage run **at the same time**; stages run **one after another**.

That single idea fixes every rule:

| figure | within a stage | across stages |
|---|---|---|
| Peak crew | **sum** — they are on site together | **max** — the stages never coincide |
| Peak plant, per (category, variant) | **sum** — two stages at once need two machines | **max** |
| Duration | **max** — concurrent stages finish when the longest does | **sum** |
| Person-days, labour days, plant days, money | sum | sum |

**This slice puts every card in its own stage.** Then each stage is a singleton, `sum` within a stage
is the card's own figure, and the table above collapses exactly to today's behaviour: peak crew is
`max` over singletons, duration is `Σ` over singletons. That equivalence is the whole point — it is
what makes this safe to ship before anything can actually group cards.

## What to build

Extend `rollUpDiscipline` to fold **stages of cards** rather than a flat card list, and give
`CardRollupInput` a way to say which stage it is in — a nullable stage key, where `null` means "its
own stage". Keep the existing signature working, or keep a thin wrapper with it, so no call site has
to change in this slice; `ScopeCardsTab` is not in scope.

Keep the module dependency-free — no React, no API client. That is why its arithmetic is unit-testable
without rendering anything, and it must stay that way.

Mark the module `SCOPE_STAGE_AWARE_V1`, and **rewrite the header comment**. It currently states
sequential execution as a domain fact with Marco's name on it. Replace it with the stage model above,
record that the sequential reading was his 2026-09-04 ruling and the concurrency revision his
2026-09-05 one, and state plainly that every card is currently its own stage. A stale header on this
particular file is how the next reader gets the arithmetic wrong.

## The equivalence is the deliverable — prove it, do not assert it

The PR body must show that nothing moved:

- [ ] A test that takes a realistic multi-card discipline, folds it **through the new stage-aware
      path with every card in its own stage**, and asserts every field equals what the old flat fold
      produced. Not "looks the same" — field by field, including `plantSummary`.
- [ ] A test with two cards **sharing** a stage, showing peak crew sums, duration maxes, and plant
      quantity sums within the stage — the behaviour that does not exist yet but will.
- [ ] A test with three stages where the middle one holds two cards, so both rules are exercised in
      one fold rather than in isolation.
- [ ] Quote the before/after figures for one worked discipline in the PR body.

## Do NOT

- **Do not add a schema column, an API field, or any UI.** Nothing in this slice lets a user group
  two cards. That is `pr-stages-s2`, and it is gated on this one.
- **Do not change any figure a user can currently see.** If a test that passed on `main` needs its
  expected value edited, you have changed behaviour — STOP and report it rather than editing the
  expectation.
- Do not change `personDays`, `labourDays` or the money folds — they sum in both models.
- Do not re-derive `labourDays` as `personDays / peakCrew`; the module already documents why that
  understates the days, and the stage model does not change that.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
