---
premise: '! grep -q "stageGroup" apps/api/prisma/schema.prisma'
premise_means: >-
  The roll-up can express concurrent stages but nothing can create one - every card is still its own
  stage because there is no field saying otherwise, and no control for setting it.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/dto/scope-of-works.dto.ts
  - apps/api/src/modules/tendering/scope/scope-cards.service.ts
  - apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx
  - apps/web/src/pages/tendering/scope-cards/useScopeCards.ts
  - apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts
  - apps/web/src/pages/tendering/scope-cards/utils/__tests__/discipline-rollup.test.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "stageGroup" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
design_ref: https://claude.ai/code/artifact/1c1d373e-dd9c-472b-9063-d74529da1035
cluster: concurrent-stages
cluster_order: 2
requires_on_main: 'apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts :: SCOPE_STAGE_AWARE_V1'
rollback_strategy: >-
  ADDITIVE: one nullable column on scope_cards, no backfill, no existing column touched. NULL means
  "its own stage", which is what every existing row will hold, so every discipline reads exactly as
  it does today until somebody deliberately groups two cards. Revert the code and the column is
  ignored; the grouping data survives for a re-apply.
---

# Two cards can now say they run at the same time

`pr-stages-s1` taught the roll-up the stage model and shipped it with every card in its own stage, so
no figure moved. This slice adds the one thing that lets a stage hold more than one card, and the
control to say so.

Marco, 2026-09-05: jobs may run concurrently at some point, and he wants the logic in place before
that happens rather than retrofitted onto a live estimate.

## What to build

**One nullable column on `ScopeCard` — `stageGroup Int?`.** `NULL` means "this card is its own
stage". Two cards in the same discipline sharing a non-null `stageGroup` are one stage and run
concurrently.

Nullable-with-null-default is deliberate and is the safety property of this slice: **every existing
row is already correct**, no backfill runs, and no discipline's figures move until a human groups
something. Do not use a non-nullable default — `@default(0)` would make every card concurrent with
every other on the day it ships, which silently multiplies every discipline's peak crew.

Then:
- Accept it on the card PATCH DTO, beside `plantColumnCount` and the markup overrides.
- Return it from the card read path so the web side can fold on it.
- Pass it into `rollUpDiscipline` as the stage key s1 already accepts.
- Give the user a way to set it on the Scope Cards tab. **Keep it small** — grouping adjacent cards
  in a discipline is the whole feature. Do not build a Gantt.

## The number that will move, and how to make it visible

The moment two cards share a stage, that discipline's **peak crew rises** (the stage sums) and its
**duration falls** (the stage maxes). That is correct — but it is a figure an estimator may have
quoted from, so it must not change quietly.

- The summary bar's Peak crew and Duration chips carry `title` text stating the sequential rule.
  **Update both** to describe what actually happened: how many stages, and that concurrent cards sum.
- Say in the PR body, with real figures, what a three-card discipline reads before and after two of
  its cards are grouped.

## Do NOT

- **Do not change any figure for an ungrouped discipline.** Every existing card gets `NULL`. If a
  test expectation needs editing for a discipline with no grouping, STOP and report — that is a
  regression, not a rebase.
- Do not add stage ORDER as a second concept. Stage order is the card order that already exists;
  grouping is the only new fact. Two fields where one will do is how this becomes a scheduler.
- Do not touch the per-card `peakCrewOverride` / `durationOverride` — they still win over the
  computed figure, in both models.
- Do not touch `/sot/` or `.github/workflows/**`.

## Required by the schema rules — do these up front, CI will not let you fix-forward

1. Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
   `docs/data-model/relationship-map.json`, `relationship-map.md` and `metadata-catalog.json`.
2. Put a bare `GATE-ALLOW: migrations` line at **column 0** of the PR body.
3. Update the card service spec's Prisma payload assertions for the new field.

## Verification

- [ ] `pnpm --filter @project-ops/web test` and `pnpm --filter @project-ops/api test` green.
- [ ] A test proving an all-NULL discipline folds identically to `main`.
- [ ] A test grouping two of three cards: peak crew, duration and plant quantities all move the way
      the stage table says, with the figures quoted.
- [ ] The migration SQL quoted in full — one `ADD COLUMN`, nullable, no `UPDATE`.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
`escalates: true` gates the MERGE, not the RUN — open the PR and leave it unmerged for Marco.
