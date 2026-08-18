---
premise: '! grep -q requires_merged scripts/pipeline/lint-prompt.mjs'
premise_means: The intake linter has ZERO references to the dependency keys the watcher actually honours. A mistyped key - `requires-merged` with a hyphen, or the plural `requires_files_on_main` when the real key is singular - passes lint and the prompt then runs COMPLETELY UNGATED. That is the out-of-order mechanism, and it is silent.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/test-lint-prompt.mjs
  - docs/pr-prompts/PROMPT-SCHEMA.md
done_when: grep -q requires_merged scripts/pipeline/lint-prompt.mjs && node scripts/pipeline/test-lint-prompt.mjs && pnpm lint
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Cluster chaining SLICE 1 - the intake linter learns the dependency keys

Implements **SLICE 1** of `docs/plans/cluster-chaining-plan.md` (merged as PR #1161). Read that
plan's §2.2 and §4 before starting. This is the foundation slice: it has no predecessor, and
SLICE 2 declares a dependency on it.

## The gap, measured

[MEASURED] against `origin/main` @ `9395a4dd`:

- `scripts/pr-watcher/index.mjs` **honours** `requires_merged` (lines 860, 877) and
  `requires_file_on_main` (lines 863, 880), resolved in `unmetDependencies()` at line 920.
- `scripts/pipeline/lint-prompt.mjs` contains **zero** occurrences of either key.

So the watcher enforces a contract the linter has never heard of. A prompt that misspells the key
does not fail - it *silently loses its gate* and dispatches out of order.

## What to build

**1. Recognise the three dependency keys** in front-matter:

- `requires_merged: <n>` - a PR number.
- `requires_file_on_main: <path>`
- `requires_on_main: <path>` or `<path> :: <fixed-string>`

**2. Reject any unrecognised `requires*` key as `UNKNOWN_KEY`, with a suggestion.** This is the
whole point of the slice. The failures to catch are near-misses, not nonsense:

- `requires-merged:` (hyphen instead of underscore)
- `requires_files_on_main:` (plural - the real key is **singular**)
- `require_merged:`, `requires_merge:`, and anything else matching `requires?[-_]`

Suggest the nearest legal key by edit distance. A bare rejection makes the author guess.

**3. Validate the values, not just the names:**

- `requires_merged` must be a **positive integer**. Reject `0`, negatives, `#123`, `abc`, empty.
- `requires_file_on_main` / `requires_on_main` must have a **non-empty path**. Reject an empty
  value, which today would parse as "depends on nothing" and gate nothing.

**4. `requires_on_main` needs a WARNING, not silent acceptance.** The linter must accept the key
now so SLICE 2 can declare it on itself - but the watcher does **not** honour it until SLICE 2
lands. Accepting it silently would recreate this slice's own bug in a new place: a prompt that
looks gated and is not. Emit a warning along the lines of *"`requires_on_main` is accepted by the
linter but not yet honoured by the watcher (cluster-chaining SLICE 2). Until SLICE 2 is on main, a
prompt relying on it will run UNGATED."* Drop the warning when SLICE 2 lands.

**5. Document all three keys in `docs/pr-prompts/PROMPT-SCHEMA.md`** - name, value form, what the
watcher does with it, and the singular/plural trap called out explicitly.

## Tests - in `scripts/pipeline/test-lint-prompt.mjs`

Note the filename: the plan guessed `lint-prompt.test.mjs`; the file that actually exists is
`test-lint-prompt.mjs`. Use the real one.

Per the plan's acceptance criterion, **each negative test must be RED before the fix and GREEN
after** - demonstrate that, do not assert it.

- `requires-merged: 42` (hyphen) -> REJECTED as UNKNOWN_KEY. This is the plan's named case.
- `requires_files_on_main: x` (plural) -> REJECTED, suggests the singular.
- `requires_merged: 0` / `-1` / `abc` / empty -> REJECTED.
- `requires_file_on_main:` (empty) -> REJECTED.
- All three keys, well-formed -> ADMITTED.
- `requires_on_main:` well-formed -> ADMITTED **with the warning**.
- A prompt with none of these keys -> unchanged behaviour. **This matters most**: every prompt in
  the queue today lacks these keys, and none may start failing.

Do not weaken an existing assertion to go green.

## Do not break the linter's existing contract

`lint-prompt.mjs` is load-bearing - it is the ADMIT / BIN / REJECT gate for the whole queue, and
its exit codes are consumed by `queue-sync.ps1` (0=ADMIT, 3=STALE, 1=MALFORMED). **Do not change
any existing exit code or verdict name.** A new rejection reason is fine; a renumbered exit code
would silently reclassify every prompt in the queue.

Run the linter across the whole live queue before and after, and report any prompt whose verdict
CHANGES. A verdict change on an unrelated prompt is a regression, not a bonus catch.

## Housekeeping precondition - already discharged, do not re-open

The plan's SLICE 1 section requires Marco to first decide the fate of two rot-prompts that also
edit this file. [MEASURED] both are already retired - they sit in
`docs/pr-prompts/superseded/cleared-2026-08-17-premise-dead/`:

- `pr-pr-master-hardening-slice0-ready.md`
- `pr-gate-a-backfill-lint-rule-ready.md`

No prompt in the active queue touches `scripts/pipeline/lint-prompt.mjs`, so there is no scope
collision with this slice. Do not resurrect either prompt.

## Verification

    node scripts/pipeline/test-lint-prompt.mjs
    pnpm lint

Then run `node scripts/pipeline/lint-prompt.mjs` over every file in `docs/pr-prompts/*.md` and
paste the verdict counts before and after. They must be identical apart from any prompt that
genuinely carries a malformed dependency key.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
