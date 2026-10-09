---
premise: '! grep -q "SEED_GRANT_UNDELIVERABLE" scripts/pipeline/lint-prompt.mjs'
premise_means: >-
  A prompt can scope apps/api/prisma/seed*, forbid a migration, and not declare gate_allow:
  migrations. CI gate CP-23 then fails every PR it can produce: its only exits are a migration
  (forbidden) or a `SEED-ONLY: dev` body line (which asserts production does not need the data).
  lint-prompt.mjs ADMITs that shape today; it validates seed_only only as a known key.
  MEASURED 2026-10-02 at origin/main c145476c: no rule in lint-prompt.mjs cross-checks a seed path
  in scope against migrations and the body text. Worked instance: PR #1823 (2026-09-09), a full
  arm-build-review cycle spent on an unsatisfiable prompt. A report-only probe of this exact rule
  over the 36 depth-1 HOLDs then fired on 1 (the real defect) with 0 false positives. Source:
  needs-marco/prompt-declared-seed-only-false-while-forbidding-a-migration-2026-09-09.md (local).
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  grep -q "SEED_GRANT_UNDELIVERABLE" scripts/pipeline/lint-prompt.mjs &&
  test -f scripts/pipeline/__tests__/lint-prompt.seed-grant-undeliverable.test.mjs
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/__tests__/lint-prompt.seed-grant-undeliverable.test.mjs
size: 2
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  One linter rule and its test. Reverting removes the rule; no prompt or data changes.
escalates: false
module: pipeline
---

# lint-prompt: reject a prompt that changes the seed but forbids the migration that would deliver it

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-02)

**REJECT the contradiction only.** Do not go stricter: a prompt that touches the seed **and** adds a
migration, or that permits one, must still ADMIT. Do not warn-only.

## The rule

Add a REJECT with code `SEED_GRANT_UNDELIVERABLE`. It fires when **all four** hold:

1. `scope` contains a path matching `^apps/api/prisma/seed`; **and**
2. `scope` contains no path matching `^apps/api/prisma/migrations/`; **and**
3. `gate_allow` does not include `migrations`; **and**
4. the body (front matter excluded) matches, case-insensitive, any of:
   `/do\s+not\s+add\s+a\s+migration/i`, `/no\s+migration\s+is\s+needed/i`,
   `/no\s+migration\s+(is\s+)?required/i`, `/without\s+a\s+migration/i`.

A body that says `SEED-ONLY: dev` at column 0 in its PR-body instructions **clears** the rule: the
author has declared the data dev-only, which is CP-23's other legitimate exit. Match it with
`/^SEED-ONLY:\s*dev\b/m`.

Message:

> This prompt writes to the Prisma seed, forbids a migration, and does not declare
> `gate_allow: migrations`. Under CP-23 that is unsatisfiable: the only exits are a migration (which
> you forbid) or a `SEED-ONLY: dev` PR-body line (which asserts production does not need the data).
> Either permit the migration or declare the data dev-only.

Place it beside the existing migration-scope checks (the `GATE_ALLOW_MISMATCH` block). Every input
is already parsed: no new I/O, no `git show`.

## Tests: `scripts/pipeline/__tests__/lint-prompt.seed-grant-undeliverable.test.mjs`

Fixture prompts written to a temp dir, linted through the module's exported entry point (or the
CLI, following the pattern of the existing `lint-prompt.*.test.mjs` files):

1. Seed in scope + "Do NOT add a migration" + no gate: **REJECT `SEED_GRANT_UNDELIVERABLE`**.
2. Same prompt with `gate_allow: migrations` and a migrations path in scope: not this code.
3. Same as 1 but the body carries `SEED-ONLY: dev`: not this code.
4. Seed in scope, no forbid-migration wording: not this code.
5. **Negative control:** the forbid-migration wording with no seed path in scope: not this code.

All existing lint tests stay green. Run the linter over every depth-1 `*-HOLD.md` on your branch
and paste the counts into the PR body. Any prompt that newly fires must be named, with a
one-line reason why it is a real contradiction.
