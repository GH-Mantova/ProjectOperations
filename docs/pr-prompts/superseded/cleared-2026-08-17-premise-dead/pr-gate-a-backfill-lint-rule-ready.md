---
premise: ! grep -q "BACKFILL_TEST" scripts/pipeline/lint-prompt.mjs
premise_means: Gate A's intake-lint (docs/plans/pipeline-correctness-gates-plan.md SLICE 3, merged #937) is not built — lint-prompt.mjs does not yet require a migration-scoped prompt to also carry a test. This is the GENERAL #923 guard (SLICE 2 is FormRule-specific; this makes every future backfill migration ship a test).
scope:
  - scripts/pipeline/lint-prompt.mjs
  - docs/pr-prompts/PROMPT-SCHEMA.md
done_when: node --check scripts/pipeline/lint-prompt.mjs && grep -q "BACKFILL_TEST" scripts/pipeline/lint-prompt.mjs && grep -q "BACKFILL_TEST" docs/pr-prompts/PROMPT-SCHEMA.md
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# feat(pipeline): Gate A intake-lint — backfill migrations must ship a test (pipeline-correctness-gates SLICE 3)

Implements Gate A's general layer of `docs/plans/pipeline-correctness-gates-plan.md` (merged #937).
SLICE 2 gives a FormRule-specific CI test; THIS makes the guard general — no future backfill migration
reaches an agent without a test named up front.

## What exists on main
- `scripts/pipeline/lint-prompt.mjs` is the intake linter (see its existing `GATE_ALLOW_MISMATCH` check:
  `scopeHasMigration` derives from a `/migrations/` scope match). It validates the PROMPT at intake —
  the migration file does NOT exist yet at that point, so the rule cannot inspect the migration body.
- `docs/pr-prompts/PROMPT-SCHEMA.md` documents the front-matter and lint failures table.

## What to build
1. In `scripts/pipeline/lint-prompt.mjs`, add a check keyed off the PROMPT (intake-safe, no migration file
   yet): when `scope` includes an `apps/api/prisma/migrations/**` path, REQUIRE the prompt to EITHER
   (a) also name a test file in `scope` (matching `\.(spec|test)\.[tj]s$`), OR
   (b) declare a new OPTIONAL front-matter boolean `backfill: false` explicitly asserting the migration
      does no data backfill (pure additive `ADD COLUMN`/`CREATE`).
   If neither holds, FAIL with code `BACKFILL_TEST_REQUIRED` and a clear message pointing at
   pipeline-correctness-gates §2 Gate A. Rationale (put as a code comment): the linter can't see the
   migration body at intake, so it forces the author to either bring a test or consciously assert
   "no backfill" — closing the #923 class without false-positiving on genuinely additive migrations.
   Keep it additive: existing migration prompts that already name a test (or add `backfill: false`) still pass.
2. If a lint test harness exists (`scripts/pipeline/test-lint-prompt.mjs` or similar), add a case for the
   new rule (a migration-scoped prompt with no test and no `backfill:false` → rejected; one WITH a test →
   admitted). If no harness exists, do not create one — the `node --check` + grep done_when suffices.
3. In `docs/pr-prompts/PROMPT-SCHEMA.md`: document the new rule, the optional `backfill:` field, and add a
   `BACKFILL_TEST_REQUIRED` row to the "Lint failures you will hit" table.

## Do NOT
- Do NOT change any other lint rule or the `must_contain`/`Assert-BodyClaimsAreReal` machinery (that is a
  separate merge-liberty concern; per the plan, this rule is STANDALONE and does not depend on it).
- Do NOT touch app code, schema, or CI workflows.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt; if genuinely impossible, say `NO-OP: <reason>` instead of stopping quietly.
- `node --check scripts/pipeline/lint-prompt.mjs` must pass; sanity-run the linter against an existing
  migration prompt and confirm no regression before opening the PR.
- Never ask for or wait on approval.
