---
premise: '! grep -rq "pr-watcher/__tests__" .github/workflows'
premise_means: The watcher and intake-linter test suites are run by nobody. scripts/pr-watcher/__tests__/ holds 47 passing tests and scripts/pipeline/test-lint-prompt.mjs guards the ADMIT/BIN/REJECT gate for the whole queue - and no CI workflow references either. Every pipeline PR merges on the honour system, with the agent that wrote the tests being the only thing that ever ran them.
scope:
  - .github/workflows/ci.yml
done_when: grep -rq "pr-watcher/__tests__" .github/workflows && node --test "scripts/pr-watcher/__tests__/*.mjs" && node scripts/pipeline/test-lint-prompt.mjs
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# CI: actually run the pipeline test suites

## The gap, measured

[MEASURED] against `origin/main` @ `e994080d`:

- `.github/workflows/` contains exactly `ci.yml`, `deploy.yml`, `playwright.yml`.
- `git grep -n "node --test\|__tests__\|pr-watcher" origin/main -- .github` returns **nothing**.
- `scripts/pr-watcher/__tests__/` holds 11 spec files; `node --test "scripts/pr-watcher/__tests__/*.mjs"`
  passes **47 tests, 0 failures**.
- `node scripts/pipeline/test-lint-prompt.mjs` passes and exits 0.

So both suites are green and neither is enforced. Cluster-chaining SLICES 1, 2, 3 and 7 all ship
tests into these files. Nothing runs them on a PR.

## What to build

Add a job to `.github/workflows/ci.yml` that runs both suites:

    node --test "scripts/pr-watcher/__tests__/*.mjs"
    node scripts/pipeline/test-lint-prompt.mjs

**The quotes around the glob are load-bearing.** [MEASURED] `node --test scripts/pr-watcher/__tests__/`
with a bare directory argument exits **1 having discovered 0 tests** on this Node version - it looks
like a failure and is really a non-discovery. The quoted glob form works. Write it quoted and add a
comment saying why, or the next person will "simplify" it back.

Follow the conventions already in `ci.yml`: same Node version, same pnpm setup, same checkout. If
the repo uses a changed-path filter, **do NOT gate this job behind one** - the point is that a PR
touching `scripts/pr-watcher/**` cannot merge with these red, and a path filter that misfires would
silently restore exactly the hole this closes. A fast unconditional job is the safer shape.

Name the job so its purpose is obvious in the checks list, e.g. `Pipeline - watcher + linter tests`.

## Do not

- Do not make it a required status check. That is a **repository ruleset** change on the "Main"
  ruleset and it is **Marco's to make**, not an agent's. Say in the PR body that the job exists but
  is not yet required, and that making it required is a one-line change he can do in Settings.
- Do not modify any test to make it pass. Both suites are green as measured; if one goes red, that
  is a real finding - report it, do not weaken it.
- Do not touch `sot/`. Do not touch `deploy.yml` or `playwright.yml`.
- Do not add the job to a workflow that runs on `main` only - it must run on pull requests.

## Verification

Paste, in the PR body, the actual output of both commands run locally, and the job's result on this
PR. A green CI badge you did not read is not verification.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
