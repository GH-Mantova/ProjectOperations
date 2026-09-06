---
premise: '! grep -q "PR_GATE_EVALUATED_V1" scripts/pipeline/lint-prompt.mjs'
premise_means: >-
  lint-prompt.mjs validates that `requires_merged` is a positive integer and then never looks at
  the PR again. Of the three legal dependency keys, two (`requires_on_main`,
  `requires_file_on_main`) are evaluated against origin/main by checkGateNotReleased; the third is
  not evaluated at all. So a HOLD gated on a PR that is still OPEN - or on a PR number that does
  not exist - returns a bare ADMIT, indistinguishable from a HOLD whose gate is genuinely
  satisfied. That breaks the post-condition checkGateNotReleased's own header states in prose:
  "the post-condition demands that a bare ADMIT means all declared gates are satisfied". It is
  also what PROMPT-SCHEMA.md:353 says already happens ("gh pr view N --json state must be
  MERGED"), so the schema documents a check that does not exist in this instrument.
scope:
  - scripts/pipeline/lint-prompt.mjs
  - scripts/pipeline/__tests__/lint-prompt.requires-merged-gate.test.mjs
  - docs/pr-prompts/PROMPT-SCHEMA.md
done_when: >-
  pnpm lint && node --test
  scripts/pipeline/__tests__/lint-prompt.requires-merged-gate.test.mjs && node
  scripts/pipeline/test-lint-prompt.mjs && grep -q "PR_GATE_EVALUATED_V1"
  scripts/pipeline/lint-prompt.mjs
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
rollback_strategy: >-
  One new rejection path in lint-prompt.mjs behind an injectable fetcher, one new test file, and
  one clarifying table row in PROMPT-SCHEMA.md. No schema, no migration, no data, no watcher
  change. `git revert` restores the previous behaviour exactly: the new code only ever turns a
  bare ADMIT into a REJECT for a prompt whose declared PR gate is provably unmet, so reverting
  can only make the linter more permissive, never less correct about anything it admits today.
---

# `requires_merged` is a gate nothing checks at arm time

## What is wrong

`scripts/pipeline/lint-prompt.mjs` treats `requires_merged` as a **format** rule, not a **gate**:

- `:29` lists it as a legal dependency key.
- `:124-150` rejects `0`, negatives, `abc`, empty - `REQUIRES_MERGED_INVALID`.
- `:321` says only that it "is a PR-number gate, not a name gate, so it is IGNORED" by the
  cluster-name check.
- **Nowhere does the file ask GitHub what state that PR is in.** `checkGateNotReleased`
  (`:817-925`) handles `requires_on_main` and `requires_file_on_main` and nothing else. The one
  `gh` call in the file, `ghFetchPrState` (`:1164-1165`), is reached only from
  `checkFixesPrTargetOpen` (`:1132`), which serves `fixes_pr`.

## The measurement (2026-09-03T18:2xZ, origin/main `e7f55174`)

Fixture experiment. One real prompt, `pr-e2e-container-s2-swap-required-job-HOLD.md`, copied to a
scratch directory three times with **only the PR number in `requires_merged` changed**, then
linted through the CLI:

```
requires_merged: 1317    (PR state = MERGED)                 -> lint exit 0
requires_merged: 1543    (PR state = OPEN)                   -> lint exit 0
requires_merged: 999999  (PR does not exist; gh errors)      -> lint exit 0
```

Reproduced twice, byte-identical both times. The MERGED case is the **positive control**: the
three verdicts are indistinguishable, so the ADMIT carries no information about the gate.

Deliberate, not accidental: `scripts/pipeline/test-lint-prompt.mjs:246` asserts
`"exit 0 ADMIT: requires_merged well-formed -> admitted (no path-gate check)"` with
`requires_merged: 42`, and `:674` asserts the same for an armed prompt.

## Honest scoping - what this does NOT claim

**Nothing on today's board is mis-gated.** All six depth-1 HOLDs carrying `requires_merged`
(`pr-dns-s5-checker-flip-to-fail`, `pr-e2e-container-s2-swap-required-job`,
`pr-pipeline-nodrift-agents-write-sweep-commits`, `pr-rates-11b2-resolver-isactive-surface`,
`pr-rates-consumers-s3-persona-export`, `pr-unified-api-key-vault-slice4c-retire-old-screens`)
name PRs that are **MERGED** - measured this run. This defect is **latent**, not operative.

**The work is not ungoverned.** `scripts/pr-watcher/index.mjs` DOES evaluate the gate at dispatch:
`unmetDependencies` (`:1230`) runs `gh pr view <n> --json state` per entry and fails **closed**,
and `hasDeclaredDependencies` is unit-tested at
`scripts/pr-watcher/__tests__/dispatch-gate.test.mjs`. So an armed prompt with an unmet
`requires_merged` is held by the watcher rather than run.

What is actually wrong is therefore narrow and real: **the arming path cannot see the gate.**
`arm-prompt.ps1` gates on `lint-prompt.mjs`, and `triage-holds.ps1` files every exit-0 prompt
under the heading `GATES SATISFIED -- lint ADMITs`. For a `requires_merged`-only prompt that
heading is a claim the instrument never checked. Station 00 chooses what to arm from that bucket.

## What to build

1. **Add a PR-state gate to `checkGateNotReleased`** (or a sibling `checkPrGateNotReleased` called
   next to it, so the existing function stays readable), marked:

   ```js
   // PR_GATE_EVALUATED_V1 - requires_merged is a GATE, not just a format rule.
   ```

   For each `requires_merged` entry, resolve the PR state and, when it is not `MERGED`, return
   `{ ok: false, code: "PR_GATE_NOT_RELEASED", msg: ... }` (REJECT, exit 1) naming the PR and the
   state actually seen. Use the same "This HOLD is parked waiting for its predecessor" /
   "This armed prompt cannot run yet" `stateLine` split the function already builds, and run it
   for HOLD **and** armed prompts alike, for the reason the `ARMED_GATE_STILL_CHECKED` comment
   already gives.

2. **Inject the fetcher; do not hard-call `gh` from inside the checker.** The file already has
   both halves of the pattern: `checkFixesPrTargetOpen({ fixesPr, fetchState })` takes an
   injectable `fetchState`, and `ghFetchPrState` (`:1164`) honours `process.env.LINT_GH_BIN`.
   Reuse both. The default path stays `gh`; tests pass a stub.

3. **FAIL SAFE when the instrument cannot answer.** If the fetch throws - no network, no auth,
   `gh` absent, PR unknown - write a `WARN ... skipping (fail-safe - not reporting gate as
   absent)` line to stderr and `continue`, exactly as the three `readFromOriginMain(...) === null`
   branches in this function already do. **Do not copy the watcher's fail-closed behaviour here.**
   The asymmetry is deliberate and worth a comment: the watcher's failure mode is "hold the run,
   try again next tick", which is free; the linter's failure mode is a verdict a human acts on,
   and DOCTRINE section 7 forbids a broken instrument from producing a negative finding.

4. **Add `scripts/pipeline/__tests__/lint-prompt.requires-merged-gate.test.mjs`** driving the
   exported checker with a stub `fetchState`:
   - `MERGED` -> ok (**positive control**: proves the check can pass, and is the regression test
     that today's six board prompts still admit)
   - `OPEN` -> `PR_GATE_NOT_RELEASED`
   - `CLOSED` -> `PR_GATE_NOT_RELEASED`
   - fetcher throws -> ok, **and** a WARN was emitted (the fail-safe control)
   - a list form `requires_merged: [a, b]` where one is MERGED and one is OPEN -> rejected

5. **Make the two existing CLI assertions deterministic.** `test-lint-prompt.mjs:246` and `:674`
   use `requires_merged: 42` and currently pass because nothing looks the PR up. Once the gate is
   live they would query GitHub from the test suite and start depending on network, auth and the
   state of PR #42. Point `LINT_GH_BIN` at a tiny stub that prints `{"state":"MERGED"}` for those
   two cases and keep both assertions at exit 0. **Do not delete or weaken them** - they are the
   regression tests for the admit path.

6. **One row in `docs/pr-prompts/PROMPT-SCHEMA.md`** saying, for each of the three dependency
   keys, WHO evaluates it (linter at arm time, watcher at dispatch, or both) and what each does
   when its probe cannot run. `:353` and `:391` currently describe watcher semantics in a table a
   reader will apply to the linter.

## What NOT to do

- **Do not touch `scripts/pr-watcher/index.mjs`.** The watcher's gate is correct and tested. This
  is a linter change only; two instruments in one PR makes both harder to revert.
- **Do not fold any assertion into `scripts/pr-gates/pr-gates.mjs`** - CP-26 failing there takes
  `PR gates - diff checks` down with it, one cause producing two reds.
- **Do not add an env escape hatch that disables the gate** (`LINT_SKIP_PR_GATE` or similar). A
  safety gate with an off switch is the gate that is off when it matters. `LINT_GH_BIN` already
  gives the tests everything they need.
- **Do not change `REQUIRES_MERGED_INVALID`** or any existing exit code. This adds a rejection
  path; it renames nothing.

## Why it is `-HOLD` with no dependency key

It has no predecessor. It is staged `-HOLD` because Station 04 may stage but never arm
(STATION-CAPABILITIES.md section 5). Station 00 arms it. Arming opens a `scripts/` PR, so the
policy classifier routes it to Marco and RULE 2 applies to the merge.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Build this in a disposable worktree off `origin/main`, run `pnpm build` and `pnpm lint`, open the
PR, and stop there. Do **not** merge it.
