---
premise: '! grep -q "NESTED_TEST_PATHS" scripts/pr-watcher/index.mjs'
premise_means: >-
  classifyPolicyFiles still matches test files with /^(tests|docs)\//, anchored at the repo root.
  This repo keeps its tests in nested __tests__ directories and in .test/.spec files beside their
  source, so every test-only PR is classified "outside tests/ or docs/" and routed to Marco.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/**
done_when: >-
  grep -q "NESTED_TEST_PATHS" scripts/pr-watcher/index.mjs && node --test
  scripts/pr-watcher/__tests__/
size: 2
gate_allow: none
seed_only: false
escalates: true
backfill: false
---

# The merge policy cannot see this repo's tests

## READ THIS FIRST — this change is PERMISSIVE

Every other guard fix on this board makes the pipeline refuse more. **This one makes it refuse
less**: PRs that are routed to Marco today would auto-merge after it. That is the intent — but it
means a mistake here costs more than a mistake in the other direction, and it is why this prompt is
`escalates: true`. Marco reviews the diff before it merges.

## The defect, measured

`scripts/pr-watcher/index.mjs:1246`:

```js
const outside = paths.find((p) => !/^(tests|docs)\//.test(p));
if (outside) return { ok: false, reason: `outside tests/ or docs/: ${outside}` };
```

The pattern is anchored at the repository root. This repo has **no top-level `tests/` directory** —
tests live in nested `__tests__/` folders and in `.test.*` / `.spec.*` files beside their source.

**Measured 2026-08-28T08:20:30Z**, PR #1374 — whose entire diff is one checker plus its new test:

```
[merge] pr-breadcrumb-gitignore-gate-routing-not-mention-ready.md:
        PR #1374 stays for Marco (outside tests/ or docs/:
        scripts/pipeline/__tests__/check-breadcrumb.gitignored-sink.test.mjs)
```

The named file is a test. The rule's stated intent — "tests and docs are safe to merge without a
human" — already covers it; only the implementation disagrees. As written, the `tests/` half of the
policy is dead code in this repo: it can never match anything, so every test-only PR reaches Marco
and the routing tells him something false about why.

## Do

1. Replace the anchored test with a named predicate carrying the literal `NESTED_TEST_PATHS` (this
   is what the premise and `done_when` grep for). A path counts as test-or-docs when **any** of:

   - `/^(tests|docs)\//` — unchanged, still true
   - `/(^|\/)__tests__\//` — a nested tests directory
   - `/\.(test|spec)\.[cm]?[jt]sx?$/` — a test file beside its source

2. Keep the rest of `classifyPolicyFiles` byte-for-byte: the empty-diff refusal and the
   migration check stay, and the migration check stays **first**, so a migration inside a
   `__tests__` folder is still refused.

3. Keep the reason string shape. When it still refuses, it must name the offending path exactly as
   it does now.

## Do NOT

- Do **not** match on the substring `test`. `apps/api/src/rates/latest-rates.ts` contains it and is
  production code. The word must be bounded by a path separator or a file-extension pattern.
- Do **not** widen to `scripts/`, `__mocks__/`, fixtures, or snapshots. Only the three forms above.
- Do **not** remove or reorder the migration guard, and do not touch any other lane.
- Do **not** treat a DELETION of a test file as safe by a separate rule. This change is about where
  tests live, not about what may be done to them; deletions keep whatever treatment they have today.

## Verification

Unit tests against `classifyPolicyFiles` directly, under `scripts/pr-watcher/__tests__/`:

- **must pass (auto-merge allowed)** — `["scripts/pipeline/__tests__/check-breadcrumb.gitignored-sink.test.mjs"]`,
  the exact #1374 case, quoted from the log above.
- **must pass** — `["apps/web/src/components/__tests__/ShellLayout.nav.test.ts"]`.
- **must pass** — `["docs/pr-prompts/x.md"]`, unchanged behaviour.
- **must REFUSE** — `["apps/web/src/App.tsx"]`, naming that path. Ordinary source still reaches Marco.
- **must REFUSE** — `["apps/api/src/rates/latest-rates.ts"]`. This is the substring trap; if this
  case passes, the predicate is wrong however green the rest is.
- **must REFUSE** — `["apps/api/prisma/migrations/x/migration.sql", "scripts/x/__tests__/a.test.mjs"]`,
  with the reason naming the migration, proving the migration guard still runs first.
- **must REFUSE** — `[]`, empty diff, unchanged.

## Why this is worth doing at all

Marco's review time is the scarcest thing in this pipeline, and today it is being spent on PRs the
policy already considers safe. Meanwhile a genuinely misrouted PR is indistinguishable from a
correctly routed one, so the signal that is supposed to mean "a human must look at this" is diluted
by files that were never meant to trigger it.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR. An agent that exits without opening a PR has failed this
prompt, whatever its reasoning was.
