---
premise: '! grep -q NEVER_MERGE scripts/pr-watcher/merge-queue.mjs'
premise_means: scripts/pr-watcher/merge-queue.mjs squash-merges every PR number handed to it. It checks NOTHING - no never-merge list, no escalates flag, no do-not-merge label. It is not currently wired to anything, which is the only reason this has never fired. The moment two lanes start producing PRs concurrently the supervisor will want it, and wiring it as it stands would build an unguarded automatic merger over a codebase whose whole merge policy is "a human decides the dangerous ones".
scope:
  - scripts/pr-watcher/merge-queue.mjs
  - scripts/pr-watcher/__tests__/merge-queue-guards.test.mjs
  - docs/pipeline/DOCTRINE.md
done_when: grep -q NEVER_MERGE scripts/pr-watcher/merge-queue.mjs && node --test "scripts/pr-watcher/__tests__/*.mjs" && pnpm lint
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Cluster chaining SLICE 7 - guard `merge-queue.mjs` before anything wires it

Implements **SLICE 7** of `docs/plans/cluster-chaining-plan.md` (PR #1161). Read §3 and §4 SLICE 7.
This slice is **standalone** - it has no predecessor and touches no dispatch path, so it can run
alongside SLICES 2 and 3. Nothing in it shares a file with either.

## The gap, measured

[MEASURED] against `origin/main` @ `54559dad`, `scripts/pr-watcher/merge-queue.mjs` in full:

- Takes bare PR numbers from `argv`, waits for green, and calls `gh pr merge --squash`.
- Contains **zero** occurrences of `NEVER_MERGE`, `escalates`, or `do-not-merge`.
- `waitReady()` treats `BLOCKED` with green checks as an error to escalate - which is the ONLY
  thing standing between it and merging a `do-not-merge` PR, and it is incidental, not a guard.
- It has **no test file at all**.

## What to build

**1. A `NEVER_MERGE` list, and a refusal that fires before anything else.** Refuse the PR before
`view()`, before `waitReady()`, before any network call - the cheapest check, and the only one whose
failure is catastrophic. Refusal must exit **non-zero** and print the reason.

Default the list from `docs/pipeline/DOCTRINE.md`'s never-merge entries, overridable by env
(`PR_WATCHER_NEVER_MERGE`, comma-separated) for testing. **Do not hardcode a fourth divergent copy
without saying so** - see the divergence note below.

**2. Refuse a PR carrying any hold label.** `do-not-merge`, `needs-marco`, `hold`. Read them
per-PR with `gh pr view <n> --json labels` - **not** from a board listing, which renders labels
empty (LL-47). A label-read failure is a REFUSAL, not a pass: an unreadable label set is exactly the
state in which you must not merge.

The `do-not-merge` label is Marco's. The watcher applies it for `escalates: true` prompts
(`index.mjs` ~1256) and, since 2026-08-18, deliberately refuses to RE-apply it once a human has
removed it. This queue must never add it, never remove it, and never merge past it.

**3. Refuse a PR whose originating prompt carried `escalates: true`.** The queue receives PR
numbers, not prompts, so it cannot read the flag directly. The honest implementation is the label -
`escalates: true` is what causes `do-not-merge` to be applied - which rule 2 already covers.
**Say that plainly in a comment and in the PR body.** Do not write a function that claims to check
`escalates` while actually checking a label; a guard that overstates what it verifies is worse than
an absent one, because the next reader stops looking.

If you can cheaply and reliably map a PR back to its prompt (e.g. the watcher records the prompt
filename in the PR body or in `shepherd-state.md`), implement the direct check as well and test it.
If you cannot, say `NO-OP` on that sub-item specifically and explain why - do not invent a mapping.

**4. Structure it so it is testable.** The file today is a CLI with a top-level IIFE that runs on
import, so it cannot be imported by a test. Extract the refusal decision into a pure exported
function - `refusalFor({ pr, labels, neverMerge })` returning `null` or a reason string - and guard
the CLI entry point so importing the module does not execute the queue. Keep the extraction
minimal; do not restructure the merge loop.

**5. Record the guard in `docs/pipeline/DOCTRINE.md`** - one short subsection under the merge-policy
section stating that the JS merge queue refuses the never-merge list and any hold label, and that
merge authority still rests with the supervisor and Marco. This is the doc that the default list is
sourced from, so it must name the list.

## A divergence you will find - report it, do not silently fix it

[MEASURED] the never-merge list is **already inconsistent across four files** on `origin/main`:

- `scripts/pipeline/pipeline-lib.ps1:223` - `$script:NEVER_MERGE = @()` (EMPTY; #552 was discharged
  when it merged 2026-07-14, and the comment block at :196-206 records why)
- `scripts/pipeline/merge-queue.ps1:42` - `$NEVER = @(552, 538)`
- `scripts/pipeline/enable-automerge.ps1:22` - `$NEVER = @(552, 538)`
- `scripts/pipeline/monitor-board.ps1:13` - `$NEVER = @(552, 538)`

Three scripts still refuse a PR that merged a month ago, and the library that the board driver
actually calls refuses nothing. **Reconciling these is NOT in this slice's scope** - it spans four
PowerShell files and needs Marco's call on what the live list should contain. Put the finding in
your PR body as a flagged follow-up. Do not edit those files.

## Tests - `scripts/pr-watcher/__tests__/merge-queue-guards.test.mjs` (new)

Run with `node --test "scripts/pr-watcher/__tests__/*.mjs"` **with the quotes** - a bare directory
argument silently discovers nothing on this Node version (measured: exit 1, 0 tests). Baseline is
47 passing, 0 failing.

- a PR on `NEVER_MERGE` -> refused, reason names the list, **no `gh` call made**.
- a PR labelled `do-not-merge` -> refused.
- `needs-marco` -> refused. `hold` -> refused.
- a label read that throws -> refused (fail closed), reason says the labels were unreadable.
- a clean PR with no hold labels and not on the list -> `refusalFor` returns `null`.
- importing the module does **not** execute the queue.
- each refusal path exits non-zero and prints its reason.

## Do not

- Do not touch `sot/`. CP-24 hard-fails a PR mixing code and `sot/`.
- **Do not wire this queue to anything.** No cron, no watcher call site, no npm script that runs it
  automatically. Guarding it is this slice; wiring it is a separate decision that is Marco's.
- Do not add, remove, or re-apply any label.
- Do not merge any PR while testing. Use fixtures and stubs - never a live PR number.
- Do not touch `scripts/pr-watcher/index.mjs` or `scripts/pipeline/lint-prompt.mjs`; SLICES 2 and 3
  are running in parallel and own those files.

## Verification

    node --test "scripts/pr-watcher/__tests__/*.mjs"
    pnpm lint

Note for your report: **no CI workflow runs `scripts/pr-watcher/__tests__/`** [MEASURED - no match
for `pr-watcher`, `__tests__` or `node --test` in `.github/workflows/*.yml`]. Your local run is the
only thing executing these tests. State that in the PR body rather than implying CI covered you.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
