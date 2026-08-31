---
premise: '! grep -q "hasDeclaredDependencies" scripts/pr-watcher/index.mjs'
premise_means: >-
  The dispatch loop decides whether to evaluate a prompt's gates with a condition that omits
  requiresOnMain. A prompt whose ONLY gate is requires_on_main therefore never reaches
  unmetDependencies and dispatches immediately, ungated, whatever is on origin/main. Every other
  layer of requires_on_main support is correct and tested; the hole is in the wiring between them.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/**
done_when: >-
  grep -q "hasDeclaredDependencies" scripts/pr-watcher/index.mjs && node --test
  "scripts/pr-watcher/__tests__/*.mjs"
size: 2
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: pipeline-hygiene
cluster_order: 1
rollback_strategy: >-
  One watcher module plus one new test file. No schema, no migration, no repo content, no CI change.
  Revert the commit and requires_on_main goes back to being an arming-time gate only.
---

# `requires_on_main` is not enforced at dispatch

## The defect

`scripts/pr-watcher/index.mjs`, in the dispatch loop:

```js
const deps = parseWatcherFrontMatter(promptBody);
if (deps.requiresMerged.length > 0 || deps.requiresFilesOnMain.length > 0) {
  const unmet = await unmetDependencies(deps);
  ...
}
```

`deps.requiresOnMain` is not in that condition.

Three layers of `requires_on_main` support exist and all three are correct:

- the parser populates `deps.requiresOnMain` (`readYamlFrontMatterDeps`, both the inline-scalar and
  indented-list forms);
- `unmetDependencies` evaluates it against `origin/main`, fails closed on a git error, and treats a
  malformed value as UNMET;
- `lint-prompt.mjs` rejects an unreleased gate at intake as `GATE_NOT_RELEASED`.

What does not exist is the call. The guard that *invokes* `unmetDependencies` never fires for a
prompt whose only declared gate is `requires_on_main`, so such a prompt is dispatched with no gate
evaluated at all. `PROMPT-SCHEMA.md` states that the watcher "DEFERS a prompt whose deps are unmet".
For this key it does not.

## Why the tests did not catch it

`scripts/pr-watcher/__tests__/watcher-frontmatter-deps.test.mjs` covers `parseWatcherFrontMatter`
(that `requiresOnMain` is populated) and the pure helpers `splitRequiresOnMainValue` and
`checkRequiresOnMain` (that a needle decides MET/UNMET correctly). Both halves are green. Nothing
asserts that a `requires_on_main`-only prompt is deferred at the dispatch site, which is the seam
where the two halves are joined.

## Why it matters more than it looks

`requires_merged` needs a PR number. In a chain-wired cluster the later slices are opened *by the
watcher*, so their PR numbers cannot be known when the prompts are authored. `requires_on_main` is
the only gate that can be declared forward, against an artifact a future PR will introduce — and it
is the one the dispatcher ignores. Chain-wire ordering is therefore currently enforced only at
arming time by the linter; once a set of gated prompts is armed, they all fire at once.

## Do

1. **Extract the condition into a named, exported predicate** in `scripts/pr-watcher/index.mjs`,
   placed immediately above `unmetDependencies`, and make it cover all three dependency keys. The
   identifier `hasDeclaredDependencies` must appear in the source — the premise and `done_when` grep
   for it.

   ```js
   export function hasDeclaredDependencies(deps) {
     if (!deps) return false;
     return (
       (deps.requiresMerged?.length ?? 0) > 0 ||
       (deps.requiresFilesOnMain?.length ?? 0) > 0 ||
       (deps.requiresOnMain?.length ?? 0) > 0
     );
   }
   ```

   Optional-chaining and the `?? 0` are deliberate: the predicate is called inside the dispatch loop
   and a throw there takes the watcher down. It must tolerate `null`, `undefined` and a partial
   object.

2. **Carry the reasoning in a comment above it.** Say that the condition used to be inline, that it
   omitted `requiresOnMain`, that both sides of the seam had passing tests, and that any future
   fourth dependency key must be added here or the same silent hole reopens. This is the only
   durable defence — the next author will read the function, not this prompt.

3. **Use it at the dispatch site**, replacing the inline condition:

   ```js
   if (hasDeclaredDependencies(deps)) {
   ```

4. **Report on-main gates in the success log.** The "all dependencies met" line names merged and
   files but not on-main gates, so a met content gate currently leaves no trace:

   ```js
   log("deps", `${name}: all dependencies met (merged: [${deps.requiresMerged.join(", ")}], files: ${deps.requiresFilesOnMain.length}, on-main: ${deps.requiresOnMain.length})`);
   ```

## Do NOT

- Do **not** change `unmetDependencies`, `checkRequiresOnMain`, `splitRequiresOnMainValue` or
  `readYamlFrontMatterDeps`. They are correct. The bug is the call site and nothing else.
- Do **not** change what happens when a gate IS unmet. The existing defer path — log, add to
  `deferredNames`, `writeQueueState()`, drop from `seen`, `drain()`, do not consume the file — is
  right and must be untouched.
- Do **not** make a prompt with no dependency keys start deferring. An ungated prompt must dispatch
  exactly as it does today; this is the regression that would stall the whole queue.
- Do **not** rewrite the existing `watcher-frontmatter-deps.test.mjs`. Add a new test file beside it.
- Do **not** touch `pollForBehindPrs`, the merge policy, `holdForMarco`, or the escalation label
  path.

## Verification

Add `scripts/pr-watcher/__tests__/dispatch-gate.test.mjs`. CI runs
`node --test "scripts/pr-watcher/__tests__/*.mjs"` (a glob, not a bare directory — see
`.github/workflows/ci.yml`), so a new `.mjs` file there is picked up automatically.

Required cases:

- **no dependency keys -> false.** The ungated prompt still dispatches immediately.
- **`requires_merged` alone -> true.**
- **`requires_file_on_main` alone -> true.**
- **`requires_on_main` alone -> true.** This is the regression. Label it as such in the test name.
- **all three together -> true.**
- **`null` / `undefined` -> false, no throw.**
- **partial object (`{}`, `{ escalates: true }`) -> false, no throw.**
- **end-to-end through the real parser:** feed `parseWatcherFrontMatter` a prompt body whose only
  gate is `requires_on_main: scripts/pipeline/arm-prompt.ps1 :: ARM_INDEX_RELEASED`, assert
  `requiresMerged` and `requiresFilesOnMain` are both empty, and assert `hasDeclaredDependencies`
  returns true. This is the exact prompt shape that was silently ungated.
- **end-to-end, ungated:** a body with `cluster` and `cluster_order` but no dependency key returns
  false.

**Negative control, recorded in the PR body.** Remove `requiresOnMain` from the predicate and re-run.
Exactly two tests must fail — "requires_on_main alone" and the end-to-end gated case — and the other
seven must pass. This control has already been run against the intended patch and produced
`# pass 7 / # fail 2`; reproduce it and paste the output. A test that passes either way is not a
test.

## Note for whoever merges this

The running watcher executes the code it was started with. This fix does not take effect for the
live queue until the watcher process is restarted after the merge. Say so in the PR body.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR. An agent that exits without opening a PR has failed this
prompt, whatever its reasoning was.
